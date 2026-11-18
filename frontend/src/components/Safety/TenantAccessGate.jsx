import { useEffect, useState } from 'react';
import { createTenantAccessMonitor, needsTenantAccessCheck, tenantAccessRequest, TENANT_UNAVAILABLE_MESSAGE } from '../../utils/tenantAccess';

export default function TenantAccessGate({ children }) {
  const [required] = useState(() => needsTenantAccessCheck(window.location, import.meta.env.VITE_TENANT_BASE_DOMAIN || 'chronous.uz'));
  const [state, setState] = useState('checking');

  useEffect(() => {
    if (!required) return;
    const monitor = createTenantAccessMonitor({
      events: window,
      visibility: document,
      onChange: setState,
      async check(signal) {
        const { url, headers } = tenantAccessRequest(window.location);
        const response = await fetch(url, { headers, signal, cache: 'no-store', credentials: 'omit' });
        return response.status === 204;
      },
    });
    monitor.start();
    return () => monitor.stop();
  }, [required]);

  if (!required || state === 'allowed') return children;
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg-primary, #f8fafc)', color: 'var(--text-primary, #0f172a)' }}>
      {state === 'checking' ? (
        <p role="status">Yuklanmoqda...</p>
      ) : (
        <div className="text-center" role="alert">
          <h1 className="text-xl font-semibold">{TENANT_UNAVAILABLE_MESSAGE}</h1>
          <button type="button" className="mt-5 underline" onClick={() => window.location.reload()}>Qayta urinish</button>
        </div>
      )}
    </main>
  );
}
