import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ceoLogout } from '../../store/slices/ceoSlice';

const navItems = [
  {
    to: '/ceo/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    to: '/ceo/tenants',
    label: 'O\'quv Markazlar',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
      </svg>
    ),
  },
  {
    to: '/ceo/analytics',
    label: 'Analitika',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
];

export default function CEOSidebar() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { user }  = useSelector((s) => s.ceo);

  const handleLogout = () => {
    dispatch(ceoLogout());
    navigate('/ceo/login');
  };

  return (
    <aside className="flex flex-col h-screen w-60 shrink-0"
      style={{
        background:  'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-glass)',
      }}>

      {/* Logo */}
      <div className="px-6 py-6 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--border-glass)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="var(--gold)" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M12 22V12M3 7l9 5 9-5"        stroke="var(--gold)" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-xs font-bold leading-none" style={{ color: 'var(--gold)' }}>CEO PANEL</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Platform Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive ? 'active-ceo-nav' : 'hover-ceo-nav'
              }`
            }
            style={({ isActive }) => ({
              color:      isActive ? 'var(--gold)' : 'var(--text-secondary)',
              background: isActive ? 'var(--gold-dim)' : 'transparent',
            })}>
            {icon}
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'var(--gold)', color: '#000' }}>
            {user?.full_name?.[0] || 'C'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {user?.full_name || 'CEO'}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {user?.email || ''}
            </p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
          style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          Chiqish
        </button>
      </div>
    </aside>
  );
}
