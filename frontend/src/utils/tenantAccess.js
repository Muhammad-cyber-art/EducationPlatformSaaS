export const TENANT_ACCESS_DENIED_EVENT = 'tenant:access-denied';
export const TENANT_ACCESS_PATH = '/api/v1/public/tenants/access/';
export const TENANT_UNAVAILABLE_MESSAGE = 'Malumot olishda xatolik';

export function needsTenantAccessCheck(location, baseDomain = 'chronous.uz') {
  const host = location.hostname.toLowerCase();
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
  if (local) return Boolean(new URLSearchParams(location.search).get('subdomain'));
  const central = [baseDomain, ...['www', 'admin', 'app', 'ceo', 'api', 'mail'].map(sub => `${sub}.${baseDomain}`)];
  return !central.includes(host) && !['admin.localhost', 'ceo.localhost', 'api.localhost', 'www.localhost'].includes(host);
}

export function tenantAccessRequest(location) {
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.endsWith('.localhost');
  const headers = { Accept: 'application/json' };
  if (local) {
    const sub = new URLSearchParams(location.search).get('subdomain');
    headers['X-Tenant-Domain'] = sub ? `${sub}.localhost` : location.hostname;
  }
  return { url: local ? `http://127.0.0.1:8000${TENANT_ACCESS_PATH}` : TENANT_ACCESS_PATH, headers };
}

/** Owns admission state; stale in-flight checks cannot reopen a denied page. */
export function createTenantAccessMonitor({ check, onChange, events, visibility, timers = globalThis, intervalMs = 15000 }) {
  let stopped = true;
  let pending = false;
  let version = 0;
  let controller;
  let interval;
  let timeout;

  function deny() {
    version++;
    controller?.abort();
    timers.clearTimeout(timeout);
    pending = false;
    if (!stopped) onChange('unavailable');
  }

  async function verify() {
    if (stopped || pending) return;
    pending = true;
    const current = ++version;
    controller = new AbortController();
    const signal = controller.signal;
    timeout = timers.setTimeout(() => { if (current === version) deny(); }, 8000);
    try {
      const allowed = await check(signal);
      if (!stopped && current === version) onChange(allowed ? 'allowed' : 'unavailable');
    } catch {
      if (!stopped && current === version) onChange('unavailable');
    } finally {
      if (current === version) {
        pending = false;
        timers.clearTimeout(timeout);
      }
    }
  }

  const visible = () => { if (!visibility || visibility.visibilityState === 'visible') verify(); };
  return {
    start() {
      if (!stopped) return;
      stopped = false;
      onChange('checking');
      events.addEventListener(TENANT_ACCESS_DENIED_EVENT, deny);
      events.addEventListener('offline', deny);
      events.addEventListener('online', verify);
      events.addEventListener('focus', verify);
      visibility?.addEventListener('visibilitychange', visible);
      interval = timers.setInterval(verify, intervalMs);
      verify();
    },
    stop() {
      stopped = true;
      version++;
      controller?.abort();
      timers.clearTimeout(timeout);
      timers.clearInterval(interval);
      pending = false;
      events.removeEventListener(TENANT_ACCESS_DENIED_EVENT, deny);
      events.removeEventListener('offline', deny);
      events.removeEventListener('online', verify);
      events.removeEventListener('focus', verify);
      visibility?.removeEventListener('visibilitychange', visible);
    },
  };
}
