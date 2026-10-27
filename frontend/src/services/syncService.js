import api from '../tokenUpdater/updater';
import { db, requestPersistentStorage, incrementSyncQueueRetry, runFullCleanup } from '../db/db';

const SYNC_ENDPOINT = 'v1/sync/';
const CHUNK_BATCH_SIZE = 500;

/**
 * BUG FIX #1: setInterval leak — faqat bitta global interval yaratish.
 * Har sahifa reload bo'lganda yangi interval yaralib, eski ham ishlashda davom etadi.
 * Singleton pattern orqali bu muammo hal qilinadi.
 */
let _syncManagerInstance = null;

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.listeners = new Set();
    this._intervalId = null;
    this._initialized = false;
  }

  /**
   * BUG FIX #2: init() faqat bir marta chaqiriladi (idempotent).
   * Har safar SyncManager import qilinganda qayta-qayta ishlamasligi uchun.
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;
    this._initNetworkListeners();
    // Android Chrome va Desktop brauzerlarida IndexedDB o'chib ketmasligi uchun
    requestPersistentStorage();
  }

  /**
   * Sinxronizatsiya holatini kuzatuvchi obunachilar (Subscribers)
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event, data) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, data);
      } catch (err) {
        // Production da xato listener butun sinxronizatsiyani to'xtatmasin
        if (import.meta.env.DEV) {
          console.error('[SyncManager] Listener error:', err);
        }
      }
    });
  }

  /**
   * BUG FIX #3: Tarmoq ulanishini eshituvchi — faqat bir marta ro'yxatdan o'tish.
   * Xotira sizishini (memory leak) oldini olish uchun intervalId saqlanadi.
   */
  _initNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.notify('network_status', { isOnline: true });
      // Kichik kechikish: tarmoq to'liq tiklangunga qadar kutish
      // BUG FIX: Ketma-ket (sequential) yuklash — 3 ta parallel og'ir so'rov o'rniga
      setTimeout(async () => {
        try {
          await this.synchronize();
        } catch (_) {}
        // Attendance va Finance prefetch — syncService tugatgandan keyin
        // (attendanceOfflineService va financeOfflineService o'zlarining 'online' listenerlariga ega)
      }, 1500);
    });

    window.addEventListener('offline', () => {
      this.notify('network_status', { isOnline: false });
    });

    // BUG FIX #4: Faqat bir intervalId saqlab, ikki marta yaratilishini oldini olish
    if (this._intervalId) {
      clearInterval(this._intervalId);
    }
    this._intervalId = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine && !this.isSyncing) {
        this.synchronize();
      }
    }, 2 * 60 * 1000); // har 2 daqiqada
  }

  /**
   * BUG FIX #5: pushChanges — network xatolikda avval navbat elementlarini
   * "failed" deb belgilash, lekin navbatdan o'chirmaslik.
   * Internet yo'q bo'lganda api.post() xatolik tashlaydi — bu endi gracefully ushlaydi.
   */
  async pushChanges() {
    const queueItems = await db.sync_queue
      .where('status')
      .equals('pending')
      .sortBy('created_at');

    if (queueItems.length === 0) return { pushedCount: 0 };

    this.notify('push_start', { totalToPush: queueItems.length });

    let response;
    try {
      response = await api.post(SYNC_ENDPOINT, {
        mutations: queueItems.map((item) => ({
          queue_id: String(item.queue_id),
          action: item.action,
          entity: item.entity,
          data: item.data,
          client_timestamp: item.created_at,
        })),
      });
    } catch (error) {
      // Internet yo'q yoki server javob bermasa — bu XATO emas, keyinroq qayta uriniladi.
      // Notify qilamiz, lekin throw qilmaymiz (synchronize() ning catch-iga tushmaydi)
      const isNetworkError =
        !error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';

      if (isNetworkError) {
        this.notify('push_skipped', { reason: 'Tarmoq aloqasi yo\'q, keyinroq qayta uriniladi' });
        return { pushedCount: 0 };
      }

      // BUG FIX: Server xatolik qaytarsa (500, 422, etc.), navbatdagi yozuvlarning
      // retry_count ini oshiramiz. 5 martadan keyin "failed" ga o'tkaziladi.
      for (const item of queueItems) {
        try {
          await incrementSyncQueueRetry(item.queue_id, 5);
        } catch (_) {}
      }
      this.notify('push_error', { error: error.message });
      throw error;
    }

    const { applied_queue_ids = [], conflicts = [] } = response.data || {};

    // BUG FIX: Agar serverda yangiroq ma'lumot bo'lsa (server_wins), lokal bazaga serverning
    // eng so'nggi to'g'ri holatini yozib qo'yamiz (stale data qolib ketishini oldini oladi)
    if (conflicts.length > 0) {
      for (const conflict of conflicts) {
        if (conflict.server_record && conflict.server_record.id) {
          await db.leads.put(conflict.server_record);
        }
      }
    }

    // Server qabul qilgan amallarni lokal navbatdan o'chirish
    if (applied_queue_ids.length > 0) {
      const idsToDelete = applied_queue_ids.map(Number);
      await db.sync_queue.bulkDelete(idsToDelete);

      // Agar kassa/to'lovlar sinxronlangan bo'lsa, moliya keshini serverdan yangilab olamiz
      const hasFinanceSync = queueItems.some(
        (it) => it.entity === 'cashier_payment' || it.entity === 'admin_expense' || it.entity === 'student_payment'
      );
      if (hasFinanceSync) {
        import('./financeOfflineService')
          .then(({ financeOfflineService }) => {
            financeOfflineService.prefetchFinanceBundle().catch(() => {});
          })
          .catch(() => {});
      }
    }

    this.notify('push_success', { pushedCount: applied_queue_ids.length });
    return { pushedCount: applied_queue_ids.length };
  }

  /**
   * BUG FIX: pullChanges — faqat barcha bo'laklar to'liq olingandagina
   * last_pulled_at vaqti yangilanadi. Chala uzilishda data loss bo'lmaydi.
   */
  async pullChanges(onProgress) {
    const metaRecord = await db.sync_meta.get('last_pulled_at');
    const lastPulledAt = metaRecord ? metaRecord.value : null;

    let cursor = null;
    let hasMore = true;
    let totalFetched = 0;
    let newServerTime = null;
    let pullCompleted = false;

    this.notify('pull_start', { isInitial: !lastPulledAt });

    while (hasMore) {
      const params = {
        batch_size: CHUNK_BATCH_SIZE,
      };
      if (lastPulledAt) params.last_pulled_at = lastPulledAt;
      if (cursor) params.cursor = cursor;

      let response;
      try {
        response = await api.get(SYNC_ENDPOINT, { params });
      } catch (error) {
        const isNetworkError =
          !error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';

        if (isNetworkError) {
          this.notify('pull_skipped', { reason: 'Tarmoq aloqasi yo\'q' });
          break; // Sikldan chiqib ketamiz, keyingi marta qayta urinadi
        }

        this.notify('pull_error', { error: error.message });
        throw error;
      }

      const {
        items = [],
        has_more = false,
        next_cursor = null,
        server_time,
        total_count = 0,
      } = response.data || {};

      newServerTime = server_time;

      if (items && items.length > 0) {
        await db.transaction('rw', db.leads, async () => {
          await db.leads.bulkPut(items);
        });

        totalFetched += items.length;

        const percent =
          total_count > 0 ? Math.min(100, Math.round((totalFetched / total_count) * 100)) : 100;

        if (onProgress) {
          onProgress({ fetched: totalFetched, total: total_count, percent });
        }
        this.notify('pull_progress', { fetched: totalFetched, total: total_count, percent });
      }

      if (!has_more) {
        pullCompleted = true;
      }

      hasMore = has_more;
      cursor = next_cursor;
    }

    // BUG FIX: Faqat butun oqim to'liq muvaffaqiyatli yakunlangandagina commit qilinadi
    if (pullCompleted && newServerTime) {
      await db.sync_meta.put({ key: 'last_pulled_at', value: newServerTime });
    }

    this.notify('pull_success', { totalFetched });
    return { totalFetched };
  }

  /**
   * ASOSIY METOD: To'liq 2 tomonlama sinxronizatsiya.
   */
  async synchronize(onProgress) {
    // 1. Agar foydalanuvchi tizimga kirmagan bo'lsa (masalan /login sahifasida), sync to'xtatiladi
    if (typeof localStorage === 'undefined' || !localStorage.getItem('access_token')) {
      return { success: false, reason: 'unauthenticated' };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notify('sync_skipped', { reason: 'Internet mavjud emas' });
      return { success: false, reason: 'offline' };
    }

    if (this.isSyncing) {
      return { success: false, reason: 'already_syncing' };
    }

    this.isSyncing = true;
    this.notify('sync_start', {});

    try {
      // 1. Avval lokal o'zgarishlar serverga yuboriladi (Push)
      await this.pushChanges();

      // 2. So'ngra serverdagi yangilanishlar tortib olinadi (Pull)
      await this.pullChanges(onProgress);

      this.notify('sync_complete', { success: true });

      // BUG FIX: Muvaffaqiyatli sinxronizatsiyadan keyin eskirgan yozuvlarni tozalash
      runFullCleanup().catch(() => {});

      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[SyncManager] Sync failed:', error);
      }
      this.notify('sync_failed', { error: error?.message || 'Noma\'lum xato' });
      return { success: false, error: error?.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Barcha resurslarni tozalash (React Strict Mode da komponent unmount bo'lganda)
   */
  destroy() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this.listeners.clear();
    this._initialized = false;
  }
}

// Singleton: Butun ilovada faqat BITTA SyncManager nusxasi bo'ladi
if (!_syncManagerInstance) {
  _syncManagerInstance = new SyncManager();
  // Tarmoq listenerlarini darhol ishga tushirish
  _syncManagerInstance.init();
}

export const syncService = _syncManagerInstance;
