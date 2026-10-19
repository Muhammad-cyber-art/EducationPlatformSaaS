import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Wallet, PlusCircle, TrendingDown, DollarSign, Calendar, 
  RefreshCw, AlertCircle, Building2, Layers, CheckCircle2, 
  ArrowLeft, Users, MinusCircle, Circle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import api from '../../../tokenUpdater/updater';
import { db } from '../../../db/db';
import { useCurrentBranch } from '../../Authorized/useBranchId';
import ColumnTeachersGroups from './ColumnTeachersGroups';
import GroupRoster from './GroupRoster';
import StudentDetailDrawer from './StudentDetailDrawer';
import QuickExpenseModal from './QuickExpenseModal';

export const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString() + " UZS";
};

const getCurrentMonthStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function CashierDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentBranchId, currentBranchName, userInfo } = useCurrentBranch();

  // State
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());
  const [activeTab, setActiveTab] = useState('groups'); // 'groups' | 'debtors'
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Fetch Cashier Desk Data (Hierarchical Teachers -> Groups -> Students + Cash Register Stats)
  const { 
    data: cashierData, 
    isLoading, 
    isFetching, 
    refetch 
  } = useQuery({
    queryKey: ['cashier-desk', currentBranchId, selectedMonth],
    queryFn: async () => {
      // 1. Agar oflayn bo'lsa, tarmoq so'rovini kutmasdan darhol keshdan o'qiymiz (0ms delay)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await db.query_cache.get(`cashier-desk_${currentBranchId}_${selectedMonth}`);
        if (cached?.data) {
          return cached.data;
        }
      }

      try {
        const res = await api.get('/finance/student-payments/cashier-desk/', {
          params: {
            branch_id: currentBranchId,
            month: selectedMonth
          }
        });
        if (res.data) {
          db.query_cache.put({
            query_key: `cashier-desk_${currentBranchId}_${selectedMonth}`,
            data: res.data,
            updated_at: new Date().toISOString()
          }).catch(() => {});
        }
        return res.data;
      } catch (err) {
        try {
          const cached = await db.query_cache.get(`cashier-desk_${currentBranchId}_${selectedMonth}`);
          if (cached?.data) {
            return cached.data;
          }
        } catch (_) {}
        throw err;
      }
    },
    enabled: !!currentBranchId,
    staleTime: 30 * 1000,
  });

  const branchDesk = cashierData?.branch || {};
  const teachers = cashierData?.teachers || [];
  const allGroups = cashierData?.all_groups || [];
  const debtors = cashierData?.debtors || [];
  const rosters = cashierData?.rosters || {};
  const summary = cashierData?.summary || {};

  // Auto-select first group if none selected
  const activeGroup = useMemo(() => {
    if (selectedGroupId && rosters[selectedGroupId]) {
      return rosters[selectedGroupId];
    }
    if (allGroups.length > 0) {
      const firstId = allGroups[0].id;
      return rosters[firstId] || allGroups[0];
    }
    return null;
  }, [selectedGroupId, rosters, allGroups]);

  const handleGroupSelect = (groupId) => {
    setSelectedGroupId(groupId);
    setActiveTab('groups');
  };

  const handleOpenPayment = (student) => {
    setSelectedStudentForDrawer(student);
  };

  const handleOpenDetails = (student) => {
    setSelectedStudentForDrawer(student);
  };

  const handleOpenRefund = (student) => {
    setSelectedStudentForDrawer(student);
  };

  const handlePaymentSuccess = () => {
    queryClient.invalidateQueries(['cashier-desk', currentBranchId, selectedMonth]);
    refetch();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-3 sm:p-5 space-y-4 max-w-[1700px] mx-auto animate-in fade-in duration-300">
      
      {/* TOP HEADER & LIVE CASH REGISTER (BranchCashDesk) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 bg-[var(--bg-panel)]/50 border border-[var(--border-glass)] rounded-2xl shadow-xl backdrop-blur-xl relative overflow-hidden group">
        <div className="flex items-center gap-3.5 sm:gap-5">
          <div className="w-11 h-11 rounded-2xl bg-[var(--gold)]/10 border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shrink-0 shadow-lg shadow-[var(--gold)]/5">
            <Wallet size={24} />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                Filial Kassasi (POS Desk)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--border-glass)] flex items-center gap-1">
                <Building2 size={12} />
                {currentBranchName || branchDesk.branch_name || "Filial"}
              </span>
              {typeof navigator !== 'undefined' && !navigator.onLine && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Oflayn Rejim (Lokal Baza)
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-medium flex items-center gap-2 mt-0.5">
              <span className={`inline-block w-2 h-2 rounded-full ${typeof navigator !== 'undefined' && !navigator.onLine ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
              {typeof navigator !== 'undefined' && !navigator.onLine ? "Internet aloqasi yo'q — ma'lumotlar qurilmadagi bazadan ko'rsatilmoqda" : "Kunlik o'quvchi to'lovlarini tezkor qabul qilish va kassa monitoringi"}
            </p>
          </div>
        </div>

        {/* Live Cash Register Metrics */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Today Inflow */}
          <div className="px-3.5 py-2 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl flex flex-col justify-center min-w-[130px]">
            <span className="text-[9px] font-black text-[var(--gold)] uppercase tracking-wider flex items-center gap-1">
              <PlusCircle size={10} /> Bugungi Kirim
            </span>
            <span className="text-sm sm:text-base font-black text-[var(--text-primary)] tabular-nums">
              {formatCurrency(branchDesk.today_income)}
            </span>
            <span className="text-[9px] text-[var(--text-muted)] mt-0.5">
              Naqd: {formatCurrency(branchDesk.today_cash)}
            </span>
          </div>

          {/* Today Outflow */}
          <div className="px-3.5 py-2 bg-rose-500/5 border border-[var(--border-glass)] rounded-xl flex flex-col justify-center min-w-[110px]">
            <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider flex items-center gap-1">
              <TrendingDown size={10} /> Chiqim
            </span>
            <span className="text-sm sm:text-base font-black text-rose-500 tabular-nums">
              {formatCurrency(branchDesk.today_expense)}
            </span>
            <span className="text-[9px] text-[var(--text-muted)] mt-0.5">
              Operatsion harajat
            </span>
          </div>

          {/* Cash Drawer Balance */}
          <div className="px-3.5 py-2 bg-emerald-500/5 border border-[var(--border-glass)] rounded-xl flex flex-col justify-center min-w-[120px]">
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider flex items-center gap-1">
              <DollarSign size={10} /> Kassa Qoldig'i
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-500 tabular-nums">
              {formatCurrency(branchDesk.today_balance)}
            </span>
            <span className="text-[9px] text-[var(--text-muted)] mt-0.5">
              Net kassa balansi
            </span>
          </div>

          {/* Controls: Month Selector & Quick Expense */}
          <div className="flex items-center gap-2 ml-auto lg:ml-2">
            <div className="relative">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 text-xs font-bold bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)] cursor-pointer"
              />
            </div>

            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-[var(--border-glass)] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <TrendingDown size={14} />
              <span className="hidden sm:inline">Chiqim</span>
            </button>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 bg-[var(--bg-void)] hover:bg-[var(--border-glass)]/30 border border-[var(--border-glass)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors active:scale-95"
              title="Yangilash"
            >
              <RefreshCw size={16} className={isFetching ? "animate-spin text-[var(--gold)]" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* MULTI-COLUMN WORKFLOW */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        
        {/* COLUMN 1: Teachers & Groups Selector (4 cols on lg, 3 cols on 2xl) */}
        <div className="lg:col-span-4 2xl:col-span-3 h-full overflow-hidden">
          <ColumnTeachersGroups
            teachers={teachers}
            allGroups={allGroups}
            debtors={debtors}
            selectedGroupId={activeGroup?.id}
            onSelectGroup={handleGroupSelect}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            formatCurrency={formatCurrency}
          />
        </div>

        {/* COLUMN 2: Streamlined Group Student Roster (8 cols on lg, 9 cols on 2xl) */}
        <div className="lg:col-span-8 2xl:col-span-9 h-full overflow-hidden">
          <GroupRoster
            activeTab={activeTab}
            selectedGroup={activeGroup}
            debtors={debtors}
            onOpenPayment={handleOpenPayment}
            onOpenDetails={handleOpenDetails}
            onOpenRefund={handleOpenRefund}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>

      {/* DETAIL & PAYMENT SLIDE-OVER DRAWER */}
      <StudentDetailDrawer
        isOpen={!!selectedStudentForDrawer}
        onClose={() => setSelectedStudentForDrawer(null)}
        student={selectedStudentForDrawer}
        branchId={currentBranchId}
        month={selectedMonth}
        onPaymentSuccess={handlePaymentSuccess}
        formatCurrency={formatCurrency}
      />

      {/* QUICK EXPENSE MODAL */}
      <QuickExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        branchId={currentBranchId}
        onExpenseAdded={handlePaymentSuccess}
      />
    </div>
  );
}
