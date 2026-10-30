import React from "react";
import {
  Users,
  Receipt,
  Calculator,
  TrendingUp,
  Landmark,
  BookOpen,
  Percent,
} from "lucide-react";
import { formatCurrency, roundNumber } from "./shared";

const StaffPaidKPICards = React.memo(({ pageData, filteredStudentsLength, filteredTotals }) => {
  const attendanceRate = filteredTotals.planned > 0
    ? roundNumber((filteredTotals.attended / filteredTotals.planned) * 100, 1)
    : 0;

  const showDavlatPuliBanner = (pageData?.total_estimated_state_receivable > 0 || filteredTotals.estimatedStateReceivable > 0);

  return (
    <div className="space-y-3.5">
      {/* 7 Clean Modern KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
        {/* Card 1: Students count */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-sm hover:border-blue-500/40 transition-all">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1.5">
            <Users size={13} />
            <span>O'quvchilar</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-[var(--text-primary)] tabular-nums">
            {filteredStudentsLength}
            <span className="text-xs text-[var(--text-muted)] font-normal ml-1">
              / {pageData?.total_students_count || 0}
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
            {pageData?.groups?.length || 0} ta guruhda
          </div>
        </div>

        {/* Card 2: Total paid (Real Kassa Tushumi) */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-sm hover:border-emerald-500/40 transition-all">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1.5">
            <Receipt size={13} />
            <span>Kassa Tushumi</span>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-400 tabular-nums truncate">
            {formatCurrency(filteredTotals.paid)}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
            To'langan mablag'lar
          </div>
        </div>

        {/* Card 3: Teacher share */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--gold)]/30 shadow-sm hover:border-[var(--gold)] transition-all">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--gold)] mb-1.5">
            <Calculator size={13} />
            <span>O'qituvchi Maoshi</span>
          </div>
          <div className="text-base sm:text-lg font-black text-[var(--gold)] tabular-nums truncate">
            {formatCurrency(filteredTotals.share)}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
            Ulush va stavkalar
          </div>
        </div>

        {/* Card 4: Center Margin */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-sm hover:border-amber-500/40 transition-all">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
            <TrendingUp size={13} />
            <span>Markaz Marjasi</span>
          </div>
          <div className="text-base sm:text-lg font-black text-amber-400 tabular-nums truncate">
            {formatCurrency(filteredTotals.margin)}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
            Kassadan sof qoldiq
          </div>
        </div>

        {/* Card 5: State receivable */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-sm hover:border-purple-500/40 transition-all">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5">
            <Landmark size={13} />
            <span>Davlat Puli</span>
          </div>
          <div className="text-base sm:text-lg font-black text-purple-400 tabular-nums truncate">
            {formatCurrency(filteredTotals.estimatedStateReceivable)}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
            Markaz: ~{formatCurrency(filteredTotals.estimatedStateMargin)}
          </div>
        </div>

        {/* Card 6: Lesson Attendance */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-sm hover:border-indigo-500/40 transition-all">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1.5">
            <BookOpen size={13} />
            <span>Darslar</span>
          </div>
          <div className="text-base sm:text-lg font-black text-[var(--text-primary)] tabular-nums truncate">
            {filteredTotals.planned > 0
              ? `${filteredTotals.attended} / ${filteredTotals.planned}`
              : `${pageData?.total_lessons_attended || 0} / ${pageData?.total_lessons_planned || 0}`}
            <span className="text-[10px] text-[var(--text-muted)] font-normal ml-1">dars</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
            Qatnashilgan / Reja
          </div>
        </div>

        {/* Card 7: Attendance Rate % */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-sm hover:border-teal-500/40 transition-all">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-400 mb-1.5">
            <Percent size={13} />
            <span>Davomat</span>
          </div>
          <div className="text-base sm:text-lg font-black text-teal-400 tabular-nums">
            {attendanceRate}%
          </div>
          <div className="w-full bg-[var(--bg-void)] rounded-full h-1 mt-1.5 overflow-hidden">
            <div
              className="bg-teal-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, attendanceRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Modern, Compact Davlat Puli Banner */}
      {showDavlatPuliBanner && (
        <div className="px-4 py-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center justify-center shrink-0">
              <Landmark size={14} />
            </div>
            <div className="min-w-0 truncate">
              <span className="text-xs font-bold text-[var(--text-primary)] mr-2">
                Imtiyozli O'quvchilar (Davlat Puli):
              </span>
              <span className="text-[11px] text-[var(--text-muted)] hidden md:inline truncate">
                Kassa tushumiga kirmaydi, o'qituvchi ulushi davomat bo'yicha to'liq hisoblangan.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 text-right self-end sm:self-center">
            <div>
              <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Kutilayotgan davlat puli</span>
              <span className="text-xs sm:text-sm font-black text-purple-400 tabular-nums">
                {formatCurrency(filteredTotals.estimatedStateReceivable || pageData?.total_estimated_state_receivable || 0)}
              </span>
            </div>
            <div className="h-5 w-px bg-[var(--border-glass)]" />
            <div>
              <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Markaz ulushi</span>
              <span className="text-xs sm:text-sm font-black text-amber-400 tabular-nums">
                {formatCurrency(filteredTotals.estimatedStateMargin || pageData?.total_estimated_center_margin || 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default StaffPaidKPICards;
