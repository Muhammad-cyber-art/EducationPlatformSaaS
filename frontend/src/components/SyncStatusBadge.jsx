import React from 'react';
import { useSyncProgress } from '../hooks/useSyncProgress';
import { RefreshCw, Wifi, WifiOff, CloudUpload } from 'lucide-react';

/**
 * BUG FIX: SyncStatusBadge endi loyihaning CSS dizayn tizimiga (var(--*)) mos.
 * Oldingi versiyada Tailwind bg-neutral-900 va boshqa generic klasslari ishlatilgandi —
 * bu loyihaning dark/light theme almashinuvida noto'g'ri rang ko'rsatardi.
 *
 * Qo'shimcha: React.memo bilan keraksiz re-render oldini olinadi.
 */
const SyncStatusBadge = React.memo(function SyncStatusBadge() {
  const { isSyncing, isOnline, progress, pendingCount, triggerSync } = useSyncProgress();

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

      {/* Navbatdagi yozuvlar (Outbox) — faqat pending bo'lganda ko'rinadi */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 font-bold">
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

      {/* Qo'lda sinxronlash tugmasi */}
      <button
        onClick={triggerSync}
        disabled={isSyncing || !isOnline}
        title={isSyncing ? 'Sinxronlanmoqda...' : 'Hozir sinxronlash'}
        className="flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold transition-all active:scale-95 disabled:opacity-40"
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
          {isSyncing ? 'Yuklanmoqda' : 'Sync'}
        </span>
      </button>
    </div>
  );
});

export default SyncStatusBadge;
