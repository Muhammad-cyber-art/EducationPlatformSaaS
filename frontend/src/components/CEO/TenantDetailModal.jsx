import { useSelector, useDispatch } from 'react-redux';
import { toggleTenantStatus } from '../../store/slices/ceoSlice';

const PLAN_STYLE = {
  starter:    { bg: 'rgba(99,102,241,0.12)',  color: '#a5b4fc' },
  pro:        { bg: 'rgba(184,134,11,0.12)',  color: '#d4a017' },
  enterprise: { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
};

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between py-3"
      style={{ borderBottom: '1px solid var(--border-glass)' }}>
      <span className="text-xs font-semibold uppercase tracking-wider w-36 shrink-0"
        style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm text-right flex-1"
        style={{ color: 'var(--text-primary)', fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export default function TenantDetailModal({ onClose }) {
  const dispatch = useDispatch();
  const { selectedTenant: t, detailLoading } = useSelector((s) => s.ceo);

  if (detailLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
        <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!t) return null;

  const sub   = t.subscription;
  const plan  = sub?.plan || 'starter';
  const pStyle = PLAN_STYLE[plan] || PLAN_STYLE.starter;
  const domList = t.domains?.map((d) => d.domain).join(', ') || '—';

  const daysLeft = sub?.expires_at
    ? Math.max(0, Math.floor((new Date(sub.expires_at) - Date.now()) / 86_400_000))
    : null;

  const handleToggle = () => {
    dispatch(toggleTenantStatus({ id: t.id, is_active: !t.is_active }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>

      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card-bg)',
          border:     '1px solid var(--border-glass)',
          boxShadow:  '0 32px 80px rgba(0,0,0,0.6)',
          maxHeight:  '90vh',
          overflowY:  'auto',
        }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5"
          style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-void)' }}>
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
              style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold)', color: 'var(--gold)' }}>
              {t.name[0]}
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{t.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                  style={{ background: pStyle.bg, color: pStyle.color }}>{plan}</span>
                <span className="flex items-center gap-1 text-xs"
                  style={{ color: t.is_active ? '#4ade80' : '#f87171' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.is_active ? '#4ade80' : '#f87171' }} />
                  {t.is_active ? 'Faol' : 'Bloklangan'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--border-glass)', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">

          {/* Tenant Info */}
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--gold)' }}>Markaz Ma'lumotlari</p>
          <Row label="ID"           value={`#${t.id}`} />
          <Row label="Schema"       value={t.schema_name} mono />
          <Row label="Domenlar"     value={domList} />
          <Row label="Shahar"       value={t.city} />
          <Row label="Aloqa"        value={t.contact_phone} />
          <Row label="Qo'shilgan"   value={t.created_at ? new Date(t.created_at).toLocaleDateString('uz-UZ') : null} />

          {/* Subscription */}
          {sub && (
            <>
              <p className="text-xs font-bold uppercase tracking-wider mt-5 mb-2" style={{ color: 'var(--gold)' }}>Obuna</p>
              <Row label="Tarif"        value={<span style={{ color: pStyle.color }}>{plan.toUpperCase()}</span>} />
              <Row label="Narx (oylik)" value={`${Number(sub.price_per_month).toLocaleString()} so'm`} />
              <Row label="Holat"        value={
                <span style={{ color: sub.status === 'active' ? '#4ade80' : sub.status === 'trial' ? '#fbbf24' : '#f87171' }}>
                  {sub.status === 'active' ? 'Faol' : sub.status === 'trial' ? 'Sinov davri' : 'Muddati tugagan'}
                </span>
              } />
              <Row label="Tugash"       value={sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('uz-UZ') : null} />
              {daysLeft !== null && (
                <Row label="Qoldi"      value={
                  <span style={{ color: daysLeft < 7 ? '#f87171' : daysLeft < 30 ? '#fbbf24' : '#4ade80' }}>
                    {daysLeft} kun
                  </span>
                } />
              )}
              <Row label="Max Talabalar" value={sub.max_students?.toLocaleString()} />
              <Row label="Max Filiallar" value={sub.max_branches} />
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 flex gap-3"
          style={{ borderTop: '1px solid var(--border-glass)', background: 'var(--bg-void)' }}>
          <button onClick={handleToggle}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              background: t.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
              border:     `1px solid ${t.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'}`,
              color:      t.is_active ? '#f87171' : '#4ade80',
            }}>
            {t.is_active ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Bloklash
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/>
                </svg>
                Faollashtirish
              </>
            )}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'var(--gold)', color: '#000' }}>
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
