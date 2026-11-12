import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { syncService } from '../../../services/syncService';
import { editableAttendanceStudents, sameAttendanceRoster, offlineAttendanceRoster } from '../../../utils/attendanceRoster';
import { get_user_info } from "../../Authorized/getRole";
import {
  saveAttendanceDraft,
  getAttendanceDraft,
  queueAttendanceConfirm,
  db,
} from "../../../db/db";
const EMPTY_STUDENTS = [];

export const useAttendance = (group_id, selectedDate, groupStudents, userData) => {
  const queryClient = useQueryClient();
  const [localAttendanceByDate, setLocalAttendanceByDate] = useState({});
  const user_info = get_user_info();
  const effectiveUserId = userData?.id || user_info?.user_id;

  const fetchRoster = async () => {
    const response = await api.get('/homework_attends/attendances/roster/', {
      params: { group_id, date: selectedDate },
    });
    const students = response.data.students;
    if (response.data.date !== selectedDate || !Array.isArray(students)) throw new Error('Davomat ro‘yxati formati noto‘g‘ri.');
    await db.query_cache.put({ query_key: `attendance-roster_${group_id}_${selectedDate}`,
      data: students, updated_at: new Date().toISOString() }).catch(() => {});
    return students;
  };

  const { data: datedStudents, refetch: refetchRoster } = useQuery({
    queryKey: ['attendance-roster', group_id, selectedDate],
    queryFn: async () => {
      if (navigator.onLine) {
        try { return await fetchRoster(); } catch (_) { /* Use the last dated snapshot offline. */ }
      }
      const cached = await db.query_cache.get(`attendance-roster_${group_id}_${selectedDate}`);
      return cached?.data || offlineAttendanceRoster(groupStudents, selectedDate);
    },
    enabled: !!group_id && !!selectedDate,
    staleTime: 0,
  });
  const attendanceStudents = datedStudents || EMPTY_STUDENTS;

  // 1. Dastlabki yuklanganda IndexedDB'dagi mavjud qoralamani (draft) tiklash
  useEffect(() => {
    let isMounted = true;
    if (group_id && selectedDate) {
      getAttendanceDraft(group_id, selectedDate).then((draft) => {
        if (isMounted && draft && Object.keys(draft).length > 0) {
          setLocalAttendanceByDate((prev) => ({
            ...prev,
            [selectedDate]: {
              ...(prev[selectedDate] || {}),
              ...draft,
            },
          }));
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [group_id, selectedDate]);

  const { data: attendanceDataRaw, refetch: refetchAttends } = useQuery({
    queryKey: ['attendance', group_id, selectedDate],
    queryFn: async () => {
      // 1. Lokal Outbox navbatidagi ushbu guruh va sana bo'yicha pending tasdiqlangan davomatni tekshirish
      let pendingMap = null;
      try {
        const pendingItems = await db.sync_queue
          .where('status')
          .equals('pending')
          .filter(
            (item) =>
              item.entity === 'attendance' &&
              Number(item.data?.group_id) === Number(group_id) &&
              item.data?.date === selectedDate
          )
          .sortBy('queue_id');
        const pendingItem = pendingItems.at(-1);

        if (pendingItem?.data?.attendances) {
          pendingMap = new Map();
          pendingItem.data.attendances.forEach((a) => {
            pendingMap.set(Number(a.student_id), Boolean(a.is_present));
          });
        }
      } catch (e) {}

      let baseList = [];
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (isOffline) {
        // OFFLINE: Tarmoq so'rovini umuman kutmasdan darhol lokal bazadan o'qiymiz (0ms delay!)
        try {
          const cached = await db.query_cache.get(`attendance_${group_id}_${selectedDate}`);
          if (cached?.data) {
            baseList = cached.data?.results || cached.data || [];
          } else {
            const localAtts = await db.attendance_records
              .where('group_id')
              .equals(Number(group_id))
              .filter((a) => a.date === selectedDate)
              .toArray();
            baseList = localAtts || [];
          }
        } catch (_) {
          baseList = [];
        }
      } else {
        // ONLINE: Serverdan olishga urinamiz
        try {
          const res = await api.get(`/homework_attends/attendances/?group_id=${group_id}&date=${selectedDate}`);
          const serverData = res.data?.results || res.data || [];
          baseList = serverData;

          // Faqat pending bo'lmagandagina server ma'lumotini keshga saqlaymiz
          if (!pendingMap) {
            db.query_cache.put({
              query_key: `attendance_${group_id}_${selectedDate}`,
              data: serverData,
              updated_at: new Date().toISOString()
            }).catch(() => {});
          }
        } catch (err) {
          try {
            const cached = await db.query_cache.get(`attendance_${group_id}_${selectedDate}`);
            if (cached?.data) {
              baseList = cached.data?.results || cached.data || [];
            } else {
              const localAtts = await db.attendance_records
                .where('group_id')
                .equals(Number(group_id))
                .filter((a) => a.date === selectedDate)
                .toArray();
              baseList = localAtts || [];
            }
          } catch (_) {
            baseList = [];
          }
        }
      }

      // Agar lokal pending tasdiqlangan davomat bo'lsa, serverdan kelgan (yoki bo'sh) ro'yxat ustiga bosamiz
      if (pendingMap && pendingMap.size > 0) {
        const mergedList = [];
        const seenStudents = new Set();

        (baseList || []).forEach((item) => {
          const sId = Number(item.student_id);
          seenStudents.add(sId);
          if (pendingMap.has(sId)) {
            mergedList.push({
              ...item,
              is_present: pendingMap.get(sId),
              marked_by: item.marked_by || { id: effectiveUserId || 1, full_name: user_info?.full_name || 'Men' },
            });
          } else {
            mergedList.push(item);
          }
        });

        pendingMap.forEach((is_pres, sId) => {
          if (!seenStudents.has(sId)) {
            mergedList.push({
              group_id: Number(group_id),
              date: selectedDate,
              student_id: sId,
              is_present: is_pres,
              marked_by: { id: effectiveUserId || 1, full_name: user_info?.full_name || 'Men' },
            });
          }
        });

        return mergedList;
      }

      return baseList;
    },
    enabled: !!group_id && !!selectedDate,
    staleTime: 1000 * 60 * 5,
  });

  const attendanceData = attendanceDataRaw?.results || attendanceDataRaw || [];
  const refreshAttendance = useCallback(() => Promise.all([refetchAttends(), refetchRoster()]), [refetchAttends, refetchRoster]);

  // 2. Har bir o'zgarishda Auto-save: ham React state, ham IndexedDB ga yoziladi
  const handleLocalAttendanceChange = useCallback(
    (studentId, is_present) => {
      setLocalAttendanceByDate((prev) => {
        const currentDateMap = {
          ...(prev[selectedDate] || {}),
          [studentId]: is_present,
        };

        // Async IndexedDB draft saqlash
        saveAttendanceDraft(group_id, selectedDate, currentDateMap).catch((e) =>
          console.warn('[Attendance] Draft save error:', e)
        );

        return {
          ...prev,
          [selectedDate]: currentDateMap,
        };
      });
    },
    [group_id, selectedDate]
  );

  const mergedAttendanceForDate = useMemo(() => {
    return localAttendanceByDate[selectedDate] || {};
  }, [localAttendanceByDate, selectedDate]);

  const isAttendanceConfirmed = useMemo(() => {
    const attendanceArray = Array.isArray(attendanceData) ? attendanceData : [];
    const eligible = new Set(editableAttendanceStudents(attendanceStudents).map(student => Number(student.id)));
    const relevant = attendanceArray.filter(row => eligible.has(Number(row.student_id)));
    if (eligible.size === 0) return false;
    const markedCount = relevant.filter(
      (a) => a.marked_by !== null && a.marked_by !== undefined
    ).length;
    // Barcha yoki ko'pchilik (>=70%) o'quvchilar tasdiqlangandagina TAYYOR deb hisoblanadi
    return markedCount > 0 && markedCount >= Math.ceil(eligible.size * 0.7);
  }, [attendanceData, attendanceStudents]);

  // 3. Tasdiqlash (Local-First Architecture):
  // Persist the outbox first, then update the UI and submit that exact operation.
  // A timeout keeps the operation for retry with the same durable identity.
  const handleConfirmAttendance = async (isLessonDay = true) => {
    // Dars bo'lmagan kunda davomat olishni qat'iy cheklash
    if (!isLessonDay) {
      toast.error("Bu kun guruh jadvalida dars kuni emas! Dars bo'lmagan kunga davomat olib bo'lmaydi.");
      return;
    }

    // 1. O'quvchilarni olish va dublikatlardan tozalash
    let roster = attendanceStudents;
    if (navigator.onLine) {
      try {
        const fresh = await fetchRoster();
        queryClient.setQueryData(['attendance-roster', group_id, selectedDate], fresh);
        if (!sameAttendanceRoster(roster, fresh)) {
          toast('Guruh ro‘yxati o‘zgargan. Ro‘yxat yangilandi — davomatni tekshirib, qayta tasdiqlang.', { icon: 'ℹ️', duration: 6000 });
          return;
        }
        roster = fresh;
      } catch (error) {
        if (error.response) {
          toast.error(error.response.data?.detail || 'Davomat ro‘yxatini yangilab bo‘lmadi.');
          return;
        }
        // A network outage may use the dated local snapshot; the server still
        // validates membership when this immutable operation is replayed.
      }
    }
    const uniqueStudentsMap = new Map();
    editableAttendanceStudents(roster).forEach((s) => {
      const sId = Number(s.id);
      if (sId && !uniqueStudentsMap.has(sId)) {
        uniqueStudentsMap.set(sId, s);
      }
    });
    const students = Array.from(uniqueStudentsMap.values());

    if (students.length === 0) {
      toast('Tanlangan sana uchun davomat olinadigan faol o‘quvchi topilmadi.', { icon: 'ℹ️' });
      return;
    }

    const attendanceArray = Array.isArray(attendanceData) ? attendanceData : [];

    const attendances = students
      .filter((s) => !s.is_frozen)
      .map((s) => {
        const studentId = Number(s.id);
        const localValue = mergedAttendanceForDate[studentId];
        const existing = attendanceArray.find((a) => Number(a.student_id) === studentId);

        let is_present;
        if (localValue !== undefined) {
          is_present = localValue;
        } else {
          if (!isLessonDay && existing && !existing.marked_by) {
            is_present = undefined;
          } else {
            is_present = existing ? existing.is_present : isLessonDay ? true : undefined;
          }
        }
        return { student_id: studentId, is_present };
      })
      .filter((a) => a.is_present !== undefined);

    const tId = toast.loading("Saqlanmoqda...");

    const userAudit = {
      id: effectiveUserId || 1,
      full_name: user_info?.full_name || userData?.full_name || 'Men'
    };

    let queued;
    try {
      // Do not claim local durability until the IndexedDB transaction commits.
      queued = await queueAttendanceConfirm(group_id, selectedDate, attendances, userAudit);
    } catch (dbErr) {
      console.error('[Attendance] Local save failed:', dbErr);
      toast.error("Davomat qurilmada saqlanmadi. Sahifani yopmang va qayta urinib ko‘ring.", { id: tId });
      return;
    }

    // Optimistic UI is applied only after local persistence succeeds.
    const optimisticConfirmedList = attendances.map((item) => ({
      group_id: Number(group_id),
      date: selectedDate,
      student_id: Number(item.student_id),
      is_present: Boolean(item.is_present),
      marked_by: userAudit,
      updated_at: new Date().toISOString(),
    }));

    queryClient.setQueryData(['attendance', String(group_id), selectedDate], optimisticConfirmedList);
    queryClient.setQueryData(['attendance', Number(group_id), selectedDate], optimisticConfirmedList);

    const todayStrActual = new Date().toLocaleDateString('sv-SE');
    if (selectedDate === todayStrActual) {
      // Guruhlar ro'yxatida (GroupCard) davomat holatini darhol optimistik 'Qilindi' ga o'tkazish (0ms)
      queryClient.setQueriesData({ queryKey: ['groups'] }, (old) => {
        if (!old) return old;
        const updateGrp = (g) => Number(g.id) === Number(group_id) ? { ...g, today_attendance_confirmed: true } : g;
        if (old.pages && Array.isArray(old.pages)) {
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              results: Array.isArray(p.results) ? p.results.map(updateGrp) : p.results,
            })),
          };
        }
        if (Array.isArray(old)) return old.map(updateGrp);
        if (old.results && Array.isArray(old.results)) return { ...old, results: old.results.map(updateGrp) };
        return old;
      });
      db.groups.update(Number(group_id), { today_attendance_confirmed: true }).catch(() => {});
    }

    setLocalAttendanceByDate((prev) => {
      const next = { ...prev };
      delete next[selectedDate];
      return next;
    });

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      toast.success(
        "Davomat oflayn saqlandi! Internetga ulanganda avtomatik sinxronlanadi.",
        { id: tId, icon: "💾", duration: 3500 }
      );
      return;
    }

    // 3. Onlayn bo'lsa serverga jo'natishga urinamiz
    toast.loading('Davomat qurilmada saqlandi. Server tasdig‘i kutilmoqda...', { id: tId });
    try {
      await syncService.pushAttendance(queued.queueId);
      const remaining = await db.sync_queue.get(queued.queueId);
      if (remaining?.status === 'failed') {
        toast.error(`Server davomatni qabul qilmadi: ${remaining.last_error || 'Ma’lumotlarni tekshiring.'}`, { id: tId, duration: 6000 });
        await refreshAttendance();
        queryClient.invalidateQueries({ queryKey: ['attendance-roster', group_id, selectedDate] });
        queryClient.invalidateQueries({ queryKey: ['groups'] });
        return;
      }
      if (remaining) {
        toast('Davomat qurilmada saqlandi. Server tasdig‘i kutilmoqda; avtomatik qayta yuboriladi.',
          { id: tId, icon: '⏳', duration: 4500 });
        return;
      }

      toast.success("Davomat muvaffaqiyatli saqlandi.", { id: tId });
      await refreshAttendance();
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-detail', String(group_id)] });
      queryClient.invalidateQueries({ queryKey: ['group-detail', Number(group_id)] });
    } catch (err) {
      const status = err.response?.status;
      if (status && [400, 403, 404, 422].includes(status)) {
        const detail = err.response?.data?.detail || 'Server so‘rovni rad etdi. Ma’lumotlarni tekshiring.';
        await db.sync_queue.update(queued.queueId, { status: 'failed', last_error: detail });
        toast.error(detail, { id: tId, duration: 6000 });
        await refreshAttendance();
        queryClient.invalidateQueries({ queryKey: ['groups'] });
      } else {
        toast('Davomat qurilmada saqlandi. Server tasdig‘i kutilmoqda; avtomatik qayta yuboriladi.',
          { id: tId, icon: '⏳', duration: 4500 });
      }
    }
  };

  return {
    attendanceData,
    attendanceStudents,
    mergedAttendanceForDate,
    isAttendanceConfirmed,
    handleLocalAttendanceChange,
    handleConfirmAttendance,
    refetchAttends: refreshAttendance,
  };
};
