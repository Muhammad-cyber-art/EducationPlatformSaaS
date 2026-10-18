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

  // 3. Tasdiqlash (Local-First Architecture):
  // 1-qadam: Darhol UI keshiga qo'llash (0ms)
  // 2-qadam: Har doim Dexie va Outbox ga yozish (Ma'lumot yo'qolishiga mutlaqo yo'l qo'yilmaydi)
  // 3-qadam: Agar onlayn bo'lsa serverga yuborish, server xato bersa ham navbatda saqlab qolish
  const handleConfirmAttendance = async (isLessonDay = true) => {
    // 1. O'quvchilarni olish va dublikatlardan tozalash
    const uniqueStudentsMap = new Map();
    (groupStudents || []).forEach((s) => {
      const sId = Number(s.id);
      if (sId && !uniqueStudentsMap.has(sId)) {
        uniqueStudentsMap.set(sId, s);
      }
    });
    const students = Array.from(uniqueStudentsMap.values());

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

    const userAudit = {
      id: effectiveUserId || 1,
      full_name: user_info?.full_name || userData?.full_name || 'Men'
    };

    // 1. Darhol UI keshiga optimistic confirmed holatini qo'llash (0ms feedback)
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

    // 2. Har doim birinchi bo'lib lokal Dexie va Outbox ga yozamiz (Local-First Guarantee)
    try {
      await queueAttendanceConfirm(group_id, selectedDate, attendances, userAudit);
      await clearAttendanceDraft(group_id, selectedDate);
      setLocalAttendanceByDate((prev) => {
        const next = { ...prev };
        delete next[selectedDate];
        return next;
      });
    } catch (dbErr) {
      console.error("[Attendance] Dexie save error:", dbErr);
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      toast.success(
        "Davomat oflayn saqlandi! Internetga ulanganda avtomatik sinxronlanadi.",
        { id: tId, icon: "💾", duration: 3500 }
      );
      return;
    }

    // 3. Onlayn bo'lsa serverga jo'natishga urinamiz
    try {
      await api.post("/homework_attends/attendances/confirm/", {
        group_id: Number(group_id),
        date: selectedDate,
        attendances,
      });

      // Server qabul qildi — outbox navbatidagi yozuvni tozalaymiz (chunki allaqachon serverda saqlandi)
      try {
        const queueItems = await db.sync_queue
          .where('status')
          .equals('pending')
          .filter(
            (q) =>
              q.entity === 'attendance' &&
              Number(q.data?.group_id) === Number(group_id) &&
              q.data?.date === selectedDate
          )
          .toArray();

        if (queueItems.length > 0) {
          await db.sync_queue.bulkDelete(queueItems.map((q) => q.queue_id));
        }
      } catch (_) {}

      toast.success("Davomat muvaffaqiyatli saqlandi.", { id: tId });
      await refetchAttends();
    } catch (err) {
      // Serverda 500 yoki aloqa xatosi bo'lsa ham — lokal bazada va outbox navbatida allaqachon saqlangan!
      console.warn("[Attendance] Online confirm failed, kept in outbox queue:", err);
      toast.success(
        "Davomat lokal saqlandi! Server bilan aloqa tiklanganda avtomatik yuboriladi.",
        { id: tId, icon: "💾", duration: 4000 }
      );
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
