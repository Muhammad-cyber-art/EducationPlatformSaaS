import { Navigate, Outlet } from'react-router-dom';
import { get_user_info } from'../Authorized/getRole';

const isAuthenticated = () => {
 const access = localStorage.getItem('access_token');
 return !!access;
};

const PrivateRoute = ({ children, allowed = [] }) => {
 const user_info = get_user_info();
 const isAuth = isAuthenticated();

 // Agar foydalanuvchi auth bo'lsa va roli ruxsat etilgan bo'lsa
 if (isAuth && user_info && allowed.includes(user_info.role)) {
 return children ? children : <Outlet />;
 }

 // Aks holda login sahifasiga redirect
 return <Navigate to="/" replace />;
};

export default PrivateRoute;