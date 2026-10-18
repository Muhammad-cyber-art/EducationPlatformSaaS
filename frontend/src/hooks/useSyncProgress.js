import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { syncService } from '../services/syncService';

/**
 * BUG FIX: useSyncProgress hook endi to'g'ri cleanup qiladi.
 *
 * Oldingi versiyada:
 * - isOnline holati navigator.onLine bilan bir marta o'qilar, keyin eski qolardi.
 * - React StrictMode da ikki marta subscribe bo'lib, listener chiqib ketmay qolardi.
 *
 * Hozirgi versiyada:
 * - window online/offline eventlari ham kuzatiladi (ikki qavatli xavfsizlik)
 * - useRef orqali stale closure muammosi hal qilinadi
 * - Barcha eventListener-lar cleanup qilinadi
 */
export function useSyncProgress() {
  const [isSyncing, setIsSyncing] = useState(syncService.isSyncing);
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
    const unsubscribe = syncService.subscribe((event, data) => {
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
          setIsSyncing(false);
          break;
        case 'network_status':
          setIsOnline(data.isOnline);
          break;
        default:
          break;
      }
    });

    // 2. BUG FIX: window eventlari ham kuzatiladi — SyncService notify-dan mustaqil
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
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = useCallback(() => {
    syncService.synchronize();
  }, []);

  return {
    isSyncing,
    isOnline,
    progress,
    pendingCount,
    triggerSync,
  };
}
