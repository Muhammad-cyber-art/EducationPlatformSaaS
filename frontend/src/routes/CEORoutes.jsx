import React from 'react';
import { Route, Outlet } from 'react-router-dom';
import CEOLayout             from '../components/CEO/CEOLayout';
import CEODashboard          from '../components/CEO/CEODashboard';
import CEOTenants            from '../components/CEO/CEOTenants';
import CEOTenantDetail       from '../components/CEO/CEOTenantDetail';
import CEOLogin              from '../components/CEO/CEOLogin';
import CEOSubdomainForbidden from '../components/CEO/CEOSubdomainForbidden';
import { isTenantSubdomain } from '../utils/subdomain';

/**
 * CEORouteGuard — Subdomen xavfsizlik himoyasi.
 *
 * Agar foydalanuvchi biron o'quv markaz subdomenida bo'lsa (masalan: najot.localhost
 * yoki maktab1.crm.uz), CEO boshqaruv paneli routelariga (/ceo/*) kirish taqiqlanadi
 * va 403 Forbidden ekrani chiqariladi.
 *
 * CEO paneli faqat markaziy platforma domenidan (localhost, 127.0.0.1, admin.crm.uz)
 * ochilishi mumkin.
 */
function CEORouteGuard() {
  if (isTenantSubdomain()) {
    return <CEOSubdomainForbidden />;
  }
  return <Outlet />;
}

/**
 * CEO Super Admin Routes — /ceo/* path ostida.
 *
 * Routing:
 *   /ceo/login        → CEOLogin (auth required emas, lekin subdomenda taqiqlangan)
 *   /ceo/dashboard    → CEODashboard (auth required)
 *   /ceo/tenants      → CEOTenants   (auth required)
 *   /ceo/tenants/:id  → CEOTenantDetail (auth required)
 *   /ceo/analytics    → CEODashboard (analytics)
 */
export const CEORoutes = (
  <Route element={<CEORouteGuard />}>
    {/* Public CEO login (faqat markaziy domendan) */}
    <Route path="/ceo/login" element={<CEOLogin />} />

    {/* Protected CEO boshqaruv paneli */}
    <Route path="/ceo" element={<CEOLayout />}>
      <Route index              element={<CEODashboard />} />
      <Route path="dashboard"   element={<CEODashboard />} />
      <Route path="tenants"     element={<CEOTenants />} />
      <Route path="tenants/:id" element={<CEOTenantDetail />} />
      <Route path="analytics"   element={<CEODashboard />} />
    </Route>
  </Route>
);
