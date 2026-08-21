import { Route } from 'react-router-dom';
import CEOLayout    from '../components/CEO/CEOLayout';
import CEODashboard from '../components/CEO/CEODashboard';
import CEOTenants   from '../components/CEO/CEOTenants';
import CEOLogin     from '../components/CEO/CEOLogin';

/**
 * CEO Super Admin Routes — /ceo/* path ostida.
 *
 * Bu routelar mavjud tenant (super_admin) routelaridan butunlay
 * ajratilgan bo'lib, alohida JWT autentifikatsiyasidan foydalanadi.
 *
 * Routing:
 *   /ceo/login       → CEOLogin (auth required emas)
 *   /ceo/dashboard   → CEODashboard (auth required)
 *   /ceo/tenants     → CEOTenants   (auth required)
 *   /ceo/analytics   → CEODashboard (analytics to'g'ridan sahifasida ko'rsatiladi)
 */
export const CEORoutes = (
  <>
    {/* Public — login (auth required emas) */}
    <Route path="/ceo/login" element={<CEOLogin />} />

    {/* Protected — CEOLayout ichidagi sahifalar */}
    <Route path="/ceo" element={<CEOLayout />}>
      <Route index        element={<CEODashboard />} />
      <Route path="dashboard" element={<CEODashboard />} />
      <Route path="tenants"   element={<CEOTenants />} />
      <Route path="analytics" element={<CEODashboard />} />
    </Route>
  </>
);
