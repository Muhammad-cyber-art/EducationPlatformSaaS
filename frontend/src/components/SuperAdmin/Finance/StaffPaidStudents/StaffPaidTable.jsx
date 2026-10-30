import React from "react";
import {
  Calculator,
  Phone,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, StudentStatusBadge, DebtorBadge, PartialBadge } from "./shared";

// Memoized individual table row with strict whitespace control and truncate safety
const StaffPaidTableRow = React.memo(({ st, idx, isSelected, onSelect }) => {
  const isDiscount = st.status === "discount";
  const isTeacherNeg = st.status === "teacher_negotiated";
  const isDebtor = Boolean(st.is_debtor || (Number(st.paid_amount || 0) === 0 && !isDiscount));
  const isPartial = Boolean(st.is_partial || (Number(st.paid_amount || 0) > 0 && Number(st.paid_amount) < Number(st.contract_amount) && !isDiscount));
  const attRate = st.attendance_rate || 0;

  // Row background & border styling
  let rowStyle = "hover:bg-[var(--gold)]/[0.03]";
  if (isSelected) {
    rowStyle = "bg-[var(--gold)]/10 border-l-4 border-l-[var(--gold)]";
  } else if (isDebtor) {
    rowStyle = "bg-rose-500/[0.03] border-l-4 border-l-rose-500/80 hover:bg-rose-500/[0.06]";
  }

  return (
    <tr
      onClick={() => onSelect(st)}
      className={`cursor-pointer transition-colors border-b border-[var(--border-glass)]/60 ${rowStyle}`}
    >
      {/* 1. Index */}
      <td className="px-3 py-3 text-[11px] font-bold text-center text-[var(--text-muted)] tabular-nums whitespace-nowrap">
        {idx + 1}
      </td>

      {/* 2. O'quvchi: Ismi, Avatar, Badges, Telefon */}
      <td className="px-3.5 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 shadow-sm ${
              isDebtor
                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                : "bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20"
            }`}
          >
            {st.name?.charAt(0) || "O"}
          </div>
          <div className="min-w-0 flex-1 max-w-[200px]">
            <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
              <span
                className={`text-xs font-bold leading-tight truncate shrink min-w-0 ${
                  isDebtor ? "text-rose-400" : "text-[var(--text-primary)]"
                }`}
                title={st.name}
              >
                {st.name}
              </span>
              {isDebtor && <DebtorBadge />}
              {isPartial && <PartialBadge />}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-nowrap min-w-0">
              <StudentStatusBadge status={st.status} label={st.status_label} />
              {st.phone && (
                <span className="text-[9px] text-[var(--text-muted)] font-medium flex items-center gap-0.5 whitespace-nowrap shrink-0">
                  <Phone size={8} /> {st.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* 3. Guruh */}
      <td className="px-3.5 py-3">
        <div className="min-w-0 max-w-[170px]">
          <span
            className="text-xs font-semibold text-[var(--text-primary)] leading-tight truncate block"
            title={st.group_name}
          >
            {st.group_name}
          </span>
        </div>
      </td>

      {/* 4. Kurs Narxi / Shartnoma */}
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums whitespace-nowrap">
          {st.custom_fee ? formatCurrency(st.custom_fee) : formatCurrency(st.contract_amount)}
        </span>
      </td>

      {/* 5. Reja Darslar */}
      <td className="px-3 py-3 text-center whitespace-nowrap">
        <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
          {st.n_total || 0} dars
        </span>
      </td>

      {/* 6. Davomat */}
      <td className="px-3 py-3 text-center whitespace-nowrap">
        <div className="flex items-center justify-center gap-1">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums whitespace-nowrap border ${
              attRate >= 80
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : attRate > 0
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}
          >
            <CheckCircle size={10} className="shrink-0" />
            <span>{st.n_attended || 0} / {st.n_total || 0} ({attRate}%)</span>
          </span>

          {st.has_manual_adjustment && (
            <span className="text-[8px] font-bold text-purple-400 bg-purple-500/10 px-1 py-0.2 rounded border border-purple-500/20 whitespace-nowrap" title="Qo'lda kiritilgan davomat">
              Qo'lda
            </span>
          )}
        </div>
      </td>

      {/* 7. Qabul qilingan */}
      <td className="px-3 py-3 text-right whitespace-nowrap">
        {isDiscount ? (
          <span className="text-xs font-bold text-purple-400 whitespace-nowrap">Davlat puli</span>
        ) : isDebtor ? (
          <span className="text-xs font-bold text-rose-400 tabular-nums whitespace-nowrap">0 UZS</span>
        ) : (
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-emerald-400 tabular-nums whitespace-nowrap leading-none">
              {formatCurrency(st.paid_amount)}
            </span>
            {isPartial && (
              <span className="text-[8px] text-amber-400 font-bold whitespace-nowrap mt-0.5">
                Qisman
              </span>
            )}
          </div>
        )}
      </td>

      {/* 8. Markaz Marjasi */}
      <td className="px-3 py-3 text-right whitespace-nowrap">
        {isDiscount ? (
          <span className="text-xs text-[var(--text-muted)]">-</span>
        ) : isDebtor ? (
          <span className="text-xs text-[var(--text-muted)] tabular-nums">0 UZS</span>
        ) : (
          <span className="text-xs font-bold text-amber-400 tabular-nums whitespace-nowrap">
            {formatCurrency(st.center_gross_margin ?? 0)}
          </span>
        )}
      </td>

      {/* 9. O'qituvchi Stavka */}
      <td className="px-3 py-3 text-center whitespace-nowrap">
        <span className="text-xs font-semibold text-blue-400 tabular-nums whitespace-nowrap">
          {st.teacher_rate_display ||
            (st.salary_type === "percentage"
              ? `${st.salary_rate}%`
              : `${formatCurrency(st.salary_rate)} / st.`)}
        </span>
      </td>

      {/* 10. O'qituvchi Ulushi */}
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <span
          className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums whitespace-nowrap border ${
            isTeacherNeg
              ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          }`}
        >
          {formatCurrency(st.mentor_share)}
        </span>
      </td>

      {/* 11. Amallar */}
      <td className="px-3 py-3 text-center whitespace-nowrap">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(st);
          }}
          className="px-2 py-1 bg-[var(--gold)]/10 hover:bg-[var(--gold)] text-[var(--gold)] hover:text-black border border-[var(--gold)]/30 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1 shadow-sm cursor-pointer whitespace-nowrap"
          title="Hisob-kitob tafsiloti"
        >
          <span>Arifmetika</span>
          <ChevronRight size={10} className="shrink-0" />
        </button>
      </td>
    </tr>
  );
});

