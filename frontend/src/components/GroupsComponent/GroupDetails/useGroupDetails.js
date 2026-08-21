import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import { get_user_info } from "../../Authorized/getRole";

const EMPTY_ARRAY = [];

export const useGroupDetails = (group_id, selectedMonth, selectedYear) => {
  const user_info = get_user_info();

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me/').then(res => res.data),
    staleTime: Infinity,
  });

  const perms = userData.permissions || {};
  const isSuperAdmin = user_info?.role === "super_admin" || userData?.role === "super_admin";
  const isMentor = user_info?.role === "mentor" || userData?.role === "mentor";
  const isAdmin = user_info?.role === "admin" || userData?.role === "admin";

  const { data: groupinfo = {}, isError: isGroupError, isLoading: isGroupLoading } = useQuery({
    queryKey: ['group-detail', group_id],
    queryFn: () => api.get(`/groups/groups/${group_id}/?exclude_students=true`).then(res => res.data),
    staleTime: 1000 * 60 * 10,
    enabled: !!group_id,
  });

  const { data: groupStudentsRaw, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['group-students', group_id],
    queryFn: () => api.get(`/groups/groups/${group_id}/students/`).then(res => res.data),
    staleTime: 1000 * 60 * 10,
    enabled: !!group_id,
  });

  const { data: lessonDates = EMPTY_ARRAY } = useQuery({
    queryKey: ['group-lesson-dates', group_id, selectedMonth, selectedYear],
    queryFn: () => api.get(`/groups/groups/${group_id}/lesson-dates/?month=${selectedMonth}&year=${selectedYear}`).then(res => res.data),
    staleTime: 0,
    enabled: !!group_id && !!selectedMonth && !!selectedYear,
  });

  // Pagination yoki oddiy massivni qo'llab-quvvatlash
  const groupStudents = groupStudentsRaw?.results || groupStudentsRaw || [];

  const { data: botStats } = useQuery({
    queryKey: ['bot-stats-group', group_id],
    queryFn: () => api.get(`/bot/statistics/?group_id=${group_id}`).then(res => res.data),
    enabled: !!group_id && !!groupinfo.id,
    staleTime: 1000 * 60 * 10,
  });

  const isGroupMentor = useMemo(() => {
    if (isSuperAdmin) return true;
    if (!groupinfo.id) return false;
    const currentUserId = userData.id || user_info?.user_id;
    const isPrimary = Number(groupinfo.mentor?.id) === Number(currentUserId);
    const isAdditional = (groupinfo.additional_mentors || []).some(m => Number(m.mentor) === Number(currentUserId));
    return isPrimary || isAdditional;
  }, [isSuperAdmin, groupinfo, userData, user_info]);

  const permissions = {
    canAddStudent: isSuperAdmin || isAdmin || perms.students === true,
    canEditGroup: (isSuperAdmin || isAdmin || perms.groups === true) && !isMentor,
    canDeleteGroup: (isSuperAdmin || isAdmin || perms.groups === true) && !isMentor,
    canAddMentor: (isSuperAdmin || isAdmin || perms.groups === true) && !isMentor,
    canSendMessage: isAdmin || isSuperAdmin || isMentor,
    canTakeAttendance: isAdmin || isSuperAdmin || isGroupMentor,
    canSeeHomework: isAdmin || isSuperAdmin || isGroupMentor,
    isSuperAdmin,
    isAdmin,
    isMentor,
    isGroupMentor
  };

  return {
    user_info,
    userData,
    groupinfo,
    groupStudents,
    lessonDates,
    botStats,
    permissions,
    isGroupError,
    isGroupLoading,
    isStudentsLoading
  };
};
