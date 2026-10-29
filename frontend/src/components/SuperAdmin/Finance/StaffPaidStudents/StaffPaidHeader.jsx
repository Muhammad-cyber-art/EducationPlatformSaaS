import React from "react";
import { ArrowLeft, Calendar, RefreshCw } from "lucide-react";
import ThemeToggle from "../../../ThemeToggle";

const StaffPaidHeader = React.memo(({ pageData, onBack, onRefresh, loading }) => {
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="group flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--gold)] transition-all w-fit cursor-pointer"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">
          Xodim Maosh Vedomostiga Qaytish
        </span>
      </button>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between p-5 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-xl gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--gold)]/20 to-[var(--gold)]/5 border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] font-black text-lg shadow-inner">
            {pageData?.employee_name?.charAt(0) || "X"}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg md:text-xl font-black text-[var(--text-primary)] tracking-tight">
                {pageData?.employee_name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                {pageData?.salary_type === "percentage"
                  ? "Foizli (Komissiya)"
                  : pageData?.salary_type === "student_count"
                    ? "O'quvchi boshiga stavka"
                    : "Belgilangan maosh"}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Guruh O'quvchilari Vedomosti
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-bold mt-0.5 flex items-center gap-2">
              <Calendar size={13} className="text-[var(--gold)]" />
              <span>{pageData?.month_display || pageData?.month} oyi uchun to'lovlar, davomat va arifmetik ulush hisobi</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end lg:self-center">
          <ThemeToggle />
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-panel)] hover:bg-[var(--gold)]/10 border border-[var(--border-glass)] hover:border-[var(--gold)]/40 rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--gold)] transition-all cursor-pointer disabled:opacity-50"
            title="Yangilash"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Yangilash</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default StaffPaidHeader;
