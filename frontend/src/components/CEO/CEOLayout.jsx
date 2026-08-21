import { Outlet, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import CEOSidebar from './CEOSidebar';

export default function CEOLayout() {
  const { isAuthenticated } = useSelector((s) => s.ceo);

  if (!isAuthenticated) return <Navigate to="/ceo/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-void)', fontFamily: 'var(--font-sans)' }}>
      <CEOSidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-panel)' }}>
        <Outlet />
      </main>
    </div>
  );
}
