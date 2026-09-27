import React, { useState, useMemo } from "react";
import {
  History,
  CheckCircle2,
  Trash2,
  XCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LogIn,
  CreditCard,
  Clock,
  GraduationCap,
  Filter,
  Loader2,
  AlertCircle
} from "lucide-react";
import { getPaymentStatus } from "./paymentStatus";

const INITIAL_LIMIT = 5;

const StudentHistorySection = ({
  payments = [],
  extraTransactions = [],
  transfers = [],
  canConfirmPayment,
  userRole,
  handlePaymentConfirm,
  handleDeleteHistory,
  studentStatus,
  isLoading = false,
}) => {
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all"); // 'all' | 'debt' | 'partial' | 'paid'
  const [isExpanded, setIsExpanded] = useState(false);

  // Unikal guruhlar ro'yxati
  const availableGroups = useMemo(() => {
    const names = new Set();
    payments.forEach((p) => {
      if (p.group_name) names.add(p.group_name);
    });
    return Array.from(names);
  }, [payments]);

  // Status hisoblagichlari
  const counts = useMemo(() => {
    let debt = 0;
    let partial = 0;
    let paid = 0;
    payments.forEach((p) => {
      if (p.is_paid) paid++;
      else if (p.is_partial) partial++;
      else debt++;
    });
    return { debt, partial, paid, total: payments.length };
  }, [payments]);

  // Filtrlangan to'lovlar
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Guruh filtri
      if (selectedGroup && p.group_name !== selectedGroup) {
        return false;
      }
      // Status filtri
      if (selectedStatus === "debt") {
        return !p.is_paid && !p.is_partial;
      }
      if (selectedStatus === "partial") {
        return !!p.is_partial && !p.is_paid;
      }
      if (selectedStatus === "paid") {
        return !!p.is_paid;
      }
      return true;
    });
  }, [payments, selectedGroup, selectedStatus]);

  // Sahifada ko'rinadigan to'lovlar
  const visiblePayments = useMemo(() => {
    if (isExpanded) return filteredPayments;
    return filteredPayments.slice(0, INITIAL_LIMIT);
  }, [filteredPayments, isExpanded]);

  const hasHiddenPayments = filteredPayments.length > INITIAL_LIMIT;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* TO'LOVLAR TARIXI KARTASI */}
      <div className="lux-card !p-0 overflow-hidden border border-[var(--border-glass)] shadow-xl">
        {/* 1. HEADER: Sarlavha va Umumiy Statistika */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-glass)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-void)]/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] shrink-0 shadow-sm">
              <History size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-[var(--text-primary)] tracking-tight">
                  To'lovlar Tarixi
                </h3>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                  {payments.length} ta oy
                </span>
              </div>
              <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">
                Barcha guruhlar bo'yicha to'lov qaydlari
              </p>
            </div>
          </div>

          {/* Tezkor qarzdorlik ogohlantirishi */}
          <div className="flex items-center gap-2">
            {counts.debt > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-wider">
                <AlertCircle size={12} /> {counts.debt} ta qarzdorlik
              </span>
            )}
            {counts.partial > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider">
                <Clock size={12} /> {counts.partial} ta bo'lib to'langan
              </span>
            )}
          </div>
        </div>

        {/* 2. FILTRLAR PANELI (Guruhlar va Status taglari) */}
        {payments.length > 0 && (
          <div className="p-3 sm:p-4 bg-[var(--bg-void)]/20 border-b border-[var(--border-glass)] space-y-2.5">
            {/* Guruhlar filtri (Agar 2 yoki undan ortiq guruh bo'lsa) */}
            {availableGroups.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mr-1 flex items-center gap-1 shrink-0">
                  <GraduationCap size={11} className="text-[var(--gold)]" /> Guruh:
                </span>
                <button
                  onClick={() => {
                    setSelectedGroup("");
                    setIsExpanded(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 border ${
                    !selectedGroup
                      ? "bg-[var(--gold)] text-white text-white-force border-[var(--gold)] shadow-sm"
                      : "bg-[var(--bg-panel)] text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Barcha guruhlar ({payments.length})
                </button>
                {availableGroups.map((groupName) => {
                  const isSelected = selectedGroup === groupName;
                  const groupCount = payments.filter((p) => p.group_name === groupName).length;
                  return (
                    <button
                      key={groupName}
                      onClick={() => {
                        setSelectedGroup(groupName);
                        setIsExpanded(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 border ${
                        isSelected
                          ? "bg-[var(--gold)] text-white text-white-force border-[var(--gold)] shadow-sm"
                          : "bg-[var(--bg-panel)] text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {groupName} ({groupCount})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Status filtri (Barchasi / Qarzdorlik / Qisman / To'langan) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mr-1 flex items-center gap-1 shrink-0">
                <Filter size={11} className="text-[var(--gold)]" /> Holat:
              </span>
              <button
                onClick={() => {
                  setSelectedStatus("all");
                  setIsExpanded(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 border ${
                  selectedStatus === "all"
                    ? "bg-[var(--gold)] text-white text-white-force border-[var(--gold)] shadow-sm"
                    : "bg-[var(--bg-panel)] text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--text-primary)]"
                }`}
              >
                Barchasi ({counts.total})
              </button>
              {counts.debt > 0 && (
                <button
                  onClick={() => {
                    setSelectedStatus("debt");
                    setIsExpanded(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 border flex items-center gap-1 ${
                    selectedStatus === "debt"
                      ? "bg-rose-500 text-white text-white-force border-rose-500 shadow-sm"
                      : "bg-[var(--bg-panel)] text-rose-600 dark:text-rose-400 border-[var(--border-glass)] hover:border-rose-500/30"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Qarzdorlik ({counts.debt})
                </button>
              )}
              {counts.partial > 0 && (
                <button
                  onClick={() => {
                    setSelectedStatus("partial");
                    setIsExpanded(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 border flex items-center gap-1 ${
                    selectedStatus === "partial"
                      ? "bg-amber-500 text-white text-white-force border-amber-500 shadow-sm"
                      : "bg-[var(--bg-panel)] text-amber-600 dark:text-amber-400 border-[var(--border-glass)] hover:border-amber-500/30"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Qisman ({counts.partial})
                </button>
              )}
              {counts.paid > 0 && (
                <button
                  onClick={() => {
                    setSelectedStatus("paid");
                    setIsExpanded(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 border flex items-center gap-1 ${
                    selectedStatus === "paid"
                      ? "bg-emerald-600 text-white text-white-force border-emerald-600 shadow-sm"
                      : "bg-[var(--bg-panel)] text-emerald-600 dark:text-emerald-400 border-[var(--border-glass)] hover:border-emerald-500/30"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  To'langan ({counts.paid})
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3. ASOSIY TO'LOVLAR RO'YXATI */}
        <div className="divide-y divide-[var(--border-glass)]">
          {isLoading && payments.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-[var(--gold)]" />
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                To'lovlar yuklanmoqda...
              </p>
            </div>
          ) : visiblePayments.length > 0 ? (
            visiblePayments.map((p) => {
              const status = getPaymentStatus(p);
              return (
                <div
                  key={p.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 group hover:bg-[var(--gold)]/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    {/* Oy qisqartmasi badge */}
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-[9px] border shrink-0 shadow-inner ${status.badgeClass}`}
                    >
                      {new Date(p.month)
                        .toLocaleDateString("uz-UZ", { month: "short" })
                        .toUpperCase()}
                    </div>

                    {/* Oy va guruh tafsilotlari */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs sm:text-sm font-black text-[var(--text-primary)] capitalize tracking-tight truncate">
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
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5">
                        <span className="text-[8px] font-mono text-[var(--text-muted)]">
                          #{p.id}
                        </span>
                        <span className="text-[8px] font-black text-[var(--text-muted)]">
                          📅 {p.lessons_count || 0} dars
                        </span>
                        {p.absences_count > 0 && (
                          <span className="text-[8px] font-black text-rose-500">
                            ⚠️ {p.absences_count} qoldirgan
                          </span>
                        )}
                        {/* Chegirma ko'rinishi */}
                        {p.refund_amount > 0 && (
                          <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Chegirma: {Math.floor(p.refund_amount).toLocaleString()} UZS
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* To'lov summasi va harakat tugmalari */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 border-[var(--border-glass)] pt-2.5 sm:pt-0">
                    {/* Summa & Status */}
                    <div className="text-left sm:text-right">
                      {p.is_paid ? (
                        <div>
                          <p className="text-xs sm:text-sm font-black text-[var(--text-primary)] tabular-nums">
                            {(p.paid_amount ?? p.amount)?.toLocaleString()} UZS
                          </p>
                          <div className="flex items-center gap-1 sm:justify-end text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} />
                            <span className="text-[8px] font-black uppercase tracking-widest">
                              To'langan
                            </span>
                          </div>
                        </div>
                      ) : p.is_partial ? (
                        <div>
                          <p className="text-xs sm:text-sm font-black text-amber-500 tabular-nums">
                            {Math.floor(status.paidAmount || 0).toLocaleString()} UZS
                          </p>
                          <p className="text-[8px] font-black text-amber-600/80 uppercase tracking-widest">
                            Qolgan: {Math.floor(status.remainingAmount || 0).toLocaleString()} UZS
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs sm:text-sm font-black text-rose-500 tabular-nums">
                            {(p.amount || 0).toLocaleString()} UZS
                          </p>
                          <div className="flex items-center gap-1 sm:justify-end text-rose-500/70">
                            <XCircle size={11} />
                            <span className="text-[8px] font-black uppercase tracking-widest">
                              Qarzdorlik
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Harakatlar (To'lash / O'chirish) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* To'lash / Davom etish tugmasi */}
                      {!p.is_paid && canConfirmPayment && studentStatus !== "discount" && (
                        <button
                          onClick={() => handlePaymentConfirm(p.id)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border font-black text-[9px] uppercase tracking-wider transition-all active:scale-95 shadow-sm ${
                            p.is_partial
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500 hover:text-black"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                          }`}
                        >
                          <CreditCard size={12} />
                          <span>{p.is_partial ? "Davom etish" : "To'lash"}</span>
                        </button>
                      )}

                      {/* Admin o'chirish / tasdiqlangan belgisi */}
                      {(userRole === "super_admin" || userRole === "admin") && !p.is_verified && (
                        <button
                          onClick={() => handleDeleteHistory(p.id)}
                          className="p-1.5 text-rose-500/70 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all"
                          title="O'chirish"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                      {p.is_verified && (
                        <div
                          className="p-1.5 text-emerald-500 bg-emerald-500/10 rounded-lg cursor-not-allowed"
                          title="Super admin tasdiqlagan"
                        >
                          <CheckCircle2 size={15} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-[var(--text-muted)]">
              <History size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-[10px] font-black uppercase tracking-widest">
                Ushbu filtr bo'yicha to'lovlar mavjud emas
              </p>
              {(selectedGroup || selectedStatus !== "all") && (
                <button
                  onClick={() => {
                    setSelectedGroup("");
                    setSelectedStatus("all");
                  }}
                  className="mt-2 text-[9px] font-black text-[var(--gold)] hover:underline uppercase tracking-wider"
                >
                  Filtrlarni tozalash
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4. AQLLI CHEKLASH: "BARCHA TO'LOVLARNI KO'RISH" TUGMASI */}
        {hasHiddenPayments && (
          <div className="p-3 bg-[var(--bg-void)]/40 border-t border-[var(--border-glass)] text-center">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full py-2 px-4 rounded-xl bg-[var(--gold)]/10 hover:bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/20 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.99] shadow-sm"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={14} />
                  <span>Kamroq ko'rsatish (Dastlabki {INITIAL_LIMIT} ta)</span>
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  <span>
                    Barcha to'lovlarni ko'rish (+{filteredPayments.length - INITIAL_LIMIT} ta eski oy)
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* GURUHLAR TRANSFERI TARIXI (TRANSFER HISTORIA) */}
      {transfers.length > 0 && (
        <div className="lux-card !p-0 overflow-hidden border border-[var(--border-glass)] shadow-sm">
          <div className="p-4 sm:p-5 border-b border-[var(--border-glass)] flex items-center justify-between bg-blue-500/5">
            <div className="flex items-center gap-3">
              <History size={18} className="text-blue-500" />
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
                Guruhlar Tarixi
              </span>
            </div>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {transfers.length} ta o'tkazma
            </span>
          </div>
          <div className="divide-y divide-[var(--border-glass)]">
            {transfers.map((tr) => (
              <div
                key={tr.id}
                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-blue-500/[0.02] transition-all"
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                    <LogIn size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2 truncate">
                      {tr.from_group_name}{" "}
                      <ChevronRight size={10} className="text-[var(--gold)] shrink-0" />{" "}
                      {tr.to_group_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        {tr.transfer_date}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-[var(--border-glass)]"></span>
                      <span className="text-[8px] font-bold text-[var(--gold)]/60 uppercase tracking-widest">
                        {tr.marked_by_name}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center sm:flex-col items-end gap-2 sm:gap-0.5">
                  <span className="text-[10px] font-black text-[var(--gold)] tabular-nums">
                    {Number(tr.new_group_fee).toLocaleString()} UZS
                  </span>
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
