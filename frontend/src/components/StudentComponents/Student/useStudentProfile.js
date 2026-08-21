import { useQuery } from"@tanstack/react-query";
import api from"../../../tokenUpdater/updater";
import { get_user_info } from"../../Authorized/getRole";

export const useStudentProfile = (student_id, branchID, dispatch) => {
 const user_info = get_user_info();

 const { data: userData = {} } = useQuery({
 queryKey: ['user-me'],
 queryFn: () => api.get('/user/me/').then(res => res.data),
 staleTime: Infinity,
 });

 const perms = userData.permissions || {};
 const userRole = (userData.role || user_info?.role ||"").toLowerCase();

 const { data: studentData = {}, isLoading: studentLoading } = useQuery({
 queryKey: ['student', student_id],
 enabled: !!student_id && !!userData.id,
 queryFn: async () => {
 const res = await api.get(`groups/nested_students/${student_id}`);
 if (dispatch) {
 dispatch({
 type:'SET_EDIT_DATA',
 payload: {
 full_name: res.data.full_name ||"", phone: res.data.phone ||"",
 parent_name: res.data.parent_name ||"", parent_phone: res.data.parent_phone ||"",
 address: res.data.address ||"", notes: res.data.notes ||"",
 birth_date: res.data.birth_date ||"",
 group: res.data.group?.id, image: null,
 status: res.data.status ||"regular",
 custom_fee: res.data.custom_fee ||"",
 telegram_id: res.data.telegram_id ||"",
 parent_telegram_id: res.data.parent_telegram_id ||""
 }
 });
 }
 return res.data;
 }
 });

 const { data: paymentsAllGroupsRaw, isLoading: paymentLoading } = useQuery({
 queryKey: ['payments-all', student_id],
 queryFn: () => api.get(`/finance/student-payments/?student=${student_id}`).then(res => res.data),
 enabled: !!student_id && !!userData.id
 });
 const paymentsAllGroups = paymentsAllGroupsRaw?.results || paymentsAllGroupsRaw || [];

 const { data: studentHistory, isLoading: historyLoading } = useQuery({
 queryKey: ['student-history', student_id],
 queryFn: () => api.get(`/finance/student-payments/student-history/${student_id}/`).then(res => res.data),
 enabled: !!student_id && !!userData.id
 });

 const { data: branchGroupsRaw } = useQuery({
 queryKey: ['groups-list', branchID],
 queryFn: () => api.get(`/groups/nested_groups/?branch_id=${branchID}`).then(res => res.data),
 enabled: !!userData.id && !!branchID,
 });
 const branchGroups = branchGroupsRaw?.results || branchGroupsRaw || [];

 const { data: transfersRaw } = useQuery({
 queryKey: ['student-transfers', student_id],
 queryFn: () => api.get(`/groups/students/${student_id}/transfers/`).then(res => res.data),
 enabled: !!student_id && !!userData.id,
 });
 const transfers = transfersRaw?.results || transfersRaw || [];

 const permissions = {
 canEditStudent: userRole ==="admin" || userRole ==="super_admin" || (userRole ==="mentor" && perms.students === true),
 canConfirmPayment: userRole ==="admin" || userRole ==="super_admin",
 userRole,
 userData
 };

 return {
 studentData,
 paymentsAllGroups,
 studentHistory,
 branchGroups,
 transfers,
 studentLoading,
 paymentLoading,
 historyLoading,
 permissions,
 userRole
 };
};
