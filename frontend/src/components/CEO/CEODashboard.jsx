import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAnalytics } from '../../store/slices/ceoSlice';

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon, color = 'var(--gold)', trend }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: 'var(--card-bg)',
        border:     '1px solid var(--border-glass)',
        boxShadow:  '0 4px 20px rgba(0,0,0,0.2)',
      }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-3xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{value ?? '—'}</p>
          {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18`, color }}>
          {icon}
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 text-xs font-medium"
          style={{ color: trend >= 0 ? '#4ade80' : '#f87171' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)} bu oy
        </div>
      )}
    </div>
  );
}

// ── MRR Bar ───────────────────────────────────────────────────────────────────
function MiniBarChart({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.mrr), 1);

  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div className="w-full rounded-t-md transition-all duration-500"
            style={{
              height:     `${(d.mrr / max) * 88}px`,
              minHeight:  '4px',
              background: i === data.length - 1
                ? 'var(--gold)'
                : 'linear-gradient(180deg, rgba(184,134,11,0.5) 0%, rgba(184,134,11,0.15) 100%)',
            }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
            {d.month?.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Plan Pill ─────────────────────────────────────────────────────────────────
function PlanBadge({ plan, count }) {
  const colors = {
    starter:    { bg: 'rgba(99,102,241,0.12)',  color: '#a5b4fc' },
    pro:        { bg: 'rgba(184,134,11,0.12)',  color: 'var(--gold)' },
    enterprise: { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
  };
  const c = colors[plan] || colors.starter;
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{ background: c.bg, border: `1px solid ${c.color}30` }}>
      <span className="text-sm font-semibold capitalize" style={{ color: c.color }}>{plan}</span>
      <span className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{count}</span>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return (
    <div className={`rounded-xl animate-pulse ${className}`}
      style={{ background: 'var(--border-glass)' }} />
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function CEODashboard() {
  const dispatch   = useDispatch();
  const { analytics, analyticsLoading } = useSelector((s) => s.ceo);

  useEffect(() => { dispatch(fetchAnalytics()); }, [dispatch]);

  const a = analytics;

  const formatMRR = (val) => {
    if (!val && val !== 0) return '—';
    const n = Number(val);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M so'm`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K so'm`;
    return `${n} so'm`;
  };

  return (
    <div className="p-6 space-y-6 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Platform Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Barcha o'quv markazlar umumiy holati
          </p>
        </div>
        <button onClick={() => dispatch(fetchAnalytics())}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: 'var(--gold-dim)',
            border:     '1px solid var(--gold)',
            color:      'var(--gold)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(184,134,11,0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--gold-dim)'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          Yangilash
        </button>
      </div>

      {/* Metric Cards */}
      {analyticsLoading ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            label="Jami Markazlar"
            value={a?.total_tenants}
            sub={`${a?.active_tenants || 0} faol, ${a?.inactive_tenants || 0} bloklangan`}
            trend={a?.new_tenants_month}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11"/>
              </svg>
            }
          />
          <MetricCard
            label="Faol Obunalar"
            value={a?.active_subscriptions}
            sub={`${a?.trial_subscriptions || 0} sinov davrida`}
            color="#4ade80"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            }
          />
          <MetricCard
            label="Oylik Daromad (MRR)"
            value={formatMRR(a?.mrr_uzs)}
            sub="Faol obunalar jami"
            color="var(--gold)"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            }
          />
          <MetricCard
            label="Muddati Tugagan"
            value={a?.expired_subscriptions}
            sub="Yangilash kerak"
            color="#f87171"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            }
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* MRR Bar Chart */}
        <div className="xl:col-span-2 rounded-2xl p-6"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>So'nggi 6 Oy — MRR O'sishi</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Oylik takroriy daromad dinamikasi</p>
            </div>
          </div>
          {analyticsLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <MiniBarChart data={a?.monthly_growth} />
          )}
        </div>

        {/* Plan Breakdown */}
        <div className="rounded-2xl p-6"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)' }}>
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Tarif Taqsimoti</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>Markazlar tarifi bo'yicha</p>
          {analyticsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(a?.plan_breakdown || {}).map(([plan, count]) => (
                <PlanBadge key={plan} plan={plan} count={count} />
              ))}
              {!a?.plan_breakdown && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Ma'lumot yo'q</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Growth Table */}
      {a?.monthly_growth?.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Oylik O'sish Jadvali
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-void)' }}>
                  {['Oy', 'Yangi Markazlar', 'Kümülatif MRR'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.monthly_growth.map((row, i) => (
                  <tr key={i}
                    style={{ borderTop: '1px solid var(--border-glass)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-void)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td className="px-6 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.month}</td>
                    <td className="px-6 py-3 text-sm" style={{ color: row.new_tenants > 0 ? '#4ade80' : 'var(--text-muted)' }}>
                      {row.new_tenants > 0 ? `+${row.new_tenants}` : row.new_tenants}
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold" style={{ color: 'var(--gold)' }}>
                      {formatMRR(row.mrr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMRR(val) {
  if (!val && val !== 0) return '—';
  const n = Number(val);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M so'm`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K so'm`;
  return `${n} so'm`;
}
