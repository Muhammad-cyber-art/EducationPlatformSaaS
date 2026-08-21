import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./ThemeContext";
import PrivateRoute from "./components/Safety/ProtectedRoute";

// Modularized Routes
import { PublicRoutes } from "./routes/PublicRoutes";
import { AdminRoutes } from "./routes/AdminRoutes";
import { SuperAdminRoutes } from "./routes/SuperAdminRoutes";
import { MentorRoutes } from "./routes/MentorRoutes";
import { CEORoutes } from "./routes/CEORoutes";

const ROLES = {
 ADMIN_ACCESS: ["admin","super_admin"],
 SUPER_ONLY: ["super_admin"],
 ADMIN_ONLY: ["admin"],
 ALL_ACCESS: ["admin","mentor","super_admin"],
};

export default function PreApp() {
 return (
 <ThemeProvider>
 <div className="layout-root">
 <BrowserRouter>
 <Routes>
 {/* ── CEO Super Admin Panel (alohida auth tizimi) ─────────────── */}
 {CEORoutes}

 {/* Public and Shared Routes */}
 {PublicRoutes}

 {/* Admin Section with Layout-level Protection */}
 <Route element={<PrivateRoute allowed={ROLES.ADMIN_ACCESS} />}>
 {AdminRoutes}
 </Route>

 {/* Super Admin Section with Layout-level Protection */}
 <Route element={<PrivateRoute allowed={ROLES.SUPER_ONLY} />}>
 {SuperAdminRoutes}
 </Route>

 {/* Mentor Section with Layout-level Protection */}
 <Route element={<PrivateRoute allowed={ROLES.ALL_ACCESS} />}>
 {MentorRoutes}
 </Route>

 </Routes>
 </BrowserRouter>
 </div>
 </ThemeProvider>
 );
}