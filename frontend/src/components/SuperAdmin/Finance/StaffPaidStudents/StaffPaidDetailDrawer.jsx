import React from "react";
import {
  Calculator,
  Sparkles,
  Calendar,
  History,
  FileText,
  ShieldCheck,
  X,
  Loader2,
  Landmark,
} from "lucide-react";
import { formatCurrency, StudentStatusBadge } from "./shared";

const StaffPaidDetailDrawer = React.memo(
  ({ selectedStudent, detailData, detailLoading, onClose }) => {
    if (!selectedStudent) return null;

    const isDiscount = selectedStudent?.status === "discount";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-2xl h-full md:h-[95vh] bg-[var(--bg-panel)] border-l md:border border-[var(--border-glass)] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-[var(--border-glass)] flex items-center justify-between bg-[var(--bg-void)]/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--gold)]/20 to-[var(--gold)]/5 border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)] font-black text-sm">
                <Calculator size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-[var(--text-primary)]">
                    {selectedStudent.name}
                  </h3>
                  <StudentStatusBadge
                    status={selectedStudent.status}
                    label={selectedStudent.status_label}
                  />
                </div>
                <p className="text-[10px] text-[var(--text-muted)] font-bold">
                  Guruh: {selectedStudent.group_name} | Ulush va davomat hisob-kitobi
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-500 rounded-xl transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
            {detailLoading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-[var(--gold)]" size={32} />
                <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
                  Arifmetik hisob-kitob formulasi tayyorlanmoqda...
                </p>
              </div>
            ) : detailData ? (
              <>
                {/* 1. Grand Formula Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[var(--gold)]/15 via-[var(--bg-panel)] to-[var(--bg-void)] border-2 border-[var(--gold)]/30 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--gold)] flex items-center gap-1.5">
                      <Sparkles size={13} />
                      {detailData.arithmetic_calculation?.summary_title || "Arifmetik Hisob-Kitob"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/30">
                      {detailData.salary_config?.type_label}
                    </span>
                  </div>

                  {/* Formula Visual Box */}
                  <div className="p-3.5 bg-[var(--bg-void)]/80 border border-[var(--border-glass)] rounded-xl space-y-1.5 font-mono">
                    <div className="text-[10px] font-bold text-[var(--text-muted)]">
                      Qo'llanilgan formula qoidasi:
                    </div>
                    <div className="text-xs font-black text-amber-400">
                      {detailData.arithmetic_calculation?.formula_template}
                    </div>
                    <div className="text-sm font-black text-emerald-400 pt-1 border-t border-[var(--border-glass)]">
                      {detailData.arithmetic_calculation?.formula_math}
                    </div>
                  </div>

                  {/* Result callout */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                        O'qituvchiga Hisoblangan Yakuniy Ulush
                      </p>
                      <p className="text-[8px] text-[var(--text-muted)]">
                        {detailData.salary_config?.source}
                      </p>
                    </div>
                    <div className="text-xl font-black text-emerald-400 tabular-nums bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 shadow-sm">
                      {formatCurrency(detailData.arithmetic_calculation?.final_share)}
                    </div>
                  </div>
                </div>

                {/* 2. 4-Grid Financial Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-[var(--bg-void)]/60 border border-[var(--border-glass)]">
                    <span className="text-[8px] font-black uppercase tracking-wider text-[var(--text-muted)] block">
                      Kurs / Shartnoma
                    </span>
                    <span className="text-sm font-black text-[var(--text-primary)] tabular-nums mt-0.5 block">
                      {formatCurrency(
                        detailData.financial_metrics?.course_fee ??
                          detailData.contract_and_payment?.contract_amount
                      )}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-void)]/60 border border-[var(--border-glass)]">
                    <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400 block">
                      Qabul qilingan
                    </span>
                    {isDiscount ? (
                      <div className="mt-0.5">
                        <span className="text-sm font-black text-[var(--text-muted)] block">-</span>
                        <span className="text-[8px] text-purple-400 font-bold">Davlat puli</span>
                      </div>
                    ) : (
                      <span className="text-sm font-black text-emerald-400 tabular-nums mt-0.5 block">
                        {formatCurrency(
                          detailData.financial_metrics?.state_receivable_amount ??
                            detailData.contract_and_payment?.paid_amount
                        )}
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-void)]/60 border border-[var(--border-glass)]">
                    <span className="text-[8px] font-black uppercase tracking-wider text-[var(--gold)] block">
                      O'qituvchi Ulushi
                    </span>
                    <span className="text-sm font-black text-[var(--gold)] tabular-nums mt-0.5 block">
                      {formatCurrency(detailData.arithmetic_calculation?.final_share)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-void)]/60 border border-[var(--border-glass)]">
                    <span className="text-[8px] font-black uppercase tracking-wider text-amber-400 block">
                      Markaz Marjasi
                    </span>
                    {isDiscount ? (
                      <div className="mt-0.5">
                        <span className="text-sm font-black text-[var(--text-muted)] block">-</span>
                        <span className="text-[8px] text-[var(--text-muted)] font-semibold">
                          Hisoblanmaydi
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-black text-amber-400 tabular-nums mt-0.5 block">
                        {formatCurrency(detailData.financial_metrics?.center_gross_margin ?? 0)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Davlat puli taxminiy hisob-kitob callout */}
                {isDiscount && (
                  <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Landmark size={15} className="text-purple-400 flex-shrink-0" />
                      <span className="text-[10px] text-purple-300 font-bold">
                        Davlat puli taxminiy ko'rsatkichi (Kassaga olinmaydi):
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[10px]">
                      <span className="text-purple-300">
                        Kutilma:{" "}
                        <strong>
                          {formatCurrency(detailData.financial_metrics?.estimated_state_receivable ?? 0)}
                        </strong>
                      </span>
                      <span className="text-[var(--text-muted)]">•</span>
                      <span className="text-amber-300">
                        Taxminiy markaz ulushi:{" "}
                        <strong>
                          {formatCurrency(detailData.financial_metrics?.estimated_center_margin ?? 0)}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Step-by-Step Arithmetic Timeline */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calculator size={14} className="text-[var(--gold)]" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">
                      Bosqichma-bosqich Arifmetik Amallar
                    </h4>
                  </div>

                  <div className="space-y-2.5">
                    {detailData.arithmetic_calculation?.steps?.map((step) => (
                      <div
                        key={step.step_number}
                        className={`p-3.5 rounded-xl border transition-all ${
                          step.highlight
                            ? "bg-emerald-500/5 border-emerald-500/30 shadow-md"
                            : "bg-[var(--bg-void)]/40 border-[var(--border-glass)]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                step.highlight
                                  ? "bg-emerald-500 text-white"
                                  : "bg-[var(--gold)]/20 text-[var(--gold)]"
                              }`}
                            >
                              {step.step_number}
                            </span>
                            <span className="text-[11px] font-black text-[var(--text-primary)]">
                              {step.title}
                            </span>
                          </div>
                          {step.badge && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-[var(--bg-panel)] text-[var(--text-muted)] border border-[var(--border-glass)]">
                              {step.badge}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-[var(--text-muted)] font-medium leading-relaxed pl-7">
                          {step.explanation}
                        </p>

                        <div className="mt-2 pl-7 flex items-center justify-between font-mono bg-black/20 p-2 rounded-lg border border-white/5">
                          <span className="text-[10px] font-bold text-amber-300">
                            {step.math_formula}
                          </span>
                          <span className="text-[11px] font-black text-emerald-400 tabular-nums">
                            = {step.result}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Attendance Calendar & Verification */}
                {detailData.attendance?.lessons && detailData.attendance.lessons.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-blue-400" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">
                          Darslar va Davomat Jurnali
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {detailData.attendance.present_count} / {detailData.attendance.total_lessons} dars (
                        {detailData.attendance.attendance_percentage}%)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {detailData.attendance.lessons.map((ls, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded-xl border text-center transition-all ${
                            ls.is_present
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-rose-500/5 border-rose-500/15 text-rose-400/60"
                          }`}
                        >
                          <div className="text-[8px] font-bold uppercase">{ls.day_name}</div>
                          <div className="text-xs font-black tabular-nums my-0.5">{ls.date}</div>
                          <div className="text-[8px] font-black uppercase flex items-center justify-center gap-1">
                            <span>{ls.is_present ? "✓ Bor" : "✗ Yo'q"}</span>
                            {ls.is_manually_adjusted && (
                              <span
                                className="text-[7px] text-purple-400 font-bold"
                                title="Qo'lda tahrirlangan"
                              >
                                (audit)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Attendance Override & Audit Logs */}
                {detailData.audit_logs && detailData.audit_logs.length > 0 && (
                  <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-purple-500/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <History size={14} className="text-purple-400" />
                      <h4 className="text-xs font-black uppercase tracking-widest text-purple-400">
                        Davomat Audit va Qayta Hisoblash Tarixi
                      </h4>
                    </div>

                    <div className="space-y-2">
                      {detailData.audit_logs.map((al) => (
                        <div
                          key={al.id}
                          className="p-3 bg-[var(--bg-void)]/60 rounded-xl border border-[var(--border-glass)] text-[10px] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-[var(--text-primary)]">
                              {al.modified_by}
                            </span>
                            <span className="text-[8px] text-[var(--text-muted)] font-mono">
                              {al.created_at}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[9px] text-[var(--text-muted)]">
                            <span>
                              Darslar: {al.previous_attended_count} ➔ {al.new_attended_count}
                            </span>
                            <span>•</span>
                            <span>
                              Ulush: {formatCurrency(al.previous_teacher_share)} ➔{" "}
                              {formatCurrency(al.new_teacher_share)}
                            </span>
                          </div>
                          {al.reason_for_change && (
                            <p className="text-[9px] text-purple-300 italic pt-0.5">
                              "{al.reason_for_change}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Payment Receipts & Audit Information */}
                <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] space-y-2 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-[var(--gold)]" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">
                      To'lov Hujjati va Kassa Yozuvi
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[10px]">
                    <div>
                      <span className="text-[var(--text-muted)] font-bold block">Shartnoma Narxi</span>
                      <span className="font-black text-[var(--text-primary)]">
                        {formatCurrency(detailData.contract_and_payment?.contract_amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] font-bold block">To'langan Summa</span>
                      {isDiscount ? (
                        <span className="font-black text-[var(--text-muted)]">- (Davlat puli)</span>
                      ) : (
                        <span className="font-black text-emerald-400">
                          {formatCurrency(detailData.contract_and_payment?.paid_amount)}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] font-bold block">Qoldiq Qarz</span>
                      {isDiscount ? (
                        <span className="font-black text-[var(--text-muted)]">-</span>
                      ) : (
                        <span className="font-black text-amber-400">
                          {formatCurrency(detailData.contract_and_payment?.remaining_debt)}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] font-bold block">To'lov Usuli</span>
                      <span className="font-black text-[var(--text-primary)]">
                        {detailData.contract_and_payment?.payment_method || "Kassa"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] font-bold block">To'langan Sana</span>
                      <span className="font-black text-[var(--text-primary)]">
                        {detailData.contract_and_payment?.paid_at || "Ushbu oy"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] font-bold block">Tasdiqlagan Xodim</span>
                      <span className="font-black text-[var(--text-primary)]">
                        {detailData.contract_and_payment?.marked_by_name || "Admin"}
                      </span>
                    </div>
                  </div>

                  {detailData.contract_and_payment?.notes && (
                    <div className="mt-2 p-2 bg-[var(--bg-void)]/60 rounded-xl border border-[var(--border-glass)] text-[9px] text-[var(--text-muted)]">
                      <span className="font-bold text-[var(--text-primary)]">Izoh: </span>
                      {detailData.contract_and_payment.notes}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                Ma'lumot topilmadi
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[var(--border-glass)] bg-[var(--bg-void)]/40 flex items-center justify-between">
            <span className="text-[9px] text-[var(--text-muted)] font-bold flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" />
              Moliya tizimi tomonidan arifmetik jihatdan tasdiqlangan
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[var(--bg-panel)] hover:bg-[var(--gold)]/10 text-[var(--text-primary)] hover:text-[var(--gold)] border border-[var(--border-glass)] hover:border-[var(--gold)]/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Yopish
            </button>
          </div>
        </div>
      </div>
    );
  }
);

export default StaffPaidDetailDrawer;
