import React, { useState, useEffect } from 'react';
import { useSyncProgress } from '../hooks/useSyncProgress';
import { RefreshCw, Wifi, WifiOff, CloudUpload, Database } from 'lucide-react';

/**
 * SyncStatusBadge:
 * Tarmoq holati (Online/Offline), outbox navbati, va eng muhimi —
 * serverdagi bazani lokal IndexedDB ga to'liq nusxalab olish (Local DB Copy) tugmasi.
 */
const SyncStatusBadge = React.memo(function SyncStatusBadge() {
  const { isSyncing, isOnline, progress, pendingCount, triggerSync } = useSyncProgress();
  const [dbStatus, setDbStatus] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('local_db_status') || 'null');
    } catch (_) {
      return null;
    }
  });

  useEffect(() => {
    if (!isSyncing) {
      const timer = setTimeout(() => {
        try {
          setDbStatus(JSON.parse(localStorage.getItem('local_db_status') || 'null'));
        } catch (_) {
          // ignore parsing error
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isSyncing]);

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded-xl border text-xs"
      style={{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-glass)',
        color: 'var(--text-secondary)',
      }}
    >
      {/* Tarmoq indikatori */}
      <div
        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider transition-all ${
          isOnline
            ? 'text-emerald-400 bg-emerald-500/10'
            : 'text-rose-400 bg-rose-500/10'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi size={11} className="animate-pulse" />
            <span className="text-[9px]">Online</span>
          </>
        ) : (
          <>
            <WifiOff size={11} />
            <span className="text-[9px]">Offline</span>
          </>
        )}
      </div>

      {/* Lokal Baza Nusxasi Statusi */}
      {dbStatus?.groups_count > 0 && (
        <div
          className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold"
          title={`Lokal bazada ${dbStatus.groups_count} ta guruh va ${dbStatus.students_count || 0} ta o'quvchi nusxalangan`}
        >
          <Database size={10} />
          <span className="text-[9px] font-mono">{dbStatus.groups_count} guruh nusxalangan</span>
        </div>
      )}

      {/* Navbatdagi yozuvlar (Outbox) — faqat pending bo'lganda ko'rinadi */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 font-bold" title="Serverga yuborilishi kutilayotgan amallar soni">
          <CloudUpload size={11} />
          <span className="text-[9px]">{pendingCount}</span>
        </div>
      )}

      {/* Progress bar (faqat sinxronizatsiya davomida) */}
      {isSyncing && progress.total > 0 && (
        <div className="flex items-center gap-1.5 min-w-[100px]">
          <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {progress.percent}%
          </span>
        </div>
      )}

      {/* Serverdagi bazani lokal xotiraga nusxalash tugmasi */}
      <button
        onClick={triggerSync}
        disabled={isSyncing || !isOnline}
        title={isSyncing ? "Serverdagi baza lokal xotiraga nusxalanmoqda..." : "Serverdagi barcha guruhlar, o'quvchilar va davomatlarni lokal xotiraga to'liq nusxalab olish"}
        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-bold transition-all active:scale-95 disabled:opacity-40 hover:border-[var(--gold)]/40"
        style={{
          background: 'var(--bg-void)',
          border: '1px solid var(--border-glass)',
          color: 'var(--text-primary)',
        }}
      >
        <RefreshCw
          size={10}
          className={isSyncing ? 'animate-spin text-blue-400' : ''}
        />
        <span className="text-[9px]">
          {isSyncing ? 'Nusxalanmoqda...' : 'Bazani nusxalash'}
        </span>
      </button>
    </div>
  );
});

export default SyncStatusBadge;
