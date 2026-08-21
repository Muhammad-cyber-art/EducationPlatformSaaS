import { useState, useEffect, useCallback } from"react";
import { useNavigate, useOutletContext } from"react-router-dom";
import { useQuery } from"@tanstack/react-query";
import api from"../../../tokenUpdater/updater";
import toast from"react-hot-toast";
import { get_user_info } from"../../Authorized/getRole";
import { useCurrentBranch } from"../../Authorized/useBranchId";

export const useGlobalStudents = () => {
 const navigate = useNavigate();
 const { currentBranchId, branchLoading, hasAccess, isExtraBranch } = useCurrentBranch();
 const { branchId } = useOutletContext() || {};
 const user_info = get_user_info();

 const [students, setStudents] = useState([]);
 const [loading, setLoading] = useState(false);
 const [searchTerm, setSearchTerm] = useState("");

 const { data: userData = {} } = useQuery({
 queryKey: ['user-me'],
 queryFn: () => api.get('/user/me/').then(res => res.data),
 staleTime: Infinity,
 });

 const perms = userData.permissions || {};
 const isSuperAdmin = user_info?.role ==="super_admin";
 const canCreateStudent = isSuperAdmin || perms.students === true;

 const fetchStudents = useCallback(async (search ="") => {
 const activeBranchId = user_info?.role ==="super_admin" ? branchId : currentBranchId;
 if (!search.trim() || !activeBranchId) {
 setStudents([]);
 return;
 }
 setLoading(true);
 try {
 const res = await api.get(`/groups/nested_students/?branch_id=${activeBranchId}&search=${search}&page_size=200`);
 setStudents(res.data.results || res.data);
 } catch {
 toast.error("Ma'lumotlarni yuklashda xatolik.");
 } finally {
 setTimeout(() => setLoading(false), 300);
 }
 }, [branchId, currentBranchId, user_info?.role]);

 useEffect(() => {
 const isSuperAdminUser = user_info?.role ==="super_admin";
 if (!isSuperAdminUser && (branchLoading || !hasAccess)) return;

 const debounce = setTimeout(() => {
 fetchStudents(searchTerm);
 }, 600);

 return () => clearTimeout(debounce);
 }, [searchTerm, currentBranchId, branchId, branchLoading, hasAccess, fetchStudents, user_info?.role]);

 return {
 students,
 loading,
 searchTerm,
 setSearchTerm,
 navigate,
 user_info,
 branchId,
 isExtraBranch,
 canCreateStudent
 };
};
