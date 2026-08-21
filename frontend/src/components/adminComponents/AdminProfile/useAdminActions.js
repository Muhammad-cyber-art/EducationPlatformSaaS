import { useMutation, useQueryClient } from"@tanstack/react-query";
import api from"../../../tokenUpdater/updater";
import toast from"react-hot-toast";

export const useAdminActions = (admin_id, admin, dispatch, navigate, refetchBranches) => {
 const queryClient = useQueryClient();

 const archiveMutation = useMutation({
 mutationFn: async (reason) => {
 return await api.delete(`/register/users/${admin?.id}/`, { params: { reason } });
 },
 onSuccess: () => {
 toast.success("Muvaffaqiyatli o'chirildi.");
 navigate(-1);
 }
 });

 const updateMutation = useMutation({
 mutationFn: async (data) => {
 return await api.patch(`/register/users/${admin?.id}/`, data);
 },
 onSuccess: () => {
 queryClient.invalidateQueries(['admin']);
 dispatch({ type:'TOGGLE_EDIT_MODAL', payload: false });
 toast.success("Profil yangilandi.");
 }
 });

 const permMutation = useMutation({
 mutationFn: async (perms) => {
 return await api.put(`/permissions/staff/${admin_id}/`, perms);
 },
 onSuccess: () => {
 dispatch({ type:'TOGGLE_PERM_MODAL', payload: false });
 toast.success("Huquqlar yangilandi.");
 }
 });

 const removeBranchMutation = useMutation({
 mutationFn: async (branchAccessId) => {
 return await api.delete(`/register/branch-access/${branchAccessId}/`);
 },
 onSuccess: () => {
 toast.success("Filialga ruxsat olib tashlandi.");
 if (refetchBranches) refetchBranches();
 queryClient.invalidateQueries(['admin']);
 }
 });

 const handleEditOpen = () => {
 if (admin) {
 dispatch({
 type:'SET_EDIT_FORM',
 payload: {
 first_name: admin.first_name,
 last_name: admin.last_name,
 phone_number: admin.phone_number,
 username: admin.username,
 is_active: admin.is_active,
 }
 });
 dispatch({ type:'TOGGLE_EDIT_MODAL', payload: true });
 }
 };

 const LogOut = () => {
    if (window.confirm("Tizimdan chiqmoqchimisiz?")) {
      localStorage.clear();
      window.location.href = "/";
    }
  };

 return {
 archiveMutation,
 updateMutation,
 permMutation,
 removeBranchMutation,
 handleEditOpen,
 LogOut
 };
};
