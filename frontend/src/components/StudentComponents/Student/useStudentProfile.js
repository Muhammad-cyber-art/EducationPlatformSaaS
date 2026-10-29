import { useQuery } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import { get_user_info } from "../../Authorized/getRole";
import { db } from "../../../db/db";

export const useStudentProfile = (student_id, branchID, dispatch) => {
  const user_info = get_user_info();

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: async () => {
      try {
        const res = await api.get('/user/me/');
        if (res.data) {
          try {
            await db.query_cache.put({
              query_key: 'user-me',
              data: res.data,
              updated_at: new Date().toISOString(),
            });
          } catch (e) {}
        }
        return res.data;
      } catch (err) {
        try {
          const cached = await db.query_cache.get('user-me');
          if (cached?.data) return cached.data;
        } catch (e) {}
        return {
          id: user_info?.user_id,
          role: user_info?.role,
          branch: user_info?.branch_id,
          accessible_branches: user_info?.accessible_branches || [],
        };
      }
    },
    staleTime: Infinity,
  });

  const perms = userData.permissions || {};
  const userRole = (userData.role || user_info?.role || "").toLowerCase();

  const { data: studentData = {}, isLoading: studentLoading } = useQuery({
    queryKey: ['student', student_id],
    enabled: !!student_id && (!!userData.id || !!user_info?.user_id),
    queryFn: async () => {
      try {
        const res = await api.get(`/groups/nested_students/${student_id}/`);
        const data = res.data;
        if (data && data.id) {
          try {
            await db.query_cache.put({
              query_key: `nested_students_${student_id}`,
              data,
              updated_at: new Date().toISOString(),
            });
          } catch (e) {}
        }
        if (dispatch) {
          dispatch({
            type: 'SET_EDIT_DATA',
            payload: {
              full_name: data.full_name || "",
              phone: data.phone || "",
              parent_name: data.parent_name || "",
              parent_phone: data.parent_phone || "",
              address: data.address || "",
              notes: data.notes || "",
              birth_date: data.birth_date || "",
              group: (typeof data.group === 'object' && data.group !== null)
                ? (data.group.id ?? "")
                : (data.group || (Array.isArray(data.groups) && data.groups[0]?.id) || ""),
              image: null,
              status: data.status || "regular",
              custom_fee: data.custom_fee || "",
              telegram_id: data.telegram_id || "",
              parent_telegram_id: data.parent_telegram_id || ""
            }
          });
        }
        return data;
      } catch (err) {
        // Fallback 1: db.query_cache ('nested_students_${student_id}')
        try {
          const cached = await db.query_cache.get(`nested_students_${student_id}`);
          if (cached?.data) {
            const data = cached.data;
            if (dispatch) {
              dispatch({
                type: 'SET_EDIT_DATA',
                payload: {
                  full_name: data.full_name || "",
                  phone: data.phone || "",
                  parent_name: data.parent_name || "",
                  parent_phone: data.parent_phone || "",
                  address: data.address || "",
                  notes: data.notes || "",
                  birth_date: data.birth_date || "",
                  group: (typeof data.group === 'object' && data.group !== null)
                    ? (data.group.id ?? "")
                    : (data.group || (Array.isArray(data.groups) && data.groups[0]?.id) || ""),
                  image: null,
                  status: data.status || "regular",
                  custom_fee: data.custom_fee || "",
                  telegram_id: data.telegram_id || "",
                  parent_telegram_id: data.parent_telegram_id || ""
                }
              });
            }
            return data;
          }
        } catch (e) {}

        // Fallback 2: db.students
        try {
          const localSt = await db.students.get(Number(student_id));
          if (localSt) {
            const fallbackGroup = localSt.group || (localSt.group_id ? { id: localSt.group_id, name: localSt.group_name || "Guruh" } : null);
            const fallbackGroups = Array.isArray(localSt.groups) && localSt.groups.length > 0
              ? localSt.groups
              : (fallbackGroup ? [fallbackGroup] : []);

            const fallbackData = {
              id: localSt.id,
              full_name: localSt.full_name,
              phone: localSt.phone,
              parent_name: localSt.parent_name || "",
              parent_phone: localSt.parent_phone || "",
              address: localSt.address || "",
              notes: localSt.notes || "",
              birth_date: localSt.birth_date || "",
              joined_at: localSt.joined_at || localSt.created_at || null,
              status: localSt.status || "regular",
              group: fallbackGroup,
              groups: fallbackGroups,
              finance_profile: localSt.finance_profile || null,
            };
            if (dispatch) {
              dispatch({
                type: 'SET_EDIT_DATA',
                payload: {
                  full_name: fallbackData.full_name || "",
                  phone: fallbackData.phone || "",
                  parent_name: fallbackData.parent_name || "",
                  parent_phone: fallbackData.parent_phone || "",
                  address: "",
                  notes: "",
                  birth_date: "",
                  group: (typeof fallbackData.group === 'object' && fallbackData.group !== null)
                    ? (fallbackData.group.id ?? "")
                    : (fallbackData.group || (Array.isArray(fallbackData.groups) && fallbackData.groups[0]?.id) || ""),
                  image: null,
                  status: fallbackData.status || "regular",
                  custom_fee: "",
                  telegram_id: "",
                  parent_telegram_id: ""
                }
              });
            }
            return fallbackData;
          }
        } catch (e) {}

        throw err;
      }
    }
  });

  const { data: paymentsAllGroupsRaw, isLoading: paymentLoading } = useQuery({
    queryKey: ['payments-all', student_id],
    queryFn: async () => {
      try {
        const res = await api.get(`/finance/student-payments/?student=${student_id}`);
        if (res.data) {
          try {
            await db.query_cache.put({
              query_key: `payments-all_${student_id}`,
              data: res.data,
              updated_at: new Date().toISOString(),
            });
          } catch (e) {}
        }
        return res.data;
      } catch (err) {
        try {
          const cached = await db.query_cache.get(`payments-all_${student_id}`);
          if (cached?.data) return cached.data;
        } catch (e) {}
        return [];
      }
    },
    enabled: !!studentData?.id && (!!userData.id || !!user_info?.user_id),
    staleTime: 1000 * 30,
  });
  const paymentsAllGroups = paymentsAllGroupsRaw?.results || paymentsAllGroupsRaw || [];

  const { data: studentHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['student-history', student_id],
    queryFn: async () => {
      try {
        const res = await api.get(`/finance/student-payments/student-history/${student_id}/`);
        if (res.data) {
          try {
            await db.query_cache.put({
              query_key: `student-history_${student_id}`,
              data: res.data,
              updated_at: new Date().toISOString(),
            });
          } catch (e) {}
        }
        return res.data;
      } catch (err) {
        try {
          const cached = await db.query_cache.get(`student-history_${student_id}`);
          if (cached?.data) return cached.data;
        } catch (e) {}
        return { monthly_payments: [] };
      }
    },
    enabled: !!studentData?.id && (!!userData.id || !!user_info?.user_id),
    staleTime: 1000 * 30,
  });

  const { data: branchGroupsRaw } = useQuery({
    queryKey: ['groups-list', branchID],
    queryFn: async () => {
      try {
        const res = await api.get(`/groups/nested_groups/?branch_id=${branchID}`);
        return res.data;
      } catch (err) {
        try {
          const localGroups = await db.groups.toArray();
          return localGroups || [];
        } catch (e) {
          return [];
        }
      }
    },
    enabled: !!studentData?.id && (!!userData.id || !!user_info?.user_id) && !!branchID,
    staleTime: 1000 * 60,
  });
  const branchGroups = branchGroupsRaw?.results || branchGroupsRaw || [];

  const { data: transfersRaw } = useQuery({
    queryKey: ['student-transfers', student_id],
    queryFn: async () => {
      try {
        const res = await api.get(`/groups/students/${student_id}/transfers/`);
        return res.data;
      } catch (err) {
        return [];
      }
    },
    enabled: !!studentData?.id && (!!userData.id || !!user_info?.user_id),
    staleTime: 1000 * 60,
  });
  const transfers = transfersRaw?.results || transfersRaw || [];

  const permissions = {
    canEditStudent: userRole === "admin" || userRole === "super_admin" || (userRole === "mentor" && perms.students === true),
    canConfirmPayment: userRole === "admin" || userRole === "super_admin",
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
