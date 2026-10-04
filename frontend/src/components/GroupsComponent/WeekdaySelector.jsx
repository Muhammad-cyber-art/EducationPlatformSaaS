import React, { useMemo } from "react";
import { Check, Calendar, Clock, Sparkles } from "lucide-react";
import {
  WEEKDAYS_MAP,
  normalizeCustomDays,
  getMonthLessonCalculation,
  formatDaysDisplay,
} from "../../utils/scheduleUtils";

const MONTH_NAMES_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"
];

/**
 * WeekdaySelector component for creating/editing groups
 *
 * @param {number[]} value - array of weekday integers [0..6]
 * @param {function} onChange - callback passing updated array
 * @param {string} startTime - initial start time (e.g. "05:20")
 * @param {string} endTime - initial end time (e.g. "07:20")
 * @param {function} onTimeChange - callback({ startTime, endTime, timeString })
 * @param {number|string} monthlyPrice - optional monthly price to display per-lesson calculation
 */
export default function WeekdaySelector({
  value = [0, 2, 4],
  onChange,
  startTime = "",
  endTime = "",
  onTimeChange,
  monthlyPrice = 0,
}) {
  const selectedDays = useMemo(() => normalizeCustomDays(value), [value]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const lessonCalc = useMemo(() => {
    return getMonthLessonCalculation(selectedDays, currentYear, currentMonth);
  }, [selectedDays, currentYear, currentMonth]);

  const cleanPrice = Number(String(monthlyPrice).replace(/\D/g, "")) || 0;
  const pricePerLesson = lessonCalc.count > 0 && cleanPrice > 0
    ? Math.round(cleanPrice / lessonCalc.count)
    : 0;

  const toggleDay = (dayId) => {
    let next;
    if (selectedDays.includes(dayId)) {
      next = selectedDays.filter((d) => d !== dayId);
    } else {
      next = [...selectedDays, dayId].sort((a, b) => a - b);
    }
    // Kamida 1 kun bo'lishi tavsiya etiladi
    if (onChange) {
      onChange(next);
    }
  };

  const setPreset = (presetDays) => {
    if (onChange) {
      onChange(presetDays);
    }
  };

  const handleStartTime = (e) => {
    const st = e.target.value;
    if (onTimeChange) {
      const combined = st && endTime ? `${st} - ${endTime}` : st || endTime || "";
      onTimeChange({ startTime: st, endTime, timeString: combined });
    }
  };

  const handleEndTime = (e) => {
    const et = e.target.value;
    if (onTimeChange) {
      const combined = startTime && et ? `${startTime} - ${et}` : startTime || et || "";
      onTimeChange({ startTime, endTime: et, timeString: combined });
    }
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
          <span>HAFTA KUNLARINI TANLANG:</span>
        </label>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setPreset([0, 2, 4])}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all border ${
              JSON.stringify(selectedDays) === JSON.stringify([0, 2, 4])
                ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-sm font-black"
                : "bg-[var(--bg-void)]/60 text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/30"
            }`}
          >
            Toq (Du-Ch-Ju)
          </button>
          <button
            type="button"
            onClick={() => setPreset([1, 3, 5])}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all border ${
              JSON.stringify(selectedDays) === JSON.stringify([1, 3, 5])
                ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-sm font-black"
                : "bg-[var(--bg-void)]/60 text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/30"
            }`}
          >
            Juft (Se-Pa-Sh)
          </button>
          <button
            type="button"
            onClick={() => setPreset([0, 1, 2, 3, 4, 5])}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all border ${
              selectedDays.length === 6 && !selectedDays.includes(6)
                ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-sm font-black"
                : "bg-[var(--bg-void)]/60 text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/30"
            }`}
          >
            Har kuni (Du-Sh)
          </button>
          <button
            type="button"
            onClick={() => setPreset([0, 1, 2, 3, 4, 5, 6])}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all border ${
              selectedDays.length === 7
                ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-sm font-black"
                : "bg-[var(--bg-void)]/60 text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/30"
            }`}
          >
            Barchasi (7 kun)
          </button>
        </div>
      </div>

      {/* Weekday Checkboxes Grid (Matching the design in user image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {WEEKDAYS_MAP.map((day) => {
          const isSelected = selectedDays.includes(day.id);
          const isSunday = day.id === 6;

          return (
            <div
              key={day.id}
              onClick={() => toggleDay(day.id)}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all cursor-pointer select-none ${
                isSelected
                  ? isSunday
                    ? "bg-rose-500/10 border-rose-500/40 text-[var(--text-primary)] shadow-[0_0_12px_rgba(244,63,94,0.15)]"
                    : "bg-cyan-500/10 border-cyan-500/50 text-[var(--text-primary)] shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                  : "bg-[var(--bg-void)]/50 border-[var(--border-glass)] text-[var(--text-secondary)] hover:bg-[var(--bg-void)] hover:border-cyan-500/30"
              }`}
            >
              {/* Checkbox Icon Box */}
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                  isSelected
                    ? isSunday
                      ? "bg-rose-500 text-white"
                      : "bg-[#00a3ff] text-white shadow-sm"
                    : "border border-[var(--border-glass)]/80 bg-[var(--bg-panel)]/50"
                }`}
              >
                {isSelected && <Check size={13} strokeWidth={3} />}
              </div>

              {/* Day Label */}
              <div className="flex-1 flex items-center justify-between">
                <span className={`text-[12px] font-bold tracking-tight ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                  {day.label}
                </span>
                {isSunday && (
                  <span className="text-[8px] font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                    Yakshanba
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time inputs matching the bottom of the screenshot */}
      {onTimeChange && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider">
              Boshlanish vaqti:
            </label>
            <div className="relative">
              <input
                type="time"
                value={startTime}
                onChange={handleStartTime}
                className="lux-input !bg-[var(--bg-void)] !py-3 w-full"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider">
              Tugash vaqti:
            </label>
            <div className="relative">
              <input
                type="time"
                value={endTime}
                onChange={handleEndTime}
                className="lux-input !bg-[var(--bg-void)] !py-3 w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Real-time Calculation Summary Card */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-500/10 via-[var(--gold)]/5 to-purple-500/10 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-cyan-400" />
            <span className="text-[10px] font-black text-[var(--text-primary)] tracking-wide">
              {formatDaysDisplay(selectedDays, true) || "Kun tanlanmagan"}
            </span>
            <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              {selectedDays.length} kun / hafta
            </span>
          </div>
          <p className="text-[9px] text-[var(--text-muted)] font-medium">
            Taqvim bo'yicha {MONTH_NAMES_UZ[currentMonth - 1]} oyida:{" "}
            <strong className="text-[var(--text-primary)] font-bold">{lessonCalc.count} ta dars</strong> mavjud
          </p>
        </div>

        {cleanPrice > 0 && pricePerLesson > 0 && (
          <div className="text-left sm:text-right shrink-0 bg-[var(--bg-void)]/60 px-3 py-1.5 rounded-lg border border-[var(--border-glass)]">
            <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              1 ta dars qiymati:
            </p>
            <p className="text-[11px] font-black text-[var(--gold)]">
              ~{pricePerLesson.toLocaleString()} UZS
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
