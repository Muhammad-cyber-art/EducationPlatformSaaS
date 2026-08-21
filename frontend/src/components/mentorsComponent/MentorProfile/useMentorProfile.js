import { useReducer, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { get_user_info } from "../../Authorized/getRole";
import { useCurrentBranch } from "../../Authorized/useBranchId";

const initialState = {
  mentor: {},
  mentorsGroup: [],
  isEditing: false,
  editData: {},
  selectedBranch: { name: "", id: null },
  showPassword: false,
  isPermModalOpen: false,
  isTransferModalOpen: false,
  permissions: {},
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FIELD": return { ...state, [action.field]: action.value };
    case "TOGGLE_TRANSFER_MODAL": return { ...state, isTransferModalOpen: action.payload };
    case "SET_MENTOR_DATA":
      return {
        ...state,
        mentor: action.payload,
        editData: action.payload,
        mentorsGroup: action.payload.mentor_groups || [],
      };
    case "UPDATE_EDIT_DATA": return { ...state, editData: { ...state.editData, ...action.payload } };
    case "START_EDITING": return { ...state, isEditing: true, editData: { ...state.mentor } };
    case "TOGGLE_SHOW_PASSWORD": return { ...state, showPassword: !state.showPassword };
    case 'TOGGLE_PERM_MODAL': return { ...state, isPermModalOpen: action.payload };
    case 'SET_PERMISSIONS': return { ...state, permissions: action.payload };
    case 'TOGGLE_PERMISSION_KEY':
      return {
        ...state,
        permissions: { ...state.permissions, [action.key]: !state.permissions[action.key] }
      };
    default: return state;
  }
}

const PERMISSION_LABELS = {
  "students": "O'quvchi qo'shish va boshqarish",
  "pay_slip": "Moliya daftarini ko'rish",
};

