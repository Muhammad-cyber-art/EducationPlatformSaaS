import { lazy } from "react";
import { Route } from "react-router-dom";

const Login = lazy(() => import("../components/Authorized/login"));
const GroupDetailPage = lazy(() => import("../components/GroupsComponent/GroupDetails"));
const StudentProfilePage = lazy(() => import("../components/StudentComponents/Student"));
const StudentPayments = lazy(() => import("../components/homework/StudentPayments"));
const LandingPage = lazy(() =>
  import("../components/Common/LandingPage").then((m) => ({ default: m.LandingPage }))
);

export const PublicRoutes = (
  <>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<Login />} />
    <Route path="/filial" element={<Login />} />
    
    {/* Shared/Stand-alone routes that require ALL_ACCESS usually */}
    <Route path="/group" element={<GroupDetailPage />} />
    <Route path="/student" element={<StudentProfilePage />} />
    <Route path="/studentpayments" element={<StudentPayments />} />
  </>
);

