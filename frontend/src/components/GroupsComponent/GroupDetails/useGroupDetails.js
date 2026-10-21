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
        const cached = (await db.query_cache.get(`group-lesson-dates_${group_id}_${selectedMonth}_${selectedYear}`)) ||
                       (await db.query_cache.get(`group-lesson-dates_${Number(group_id)}_${selectedMonth}_${selectedYear}`));
        if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
          return cached.data;
        }
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
        const cached = (await db.query_cache.get(`group-lesson-dates_${group_id}_${selectedMonth}_${selectedYear}`)) ||
                       (await db.query_cache.get(`group-lesson-dates_${Number(group_id)}_${selectedMonth}_${selectedYear}`));
        if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
          return cached.data;
        }

        // Oflayn rejimda dars kunlarini guruh jadvalidan avtomatik hisoblash (Oflayn generatsiya)
        try {
          const grp = (await db.groups.get(Number(group_id))) || (await db.groups.get(String(group_id)));
          if (grp) {
            const days = grp.days;
            const customDays = Array.isArray(grp.custom_days) ? grp.custom_days.map(Number) : [];
            const darsKunlari = (grp.dars_kunlari || '').toLowerCase();
            const specialDates = new Set(grp.special_lesson_dates || []);
            const canceledDates = new Set(grp.canceled_lesson_dates || []);
            const startDate = grp.start_date || '';

            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
            const computedDates = [];
            for (let day = 1; day <= daysInMonth; day++) {
              const dStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              if (startDate && dStr < startDate) continue;
              if (canceledDates.has(dStr)) continue;
              if (specialDates.has(dStr)) {
                computedDates.push(dStr);
                continue;
              }
              const dow = new Date(selectedYear, selectedMonth - 1, day).getDay();
              if (dow === 0) continue;
              let isMatch = false;
              if (days === 'odd' || darsKunlari.includes('dush') || darsKunlari.includes('toq')) {
                isMatch = [1, 3, 5].includes(dow);
              } else if (days === 'even' || darsKunlari.includes('sesh') || darsKunlari.includes('juft')) {
                isMatch = [2, 4, 6].includes(dow);
              } else if (days === 'everyday' || darsKunlari.includes('har kun')) {
                isMatch = [1, 2, 3, 4, 5, 6].includes(dow);
              } else if (days === 'custom' && customDays.length > 0) {
                isMatch = customDays.includes(dow);
              }
              if (isMatch) computedDates.push(dStr);
            }
            if (computedDates.length > 0) {
              return computedDates.sort((a, b) => b.localeCompare(a));
            }
          }
        } catch (_) {}

        const todayStr = new Date().toLocaleDateString('sv-SE');
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
    hasFullAttendance: isSuperAdmin || (isAdmin && perms.full_attendance === true),
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
