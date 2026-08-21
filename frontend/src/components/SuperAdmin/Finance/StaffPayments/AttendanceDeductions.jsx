import React from "react";
import { UserX, Calendar, AlertCircle, TrendingDown } from "lucide-react";

const AttendanceDeductions = ({ data, formatCurrency }) => {
  const deductions = data?.attendance_deductions || {};
  const deductionEntries = Object.values(deductions);

  if (!deductionEntries || deductionEntries.length === 0) {
    return null;
  }

  const totalDeduction = deductionEntries.reduce(
    (sum, item) => sum + (item.deduction_amount || 0),
    0
  );

  return (
    <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-rose-500/20 shadow-lg shadow-rose-500/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
            <TrendingDown size={16} className="text-rose-500" />
          </div>
          <div>
            <p className="text-[10px] font-black text-rose-500 capitalize tracking-widest">
              Davomat Ayirmalari
            </p>
            <p className="text-[8px] font-bold text-[var(--text-muted)]">
              {deductionEntries.length} ta o'quvchi
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-black text-rose-400 tabular-nums">
            -{formatCurrency(totalDeduction)}
          </p>
          <p className="text-[8px] font-bold text-[var(--text-muted)]">
            jami qirilgan
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {deductionEntries.map((item, index) => {
          const basisBefore =
            item.mentor_slice_before ?? item.original_payment ?? 0;
          const basisAfter =
            item.mentor_slice_after ??
            item.after_deduction ??
            (typeof item.original_payment === "number"
              ? item.original_payment - (item.deduction_amount || 0)
              : 0);
          return (
          <div
            key={index}
            className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/20 transition-all"
          >
            {/* Header - Student info */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                  <UserX size={12} className="text-rose-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-[var(--text-primary)] truncate">
                    {item.student_name}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-muted)] truncate">
                    {item.group_name}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-black text-rose-400 tabular-nums">
                  -{formatCurrency(item.deduction_amount)}
                </p>
              </div>
            </div>
            
            {/* Stats row */}
            <div className="mt-2 pt-2 border-t border-rose-500/10 grid grid-cols-3 gap-2 text-[8px]">
              <div className="bg-rose-500/5 rounded-lg p-1.5 text-center">
                <p className="font-bold text-rose-400">{item.absent_days}</p>
                <p className="font-medium text-[var(--text-muted)]">kelmagan</p>
              </div>
              <div className="bg-slate-500/5 rounded-lg p-1.5 text-center">
                <p className="font-bold text-slate-400">{item.total_lesson_days || '-'}</p>
                <p className="font-medium text-[var(--text-muted)]">dars kun</p>
              </div>
              <div className="bg-emerald-500/5 rounded-lg p-1.5 text-center">
                <p className="font-bold text-emerald-400 tabular-nums">
                  {formatCurrency(basisAfter).replace(' UZS', '')}
                </p>
                <p className="font-medium text-[var(--text-muted)]">qolgan</p>
              </div>
            </div>
            
            {/* Daily rate info */}
            <div className="mt-2 flex items-center justify-between text-[8px] font-bold text-[var(--text-muted)]">
              <div className="flex items-center gap-1">
                <Calendar size={10} />
                <span>{formatCurrency(item.daily_rate)}/kunlik narx</span>
              </div>
              <span className="tabular-nums text-[var(--text-muted)]">
                Asos: {formatCurrency(basisBefore)}
              </span>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceDeductions;
