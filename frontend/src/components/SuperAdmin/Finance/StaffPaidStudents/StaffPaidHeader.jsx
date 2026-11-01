import React from "react";
import { ArrowLeft, Calendar, RefreshCw, ChevronDown } from "lucide-react";
import ThemeToggle from "../../../ThemeToggle";

const StaffPaidHeader = React.memo(({ pageData, onBack, onRefresh, loading, onSelectMonth }) => {
  const currentMonthObj = pageData?.available_months?.find(
    (m) => String(m.id) === String(pageData?.payment_id)
  );
  const displayLabel = currentMonthObj?.month_display || pageData?.month_display || pageData?.month || "Davr";

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={onBack}
        className="group flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--gold)] transition-all w-fit cursor-pointer"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-[10px] font-bold uppercase tracking-wider">
          Xodim maosh vedomostiga qaytish
        </span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-lg gap-4 backdrop-blur-xl">
        {/* Left Profile Info */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--gold)]/20 to-[var(--gold)]/5 border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] font-black text-base shadow-inner shrink-0">
            {pageData?.employee_name?.charAt(0) || "X"}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-[var(--text-primary)] tracking-tight">
                {pageData?.employee_name}
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                {pageData?.salary_type === "percentage"
                  ? "Foizli ulush"
                  : pageData?.salary_type === "student_count"
                    ? "Stavka (o'quvchi boshiga)"
                    : "Belgilangan maosh"}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-medium mt-0.5 flex items-center gap-1.5">
              <span>{displayLabel} oyi to'lov va davomat vedomosti</span>
            </p>
          </div>
        </div>

        {/* Right Actions: Modern Month Selector Button + ThemeToggle + Refresh Button */}
        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap shrink-0">
          {/* Compact Modern Month Selector Button */}
          {pageData?.available_months && pageData.available_months.length > 1 ? (
            <div className="relative inline-flex items-center">
              <button
                type="button"
                className="flex items-center gap-1.5 h-9 px-3 bg-[var(--bg-panel)] hover:bg-[var(--gold)]/10 border border-[var(--border-glass)] hover:border-[var(--gold)]/50 rounded-xl transition-all shadow-sm text-[var(--gold)] cursor-pointer active:scale-95 group"
                title="Hisobot oyini almashtirish"
              >
                <Calendar size={13} className="shrink-0 text-[var(--gold)] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black tracking-tight whitespace-nowrap">
                  {displayLabel}
                </span>
                <ChevronDown size={12} className="shrink-0 text-[var(--gold)] opacity-70 group-hover:opacity-100 transition-opacity" />
              </button>
              <select
                value={pageData?.payment_id}
                onChange={(e) => onSelectMonth && onSelectMonth(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
                title="Hisobot oyini almashtirish"
              >
                {pageData.available_months.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#1a1a1a] text-white py-1">
                    {m.month_display} {m.is_paid ? "✓ (To'langan)" : "(Kutilmoqda)"}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 h-9 px-3 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl text-xs font-black text-[var(--gold)] shrink-0 shadow-sm">
              <Calendar size={13} className="text-[var(--gold)]" />
              <span className="whitespace-nowrap">{displayLabel}</span>
            </div>
          )}

          <ThemeToggle />

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3 bg-[var(--bg-panel)] hover:bg-[var(--gold)]/10 border border-[var(--border-glass)] hover:border-[var(--gold)]/40 rounded-xl text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--gold)] transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-sm shrink-0"
            title="Yangilash"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--gold)]" : ""} />
            <span className="hidden xs:inline">Yangilash</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default StaffPaidHeader;
