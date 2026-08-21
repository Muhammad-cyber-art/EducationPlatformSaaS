import React from "react";
import {
  DollarSign,
  MapPin,
  Hash,
  CreditCard,
  CheckCircle,
  XCircle,
  Wallet,
  Users,
  History,
} from "lucide-react";

export const FinanceHeader = ({ month }) => (
  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
    <div className="flex items-center gap-6">
      <div className="w-16 h-16 bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dim)] rounded-3xl shadow-[0_0_30px_#b8860b20] flex items-center justify-center text-black">
        <DollarSign size={32} strokeWidth={2.5} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-[var(--text-primary)] capitalize tracking-tighter leading-none">
          Moliya Portali
        </h1>
        <p className="text-[10px] text-[var(--gold)] font-black capitalize tracking-[0.3em] mt-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]"></span>
          Shaxsiy Maosh Tafsilotlari
        </p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="px-5 py-3 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl backdrop-blur-xl">
        <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-0.5">
          Joriy Oy
        </p>
        <p className="text-xs font-black text-[var(--gold)] capitalize">
          {month}
        </p>
      </div>
    </div>
  </div>
);

export const MentorInfoCard = ({ data, isPercentageType }) => (
  <div className="space-y-6">
    <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] p-8 rounded-[2.5rem] relative overflow-hidden group shadow-2xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--gold)]/5 rounded-full -mr-16 -mt-16 blur-3xl" />
      <div className="w-24 h-24 bg-[var(--bg-void)] border-2 border-[var(--gold)]/20 rounded-[2rem] mx-auto mb-6 flex items-center justify-center text-[var(--gold)] p-1 overflow-hidden" />
      <h2 className="text-xl font-black text-[var(--text-primary)] text-center mb-1 capitalize tracking-tight">
        {data.employee_first_name} {data.employee_last_name}
      </h2>
      <div className="flex justify-center mb-8">
        <span className="px-4 py-1.5 bg-[var(--bg-void)] text-[var(--text-secondary)] rounded-full text-[9px] font-black capitalize tracking-widest border border-[var(--border-glass)]">
          {data.employee_role} • {isPercentageType ? "Foizda" : "Fixed"}
        </span>
      </div>
      <div className="space-y-4 pt-6 border-t border-[var(--border-glass)]">
        <InfoRow
          icon={<Hash size={14} />}
          label="ID"
          value={`#${data.employee_id}`}
        />
        <InfoRow
          icon={<MapPin size={14} />}
          label="Filial"
          value={`${data.employee_branch} Filial`}
        />
        <InfoRow
          icon={<CreditCard size={14} />}
          label="Karta"
          value={data.karta || "Kiritilmagan"}
        />
      </div>
    </div>
    <div
      className={`p-6 rounded-[2rem] border-2 flex items-center justify-between ${data.is_paid ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}
    >
      <div>
        <p className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1 opacity-60">
          To'lov Holati
        </p>
        <h4
          className={`text-lg font-black capitalize tracking-tighter ${data.is_paid ? "text-emerald-400" : "text-amber-500"}`}
        >
          {data.is_paid ? "To'langan" : "Kutilmoqda"}
        </h4>
      </div>
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${data.is_paid ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-500"}`}
      >
        {data.is_paid ? <CheckCircle size={24} /> : <XCircle size={24} />}
      </div>
    </div>
  </div>
);

export const FinanceStatsGrid = ({
  data,
  isPercentageType,
  formatCurrency,
  formatPercentage,
}) => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="p-8 bg-gradient-to-br from-[var(--bg-panel)] to-[var(--bg-void)] border border-[var(--border-glass)] rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute bottom-0 right-0 p-4 opacity-5">
          <DollarSign size={100} />
        </div>
        <p className="text-[10px] font-black text-[var(--gold)] capitalize tracking-widest mb-2">
          Asosiy Tushm
        </p>
        <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter">
          {isPercentageType
            ? formatCurrency(data.calculated_commission)
            : formatCurrency(data.salary_base)}
        </h3>
        {isPercentageType && (
          <p className="text-[9px] font-bold text-[var(--text-muted)] mt-2 capitalize">
            Guruhlardan {data.commission_percentage}% foiz
          </p>
        )}
      </div>
      <div className="p-8 bg-gradient-to-br from-[var(--bg-panel)] to-[var(--bg-void)] border border-[var(--border-glass)] rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-4 right-6 w-10 h-10 bg-[var(--gold)]/10 rounded-xl flex items-center justify-center text-[var(--gold)]">
          <Wallet size={20} />
        </div>
        <p className="text-[10px] font-black text-[var(--gold)] capitalize tracking-widest mb-2">
          Jami To'lanadi
        </p>
        <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter">
          {formatCurrency(data.total_amount)}
        </h3>
        <div className="flex gap-4 mt-3">
          <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 capitalize leading-none">
            +{formatCurrency(data.bonus)} Bonus
          </div>
          <div className="text-[9px] font-bold text-rose-600 dark:text-rose-500 capitalize leading-none">
            -{formatCurrency(data.deductions)} Jarima
          </div>
        </div>
      </div>
    </div>
    <div
      className={`p-6 rounded-[2rem] border-2 ${isPercentageType ? "border-emerald-500/20 bg-emerald-500/5" : "border-[var(--gold)]/20 bg-[var(--gold)]/5"}`}
    >
      <p className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1 opacity-60">
        Maosh Turi
      </p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-black text-[var(--text-primary)] tabular-nums tracking-tighter">
          {isPercentageType
            ? formatPercentage(data.commission_percentage)
            : formatCurrency(data.salary_base)}
        </p>
        <span className="text-[9px] font-black text-[var(--gold)] capitalize tracking-widest">
          {isPercentageType ? "KPI" : "Fixed"}
        </span>
      </div>
    </div>
  </div>
);

