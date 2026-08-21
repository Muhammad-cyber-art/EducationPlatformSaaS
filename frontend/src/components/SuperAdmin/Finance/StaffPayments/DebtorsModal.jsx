import React, { useState, memo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Crown,
  HandHeart,
  DollarSign,
  Calendar,
  CreditCard,
  Phone,
  ShieldCheck,
} from "lucide-react";

const FinancialStatusBadge = memo(({ status, label }) => {
  const statusConfig = {
    discount: {
      icon: Crown,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    low_income: {
      icon: HandHeart,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    negotiated: {
      icon: DollarSign,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    teacher_negotiated: {
      icon: Crown,
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
    },
    regular: {
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
  };
  const config = statusConfig[status] || statusConfig["regular"];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${config.bg} ${config.border} border ${config.color}`}
    >
      <Icon size={10} />
      <span className="text-[9px] font-black uppercase tracking-tighter">
        {label}
      </span>
    </div>
  );
});

const StudentRow = memo(({ student, isPaid, formatCurrency }) => {
  const remaining = (student.expected || 0) - (student.actual || 0);
  const hasRefund = student.refund_amount > 0;
  const refundIgnored = student.refund_ignored;
  const isAttendanceBased = student.is_attendance_based;
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--bg-void)]/40 hover:bg-[var(--bg-void)]/60 border border-[#2a2a2a] rounded-xl transition-all duration-200 group">
      <div className="flex items-center gap-4">
        {/* Avatar & Basic Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 ${isPaid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}
          >
            {student.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-[var(--text-primary)] truncate uppercase tracking-tight">
              {student.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <FinancialStatusBadge
                status={student.financial_status}
                label={student.financial_status_label}
              />
              {isAttendanceBased && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-purple-500/10 text-purple-500">
                  <Clock size={8} /> Davomat asosida (avtomatik)
                </span>
              )}
              {student.financial_status === "negotiated" && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-rose-500/10 text-rose-400">
                  <DollarSign size={8} /> Kelishilgan:{" "}
                  {formatCurrency(
                    student.contract_amount || student.negotiated_price || 0,
                  )}
                </span>
              )}
              {(student.mentor_salary_excluded ||
                student.financial_status === "teacher_negotiated") && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter bg-cyan-500/10 text-cyan-400">
                  <ShieldCheck size={8} /> Mentor ulushiga ta'sir qilmaydi
                </span>
              )}
              {student.phone && (
                <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)] font-bold">
                  <Phone size={8} /> {student.phone}
                </span>
              )}
              {hasRefund && (
                <span
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${refundIgnored ? "bg-red-500/10 text-red-500 line-through" : "bg-blue-500/10 text-blue-500"}`}
                >
                  Refund: {formatCurrency(student.refund_amount)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Financial Details - Compact */}
        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
          <div className="text-right">
            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-0.5">
              {isAttendanceBased ? "To'langan (Davomat)" : "Guruh Narxi"}
            </p>
            <p className="text-[10px] font-black text-[var(--text-secondary)] tabular-nums">
              {formatCurrency(
                isAttendanceBased
                  ? student.expected
                  : student.expected +
                      (refundIgnored ? 0 : student.refund_amount || 0),
              )}
            </p>
          </div>
          {!isAttendanceBased && (
            <div className="text-right">
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-0.5">
                To'langan
              </p>
              <p className="text-[10px] font-black text-emerald-500 tabular-nums">
                {formatCurrency(student.actual || 0)}
              </p>
            </div>
          )}
        </div>

        {/* Final Amount & Action */}
        <div className="flex-shrink-0 text-right min-w-[80px]">
          {isAttendanceBased ? (
            <>
              <p className="text-[12px] font-black tabular-nums tracking-tighter text-emerald-500">
                {formatCurrency(student.expected || 0)}
              </p>
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                Avtomatik to'langan
              </p>
            </>
          ) : (
            <>
              <p
                className={`text-[12px] font-black tabular-nums tracking-tighter ${remaining > 0 ? "text-amber-500" : "text-emerald-500"}`}
              >
                {remaining > 0
                  ? formatCurrency(remaining)
                  : isPaid
                    ? "OK"
                    : formatCurrency(remaining)}
              </p>
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                {remaining > 0 ? "Qolgan" : "To'langan"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Refund Info Banner (If present) */}
      {hasRefund && (
        <div
          className={`text-[9px] font-bold px-2 py-1 rounded-md flex items-center gap-2 ${refundIgnored ? "bg-red-500/5 text-red-500/60" : "bg-blue-500/5 text-blue-500"}`}
        >
          <AlertCircle size={10} />
          {refundIgnored
            ? "Refund qo'llanilmagan (Bekor qilingan)"
            : `O'quvchi kech qo'shilgani yoki dars qoldirgani uchun ${formatCurrency(student.refund_amount)} chegirma (refund) hisoblangan.`}
        </div>
      )}
    </div>
  );
});

const DebtorsModal = ({ group, onClose, formatCurrency }) => {
  if (!group) return null;

  const [activeTab, setActiveTab] = useState("debtors");

  const unpaidStudents = group.unpaid_students || [];
  const paidStudents = group.paid_students || [];

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200 p-4">
      <div className="bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-[1.5rem] w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header - Compact */}
        <div className="p-4 sm:p-5 border-b border-[#2a2a2a] flex items-center justify-between bg-[var(--bg-void)]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--gold)]/10 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-[var(--gold)]" />
            </div>
            <div>
              <h4 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">
                {group.name}
              </h4>
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
                Guruh O'quvchilari
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs - Minimal */}
        <div className="flex border-b border-[#2a2a2a] bg-[var(--bg-void)]/10">
          <button
            onClick={() => setActiveTab("debtors")}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === "debtors" ? "text-amber-500 border-amber-500 bg-amber-500/5" : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]"}`}
          >
            Qarzdorlar ({unpaidStudents.length})
          </button>
          <button
            onClick={() => setActiveTab("paid")}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === "paid" ? "text-emerald-500 border-emerald-500 bg-emerald-500/5" : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]"}`}
          >
            To'laganlar ({paidStudents.length})
          </button>
        </div>

        {/* Content - Performance Optimized */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {activeTab === "debtors" ? (
            unpaidStudents.length === 0 ? (
              <div className="py-20 text-center opacity-30">
                <CheckCircle2
                  size={40}
                  className="mx-auto text-emerald-500 mb-3"
                />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Qarzdorlar yo'q
                </p>
              </div>
            ) : (
              unpaidStudents.map((st) => (
                <StudentRow
                  key={st.id}
                  student={st}
                  isPaid={false}
                  formatCurrency={formatCurrency}
                />
              ))
            )
          ) : paidStudents.length === 0 ? (
            <div className="py-20 text-center opacity-30">
              <Clock size={40} className="mx-auto text-amber-500 mb-3" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                To'lovlar yo'q
              </p>
            </div>
          ) : (
            paidStudents.map((st) => (
              <StudentRow
                key={st.id}
                student={st}
                isPaid={true}
                formatCurrency={formatCurrency}
              />
            ))
          )}
        </div>

        {/* Footer - Lightweight */}
        <div className="p-4 border-t border-[#2a2a2a] bg-[var(--bg-void)]/20 flex items-center justify-between">
          <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
            {activeTab === "debtors" ? "Jami Qarz" : "Jami To'lov"}
          </span>
          <span
            className={`text-xl font-black tabular-nums tracking-tighter ${activeTab === "debtors" ? "text-amber-500" : "text-emerald-500"}`}
          >
            {activeTab === "debtors"
              ? formatCurrency(
                  unpaidStudents.reduce(
                    (acc, s) => acc + ((s.expected || 0) - (s.actual || 0)),
                    0,
                  ),
                )
              : formatCurrency(
                  paidStudents.reduce((acc, s) => acc + (s.actual || 0), 0),
                )}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default memo(DebtorsModal);
