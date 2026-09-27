import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTenants, toggleTenantStatus } from '../../store/slices/ceoSlice';
import AddTenantModal from './AddTenantModal';

// Plan badge colors
const PLAN_STYLE = {
  starter:    { bg: 'rgba(99,102,241,0.12)',  color: '#a5b4fc' },
  pro:        { bg: 'rgba(184,134,11,0.12)',  color: '#d4a017' },
  enterprise: { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
};

function PlanChip({ plan }) {
  const s = PLAN_STYLE[plan] || PLAN_STYLE.starter;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: s.bg, color: s.color }}>
      {plan}
    </span>
  );
}

function StatusDot({ active }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium"
      style={{ color: active ? '#4ade80' : '#f87171' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? '#4ade80' : '#f87171' }} />
      {active ? 'Faol' : 'Bloklangan'}
    </span>
  );
}

export default function CEOTenants() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { tenants, tenantsLoading, tenantsTotal, tenantsPage, tenantsPages } = useSelector((s) => s.ceo);

  const [showAdd,    setShowAdd]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [page,       setPage]       = useState(1);

  const load = () => {
    const params = { page, page_size: 15 };
    if (search)       params.search    = search;
    if (filterPlan)   params.plan      = filterPlan;
    if (filterActive !== '') params.is_active = filterActive;
    dispatch(fetchTenants(params));
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => { setPage(1); load(); }, [search, filterPlan, filterActive]);

  const openDetail = (id) => {
    navigate(`/ceo/tenants/${id}`);
  };

  const handleToggle = async (id, currentStatus) => {
    const reason = currentStatus ? 'CEO tomonidan bloklandi' : '';
    await dispatch(toggleTenantStatus({ id, is_active: !currentStatus, reason }));
    load();
  };

  return (
    <div className="p-6 space-y-5 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>O'quv Markazlar</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Jami <span style={{ color: 'var(--gold)' }} className="font-bold">{tenantsTotal}</span> ta markaz
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--gold)', color: '#000' }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--gold-glow)'}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Yangi Markaz
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-52">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom yoki domen bo'yicha qidirish..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
            onBlur={(e)  => e.target.style.borderColor = 'var(--border-glass)'} />
        </div>

        {/* Plan filter */}
        <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}>
          <option value="">Barcha tariflar</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>

        {/* Active filter */}
        <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}>
          <option value="">Barcha holatlar</option>
          <option value="true">Faol</option>
          <option value="false">Bloklangan</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--bg-void)', borderBottom: '1px solid var(--border-glass)' }}>
                {['Markaz', 'Domen', 'Tarif', 'Holat', 'Obuna', 'Amallar'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenantsLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex items-center justify-center gap-3" style={{ color: 'var(--text-muted)' }}>
                      <span className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full inline-block" />
                      Yuklanmoqda...
                    </div>
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <p className="text-4xl mb-3">🏫</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {search ? 'Qidiruv natijalari topilmadi' : 'Hali markaz qo\'shilmagan'}
                    </p>
                  </td>
                </tr>
              ) : tenants.map((tenant) => (
                <tr key={tenant.id}
                  onClick={() => openDetail(tenant.id)}
                  className="cursor-pointer transition-colors"
                  style={{ borderTop: '1px solid var(--border-glass)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-void)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>

                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tenant.name}</p>
                      <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>{tenant.schema_name}</p>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {tenant.primary_domain || '—'}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <PlanChip plan={tenant.plan || 'starter'} />
                  </td>

                  <td className="px-5 py-4">
                    <StatusDot active={tenant.is_active} />
                  </td>

                  <td className="px-5 py-4">
                    <div>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: tenant.sub_status === 'active' ? 'rgba(74,222,128,0.1)' :
                                      tenant.sub_status === 'trial'  ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)',
                          color:      tenant.sub_status === 'active' ? '#4ade80' :
                                      tenant.sub_status === 'trial'  ? '#fbbf24' : '#f87171',
                        }}>
                        {tenant.sub_status === 'active' ? 'Faol' :
                         tenant.sub_status === 'trial'  ? 'Sinov' : 'Tugagan'}
                      </span>
                      {tenant.sub_expires_at && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {new Date(tenant.sub_expires_at).toLocaleDateString('uz-UZ')}
                        </p>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {/* Detail */}
                      <button onClick={(e) => { e.stopPropagation(); openDetail(tenant.id); }}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: 'var(--gold)', background: 'var(--gold-dim)' }}
                        title="Ko'rish"
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(184,134,11,0.25)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--gold-dim)'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      </button>

                      {/* Toggle Status */}
                      <button onClick={(e) => { e.stopPropagation(); handleToggle(tenant.id, tenant.is_active); }}
                        className="p-1.5 rounded-lg transition-all"
                        title={tenant.is_active ? 'Bloklash' : 'Ochish'}
                        style={{
                          color:      tenant.is_active ? '#f87171' : '#4ade80',
                          background: tenant.is_active ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)',
                        }}>
                        {tenant.is_active ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {tenantsPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: '1px solid var(--border-glass)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {tenantsTotal} ta ichidan {(tenantsPage - 1) * 15 + 1}–{Math.min(tenantsPage * 15, tenantsTotal)} ko'rsatilmoqda
            </p>
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 transition-all"
                style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold)' }}>
                ← Oldingi
              </button>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {page} / {tenantsPages}
              </span>
              <button disabled={page === tenantsPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 transition-all"
                style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold)' }}>
                Keyingi →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && <AddTenantModal onClose={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}
