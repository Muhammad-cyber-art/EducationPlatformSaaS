import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";

export const useAttendance = (group_id, selectedDate, groupStudents, userData) => {
  const [localAttendanceByDate, setLocalAttendanceByDate] = useState({});

  const { data: attendanceDataRaw, refetch: refetchAttends } = useQuery({
    queryKey: ['attendance', group_id, selectedDate],
    queryFn: () => api.get(`/homework_attends/attendances/?group_id=${group_id}&date=${selectedDate}`).then(res => res.data),
    enabled: !!group_id && !!selectedDate && !!userData.id,
    staleTime: 1000 * 60 * 5,
  });

  const attendanceData = attendanceDataRaw?.results || attendanceDataRaw || [];

  const handleLocalAttendanceChange = useCallback((studentId, is_present) => {
    setLocalAttendanceByDate((prev) => ({
      ...prev,
      [selectedDate]: {
        ...(prev[selectedDate] || {}),
        [studentId]: is_present,
      },
    }));
  }, [selectedDate]);

  const mergedAttendanceForDate = useMemo(() => {
    return localAttendanceByDate[selectedDate] || {};
  }, [localAttendanceByDate, selectedDate]);

  const isAttendanceConfirmed = useMemo(() => {
    const attendanceArray = Array.isArray(attendanceData) ? attendanceData : [];
    return attendanceArray.some(a => a.marked_by !== null);
  }, [attendanceData]);

  const handleConfirmAttendance = async (isLessonDay = true) => {
    const students = groupStudents || [];
    if (students.length === 0) return;

    const attendanceArray = Array.isArray(attendanceData) ? attendanceData : [];

    const attendances = students.map((s) => {
      const studentId = Number(s.id);
      const localValue = mergedAttendanceForDate[studentId];
      const existing = attendanceArray.find(a => Number(a.student_id) === studentId);
      
      let is_present;
      if (localValue !== undefined) {
        is_present = localValue;
      } else {
        // Agar dars kuni bo'lmasa va bazadagi rekord hali mentor tomonidan 
        // tasdiqlanmagan bo'lsa (marked_by null), uni "undefined" deb hisoblaymiz.
        if (!isLessonDay && existing && !existing.marked_by) {
          is_present = undefined;
        } else {
          is_present = existing ? existing.is_present : (isLessonDay ? true : undefined);
        }
      }
      return { student_id: studentId, is_present };
    }).filter(a => a.is_present !== undefined);

    const tId = toast.loading("Saqlanmoqda...");
    try {
      await api.post("/homework_attends/attendances/confirm/", {
        group_id: Number(group_id),
        date: selectedDate,
        attendances,
      });

      toast.success("Davomat muvaffaqiyatli saqlandi.", { id: tId });
      
      setLocalAttendanceByDate((prev) => {
        const next = { ...prev };
        delete next[selectedDate];
        return next;
      });
      await refetchAttends();
    } catch (err) {
      console.error("Attendance confirm error:", err);
      const msg = err.response?.data?.detail || err.message || "Davomatni saqlashda xatolik!";
      toast.error(msg, { id: tId });
    }
  };

  return {
    attendanceData,
    mergedAttendanceForDate,
    isAttendanceConfirmed,
    handleLocalAttendanceChange,
    handleConfirmAttendance,
    refetchAttends
  };
};
