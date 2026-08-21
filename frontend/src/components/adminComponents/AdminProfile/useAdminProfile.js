import { useEffect } from"react";
import { useQuery } from"@tanstack/react-query";
import api from"../../../tokenUpdater/updater";
import { get_user_info } from"../../Authorized/getRole";

export const PERMISSION_LABELS = {
"finance":"Moliya",
"groups":"Guruhlar",
"students":"O'quvchilar",
"teachers":"Mentorlar",
"branches":"Filiallar",
"reports":"Hisobotlar",
"pay_slip":"Oylik kvitansiya"
};

export const useAdminProfile = (admin_id, dispatch) => {
 const user_info = get_user_info();

 const { data: admin, isLoading: loading, error } = useQuery({
 queryKey: ['admin', admin_id ||'me', user_info.role],
 queryFn: async () => {
 let res;
 if (!admin_id) {
 res = await api.get("/user/me/");
 } else {
 res = await api.get(`/groups/admins/${admin_id}/`);
 }
 return res?.data;
 }
 });

 const { data: staffPermissions } = useQuery({
 queryKey: ['staffPermissions', admin_id],
 queryFn: async () => {
 if (!admin_id || user_info.role !=="super_admin") return null;
 try {
 const res = await api.get(`/permissions/staff/${admin_id}/`);
 return res.data;
 } catch (err) { return null; }
 },
 enabled: !!admin_id && user_info.role ==="super_admin"
 });

 const { data: staffBranchesRaw, refetch: refetchBranches } = useQuery({
 queryKey: ['staff-branches', admin_id],
 queryFn: async () => {
 if (!admin_id || user_info.role !=='super_admin') return [];
 const res = await api.get(`/register/branch-access/?user_id=${admin_id}`);
 return res.data || [];
 },
 enabled: !!admin_id && user_info.role ==='super_admin',
 });
 const staffBranches = staffBranchesRaw?.results || staffBranchesRaw || [];

 useEffect(() => {
 const source = staffPermissions?.permissions || staffPermissions || admin?.permissions;
 if (source && dispatch) {
 const backendPerms = {};
 Object.keys(PERMISSION_LABELS).forEach(key => {
 if (Array.isArray(source)) {
 const exists = source.some(p => {
 if (typeof p ==='string') return p === key;
 if (typeof p ==='object' && p !== null) return p.codename === key || p.name === key || p[key] === true;
 return false;
 });
 backendPerms[key] = exists;
 } else if (typeof source ==='object' && source !== null) {
 backendPerms[key] = !!source[key];
 } else {
 backendPerms[key] = false;
 }
 });
 dispatch({ type:'SET_PERMISSIONS', payload: backendPerms });
 }
 }, [admin, staffPermissions, dispatch]);

 return {
 admin,
 staffBranches,
 loading,
 error,
 user_info,
 refetchBranches
 };
};