export const MentorGroupsTable = ({ data, formatCurrency }) => (
  <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2.5rem] overflow-hidden shadow-2xl">
    <div className="px-8 py-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Users size={18} className="text-[var(--gold)]" />
        <h3 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-widest">
          Guruhlarim
        </h3>
      </div>
      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 capitalize tracking-widest">
        Jami Real Daromad: {formatCurrency(data.groups_income)}
      </span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-black/20">
            <th className="px-8 py-4 text-[9px] font-black text-[var(--text-muted)] capitalize">
              Guruh
            </th>
            <th className="px-8 py-4 text-[9px] font-black text-[var(--text-muted)] capitalize text-center">
              Talabalar
            </th>
            <th className="px-8 py-4 text-[9px] font-black text-emerald-400 capitalize text-right">
              Real Tushum
            </th>
            <th className="px-8 py-4 text-[9px] font-black text-[var(--gold)] capitalize text-right">
              Sizning Ulushingiz
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.mentor_groups.map((group) => (
            <tr key={group.id} className="hover:bg-white/5 transition-colors">
              <td className="px-8 py-5">
                <p className="text-xs font-black text-[var(--text-primary)] capitalize tracking-tight">
                  {group.name}
                </p>
                <p className="text-[8px] text-[var(--text-muted)] font-bold capitalize mt-1">
                  {group.branch_name}
                </p>
              </td>
              <td className="px-8 py-5 text-center">
                <span className="px-3 py-1 bg-[var(--bg-void)] border border-white/10 rounded-lg text-[10px] font-black text-white">
                  {group.students_count}
                </span>
              </td>
              <td className="px-8 py-5 text-right font-bold text-xs text-[var(--text-primary)] tabular-nums">
                {formatCurrency(group.real_income)}
              </td>
              <td className="px-8 py-5 text-right font-black text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(
                  group.mentor_share_paid ??
                    group.real_income * (data.commission_percentage / 100),
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const PaymentHistoryList = ({ history, formatCurrency }) => (
  <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2.5rem] overflow-hidden shadow-2xl">
    <div className="px-8 py-6 border-b border-[var(--border-glass)] flex items-center gap-3">
      <History size={18} className="text-[var(--gold)]" />
      <h3 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-widest">
        Tarix
      </h3>
    </div>
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {history?.map((item, idx) => (
        <div
          key={idx}
          className="p-5 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl flex items-center justify-between group hover:border-[var(--gold)]/30 transition-all"
        >
          <div>
            <p className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">
              {item.month}
            </p>
            <p
              className={`text-[8px] font-black capitalize mt-1 ${item.is_paid ? "text-emerald-600 dark:text-emerald-500" : "text-amber-500"}`}
            >
              {item.is_paid ? "To'langan" : "Kutilmoqda"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-[var(--gold)] tabular-nums">
              {formatCurrency(item.total_amount)}
            </p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3 text-[var(--text-muted)]">
      <div className="opacity-60">{icon}</div>
      <span className="text-[9px] font-black capitalize tracking-widest">
        {label}
      </span>
    </div>
    <span className="text-[10px] font-black text-[var(--text-primary)] capitalize truncate ml-4">
      {value}
    </span>
  </div>
);

export const LoadingState = () => (
  <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin text-[var(--gold)]">
        <Activity size={40} />
      </div>
      <p className="text-[10px] font-black text-[var(--gold)] capitalize tracking-widest">
        Moliya ma'lumotlari yuklanmoqda...
      </p>
    </div>
  </div>
);

export const ErrorState = ({ error, onBack }) => (
  <div className="min-h-screen bg-[var(--bg-void)] flex flex-col items-center justify-center p-6">
    <div className="w-20 h-20 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 border border-amber-500/20">
      <ShieldAlert size={40} />
    </div>
    <h2 className="text-xl font-black text-white capitalize tracking-tighter mb-2 text-center">
      To'lov ma'lumoti topilmadi
    </h2>
    <p className="text-[11px] text-[var(--text-muted)] font-black capitalize tracking-widest text-center max-w-md leading-relaxed">
      {error ||
        "Moliya bo'limida sizning to'lov ma'lumotingiz hali generatsiya qilinmagan."}
    </p>
    <button
      onClick={onBack}
      className="mt-8 px-8 py-4 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl text-[10px] font-black text-white hover:bg-[var(--gold)] hover:text-black transition-all capitalize tracking-[0.2em]"
    >
      Orqaga qaytish
    </button>
  </div>
);

export const ShieldAlert = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

import { Activity } from "lucide-react";
