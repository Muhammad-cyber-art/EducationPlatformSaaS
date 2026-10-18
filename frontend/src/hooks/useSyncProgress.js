import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { syncService } from '../services/syncService';
import { attendanceOfflineService } from '../services/attendanceOfflineService';
import { financeOfflineService } from '../services/financeOfflineService';
import toast from 'react-hot-toast';

/**
 * useSyncProgress hook:
 * - Leads va oflayn mutatsiyalarni (syncService) kuzatadi
 * - Davomat, guruhlar va o'quvchilar ro'yxatini (attendanceOfflineService) orqa fonda yuklash holatini ko'rsatadi
 * - Moliya va Kassa ma'lumotlarini (financeOfflineService) orqa fonda yuklash holatini ko'rsatadi
 * - [Sync] tugmasi bosilganda barcha ma'lumotlarni bir vaqtda serverdan tortib oladi
 */
export function useSyncProgress() {
  const [isSyncing, setIsSyncing] = useState(
    syncService.isSyncing || attendanceOfflineService.isPrefetching || financeOfflineService.isPrefetching
  );
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [progress, setProgress] = useState({ fetched: 0, total: 0, percent: 0 });

  // useRef: komponent unmount bo'lganda stale setState chaqirilmaslik uchun
  const mountedRef = useRef(true);

  // Navbatdagi amallar soni — reaktiv (sync_queue o'zgarsa darhol yangilanadi)
  const pendingCount =
    useLiveQuery(async () => {
      return await db.sync_queue.where('status').equals('pending').count();
    }, []) ?? 0;

  useEffect(() => {
    mountedRef.current = true;

    // 1. SyncService eventlarini eshitish
    const unsubscribeSync = syncService.subscribe((event, data) => {
      if (!mountedRef.current) return;

      switch (event) {
        case 'sync_start':
          setIsSyncing(true);
          setProgress({ fetched: 0, total: 0, percent: 0 });
          break;
        case 'pull_progress':
          setProgress(data);
          break;
        case 'sync_complete':
        case 'sync_failed':
        case 'sync_skipped':
          if (!attendanceOfflineService.isPrefetching && !financeOfflineService.isPrefetching) {
            setIsSyncing(false);
          }
          break;
        case 'network_status':
          setIsOnline(data.isOnline);
          break;
        default:
          break;
      }
    });

    // 2. AttendanceOfflineService (guruhlar, o'quvchilar, davomat) eventlarini eshitish
    const unsubscribeAttendance = attendanceOfflineService.subscribe((event) => {
      if (!mountedRef.current) return;

      if (event === 'prefetch_start') {
        setIsSyncing(true);
      } else if (event === 'prefetch_complete' || event === 'prefetch_error') {
        if (!syncService.isSyncing && !financeOfflineService.isPrefetching) {
          setIsSyncing(false);
        }
      }
    });

    // 3. FinanceOfflineService (kassa, to'lovlar, filiallar) eventlarini eshitish
    const unsubscribeFinance = financeOfflineService.subscribe((event) => {
      if (!mountedRef.current) return;

      if (event === 'finance_prefetch_start') {
        setIsSyncing(true);
      } else if (event === 'finance_prefetch_complete' || event === 'finance_prefetch_error') {
        if (!syncService.isSyncing && !attendanceOfflineService.isPrefetching) {
          setIsSyncing(false);
        }
      }
    });

    // 4. Window network eventlari
    const handleOnline = () => {
      if (mountedRef.current) setIsOnline(true);
    };
    const handleOffline = () => {
      if (mountedRef.current) setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mountedRef.current = false;
      unsubscribeSync();
      unsubscribeAttendance();
      unsubscribeFinance();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    const toastId = toast.loading("Baza lokal xotiraga nusxalanmoqda...");
    try {
      const results = await Promise.allSettled([
        syncService.synchronize(),
        attendanceOfflineService.prefetchBundle(true),
        financeOfflineService.prefetchFinanceBundle(),
      ]);

      const attRes = results[1]?.status === 'fulfilled' ? results[1].value : null;
      const count = attRes?.count ?? 0;
      const students = attRes?.studentsCount ?? 0;

      toast.success(
        `Lokal baza nusxalandi! (${count} ta guruh, ${students} ta o'quvchi)`,
        { id: toastId, icon: "💾", duration: 4000 }
      );
    } catch (err) {
      console.warn("Manual sync error:", err);
      toast.error("Baza nusxalashda xatolik yuz berdi", { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline]);

  return {
    isSyncing,
    isOnline,
    progress,
    pendingCount,
    triggerSync,
  };
}
