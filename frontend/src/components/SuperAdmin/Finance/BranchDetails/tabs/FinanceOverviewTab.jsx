import React from 'react';
import { Target, DollarSign, CheckCircle, Clock, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';

const MiniIndicator = ({ label, value, icon, color }) => (
  <div className="p-3 bg-[var(--bg-void)]/30 rounded-xl border border-[#2a2a2a]">
    <div className={`flex items-center gap-1.5 mb-1 ${color} opacity-70`}>
      {icon}
      <span className="text-[8px] font-bold uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{value}</p>
  </div>
);

export const FinanceOverviewTab = ({ finance = {}, formatNumber, progressPercentage = 0 }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kutilayotgan tushum kartasi */}
        <div className="lg:col-span-5 lux-card !p-5 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--bg-void)]/60 border border-[var(--gold)]/30 rounded-xl flex items-center justify-center text-[var(--gold)]">
                <Target size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
                  Kutilayotgan Tushum
                </h3>
                <p className="text-[9px] text-[var(--text-muted)] font-bold">Rejadagi umumiy oylik tushum</p>
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-black text-[var(--text-primary)] tracking-tight tabular-nums">
                  {formatNumber(finance.expected_income)}
                </span>
                <span className="text-xs font-bold text-[var(--text-muted)]">UZS</span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Yig'im Tezligi
                  </span>
                  <span className="text-2xl font-black text-[var(--gold)] tabular-nums">
                    {progressPercentage}%
                  </span>
                </div>
                <div className="h-2 w-full bg-[var(--bg-void)]/60 rounded-full overflow-hidden border border-[#2a2a2a]">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-[var(--gold)] transition-all duration-700"
                    style={{ width: `${Math.min(Number(progressPercentage) || 0, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <MiniIndicator
                label="Tasdiqlangan"
                value={`${formatNumber(finance.received_income)} UZS`}
                icon={<CheckCircle size={14} />}
                color="text-emerald-400"
              />
              <MiniIndicator
                label="Kutilmoqda (Qarz)"
                value={`${formatNumber(finance.debt ?? finance.remaining_debt ?? 0)} UZS`}
                icon={<Clock size={14} />}
                color="text-orange-400"
              />
            </div>
          </div>
        </div>

        {/* Haqiqiy Tushum va Sof Foyda kartasi */}
        <div className="lg:col-span-7 lux-card !p-5 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <DollarSign size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
                      Haqiqiy Tushum
                    </h4>
                    <p className="text-[9px] text-[var(--text-muted)] font-bold">Kassaga tushgan real mablag'</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  <TrendingUp size={12} />
                  <span>{progressPercentage}% Natija</span>
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-black text-emerald-400 tracking-tight tabular-nums">
                  {formatNumber(finance.real_revenue || finance.received_income)}
                </span>
                <span className="text-xs font-bold text-[var(--text-muted)]">UZS</span>
              </div>
            </div>

            {/* Refund va Brutto ko'rsatkichlari */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <p className="text-[8px] font-black uppercase text-rose-400 tracking-wider mb-1">
                  Davomat Refundlari
                </p>
                <p className="text-sm font-bold text-rose-400 tabular-nums">
                  -{formatNumber(finance.attendance_refunds_paid ?? finance.refunds ?? 0)} UZS
                </p>
                {finance.refund_share_percent > 0 && (
                  <p className="text-[8px] font-bold text-rose-400/60 mt-0.5">
                    {finance.refund_share_percent}% ulush
                  </p>
                )}
              </div>

              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <p className="text-[8px] font-black uppercase text-amber-400 tracking-wider mb-1">
                  Umumiy Refundlar
                </p>
                <p className="text-sm font-bold text-amber-400 tabular-nums">
                  -{formatNumber(finance.total_payment_refunds ?? 0)} UZS
                </p>
              </div>

              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <p className="text-[8px] font-black uppercase text-emerald-400 tracking-wider mb-1">
                  Brutto (Refundsiz)
                </p>
                <p className="text-sm font-bold text-emerald-400 tabular-nums">
                  {formatNumber(
                    Number(finance.received_income || 0) +
                      Number(finance.attendance_refunds_paid ?? finance.refunds ?? 0)
                  )}{' '}
                  UZS
                </p>
              </div>
            </div>

            {/* Chiqimlar va Sof Foyda */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-[var(--bg-void)]/60 rounded-xl border border-[#2a2a2a]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                    Jami Chiqimlar
                  </p>
                  <TrendingDown size={14} className="text-rose-400" />
                </div>
                <p className="text-xl font-black text-rose-400 tracking-tight tabular-nums">
                  -{formatNumber(finance.expenses)} <span className="text-[10px] text-[var(--text-muted)] font-normal">UZS</span>
                </p>
                {Number(finance.admin_expenses_total || 0) > 0 && (
                  <p className="text-[9px] text-rose-400/80 font-bold mt-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Admin chiqimlari: {formatNumber(finance.admin_expenses_total)} UZS
                  </p>
                )}
              </div>

              <div className="p-4 bg-gradient-to-br from-[var(--gold)]/10 to-transparent rounded-xl border border-[var(--gold)]/30">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[var(--gold)]">
                    Filial Sof Foydasi
                  </p>
                  <ArrowUpRight size={14} className="text-[var(--gold)]" />
                </div>
                <p className="text-2xl font-black text-[var(--gold)] tracking-tight tabular-nums">
                  {formatNumber(finance.net_profit)} <span className="text-[10px] text-[var(--text-muted)] font-normal">UZS</span>
                </p>
                <p className="text-[8px] text-[var(--text-muted)] font-bold mt-1.5">
                  Tushum - Chiqimlar
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceOverviewTab;
