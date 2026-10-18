import api from '../tokenUpdater/updater';
import { db } from '../db/db';

/**
 * Finance & Kassa Offline Service
 *
 * Tizimga kirganda orqa fonda butun kassa, to'lovlar va filiallar ma'lumotlarini
 * mahalliy IndexedDB (Dexie) keshiga yuklaydi.
 * Internet bo'lmaganda Kassa va talaba to'lovlari to'liq oflayn ishlaydi.
 */
class FinanceOfflineService {
  constructor() {
    this.queryClient = null;
    this.isPrefetching = false;
    this.lastPrefetchedAt = null;
    this.intervalId = null;
    this.listeners = new Set();
  }

  setQueryClient(queryClient) {
    this.queryClient = queryClient;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event, data) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, data);
      } catch (e) {}
    });
  }

  /**
   * Kassa va to'lovlar paketini orqa fonda yuklab, IndexedDB ga saqlash
   */
  async prefetchFinanceBundle() {
    if (this.isPrefetching) return { success: false, reason: 'already_running' };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, reason: 'offline' };
    }
    if (typeof localStorage === 'undefined' || !localStorage.getItem('access_token')) {
      return { success: false, reason: 'unauthenticated' };
    }

    this.isPrefetching = true;
    this.notify('finance_prefetch_start', {});

    try {
      const res = await api.get('/finance/offline-bundle/');
      const data = res.data;
      if (!data) return { success: false, reason: 'empty_response' };

      const nowIso = new Date().toISOString();
      const currentMonth = data.current_month;
      const todayDate = data.current_date;

      await db.transaction('rw', [db.query_cache, db.sync_meta], async () => {
        // 1. Bugungi kassa statistikasi
        if (data.today_stats) {
          await db.query_cache.put({
            query_key: 'kassa_today_stats_all',
            data: data.today_stats,
            updated_at: nowIso,
          });

          await db.query_cache.put({
            query_key: `kassa_today_stats_${todayDate}`,
            data: data.today_stats,
            updated_at: nowIso,
          });
        }

        // 2. Bugungi daromad va chiqimlar (Kassa page 1000 items)
        if (data.today_incomes) {
          await db.query_cache.put({
            query_key: `kassa_incomes_${todayDate}`,
            data: data.today_incomes,
            updated_at: nowIso,
          });
        }
        if (data.today_expenses) {
          await db.query_cache.put({
            query_key: `kassa_expenses_${todayDate}`,
            data: data.today_expenses,
            updated_at: nowIso,
          });
        }

        // 3. Joriy oydagi daromadlar (Incomes)
        if (data.month_incomes) {
          await db.query_cache.put({
            query_key: `kassa_incomes_${currentMonth}_all`,
            data: data.month_incomes,
            updated_at: nowIso,
          });

          await db.query_cache.put({
            query_key: `kassa_incomes_${currentMonth}`,
            data: data.month_incomes,
            updated_at: nowIso,
          });
        }

        // 4. Joriy oydagi chiqimlar (Expenses / Withdrawals)
        if (data.month_expenses) {
          await db.query_cache.put({
            query_key: `kassa_expenses_${currentMonth}_all`,
            data: data.month_expenses,
            updated_at: nowIso,
          });

          await db.query_cache.put({
            query_key: `kassa_expenses_${currentMonth}`,
            data: data.month_expenses,
            updated_at: nowIso,
          });
        }

        // 5. Filiallar
        if (data.branches && data.branches.length > 0) {
          await db.query_cache.put({
            query_key: 'branches_list',
            data: data.branches,
            updated_at: nowIso,
          });
        }

        // 6. O'quvchilarning so'nggi to'lovlari (student-payments)
        if (data.student_payments && data.student_payments.length > 0) {
          const paymentsByStudent = new Map();
          data.student_payments.forEach((p) => {
            const sId = Number(p.student?.id || p.student);
            if (sId) {
              if (!paymentsByStudent.has(sId)) paymentsByStudent.set(sId, []);
              paymentsByStudent.get(sId).push(p);
            }
          });

          for (const [sId, pList] of paymentsByStudent.entries()) {
            await db.query_cache.put({
              query_key: `payments-all_${sId}`,
              data: pList,
              updated_at: nowIso,
            });

            await db.query_cache.put({
              query_key: `student-history_${sId}`,
              data: { monthly_payments: pList },
              updated_at: nowIso,
            });

            if (this.queryClient) {
              this.queryClient.setQueryData(['payments-all', String(sId)], pList);
              this.queryClient.setQueryData(['payments-all', Number(sId)], pList);
              this.queryClient.setQueryData(['student-history', String(sId)], { monthly_payments: pList });
              this.queryClient.setQueryData(['student-history', Number(sId)], { monthly_payments: pList });
            }
          }
        }

        await db.sync_meta.put({
          key: 'last_finance_prefetched_at',
          value: nowIso,
        });
      });

      this.lastPrefetchedAt = nowIso;
      this.notify('finance_prefetch_complete', { timestamp: nowIso });
      return { success: true };
    } catch (error) {
      console.warn('[FinanceOfflineService] prefetch error:', error?.message);
      this.notify('finance_prefetch_error', { error: error?.message });
      return { success: false, error: error?.message };
    } finally {
      this.isPrefetching = false;
    }
  }

  /**
   * Background monitoring va intervalni ishga tushirish
   */
  init(queryClient) {
    if (queryClient) {
      this.setQueryClient(queryClient);
    }

    if (typeof window === 'undefined') return;

    // 1. Sahifa ochilgandan 3 soniya o'tib birinchi yuklash
    setTimeout(() => {
      if (localStorage.getItem('access_token')) {
        this.prefetchFinanceBundle();
      }
    }, 3500);

    // 2. Internet tiklanganda yangilash
    window.addEventListener('online', () => {
      setTimeout(() => {
        if (localStorage.getItem('access_token')) {
          this.prefetchFinanceBundle();
        }
      }, 4000);
    });

    // 3. Har 20 daqiqada orqa fonda yangilab turish
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && localStorage.getItem('access_token')) {
        this.prefetchFinanceBundle();
      }
    }, 20 * 60 * 1000);
  }
}

export const financeOfflineService = new FinanceOfflineService();
