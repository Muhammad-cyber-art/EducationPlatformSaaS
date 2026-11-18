import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { needsTenantAccessCheck, TENANT_ACCESS_PATH, TENANT_UNAVAILABLE_MESSAGE } from './src/utils/tenantAccess.js';

export const unavailableDocument = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${TENANT_UNAVAILABLE_MESSAGE}</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;font:16px system-ui;background:#f8fafc;color:#0f172a"><h1 style="font-size:20px">${TENANT_UNAVAILABLE_MESSAGE}</h1></body></html>`;

// Node fetch can discard Host overrides. Preserve the browser hostname using
// the HTTP client so the backend checks this tenant instead of localhost.
function requestAdmission(url, { headers, signal }) {
  return new Promise((resolve, reject) => {
    const request = (url.startsWith('https:') ? httpsRequest : httpRequest)(url, { headers, signal }, response => {
      response.resume();
      resolve({ status: response.statusCode });
    });
    request.on('error', reject);
    request.end();
  });
}

export function tenantAccessPlugin({ backendUrl = 'http://127.0.0.1:8000', fetchImpl = requestAdmission } = {}) {
  function configure(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!['GET', 'HEAD'].includes(req.method)) return next();
      let location;
      try { location = new URL(req.url, `http://${req.headers.host}`); }
      catch { res.writeHead(400); return res.end(); }
      const path = location.pathname;
      const asset = /^\/(?:src|node_modules|assets|@vite|@fs|@id)\//.test(path)
        || path === '/@react-refresh' || /\.(?:js|jsx|ts|tsx|css|map|png|jpe?g|svg|ico|woff2?|ttf|eot|webmanifest|txt)$/.test(path);
      if (path.startsWith('/api/') || path.startsWith('/media/') || asset) return next();
      const baseDomain = server.config?.env?.VITE_TENANT_BASE_DOMAIN || 'chronous.uz';
      if (!needsTenantAccessCheck(location, baseDomain)) return next();
      const headers = { Accept: 'application/json', Host: req.headers.host };
      const sub = new URLSearchParams(location.search).get('subdomain');
      if (sub && ['localhost', '127.0.0.1'].includes(location.hostname)) headers['X-Tenant-Domain'] = `${sub}.localhost`;
      let status = 503;
      try {
        const response = await fetchImpl(`${backendUrl}${TENANT_ACCESS_PATH}`, { headers, signal: AbortSignal.timeout(8000) });
        if (response.status === 204) return next();
        status = response.status === 403 ? 403 : 503;
      } catch { /* Fail closed when the tenant cannot be verified. */ }
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : unavailableDocument);
    });
  }
  return { name: 'tenant-document-access', configureServer: configure, configurePreviewServer: configure };
}
