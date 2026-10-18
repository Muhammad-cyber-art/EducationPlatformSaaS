import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { get_user_info } from "../../Authorized/getRole";
import {
  saveAttendanceDraft,
  getAttendanceDraft,
  clearAttendanceDraft,
  queueAttendanceConfirm,
  db,
} from "../../../db/db";

export const useAttendance = (group_id, selectedDate, groupStudents, userData) => {
  const queryClient = useQueryClient();
  const [localAttendanceByDate, setLocalAttendanceByDate] = useState({});
  const user_info = get_user_info();
  const effectiveUserId = userData?.id || user_info?.user_id;

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
        const pendingItem = await db.sync_queue
          .where('status')
          .equals('pending')
          .filter(
            (item) =>
              item.entity === 'attendance' &&
              Number(item.data?.group_id) === Number(group_id) &&
              item.data?.date === selectedDate
          )
          .first();

        if (pendingItem?.data?.attendances) {
          pendingMap = new Map();
          pendingItem.data.attendances.forEach((a) => {
            pendingMap.set(Number(a.student_id), Boolean(a.is_present));
          });
        }
      } catch (e) {}

      let baseList = [];
      try {
        const res = await api.get(`/homework_attends/attendances/?group_id=${group_id}&date=${selectedDate}`);
        const serverData = res.data?.results || res.data || [];
        baseList = serverData;

        // Faqat pending bo'lmagandagina server ma'lumotini keshga to'liq saqlaymiz
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
              .filter(a => a.date === selectedDate)
              .toArray();
            baseList = localAtts || [];
          }
        } catch (cacheErr) {
          baseList = [];
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
              marked_by: item.marked_by || { id: effectiveUserId, full_name: user_info?.full_name || 'Men' },
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
              marked_by: { id: effectiveUserId, full_name: user_info?.full_name || 'Men' },
            });
          }
        });

        return mergedList;
      }

      return baseList;
    },
    enabled: !!group_id && !!selectedDate && !!effectiveUserId,
    staleTime: 1000 * 60 * 5,
  });

  const attendanceData = attendanceDataRaw?.results || attendanceDataRaw || [];

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
    return attendanceArray.some((a) => a.marked_by !== null && a.marked_by !== undefined);
  }, [attendanceData]);

  // 3. Tasdiqlash (Offline-First): Internet bo'lsa serverga, yo'q bo'lsa darhol Outbox navbatiga!
  const handleConfirmAttendance = async (isLessonDay = true) => {
    const students = groupStudents || [];
    if (students.length === 0) return;

    const attendanceArray = Array.isArray(attendanceData) ? attendanceData : [];

    const attendances = students
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

    // Darhol UI keshiga optimistic confirmed holatini qo'llash
    const optimisticConfirmedList = attendances.map((item) => ({
      group_id: Number(group_id),
      date: selectedDate,
      student_id: Number(item.student_id),
      is_present: Boolean(item.is_present),
      marked_by: { id: effectiveUserId, full_name: user_info?.full_name || 'Men' },
      updated_at: new Date().toISOString(),
    }));

    queryClient.setQueryData(['attendance', String(group_id), selectedDate], optimisticConfirmedList);
    queryClient.setQueryData(['attendance', Number(group_id), selectedDate], optimisticConfirmedList);

    try {
      await db.query_cache.put({
        query_key: `attendance_${group_id}_${selectedDate}`,
        data: optimisticConfirmedList,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {}

    // Agar internet umuman bo'lmasa — darhol lokal Outbox ga yozamiz
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      try {
        await queueAttendanceConfirm(group_id, selectedDate, attendances, {
          id: effectiveUserId,
          full_name: user_info?.full_name || 'Men',
        });
        await clearAttendanceDraft(group_id, selectedDate);
        setLocalAttendanceByDate((prev) => {
          const next = { ...prev };
          delete next[selectedDate];
          return next;
        });
        toast.success(
          "Davomat oflayn saqlandi! Internetga ulanganda avtomatik sinxronlanadi.",
          { id: tId, icon: "💾", duration: 4000 }
        );
        return;
      } catch (offlineErr) {
        toast.error("Oflayn saqlashda xatolik yuz berdi!", { id: tId });
        return;
      }
    }

    // Onlayn bo'lsa serverga jo'natamiz, tarmoq xatosi bo'lsa esa graceful fallback qilamiz
    try {
      await api.post("/homework_attends/attendances/confirm/", {
        group_id: Number(group_id),
        date: selectedDate,
        attendances,
      });

      await clearAttendanceDraft(group_id, selectedDate);
      toast.success("Davomat muvaffaqiyatli saqlandi.", { id: tId });

      setLocalAttendanceByDate((prev) => {
        const next = { ...prev };
        delete next[selectedDate];
        return next;
      });
      await refetchAttends();
    } catch (err) {
      const isNetworkError =
        !err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED';

      if (isNetworkError) {
        // Tarmoq kutilmaganda uzildi — navbatga saqlab qo'yamiz
        await queueAttendanceConfirm(group_id, selectedDate, attendances, {
          id: effectiveUserId,
          full_name: user_info?.full_name || 'Men',
        });
        await clearAttendanceDraft(group_id, selectedDate);
        setLocalAttendanceByDate((prev) => {
          const next = { ...prev };
          delete next[selectedDate];
          return next;
        });
        toast.success(
          "Aloqa uzildi, lekin davomat lokal saqlandi. Internet kelganda jo'natiladi.",
          { id: tId, icon: "💾", duration: 4000 }
        );
      } else {
        console.error("Attendance confirm error:", err);
        const msg = err.response?.data?.detail || err.message || "Davomatni saqlashda xatolik!";
        toast.error(msg, { id: tId });
      }
    }
  };

  return {
    attendanceData,
    mergedAttendanceForDate,
    isAttendanceConfirmed,
    handleLocalAttendanceChange,
    handleConfirmAttendance,
    refetchAttends,
  };
};
