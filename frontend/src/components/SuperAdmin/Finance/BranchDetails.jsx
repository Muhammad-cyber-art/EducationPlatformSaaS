import React from 'react';
import { useBranchFinance } from './BranchDetails/useBranchFinance';
import { Link } from 'react-router-dom';
import {
  BranchHeader, BranchStatsGrid, FinancialIntelligence,
  UnitBreakdown
} from './BranchDetails/BranchFinanceUI';
import { Activity, ShieldCheck, Calendar, Users } from 'lucide-react';

export default function BranchFinance() {
  const {
    loading, data, error, fetchBranchFinance,
    formatNumber, progressPercentage, stats,
    finance, branch, groups,
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    goPrevMonth,
    goCurrentMonth,
    formatMonthLabel,
    b_id
  } = useBranchFinance();

  const today = new Date();
  const periodControls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 h-9 px-2 bg-[var(--bg-void)]/40 border border-[#2a2a2a] rounded-lg">
        <Calendar size={12} className="text-[var(--gold)] opacity-60 shrink-0" />
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="bg-transparent text-[9px] font-black text-[var(--text-primary)] outline-none max-w-[3rem]"
        >
          {Array.from({ length: 12 }).map((_, idx) => (
            <option key={idx + 1} value={idx + 1} className="bg-[var(--bg-panel)]">
              {String(idx + 1).padStart(2, '0')}
            </option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="bg-transparent text-[9px] font-black text-[var(--text-primary)] outline-none"
        >
          {Array.from({ length: 6 }).map((_, i) => {
            const y = today.getFullYear() - i;
            return <option key={y} value={y} className="bg-[var(--bg-panel)]">{y}</option>;
          })}
        </select>
      </div>
      <span className="text-[9px] font-black text-[var(--gold)] tabular-nums px-1">
        {formatMonthLabel(selectedYear, selectedMonth)}
      </span>
      <button
        type="button"
        onClick={goPrevMonth}
        className="h-9 px-3 bg-[var(--bg-void)]/40 border border-red-500/20 text-red-400 rounded-lg font-black text-[9px] capitalize tracking-wider hover:bg-red-500/10"
      >
        O'tgan oy
      </button>
      <button
        type="button"
        onClick={goCurrentMonth}
        className="h-9 px-3 bg-[var(--bg-void)]/40 border border-emerald-500/20 text-emerald-400 rounded-lg font-black text-[9px] capitalize tracking-wider hover:bg-emerald-500/10"
      >
        Joriy oy
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Activity className="animate-spin text-[var(--gold)] mb-6" size={48} />
        <p className="text-[10px] font-black capitalize tracking-[0.4em] text-[var(--text-muted)]">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <ShieldCheck size={48} className="text-red-500/40 mb-6" />
        <p className="text-sm font-black text-red-400 capitalize tracking-widest mb-6">{error}</p>
        <button
          onClick={fetchBranchFinance}
          className="lux-btn lux-btn-primary !px-10"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 pb-12">
      <BranchHeader branchName={branch.name} periodControls={periodControls} />
      <BranchStatsGrid stats={stats} />

      {/* Maxsus O'quvchilar Banner */}
      <div className="lux-card !p-0 overflow-hidden border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
        <Link
          to={`/super_admin/all-payments/branch-details/${b_id}/special-students`}
          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 relative z-10 gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 border border-amber-500/20">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-500 tracking-wider uppercase">Maxsus O'quvchilar Dushbordi</h3>
              <p className="text-[10px] text-amber-500/70 font-bold mt-1 tracking-wide">Imtiyozli, kelishilgan va ehtiyojmand o'quvchilar uchun moliyaviy tahlil va wallet hisoboti</p>
            </div>
          </div>
          <div className="flex items-center self-end sm:self-auto gap-2 px-4 py-2 bg-amber-500/10 rounded-lg text-amber-500 text-[10px] font-black uppercase tracking-widest border border-amber-500/20 group-hover:bg-amber-500 text-amber-500 group-hover:text-black transition-colors shrink-0">
            <span>Ko'rish</span>
          </div>
        </Link>
      </div>

      <FinancialIntelligence
        finance={finance}
        formatNumber={formatNumber}
        progressPercentage={progressPercentage}
      />
      {groups && groups.length > 0 && (
        <UnitBreakdown groups={groups} formatNumber={formatNumber} />
      )}
    </div>
  );
}