const StaffPaidTable = React.memo(({ filteredStudents, selectedStudent, onSelectStudent }) => {
  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl overflow-hidden shadow-lg">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr className="border-b border-[var(--border-glass)] bg-[var(--bg-void)]/60 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] select-none">
              <th className="px-3 py-3 w-10 text-center whitespace-nowrap">#</th>
              <th className="px-3.5 py-3 w-[220px] min-w-[190px] whitespace-nowrap">O'quvchi</th>
              <th className="px-3.5 py-3 w-[170px] min-w-[150px] whitespace-nowrap">Guruh</th>
              <th className="px-3 py-3 w-[110px] text-right whitespace-nowrap">Kurs Narxi</th>
              <th className="px-3 py-3 w-[80px] text-center whitespace-nowrap">Reja</th>
              <th className="px-3 py-3 w-[120px] text-center whitespace-nowrap">Davomat</th>
              <th className="px-3 py-3 w-[120px] text-right whitespace-nowrap">To'langan</th>
              <th className="px-3 py-3 w-[110px] text-right text-amber-400 whitespace-nowrap">Markaz Ulushi</th>
              <th className="px-3 py-3 w-[110px] text-center whitespace-nowrap">Stavka</th>
              <th className="px-3 py-3 w-[120px] text-right text-emerald-400 whitespace-nowrap">O'qituvchi Ulushi</th>
              <th className="px-3 py-3 w-[90px] text-center whitespace-nowrap">Batafsil</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-glass)]/60 text-xs">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-14 text-center">
                  <Calculator size={32} className="mx-auto text-[var(--text-muted)]/40 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    O'quvchilar ro'yxati bo'sh
                  </p>
                </td>
              </tr>
            ) : (
              filteredStudents.map((st, idx) => {
                const isSelected =
                  selectedStudent?.id === st.id && selectedStudent?.group_id === st.group_id;
                return (
                  <StaffPaidTableRow
                    key={`${st.id}_${st.group_id}_${idx}`}
                    st={st}
                    idx={idx}
                    isSelected={isSelected}
                    onSelect={onSelectStudent}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default StaffPaidTable;
