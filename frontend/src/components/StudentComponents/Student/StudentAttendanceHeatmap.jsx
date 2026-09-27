import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Flame,
  Award,
  Filter,
  Loader2,
  CalendarDays,
  Info,
  LayoutGrid,
  Columns,
  RotateCw,
  GraduationCap
} from "lucide-react";

const MONTH_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"
];

const DAY_NAMES = [
  { full: "Dushanba", short: "Du" },
  { full: "Seshanba", short: "Se" },
  { full: "Chorshanba", short: "Ch" },
  { full: "Payshanba", short: "Pa" },
  { full: "Juma", short: "Ju" },
  { full: "Shanba", short: "Sh" },
  { full: "Yakshanba", short: "Ya" },
];

export default function StudentAttendanceHeatmap({ studentId, studentName, studentGroups = [] }) {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [viewMode, setViewMode] = useState("horizontal"); // 'horizontal' (GitHub matrix) or 'calendar' (7-col calendar)
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const isCurrentMonth =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;

  // Asinxron ma'lumot olish (Lazy load - faqat o'quvchi ID va oy bo'yicha)
  const {
    data: attendancePayload,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "student-monthly-attendance",
      studentId,
      selectedYear,
      selectedMonth,
      selectedGroupId,
    ],
    queryFn: async () => {
      let url = `/homework_attends/attendances/student-monthly/?student_id=${studentId}&year=${selectedYear}&month=${selectedMonth}`;
      if (selectedGroupId && String(selectedGroupId).trim() !== "") {
        url += `&group_id=${selectedGroupId}`;
      }
      const res = await api.get(url);
      return res.data;
    },
    enabled: !!studentId,
    staleTime: 1000 * 60, // 1 daqiqa
    keepPreviousData: true,
  });

  const stats = attendancePayload?.stats || {
    total_scheduled: 0,
    total_passed: 0,
    attended_count: 0,
    absent_count: 0,
    unconfirmed_count: 0,
    future_count: 0,
    attendance_rate: 100,
  };

  const groups = attendancePayload?.groups || [];
  const days = attendancePayload?.days || [];

  // O'quvchi a'zo bo'lgan barcha guruhlar ro'yxati (props + api payload birlashmasi)
  const allGroupsList = useMemo(() => {
    const fromProps = Array.isArray(studentGroups) ? studentGroups : [];
    const fromPayload = Array.isArray(groups) ? groups : [];
    const map = new Map();
    [...fromProps, ...fromPayload].forEach((g) => {
      if (g && g.id) {
        map.set(String(g.id), { id: g.id, name: g.name });
      }
    });
    return Array.from(map.values());
  }, [studentGroups, groups]);

  // Sahifa aylantirilganda (scroll) tooltipni xavfsiz yopish
  useEffect(() => {
    const handleScroll = () => {
      if (hoveredDay) setHoveredDay(null);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hoveredDay]);

  // Oylarni navigatsiya qilish
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleGoToday = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth() + 1);
  };

  // 1. GitHub uslubidagi 7 qatorlik gorizontal matritsa (Dushanba..Yakshanba x Haftalar)
  const horizontalGrid = useMemo(() => {
    if (!days.length) return { rows: [], numWeeks: 0 };

    const firstDayOfWeek = days[0].day_of_week; // 0=Du, 6=Ya
    const totalSlots = firstDayOfWeek + days.length;
    const numWeeks = Math.ceil(totalSlots / 7);

    // 7 ta qator (qator = hafta kuni, 0=Du, 1=Se, ..., 6=Ya)
    const rows = Array.from({ length: 7 }, () => Array(numWeeks).fill(null));

    days.forEach((dayObj) => {
      const slotIndex = firstDayOfWeek + (dayObj.day - 1);
      const colIndex = Math.floor(slotIndex / 7);
      const rowIndex = dayObj.day_of_week;
      if (rows[rowIndex] && colIndex < numWeeks) {
        rows[rowIndex][colIndex] = dayObj;
      }
    });

    return { rows, numWeeks };
  }, [days]);

  // 2. Standart 7 ustunlik to'liq kalendar jadvali (Ustun = Dushanba..Yakshanba, Qator = Haftalar)
  const calendarColsGrid = useMemo(() => {
    if (!days.length) return [];

    const firstDayOfWeek = days[0].day_of_week;
    const totalSlots = firstDayOfWeek + days.length;
    const numWeeks = Math.ceil(totalSlots / 7);

    const weeks = Array.from({ length: numWeeks }, () => Array(7).fill(null));

    days.forEach((dayObj) => {
      const slotIndex = firstDayOfWeek + (dayObj.day - 1);
      const weekIdx = Math.floor(slotIndex / 7);
      const dayIdx = dayObj.day_of_week;
      if (weeks[weekIdx] && dayIdx < 7) {
        weeks[weekIdx][dayIdx] = dayObj;
      }
    });

    return weeks;
  }, [days]);

  // Tooltip koordinatalari (ekrandan chiqib ketishini oldini oluvchi clamping)
  const handleMouseEnter = (day, e) => {
    if (!day) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = rect.left + rect.width / 2;
    const screenWidth = typeof window !== "undefined" ? window.innerWidth : 800;
    const clampedX = Math.max(140, Math.min(screenWidth - 140, rawX));
    setTooltipPos({
      x: clampedX,
      y: rect.top - 8,
    });
    setHoveredDay(day);
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  // Katak uslublari (och va to'yg'in yashil, qon kabi qizil, toza adaptiv fon)
  const getCellClasses = (day, isLarge = false) => {
    if (!day) return "bg-transparent opacity-0 pointer-events-none border-transparent";

    const base = isLarge
      ? "relative rounded-xl p-2.5 transition-all duration-200 cursor-pointer select-none border flex flex-col justify-between"
      : "relative rounded-xl px-2.5 sm:px-3.5 py-1.5 transition-all duration-200 cursor-pointer select-none border flex items-center justify-between";

    switch (day.status) {
      case "present":
        // Och va to'yg'in yashil (Vibrant Emerald) - text-white-force orqali har ikki mavzuda ham oq matn
        return `${base} bg-[#16a34a] hover:bg-[#15803d] border-[#4ade80] text-white shadow-[0_0_16px_rgba(22,163,74,0.35)] hover:scale-[1.02] font-black z-10 text-white-force`;
      case "absent":
        // Qon kabi qizil (Deep Crimson / Blood Red) - text-white-force orqali har ikki mavzuda ham oq matn
        return `${base} bg-[#991b1b] hover:bg-[#7f1d1d] border-[#ef4444] text-white shadow-[0_0_16px_rgba(153,27,27,0.45)] hover:scale-[1.02] font-black z-10 text-white-force`;
      case "unconfirmed":
        return `${base} bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-[#fde68a] hover:bg-amber-500/25 hover:border-amber-400 shadow-sm hover:scale-[1.02] z-10`;
      case "future":
        return `${base} border-dashed border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-[#38bdf8] hover:border-sky-400 hover:bg-sky-500/20 hover:scale-[1.02]`;
      case "not_joined":
        return `${base} bg-black/5 dark:bg-white/[0.02] border-black/5 dark:border-white/5 text-[var(--text-muted)] opacity-40 cursor-not-allowed`;
      case "no_lesson":
      default:
        // Adaptiv yengil fon (Lightda och qumtosh/oqish, Darkda qora obsidian)
        return `${base} bg-[var(--bg-void)]/60 dark:bg-white/[0.02] border-[var(--border-glass)] text-[var(--text-muted)] hover:border-[var(--gold)]/40 hover:bg-[var(--gold)]/5 hover:text-[var(--text-primary)]`;
    }
  };

  return (
    <div className="lux-card space-y-6 border border-[var(--border-glass)] shadow-xl relative overflow-visible w-full bg-[var(--card-bg)]">
      {/* 1. HEADER: Title, Month Navigation & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[var(--border-glass)]">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/25 flex items-center justify-center text-[var(--gold)] shadow-sm shrink-0">
            <CalendarIcon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)] tracking-tight">
                Davomat faolligi kalendari
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/25 text-[var(--gold)] text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Flame size={11} /> 1 oylik heatmap
              </span>
            </div>
            <p className="text-[10px] font-bold text-[var(--text-muted)] mt-0.5">
              GitHub uslubidagi darsga qatnashish tahlili
            </p>
          </div>
        </div>

        {/* Boshqaruv elementlari */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Ko'rinish rejimi: Gorizontal Matritsa vs 7-ustunlik Kalendar */}
          <div className="flex items-center bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setViewMode("horizontal")}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                viewMode === "horizontal"
                  ? "bg-[var(--gold)] text-white text-white-force shadow-md font-black"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              title="Gorizontal keng matritsa"
            >
              <Columns size={13} />
              <span className="hidden sm:inline">Gorizontal</span>
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                viewMode === "calendar"
                  ? "bg-[var(--gold)] text-white text-white-force shadow-md font-black"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              title="Klassik 7-ustunlik kalendar"
            >
              <LayoutGrid size={13} />
              <span className="hidden sm:inline">Kalendar</span>
            </button>
          </div>

          {/* Oylik navigatsiya */}
          <div className="flex items-center gap-1 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl p-1 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--gold)] hover:bg-[var(--gold)]/10 rounded-lg transition-all active:scale-95"
              title="Oldingi oy"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="px-3 text-xs font-black text-[var(--text-primary)] min-w-[110px] text-center whitespace-nowrap">
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </span>

            <button
              onClick={handleNextMonth}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--gold)] hover:bg-[var(--gold)]/10 rounded-lg transition-all active:scale-95"
              title="Keyingi oy"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {!isCurrentMonth && (
            <button
              onClick={handleGoToday}
              className="h-8 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider hover:bg-emerald-500/25 transition-all active:scale-95 flex items-center gap-1"
            >
              Bugun
            </button>
          )}

          {isFetching && (
            <Loader2
              size={16}
              className="animate-spin text-[var(--gold)] opacity-70"
            />
          )}
        </div>
      </div>

      {/* 2. GURUH TAGLARI (GROUP FILTER PILLS) */}
      {allGroupsList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1 pb-1">
          <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mr-1 flex items-center gap-1.5 shrink-0">
            <GraduationCap size={14} className="text-[var(--gold)]" /> Guruhlar:
          </span>

          {/* Barcha guruhlar tagi */}
          <button
            onClick={() => setSelectedGroupId("")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 border ${
              !selectedGroupId
                ? "bg-[var(--gold)] text-white text-white-force border-[var(--gold)] shadow-md shadow-[var(--gold)]/20"
                : "bg-[var(--bg-void)] text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/40 hover:text-[var(--text-primary)]"
            }`}
          >
            <span>Barcha guruhlar</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                !selectedGroupId
                  ? "bg-white/25 text-white text-white-force"
                  : "bg-[var(--bg-panel)] text-[var(--text-muted)]"
              }`}
            >
              {allGroupsList.length}
            </span>
          </button>

          {/* Har bir guruh tagi */}
          {allGroupsList.map((g) => {
            const isSelected = String(selectedGroupId) === String(g.id);
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(String(g.id))}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 border ${
                  isSelected
                    ? "bg-[var(--gold)] text-white text-white-force border-[var(--gold)] shadow-md shadow-[var(--gold)]/20"
                    : "bg-[var(--bg-void)] text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/40 hover:text-[var(--text-primary)]"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isSelected ? "bg-white" : "bg-[var(--gold)]"
                  }`}
                />
                <span>{g.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. STATS KPI WIDGETS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full">
        {/* Oydagi darslar */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center gap-3.5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 flex items-center justify-center shrink-0 shadow-sm">
            <CalendarDays size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">
              Oydagi darslar
            </p>
            <p className="text-base sm:text-lg font-black text-[var(--text-primary)] tabular-nums">
              {stats.total_scheduled} ta
            </p>
          </div>
        </div>

        {/* Qatnashdi (Kelgan - Och va to'yg'in yashil) */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3.5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[#16a34a] text-white border border-[#4ade80] flex items-center justify-center shrink-0 shadow-md text-white-force">
            <CheckCircle2 size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[9px] font-black text-emerald-600 dark:text-[#4ade80] uppercase tracking-wider">
              Qatnashdi
            </p>
            <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-[#4ade80] tabular-nums">
              {stats.attended_count} ta
            </p>
          </div>
        </div>

        {/* Qoldirdi (Kelmagan - Qon kabi qizil) */}
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3.5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[#991b1b] text-white border border-[#ef4444] flex items-center justify-center shrink-0 shadow-md text-white-force">
            <XCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[9px] font-black text-red-600 dark:text-[#f87171] uppercase tracking-wider">
              Qoldirdi
            </p>
            <p className="text-base sm:text-lg font-black text-red-600 dark:text-[#f87171] tabular-nums">
              {stats.absent_count} ta
            </p>
          </div>
        </div>

        {/* Davomat darajasi */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center gap-3.5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 flex items-center justify-center shrink-0 shadow-sm">
            <Award size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between items-center">
              <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                Ko'rsatkich
              </p>
              <span className="text-[11px] sm:text-xs font-black text-[var(--gold)] tabular-nums">
                {stats.attendance_rate}%
              </span>
            </div>
            <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden mt-1.5 border border-black/5 dark:border-white/5 shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[var(--gold)] via-emerald-500 to-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                style={{ width: `${Math.min(100, Math.max(0, stats.attendance_rate))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. EXPANDED FULL-WIDTH CALENDAR AREA */}
      <div className="w-full pt-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
            <Loader2 size={32} className="animate-spin text-[var(--gold)]" />
            <p className="text-xs font-bold tracking-wider">Davomat faolligi yuklanmoqda...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-[var(--text-muted)] space-y-3">
            <Info size={28} className="mx-auto mb-2 text-rose-500 opacity-80" />
            <p className="text-sm font-bold text-rose-500">Davomat ma'lumotlarini yuklashda xatolik yuz berdi.</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-bold hover:bg-[var(--gold)]/20 transition-all active:scale-95"
            >
              <RotateCw size={14} /> Qayta yuklash
            </button>
          </div>
        ) : days.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)]">
            <Info size={28} className="mx-auto mb-2 opacity-50 text-[var(--gold)]" />
            <p className="text-sm font-bold">Ushbu oy uchun dars jadvali topilmadi.</p>
          </div>
        ) : viewMode === "horizontal" ? (
          /* ==========================================================
             OPTION A: GITHUB-STYLE EXPANDED HORIZONTAL MATRIX
             7 Rows (Dushanba..Yakshanba) x Full-width Week Columns
             ========================================================== */
          <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
            <div className="w-full min-w-[650px] space-y-2.5">
              {/* Hafta ustunlari sarlavhalari (100% eniga yoyilgan) */}
              <div
                className="grid gap-2 sm:gap-3 w-full items-center mb-1"
                style={{
                  gridTemplateColumns: `48px repeat(${horizontalGrid.numWeeks}, minmax(0, 1fr))`,
                }}
              >
                <div />
                {Array.from({ length: horizontalGrid.numWeeks }).map((_, colIdx) => (
                  <div
                    key={colIdx}
                    className="text-center py-1.5 px-1 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] text-[10px] sm:text-xs font-black text-[var(--gold)] tracking-wider shadow-sm"
                  >
                    {colIdx + 1}-hafta
                  </div>
                ))}
              </div>

              {/* 7 ta hafta kuni qatorlari */}
              <div className="space-y-2 w-full">
                {DAY_NAMES.map((dayName, rowIdx) => (
                  <div
                    key={rowIdx}
                    className="grid gap-2 sm:gap-3 w-full items-center"
                    style={{
                      gridTemplateColumns: `48px repeat(${horizontalGrid.numWeeks}, minmax(0, 1fr))`,
                    }}
                  >
                    {/* Hafta kuni nomi */}
                    <div className="text-right pr-2 text-[10px] sm:text-xs font-black text-[var(--text-muted)] select-none">
                      {dayName.short}
                    </div>

                    {/* Haftalar bo'yicha to'liq eniga cho'zilgan kataklar */}
                    {Array.from({ length: horizontalGrid.numWeeks }).map((_, colIdx) => {
                      const day = horizontalGrid.rows[rowIdx]?.[colIdx];
                      return (
                        <div
                          key={colIdx}
                          onMouseEnter={(e) => day && handleMouseEnter(day, e)}
                          onMouseLeave={handleMouseLeave}
                          className={`w-full h-10 sm:h-12 ${getCellClasses(day, false)}`}
                        >
                          {day && (
                            <>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`text-[11px] sm:text-xs font-black tabular-nums ${
                                    day.status === "present" || day.status === "absent"
                                      ? "text-white text-white-force"
                                      : day.is_today
                                      ? "text-[var(--gold)] underline decoration-2 underline-offset-2 font-black"
                                      : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                                  }`}
                                >
                                  {day.day}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {day.status === "present" && (
                                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-white text-white-force drop-shadow-sm">
                                    <CheckCircle2 size={15} className="shrink-0 text-white" />
                                    <span className="hidden lg:inline text-white font-black text-white-force">Keldi</span>
                                  </span>
                                )}
                                {day.status === "absent" && (
                                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-white text-white-force drop-shadow-sm">
                                    <XCircle size={15} className="shrink-0 text-white" />
                                    <span className="hidden lg:inline text-white font-black text-white-force">Qoldi</span>
                                  </span>
                                )}
                                {day.status === "unconfirmed" && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700 dark:text-[#fde68a]">
                                    <HelpCircle size={13} className="shrink-0" />
                                    <span className="hidden xl:inline">Olinmagan</span>
                                  </span>
                                )}
                                {day.status === "future" && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-sky-700 dark:text-[#38bdf8]">
                                    <Clock size={13} className="shrink-0" />
                                    <span className="hidden xl:inline">Rejada</span>
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ==========================================================
             OPTION B: STANDARD 7-COLUMN FULL-WIDTH CALENDAR
             Columns = Mon..Sun (100% width) x Weeks Rows
             ========================================================== */
          <div className="w-full space-y-2">
            {/* 7 Ustun sarlavhalari */}
            <div className="grid grid-cols-7 gap-2 sm:gap-3 w-full text-center">
              {DAY_NAMES.map((d, idx) => (
                <div
                  key={idx}
                  className="py-2.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] text-[10px] sm:text-xs font-black text-[var(--gold)] uppercase tracking-wider shadow-sm"
                >
                  <span className="hidden sm:inline">{d.full}</span>
                  <span className="sm:hidden">{d.short}</span>
                </div>
              ))}
            </div>

            {/* Haftalar qatorlari */}
            <div className="space-y-2.5 w-full">
              {calendarColsGrid.map((week, weekIdx) => (
                <div key={weekIdx} className="grid grid-cols-7 gap-2 sm:gap-3 w-full">
                  {week.map((day, dayIdx) => (
                    <div
                      key={dayIdx}
                      onMouseEnter={(e) => day && handleMouseEnter(day, e)}
                      onMouseLeave={handleMouseLeave}
                      className={`w-full min-h-[60px] sm:min-h-[74px] ${getCellClasses(
                        day,
                        true
                      )}`}
                    >
                      {day && (
                        <>
                          <div className="flex items-center justify-between w-full">
                            <span
                              className={`text-xs sm:text-sm font-black tabular-nums ${
                                day.status === "present" || day.status === "absent"
                                  ? "text-white text-white-force"
                                  : day.is_today
                                  ? "text-[var(--gold)] font-black ring-1 ring-[var(--gold)] px-1.5 py-0.5 rounded-lg bg-[var(--gold)]/10"
                                  : "text-[var(--text-muted)]"
                              }`}
                            >
                              {day.day}
                            </span>

                            {day.is_today && (
                              <span className="text-[8px] font-black text-amber-500 bg-amber-500/15 border border-amber-500/30 px-1 py-0.5 rounded uppercase hidden md:inline">
                                Bugun
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center justify-between w-full text-[9px] sm:text-[10px] font-black">
                            {day.status === "present" && (
                              <span className="text-white flex items-center gap-1 font-black text-white-force drop-shadow-sm">
                                <CheckCircle2 size={15} className="text-white" />
                                <span className="hidden sm:inline">Kelgan</span>
                              </span>
                            )}
                            {day.status === "absent" && (
                              <span className="text-white flex items-center gap-1 font-black text-white-force drop-shadow-sm">
                                <XCircle size={15} className="text-white" />
                                <span className="hidden sm:inline">Qoldirgan</span>
                              </span>
                            )}
                            {day.status === "unconfirmed" && (
                              <span className="text-amber-700 dark:text-[#fde68a] flex items-center gap-1 font-black">
                                <HelpCircle size={13} />
                                <span className="hidden sm:inline">Olinmagan</span>
                              </span>
                            )}
                            {day.status === "future" && (
                              <span className="text-sky-700 dark:text-[#38bdf8] flex items-center gap-1 font-black">
                                <Clock size={13} />
                                <span className="hidden sm:inline">Rejada</span>
                              </span>
                            )}
                            {day.status === "no_lesson" && (
                              <span className="text-[var(--text-muted)] text-[8px] font-semibold">
                                Dars yo'q
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. FLOATING INTERACTIVE TOOLTIP */}
      {hoveredDay && (
        <div
          className="fixed z-[99999] pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-[#121212] border border-[#333333] text-white rounded-xl px-4 py-2.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 dark-tooltip text-white-force"
          style={{ top: `${tooltipPos.y}px`, left: `${tooltipPos.x}px` }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black text-[var(--gold)]">
              {hoveredDay.date}
            </span>
            <span className="text-[10px] text-[#aaaaaa] font-bold">
              ({DAY_NAMES[hoveredDay.day_of_week]?.full})
            </span>
            {hoveredDay.is_today && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase">
                Bugun
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-black">
            {hoveredDay.status === "present" && (
              <span className="text-[#4ade80] flex items-center gap-1">
                <CheckCircle2 size={14} /> Darsga to'liq qatnashgan (Kelgan)
              </span>
            )}
            {hoveredDay.status === "absent" && (
              <span className="text-[#f87171] flex items-center gap-1">
                <XCircle size={14} /> Dars qoldirgan (Qon qizil)
              </span>
            )}
            {hoveredDay.status === "unconfirmed" && (
              <span className="text-[#fde68a] flex items-center gap-1">
                <HelpCircle size={14} /> Dars o'tilgan, ammo davomat kiritilmagan
              </span>
            )}
            {hoveredDay.status === "future" && (
              <span className="text-[#38bdf8] flex items-center gap-1">
                <Clock size={14} /> Rejalashtirilgan dars kuni
              </span>
            )}
            {hoveredDay.status === "not_joined" && (
              <span className="text-[#aaaaaa] flex items-center gap-1">
                O'quvchi guruhga qo'shilishidan oldingi dars
              </span>
            )}
            {hoveredDay.status === "no_lesson" && (
              <span className="text-[#aaaaaa]">Dars kuni emas</span>
            )}
          </div>

          {hoveredDay.groups && hoveredDay.groups.length > 0 && (
            <p className="text-[10px] text-[#bbbbbb] mt-1.5 border-t border-white/10 pt-1 font-bold">
              Guruh: <span className="text-white font-black text-white-force">{hoveredDay.groups.join(", ")}</span>
            </p>
          )}
        </div>
      )}

      {/* 5. GITHUB-STYLE FOOTER LEGEND */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-[var(--border-glass)] text-[10px] font-bold text-[var(--text-secondary)] w-full">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-black">
          Izohlar (Legend):
        </span>

        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-[#16a34a] border border-[#4ade80] shadow-[0_0_8px_rgba(22,163,74,0.4)]" />
            <span className="text-emerald-600 dark:text-[#4ade80] font-black">Kelgan (To'yg'in Yashil)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-[#991b1b] border border-[#ef4444] shadow-[0_0_8px_rgba(153,27,27,0.4)]" />
            <span className="text-red-600 dark:text-[#f87171] font-black">Qoldirgan (Qon Qizil)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-amber-500/20 border border-amber-500/50" />
            <span className="text-amber-600 dark:text-amber-400 font-bold">Olinmagan</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md border border-dashed border-sky-500 bg-sky-500/20" />
            <span className="text-sky-600 dark:text-sky-400 font-bold">Rejada</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-[var(--bg-void)] border border-[var(--border-glass)]" />
            <span className="text-[var(--text-muted)] font-bold">Dars yo'q</span>
          </div>
        </div>
      </div>
    </div>
  );
}