export const useMentorProfile = () => {
  const user_info = get_user_info();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mentor_id } = useParams();
  const { currentBranchId } = useCurrentBranch();
  const { branchId } = useOutletContext() || {};

  const [state, dispatch] = useReducer(reducer, initialState);

  const realMentorId = user_info?.role === "mentor" ? user_info?.user_id : mentor_id;
  const effectiveBranchId = state.selectedBranch?.id || currentBranchId || branchId;

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me/').then(res => res.data),
    staleTime: Infinity,
  });

  const { data: mentorData, isLoading: isMentorLoading } = useQuery({
    queryKey: ['mentor-details', realMentorId, effectiveBranchId],
    queryFn: async () => {
      if (!realMentorId || !effectiveBranchId) return null;
      const res = await api.get(`/groups/nested_mentors/${realMentorId}/?branch_id=${effectiveBranchId}`);
      return res.data;
    },
    enabled: !!realMentorId && !!effectiveBranchId,
  });

  useEffect(() => {
    if (mentorData) {
      dispatch({ type: "SET_MENTOR_DATA", payload: mentorData });
    }
  }, [mentorData]);

  const { data: staffPermissions } = useQuery({
    queryKey: ['staffPermissions', realMentorId],
    queryFn: async () => {
      if (!realMentorId || user_info.role !== "super_admin") return null;
      try {
        const res = await api.get(`/permissions/staff/${realMentorId}/`);
        return res.data;
      } catch (err) { return null; }
    },
    enabled: !!realMentorId && user_info.role === "super_admin"
  });

  useEffect(() => {
    const source = staffPermissions?.permissions || staffPermissions || mentorData?.permissions;
    if (source) {
      const backendPerms = {};
      Object.keys(PERMISSION_LABELS).forEach(key => {
        backendPerms[key] = !!(typeof source === 'object' && source !== null ? source[key] : false);
      });
      dispatch({ type: 'SET_PERMISSIONS', payload: backendPerms });
    }
  }, [mentorData, staffPermissions]);

  const handleUpdate = async () => {
    try {
      const payload = {
        first_name: state.editData.first_name,
        last_name: state.editData.last_name,
        phone_number: state.editData.phone_number,
        subject: state.editData.subject,
        username: state.editData.username,
        is_active: state.editData.is_active,
        color: state.editData.color,
        branch_id: state.mentor.branch_id ? Number(state.mentor.branch_id) : Number(currentBranchId),
      };
      if (state.editData.password) payload.password = state.editData.password;

      const res = await api.put(`/register/users/${realMentorId}/`, payload);
      dispatch({ type: "SET_FIELD", field: "mentor", value: res.data });
      dispatch({ type: "SET_FIELD", field: "isEditing", value: false });
      queryClient.invalidateQueries(['user-me']);
      toast.success("Profil yangilandi!");
    } catch (err) { toast.error("Xatolik yuz berdi!"); }
  };

  const permMutation = useMutation({
    mutationFn: async (perms) => api.put(`/permissions/staff/${realMentorId}/`, perms),
    onSuccess: () => {
      dispatch({ type: 'TOGGLE_PERM_MODAL', payload: false });
      toast.success("Huquqlar yangilandi.");
      queryClient.invalidateQueries(['staffPermissions', realMentorId]);
    }
  });

  const handleDelete = async () => {
    const reason = window.prompt("O'chirish uchun sababni kiriting:");
    if (reason !== null) {
      try {
        await api.delete(`/register/users/${realMentorId}/?reason=${encodeURIComponent(reason || "Sabab ko'rsatilmadi")}`);
        toast.success("Muvaffaqiyatli o'chirildi.");
        navigate(-1);
      } catch (err) { toast.error("Xatolik yuz berdi"); }
    }
  };

  const handleRemoveFromBranch = async () => {
    const branchName = state.mentor?.branch?.name || 'filialdan';
    const confirmed = window.confirm(
      `"${state.mentor?.first_name || ''} ${state.mentor?.last_name || ''}" ni "${branchName}" dan o'chirasizmi?\n\nBu amal mentorning asosiy filialini null qilib qo'yadi.`
    );
    if (!confirmed) return;
    try {
      const res = await api.post(`/register/users/${realMentorId}/remove-from-branch/`);
      toast.success(res.data?.detail || "Muvaffaqiyatli olib tashlandi.");
      queryClient.invalidateQueries(['mentor-details']);
      queryClient.invalidateQueries(['mentors']);
      navigate(-1);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Xatolik yuz berdi";
      toast.error(msg);
    }
  };

  const handleRemoveBranchAccess = async (branchId, branchName) => {
    const confirmed = window.confirm(
      `"${state.mentor?.first_name || ''} ${state.mentor?.last_name || ''}" dan "${branchName || 'ushbu'}" filial ruxsatini o'chirasizmi?`
    );
    if (!confirmed) return;
    try {
      const res = await api.post(`/register/users/${realMentorId}/remove-branch-access/`, { branch_id: branchId });
      toast.success(res.data?.detail || "Ruxsat muvaffaqiyatli olib tashlandi.");
      queryClient.invalidateQueries(['mentor-details']);
      queryClient.invalidateQueries(['staff-branches']);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Xatolik yuz berdi";
      toast.error(msg);
    }
  };

  const { data: staffBranchesRaw } = useQuery({
    queryKey: ['staff-branches', realMentorId],
    queryFn: async () => {
      if (!realMentorId || user_info?.role !== 'super_admin') return [];
      try {
        const res = await api.get(`/register/branch-access/?user_id=${realMentorId}`);
        return res.data || [];
      } catch (err) { return []; }
    },
    enabled: !!realMentorId && user_info?.role === 'super_admin',
  });
  const staffBranches = staffBranchesRaw?.results || staffBranchesRaw || [];

  const userRole = (userData.role || user_info?.role || "").toLowerCase();
  const perms = userData.permissions || {};
  const isSuperAdmin = userRole === "super_admin";
  const isAdmin = userRole === "admin";
  const isOwnProfile = userRole === "mentor" && Number(realMentorId) === Number(user_info?.user_id);
  const canEditMentor = (isSuperAdmin || isAdmin || perms.teachers === true) && !isOwnProfile;

  return {
    state,
    dispatch,
    user_info,
    userData,
    isMentorLoading,
    staffBranches,
    isSuperAdmin,
    canEditMentor,
    handleUpdate,
    handleDelete,
    handleRemoveFromBranch,
    handleRemoveBranchAccess,
    permMutation,
    navigate,
    queryClient,
    PERMISSION_LABELS
  };
};
