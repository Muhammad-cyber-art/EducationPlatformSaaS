import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBranchFinance } from './BranchDetails/useBranchFinance';
import { BranchHeader } from './BranchDetails/BranchHeader';
import { BranchStatsGrid } from './BranchDetails/BranchStatsGrid';
import { BranchTabsNav } from './BranchDetails/BranchTabsNav';
import { FinanceOverviewTab } from './BranchDetails/tabs/FinanceOverviewTab';
import { BranchExpensesTab } from './BranchDetails/tabs/BranchExpensesTab';
import { GroupsAnalyticsTab } from './BranchDetails/tabs/GroupsAnalyticsTab';
import { SpecialStudentsTab } from './BranchDetails/tabs/SpecialStudentsTab';
import { Activity, ShieldCheck, Calendar } from 'lucide-react';

export default function BranchFinance() {
  const {
    loading,
    data,
    error,
    fetchBranchFinance,
    formatNumber,
    progressPercentage,
    stats,
    finance,
    branch,
    groups,
    adminExpenses,
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    goPrevMonth,
    goCurrentMonth,
    formatMonthLabel,
    b_id,
  } = useBranchFinance();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'finance';

  const handleTabChange = (tabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId);
      return next;
    });
  };

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
            return (
              <option key={y} value={y} className="bg-[var(--bg-panel)]">
                {y}
              </option>
            );
          })}
        </select>
      </div>
      <span className="text-[9px] font-black text-[var(--gold)] tabular-nums px-1">
        {formatMonthLabel(selectedYear, selectedMonth)}
      </span>
      <button
        type="button"
        onClick={goPrevMonth}
        className="h-9 px-3 bg-[var(--bg-void)]/40 border border-red-500/20 text-red-400 rounded-lg font-black text-[9px] capitalize tracking-wider hover:bg-red-500/10 cursor-pointer"
      >
        O'tgan oy
      </button>
      <button
        type="button"
        onClick={goCurrentMonth}
        className="h-9 px-3 bg-[var(--bg-void)]/40 border border-emerald-500/20 text-emerald-400 rounded-lg font-black text-[9px] capitalize tracking-wider hover:bg-emerald-500/10 cursor-pointer"
      >
        Joriy oy
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Activity className="animate-spin text-[var(--gold)] mb-6" size={48} />
        <p className="text-[10px] font-black capitalize tracking-[0.4em] text-[var(--text-muted)]">
          Yuklanmoqda...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <ShieldCheck size={48} className="text-red-500/40 mb-6" />
        <p className="text-sm font-black text-red-400 capitalize tracking-widest mb-6">{error}</p>
        <button onClick={fetchBranchFinance} className="lux-btn lux-btn-primary !px-10 cursor-pointer">
          Qayta urinish
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Yuqori sarlavha va davr boshqaruvi */}
      <BranchHeader branchName={branch.name} periodControls={periodControls} />

      {/* 2. Filial asosiy ko'rsatkichlari (Mentorlar, Adminlar, Guruhlar, O'quvchilar) */}
      <BranchStatsGrid stats={stats} />

      {/* 3. Ichki sahifalar / Tablar navigatsiyasi */}
      <BranchTabsNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        expensesCount={adminExpenses.length}
        groupsCount={groups?.length || 0}
        progressPercentage={progressPercentage}
      />

      {/* 4. Tanlangan ichki sahifa komponenti */}
      <div className="pt-1">
        {activeTab === 'finance' && (
          <FinanceOverviewTab
            finance={finance}
            formatNumber={formatNumber}
            progressPercentage={progressPercentage}
          />
        )}

        {activeTab === 'expenses' && (
          <BranchExpensesTab
            adminExpenses={adminExpenses}
            formatNumber={formatNumber}
          />
        )}

        {activeTab === 'groups' && (
          <GroupsAnalyticsTab
            groups={groups || []}
            formatNumber={formatNumber}
          />
        )}

        {activeTab === 'special' && (
          <SpecialStudentsTab
            b_id={b_id}
            branchName={branch.name}
          />
        )}
      </div>
    </div>
  );
}