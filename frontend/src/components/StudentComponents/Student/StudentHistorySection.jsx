import React from "react";
import {
  History,
  CheckCircle2,
  Trash2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  LogIn,
  CreditCard,
  Clock,
} from "lucide-react";
import { getPaymentStatus } from "./paymentStatus";

const StudentHistorySection = ({
  payments,
  extraTransactions,
  transfers,
  canConfirmPayment,
  userRole,
  handlePaymentConfirm,
  handleDeleteHistory,
  studentStatus,
}) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* TREASURY HISTORIA */}
      <div className="lux-card !p-0 overflow-hidden border border-[var(--border-glass)] shadow-xl">
        <div className="p-4 sm:p-5 border-b border-[var(--border-glass)] flex items-center justify-between bg-[var(--bg-void)]/30">
          <div className="flex items-center gap-3">
            <History size={18} className="text-[var(--gold)]" />
            <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-[0.2em]">
              To'lovlar
            </span>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-glass)]">
          {payments.length > 0 ? (
            <div className="divide-y divide-[var(--border-glass)]">
              {payments.map((p) => {
                const status = getPaymentStatus(p);
                return (
                  <div
                    key={p.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-[var(--gold)]/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-black text-[9px] border shrink-0 ${status.badgeClass}`}
                      >
                        {new Date(p.month)
                          .toLocaleDateString("uz-UZ", { month: "short" })
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-black text-[var(--text-primary)] uppercase tracking-tight truncate">
                            {new Date(p.month).toLocaleDateString("uz-UZ", {
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                          {p.group_name && (
                            <span className="text-[7px] bg-[var(--gold)]/10 text-[var(--gold)] px-1.5 py-0.5 rounded border border-[var(--gold)]/20 tracking-widest leading-none uppercase font-black">
                              {p.group_name}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                            ID #{p.id}
                          </p>
                          <p className="text-[8px] font-black text-[var(--gold)] uppercase tracking-widest">
                            📅 {p.lessons_count} dars
                          </p>
                          {p.absences_count > 0 && (
                            <p className="text-[8px] font-black text-red-400 uppercase tracking-widest">
                              ⚠️ {p.absences_count} qoldirgan
                            </p>
                          )}
                          {/* REFUND DISPLAY */}
                          {p.refund_amount > 0 && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                                {p.refund_ignored
                                  ? "Bekor qilingan chegirma:"
                                  : "Chegirma:"}{" "}
                                {Math.floor(p.refund_amount).toLocaleString()}{" "}
                                UZS
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8 border-t sm:border-t-0 border-[var(--border-glass)] pt-3 sm:pt-0">
                      <div className="flex items-center gap-3">
                        {p.is_paid ? (
                          <div className="flex flex-col items-end gap-1">
                            <p className="text-xs sm:text-sm font-black text-[var(--text-primary)] tabular-nums">
                              {(p.paid_amount ?? p.amount)?.toLocaleString()}{" "}
                              UZS
                            </p>
                            <div className="flex items-center gap-1 text-emerald-500">
                              <CheckCircle2 size={12} />
                              <span className="text-[8px] font-black uppercase tracking-widest">
                                To'langan
                              </span>
                            </div>
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                              Shartnoma: {(p.amount || 0).toLocaleString()} UZS
                            </p>
                          </div>
                        ) : p.is_partial ? (
                          <div className="flex flex-col items-end gap-1">
                            <p className="text-xs sm:text-sm font-black text-amber-400 tabular-nums">
                              {Math.floor(
                                status.paidAmount || 0,
                              ).toLocaleString()}{" "}
                              UZS
                            </p>
                            <div className="flex items-center gap-1 text-amber-400">
                              <Clock size={12} />
                              <span className="text-[8px] font-black uppercase tracking-widest">
                                Bo'lib to'langan
                              </span>
                            </div>
                            <p className="text-[8px] font-black text-amber-500/80 uppercase tracking-widest">
                              Qolgan:{" "}
                              {Math.floor(
                                status.remainingAmount || 0,
                              ).toLocaleString()}{" "}
                              UZS
                            </p>
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                              Shartnoma: {(p.amount || 0).toLocaleString()} UZS
                            </p>
                            {canConfirmPayment &&
                              studentStatus !== "discount" && (
                                <button
                                  onClick={() => handlePaymentConfirm(p.id)}
                                  className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black rounded-lg border border-amber-500/30 transition-all font-black text-[8px] uppercase tracking-widest"
                                >
                                  <CreditCard size={12} /> Davom etish
                                </button>
                              )}
                          </div>
                        ) : canConfirmPayment &&
                          studentStatus !== "discount" ? (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              onClick={() => handlePaymentConfirm(p.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black rounded-xl border border-emerald-500/20 transition-all font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95"
                            >
                              <CreditCard size={14} /> To'lash
                            </button>
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                              Shartnoma: {(p.amount || 0).toLocaleString()} UZS
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1 text-red-500/30">
                              <XCircle size={16} />
                              <span className="text-[8px] font-black uppercase tracking-widest">
                                Qarzdorlik
                              </span>
                            </div>
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                              Shartnoma: {(p.amount || 0).toLocaleString()} UZS
                            </p>
                          </div>
                        )}

                        {(userRole === "super_admin" || userRole === "admin") && !p.is_verified && (
                          <button
                            onClick={() => handleDeleteHistory(p.id)}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                            title="O'chirish"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {p.is_verified && (
                          <div
                            className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg cursor-not-allowed"
                            title="Super admin tasdiqlagan — o'chirib bo'lmaydi"
                          >
                            <CheckCircle2 size={16} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}


          {payments.length === 0 && (
            <div className="py-16 text-center opacity-30">
              <History size={40} className="mx-auto mb-3" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em]">
                Tarix bo'sh
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TRANSFER HISTORIA */}
      {transfers.length > 0 && (
        <div className="lux-card !p-0 overflow-hidden border border-[var(--border-glass)]">
          <div className="p-4 sm:p-5 border-b border-[var(--border-glass)] flex items-center justify-between bg-blue-500/5">
            <div className="flex items-center gap-3">
              <History size={18} className="text-blue-500" />
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
                Guruhlar Tarixi
              </span>
            </div>
          </div>
          <div className="divide-y divide-[var(--border-glass)]">
            {transfers.map((tr) => (
              <div
                key={tr.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-blue-500/[0.02] transition-all"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                    <LogIn size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2 truncate">
                      {tr.from_group_name}{" "}
                      <ChevronRight
                        size={10}
                        className="text-[var(--gold)] shrink-0"
                      />{" "}
                      {tr.to_group_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        {tr.transfer_date}
                      </p>
                      <span className="w-1 h-1 rounded-full bg-[var(--border-glass)]"></span>
                      <p className="text-[8px] font-bold text-[var(--gold)]/60 uppercase tracking-widest">
                        {tr.marked_by_name}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center sm:flex-col items-end gap-3 sm:gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-[var(--gold)] tabular-nums">
                      {Number(tr.new_group_fee).toLocaleString()}
                    </p>
                    <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                      UZS
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentHistorySection;
