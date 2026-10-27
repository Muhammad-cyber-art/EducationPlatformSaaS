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
    // 0. Agar login sahifasida bo'lsa — prefetch qilmaslik
    if (typeof window !== 'undefined' && window.location.pathname.includes('/login')) {
      return { success: false, reason: 'on_login_page' };
    }
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
      const storedBranch = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('active_branch_id') || localStorage.getItem('branch_id'))
        : null;
      const params = storedBranch ? { branch_id: storedBranch } : {};
      const res = await api.get('/finance/offline-bundle/', { params, timeout: 30000 });
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

        // 7. Filiallar Kassasi (Cashier Desk) — Guruhlar, O'quvchilar, Qarzdorlar va Roster
        if (data.cashier_desks && typeof data.cashier_desks === 'object') {
          for (const [branchId, deskData] of Object.entries(data.cashier_desks)) {
            const bIdNum = Number(branchId);
            const deskKey = `cashier-desk_${branchId}_${currentMonth}`;

            await db.query_cache.put({
              query_key: deskKey,
              data: deskData,
              updated_at: nowIso,
            });

            if (this.queryClient) {
              this.queryClient.setQueryData(['cashier-desk', bIdNum, currentMonth], deskData);
              this.queryClient.setQueryData(['cashier-desk', String(branchId), currentMonth], deskData);
            }

            // O'quvchilarning drill-down to'lov detallarini oflayn keshga tayyorlab qo'yish
            if (deskData.rosters) {
              for (const [groupId, roster] of Object.entries(deskData.rosters)) {
                if (Array.isArray(roster.students)) {
                  for (const st of roster.students) {
                    const detailKey = `cashier-student-detail_${st.student_id}_${groupId}_${currentMonth}`;
                    const detailData = {
                      student: {
                        id: st.student_id,
                        full_name: st.student_name,
                        phone: st.student_phone,
                        parent_phone: st.parent_phone,
                        status: st.status,
                        status_display: st.status_display,
                      },
                      target_group: {
                        id: st.group_id,
                        name: st.group_name,
                        monthly_price: st.expected_amount,
                        remaining_amount: st.remaining_amount,
                        paid_amount: st.paid_amount,
                        is_paid: st.is_paid,
                        is_partial: st.is_partial,
                        payment_id: st.payment_id,
                      },
                      all_active_groups: [
                        {
                          group_id: st.group_id,
                          group_name: st.group_name,
                          monthly_price: st.expected_amount,
                          remaining_amount: st.remaining_amount,
                          paid_amount: st.paid_amount,
                          is_paid: st.is_paid,
                          payment_id: st.payment_id,
                        },
                        ...(st.other_groups || []).map((og) => ({
                          group_id: og.group_id,
                          group_name: og.group_name,
                          monthly_price: og.monthly_price,
                          remaining_amount: og.monthly_price,
                          paid_amount: 0,
                          is_paid: false,
                        })),
                      ],
                    };
                    await db.query_cache.put({
                      query_key: detailKey,
                      data: detailData,
                      updated_at: nowIso,
                    });
                  }
                }
              }
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

    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // 1. Sahifa ochilgandan 16 soniya o'tib birinchi yuklash (attendanceBundle 6s da boshlanib tugashini kutadi)
    setTimeout(() => {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && localStorage.getItem('access_token')) {
        this.prefetchFinanceBundle();
      }
    }, 16000);

    // 2. Internet tiklanganda yangilash
    //    BUG FIX: 7 soniya kutib — syncService (1.5s) tugatganidan keyin, attendanceService (10s) dan oldin
    this._onlineHandler = () => {
      setTimeout(() => {
        if (localStorage.getItem('access_token')) {
          this.prefetchFinanceBundle();
        }
      }, 7000);
    };
    window.addEventListener('online', this._onlineHandler);

    // 3. Har 20 daqiqada orqa fonda yangilab turish (faqat tab ko'rinib turganda)
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      if (
        typeof navigator !== 'undefined' &&
        navigator.onLine &&
        localStorage.getItem('access_token') &&
        (typeof document === 'undefined' || document.visibilityState === 'visible')
      ) {
        this.prefetchFinanceBundle();
      }
    }, 20 * 60 * 1000);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this._onlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this._onlineHandler);
      this._onlineHandler = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }
}

export const financeOfflineService = new FinanceOfflineService();
