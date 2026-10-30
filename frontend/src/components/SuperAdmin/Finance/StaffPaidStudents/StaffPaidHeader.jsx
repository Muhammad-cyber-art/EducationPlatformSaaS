import React from "react";
import { ArrowLeft, Calendar, RefreshCw } from "lucide-react";
import ThemeToggle from "../../../ThemeToggle";

const StaffPaidHeader = React.memo(({ pageData, onBack, onRefresh, loading }) => {
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
              <Calendar size={12} className="text-[var(--gold)]" />
              <span>{pageData?.month_display || pageData?.month} oyi to'lov va davomat vedomosti</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          <ThemeToggle />
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-panel)] hover:bg-[var(--gold)]/10 border border-[var(--border-glass)] hover:border-[var(--gold)]/40 rounded-xl text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--gold)] transition-all cursor-pointer disabled:opacity-50"
            title="Yangilash"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span>Yangilash</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default StaffPaidHeader;
