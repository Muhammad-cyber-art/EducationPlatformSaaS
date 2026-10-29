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
    <div className="space-y-4">
      {/* 7 Rich KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
        {/* Card 1: Students count */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-md hover:border-blue-500/30 transition-all border-t-4 border-t-blue-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-1">
              <Users size={12} /> O'quvchilar
            </span>
            <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {filteredStudentsLength} / {pageData?.total_students_count || 0}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tabular-nums">
            {filteredStudentsLength} <span className="text-[10px] text-[var(--text-muted)] font-bold">st.</span>
          </h3>
          <p className="text-[8px] text-[var(--text-muted)] mt-1 truncate">
            Guruhlar: {pageData?.groups?.length || 0} ta
          </p>
        </div>

        {/* Card 2: Total paid (Faqat Real Kassa Tushumi) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-md hover:border-emerald-500/30 transition-all border-t-4 border-t-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
              <Receipt size={12} /> Real Tushum
            </span>
            <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Faqat Kassa
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-emerald-400 tabular-nums">
            {formatCurrency(filteredTotals.paid)}
          </h3>
          <p className="text-[8px] text-[var(--text-muted)] mt-1 truncate">
            Haqiqiy to'lovlar summasi
          </p>
        </div>

        {/* Card 3: Teacher share */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[var(--gold)]/10 to-[var(--bg-panel)] border border-[var(--gold)]/40 shadow-md hover:border-[var(--gold)] transition-all border-t-4 border-t-[var(--gold)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--gold)] flex items-center gap-1">
              <Calculator size={12} /> O'qituvchi Ulushi
            </span>
            <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/30 animate-pulse">
              Maosh
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tabular-nums">
            {formatCurrency(filteredTotals.share)}
          </h3>
          <p className="text-[8px] text-[var(--gold)] font-bold mt-1 truncate">
            Hisoblangan jami maosh
          </p>
        </div>

        {/* Card 4: Center Gross Margin (Real Kassa Marjasi) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-md hover:border-amber-500/30 transition-all border-t-4 border-t-amber-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1">
              <TrendingUp size={12} /> Markaz Marjasi
            </span>
            <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Kassadan
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-amber-400 tabular-nums">
            {formatCurrency(filteredTotals.margin)}
          </h3>
          <p className="text-[8px] text-[var(--text-muted)] mt-1 truncate">
            Kassa tushumi − O'qituvchi ulushi
          </p>
        </div>

        {/* Card 5: Taxminiy Davlat Puli & Taxminiy Markaz Ulushi */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-panel)] border border-purple-500/30 shadow-md hover:border-purple-500/50 transition-all border-t-4 border-t-purple-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1">
              <Landmark size={12} /> Davlat Puli
            </span>
            <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Taxminiy
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-purple-400 tabular-nums">
            {formatCurrency(filteredTotals.estimatedStateReceivable)}
          </h3>
          <p className="text-[8px] text-amber-400/90 mt-1 truncate font-semibold">
            Markaz ulushi: ~{formatCurrency(filteredTotals.estimatedStateMargin)}
          </p>
        </div>

        {/* Card 6: Total planned & attended lessons */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-md hover:border-indigo-500/30 transition-all border-t-4 border-t-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1">
              <BookOpen size={12} /> Darslar Rejasi
            </span>
            <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Davomat
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tabular-nums">
            ------
            <span className="text-[10px] text-[var(--text-muted)] font-bold">Oy</span>
          </h3>
          <p className="text-[8px] text-[var(--text-muted)] mt-1 truncate">
            Oyiga
          </p>
        </div>

        {/* Card 7: Attendance Rate % */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-md hover:border-teal-500/30 transition-all border-t-4 border-t-teal-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-teal-400 flex items-center gap-1">
              <Percent size={12} /> O'rtacha Davomat
            </span>
            <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Foiz
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tabular-nums">
            {attendanceRate}%
          </h3>
          <div className="w-full bg-[var(--bg-void)] rounded-full h-1 mt-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, attendanceRate)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Dedicated Davlat Puli Info Card / Section */}
      {showDavlatPuliBanner && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-[var(--bg-panel)] to-amber-500/10 border border-purple-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Landmark size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                  Imtiyozli O'quvchilar (Davlat Puli) Bo'limi
                </h4>
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  Alohida hisob
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                Davlat tomonidan aynan qancha summa tushishi oldindan aniq bo'lmagani sababli, bu summa umumiy kassa kirimiga va kassa marjasiga qo'shilmaydi. O'qituvchiga ulush esa davomat (Face ID) bo'yicha to'liq hisoblangan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-[var(--bg-void)]/80 border border-[var(--border-glass)] text-right">
              <span className="text-[8px] font-black uppercase tracking-wider text-purple-400 block">
                Taxminiy Davlat Puli
              </span>
              <span className="text-sm font-black text-purple-400 tabular-nums">
                {formatCurrency(filteredTotals.estimatedStateReceivable || pageData?.total_estimated_state_receivable || 0)}
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-[var(--bg-void)]/80 border border-[var(--border-glass)] text-right">
              <span className="text-[8px] font-black uppercase tracking-wider text-amber-400 block">
                Taxminiy Markaz Ulushi
              </span>
              <span className="text-sm font-black text-amber-400 tabular-nums">
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
