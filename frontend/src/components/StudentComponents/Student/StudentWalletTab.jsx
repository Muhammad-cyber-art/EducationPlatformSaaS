import React, { useState } from "react";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  CreditCard,
  History,
  DownloadCloud,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Percent,
  RotateCcw
} from "lucide-react";
import { getPaymentStatus } from "./paymentStatus";

export default function StudentWalletTab({
  studentData,
  payments,
  extraTransactions,
  ledgerTransactions,
  canConfirmPayment,
  dispatch,
}) {
  const [activeSubTab, setActiveSubTab] = useState("ledger"); // ledger or invoices

  // Extract from studentData.finance_profile if available, else fallback
  const financeProfile = studentData?.finance_profile || {};
  const balance = financeProfile.balance || 0;
  const deposit = balance > 0 ? balance : 0;
  const debtDisplay = balance < 0 ? Math.abs(balance) : 0;

  // For demonstration, combining payments and extraTransactions into a single ledger array
  const ledger = ledgerTransactions || [];

  return (
    <div className="space-y-6">
      {/* KPI WIDGETS */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lux-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Wallet size={48} />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Joriy Balans
            </span>
            <span className={`text-2xl font-black ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {Number(balance).toLocaleString()} UZS
            </span>
          </div>
        </div>

        <div className="lux-card p-5 relative overflow-hidden group border-red-500/20">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingDown size={48} className="text-red-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Qarzdorlik
            </span>
            <span className="text-2xl font-black text-red-500">
              {Number(debtDisplay).toLocaleString()} UZS
            </span>
          </div>
        </div>

        <div className="lux-card p-5 relative overflow-hidden group border-green-500/20">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp size={48} className="text-green-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Depozit (Avans)
            </span>
            <span className="text-2xl font-black text-green-500">
              {Number(deposit).toLocaleString()} UZS
            </span>
          </div>
        </div>
      </div> */}

      {/* LEDGER & INVOICES */}
      <div className="lux-card !p-0 overflow-hidden border border-[var(--border-glass)] shadow-xl">
        <div className="flex items-center border-b border-[var(--border-glass)] bg-[var(--bg-void)]/40">
          <button
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeSubTab === "ledger"
              ? "border-[var(--gold)] text-[var(--gold)] bg-[var(--gold)]/5"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-void)]/60"
              }`}
            onClick={() => setActiveSubTab("ledger")}
          >
            Tranzaksiyalar tarixi
          </button>
          <button
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeSubTab === "invoices"
              ? "border-[var(--gold)] text-[var(--gold)] bg-[var(--gold)]/5"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-void)]/60"
              }`}
            onClick={() => setActiveSubTab("invoices")}
          >
            Shartnomalar
          </button>
        </div>

        <div className="p-0">
          {activeSubTab === "ledger" && (
            <div className="divide-y divide-[var(--border-glass)]">
              {ledger.length > 0 ? (
                ledger.map((item, idx) => {
                  const isCancelled = item.status === 'cancelled';
                  const isReversal = item.record_type === 'reversal';
                  const isRefund = item.record_type === 'refund';
                  const amount = Number(item.amount || 0);

                  let badgeColor = "bg-green-500/10 text-green-400";
                  let Icon = ArrowUpRight;
                  let label = "KIRIM";

                  if (isCancelled) {
                    badgeColor = "bg-gray-500/10 text-gray-400";
                    label = "BEKOR QILINDI";
                  } else if (isRefund) {
                    badgeColor = "bg-red-500/10 text-red-400";
                    Icon = ArrowDownRight;
                    label = "QAYTARILDI";
                  } else if (isReversal) {
                    badgeColor = "bg-orange-500/10 text-orange-400";
                    Icon = ArrowDownRight;
                    label = "REVERSAL";
                  }

                  const details = item.payment_details || {};
                  const hasRefund = details.refund_amount > 0;
                  const paymentMethod = details.payment_method_display || item.category_display || "To'lov";
                  const markedBy = item.marked_by_name || "Noma'lum";

                  return (
                    <div
                      key={item.id || idx}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-[var(--gold)]/[0.03] transition-colors border-b border-[var(--border-glass)] last:border-0 ${isCancelled ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`p-3 rounded-xl flex-shrink-0 ${badgeColor}`}>
                          <Icon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h4 className={`font-black text-base ${isCancelled ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                              {amount.toLocaleString()} UZS
                            </h4>
                            <span className={`px-1.5 py-0.5 rounded uppercase text-[8px] font-black tracking-widest ${badgeColor.replace('text-', 'bg-').replace('/10', '/20')}`}>
                              {label}
                            </span>
                            {item.is_verified && (
                              <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                <CheckCircle2 size={10} />
                                <span className="text-[8px] font-black uppercase tracking-widest">Tasdiqlangan</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                              {paymentMethod}
                            </span>
                            <span className="text-[10px] text-[var(--border-glass)]">•</span>
                            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                              {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                            </span>
                            <span className="text-[10px] text-[var(--border-glass)]">•</span>
                            <span className="text-[9px] font-bold text-[var(--gold)] uppercase tracking-widest">
                              {markedBy}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--text-secondary)] truncate">
                            <span className="font-semibold text-[var(--text-primary)] shrink-0">
                              {item.group_name || "Ta'lim xizmati"}
                            </span>
                            <span className="opacity-50 shrink-0">—</span>
                            <span className="truncate">{item.description || item.notes || "Izohsiz"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0 text-right mt-2 sm:mt-0">
                        {details.month && (
                          <span className="text-[10px] font-black text-[var(--gold)] uppercase tracking-widest">
                            {new Date(details.month).toLocaleDateString("uz-UZ", { month: "long", year: "numeric" })}
                          </span>
                        )}
                        {hasRefund && (
                          <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-500">
                            <span>{details.refund_ignored ? "Bekor qilingan chegirma:" : "Davomat chegirmasi:"}</span>
                            <span>{Math.floor(details.refund_amount).toLocaleString()} UZS</span>
                          </div>
                        )}
                        <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">
                          Ref: {item.related_id?.split('-').slice(-2).join('-') || item.id}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-[var(--text-secondary)]">
                  <FileText className="mx-auto mb-3 opacity-20" size={48} />
                  <p>Tranzaksiyalar topilmadi.</p>
                </div>
              )}

            </div>
          )}

          {activeSubTab === "invoices" && (
            <div className="divide-y divide-[var(--border-glass)]">
              {payments && payments.length > 0 ? (
                payments.map((p) => {
                  const status = getPaymentStatus(p);
                  return (
                    <div
                      key={p.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-[var(--gold)]/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div
                          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-xs sm:text-sm border shrink-0 shadow-lg ${status.badgeClass}`}
                        >
                          {new Date(p.month)
                            .toLocaleDateString("uz-UZ", { month: "short" })
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm sm:text-base font-black text-[var(--text-primary)] uppercase tracking-tight truncate">
                              {new Date(p.month).toLocaleDateString("uz-UZ", {
                                month: "long",
                                year: "numeric",
                              })}
                            </p>
                            {p.group_name && (
                              <span className="text-[8px] sm:text-[9px] bg-[var(--gold)]/10 text-[var(--gold)] px-2 py-0.5 rounded-md border border-[var(--gold)]/20 tracking-widest leading-none uppercase font-black">
                                {p.group_name}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                            <p className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                              ID #{p.id}
                            </p>
                            <p className="text-[9px] sm:text-[10px] font-black text-[var(--gold)] uppercase tracking-widest">
                              📅 {p.lessons_count} dars
                            </p>
                            {p.absences_count > 0 && (
                              <p className="text-[9px] sm:text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1">
                                ⚠️ {p.absences_count} qoldirgan
                              </p>
                            )}
                            {p.refund_amount > 0 && (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                <p className="text-[8px] sm:text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                                  {p.refund_ignored ? "Bekor qilingan chegirma:" : "Chegirma:"}{" "}
                                  {Math.floor(p.refund_amount).toLocaleString()} UZS
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 border-t sm:border-t-0 border-[var(--border-glass)] pt-4 sm:pt-0">
                        {p.is_paid ? (
                          <div className="flex items-center gap-4 sm:gap-6">
                            <div className="flex flex-col items-end gap-1">
                              <p className="text-sm sm:text-lg font-black text-[var(--text-primary)] tabular-nums tracking-tight">
                                {(p.paid_amount ?? p.amount)?.toLocaleString()} UZS
                              </p>
                              <div className="flex items-center gap-1.5 text-emerald-500">
                                <CheckCircle2 size={14} />
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                                  To'langan
                                </span>
                              </div>
                              <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                                Shartnoma: {(p.amount || 0).toLocaleString()} UZS
                              </p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                              <CheckCircle2 size={24} />
                            </div>
                          </div>
                        ) : p.is_partial ? (
                          <div className="flex items-center gap-4 sm:gap-6">
                            <div className="flex flex-col items-end gap-1">
                              <p className="text-sm sm:text-lg font-black text-amber-400 tabular-nums tracking-tight">
                                {Math.floor(status.paidAmount || 0).toLocaleString()} UZS
                              </p>
                              <div className="flex items-center gap-1.5 text-amber-400">
                                <Clock size={14} />
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                                  Bo'lib to'langan
                                </span>
                              </div>
                              <p className="text-[8px] sm:text-[9px] font-black text-amber-500/80 uppercase tracking-widest">
                                Qolgan: {Math.floor(status.remainingAmount || 0).toLocaleString()} UZS
                              </p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                              <Clock size={24} />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 sm:gap-6">
                            <div className="flex flex-col items-end gap-1">
                              <p className="text-sm sm:text-lg font-black text-[var(--text-primary)] tabular-nums tracking-tight opacity-50">
                                {(p.amount || 0).toLocaleString()} UZS
                              </p>
                              <div className="flex items-center gap-1.5 text-red-500/60">
                                <XCircle size={14} />
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                                  To'lanmagan
                                </span>
                              </div>
                              <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                                Shartnoma: {(p.amount || 0).toLocaleString()} UZS
                              </p>
                            </div>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500/50 flex items-center justify-center shrink-0">
                              <XCircle size={24} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-[var(--text-secondary)]">
                  <FileText className="mx-auto mb-3 opacity-20" size={48} />
                  <p>Shartnomalar topilmadi.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
