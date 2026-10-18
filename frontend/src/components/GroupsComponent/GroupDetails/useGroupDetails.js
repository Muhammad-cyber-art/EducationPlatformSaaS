import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import { get_user_info } from "../../Authorized/getRole";
import { db, cacheUserMe, getCachedUserMe } from "../../../db/db";

const EMPTY_ARRAY = [];

export const useGroupDetails = (group_id, selectedMonth, selectedYear) => {
  const user_info = get_user_info();

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: async () => {
      try {
        const res = await api.get('/user/me/');
        if (res.data) {
          cacheUserMe(res.data);
        }
        return res.data;
      } catch (err) {
        const cached = await getCachedUserMe();
        if (cached) return cached;
        if (user_info) {
          return {
            id: user_info.user_id,
            role: user_info.role,
            is_superuser: user_info.is_superuser,
            branch_id: user_info.branch_id,
            permissions: { students: true, groups: true, attendance: true },
          };
        }
        return {};
      }
    },
    staleTime: Infinity,
  });

  const perms = userData.permissions || {};
  const isSuperAdmin = user_info?.role === "super_admin" || userData?.role === "super_admin";
  const isMentor = user_info?.role === "mentor" || userData?.role === "mentor";
  const isAdmin = user_info?.role === "admin" || userData?.role === "admin";

  const { data: groupinfo = {}, isError: isGroupError, isLoading: isGroupLoading } = useQuery({
    queryKey: ['group-detail', group_id],
    queryFn: async () => {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        const cached = await db.query_cache.get(`group-detail_${group_id}`);
        if (cached?.data) return cached.data;
        const localGroup = await db.groups.get(Number(group_id));
        if (localGroup) return localGroup;
      }

      try {
        const res = await api.get(`/groups/groups/${group_id}/?exclude_students=true`);
        db.query_cache.put({
          query_key: `group-detail_${group_id}`,
          data: res.data,
          updated_at: new Date().toISOString()
        }).catch(() => {});
        return res.data;
      } catch (err) {
        const cached = await db.query_cache.get(`group-detail_${group_id}`);
        if (cached?.data) return cached.data;
        const localGroup = await db.groups.get(Number(group_id));
        if (localGroup) return localGroup;
        throw err;
      }
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!group_id,
  });

  const { data: groupStudentsRaw, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['group-students', group_id],
    queryFn: async () => {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        const cached = (await db.query_cache.get(`group-students_${group_id}`)) ||
                       (await db.query_cache.get(`group-students_${Number(group_id)}`));
        if (cached?.data && Array.isArray(cached.data)) return cached.data;

        try {
          const localStudents = await db.students.where('group_id').equals(Number(group_id)).toArray();
          if (localStudents && localStudents.length > 0) return localStudents;
        } catch (_) {}

        try {
          const allStudents = await db.students.toArray();
          const filtered = allStudents.filter(s => Number(s.group_id) === Number(group_id));
          if (filtered && filtered.length > 0) return filtered;
        } catch (_) {}
      }

      try {
        const res = await api.get(`/groups/groups/${group_id}/students/`);
        db.query_cache.put({
          query_key: `group-students_${group_id}`,
          data: res.data,
          updated_at: new Date().toISOString()
        }).catch(() => {});
        return res.data;
      } catch (err) {
        const cached = (await db.query_cache.get(`group-students_${group_id}`)) ||
                       (await db.query_cache.get(`group-students_${Number(group_id)}`));
        if (cached?.data && Array.isArray(cached.data)) return cached.data;

        try {
          const localStudents = await db.students.where('group_id').equals(Number(group_id)).toArray();
          if (localStudents && localStudents.length > 0) return localStudents;
        } catch (_) {}

        try {
          const allStudents = await db.students.toArray();
          const filtered = allStudents.filter(s => Number(s.group_id) === Number(group_id));
          if (filtered && filtered.length > 0) return filtered;
        } catch (_) {}

        return [];
      }
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!group_id,
  });

  const { data: lessonDates = EMPTY_ARRAY } = useQuery({
    queryKey: ['group-lesson-dates', group_id, selectedMonth, selectedYear],
    queryFn: async () => {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        const cached = await db.query_cache.get(`group-lesson-dates_${group_id}_${selectedMonth}_${selectedYear}`);
        if (cached?.data) return cached.data;
      }

      try {
        const res = await api.get(`/groups/groups/${group_id}/lesson-dates/?month=${selectedMonth}&year=${selectedYear}`);
        db.query_cache.put({
          query_key: `group-lesson-dates_${group_id}_${selectedMonth}_${selectedYear}`,
          data: res.data,
          updated_at: new Date().toISOString()
        }).catch(() => {});
        return res.data;
      } catch (err) {
        const cached = await db.query_cache.get(`group-lesson-dates_${group_id}_${selectedMonth}_${selectedYear}`);
        if (cached?.data) return cached.data;
        const todayStr = new Date().toISOString().split('T')[0];
        return [todayStr];
      }
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!group_id && !!selectedMonth && !!selectedYear,
  });

  // Pagination yoki oddiy massivni qo'llab-quvvatlash
  const groupStudents = groupStudentsRaw?.results || groupStudentsRaw || [];

  const { data: botStats } = useQuery({
    queryKey: ['bot-stats-group', group_id],
    queryFn: async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return {};
      }
      try {
        const res = await api.get(`/bot/statistics/?group_id=${group_id}`);
        return res.data;
      } catch (_) {
        return {};
      }
    },
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
