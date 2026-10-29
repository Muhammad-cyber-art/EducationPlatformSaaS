import React, { useState, useMemo } from 'react';
import {
  CreditCard, RotateCcw, Eye, Search, CheckCircle2,
  AlertCircle, Clock, Phone, BookOpen, Layers, Users,
  Sparkles, Filter, AlertTriangle, Award
} from 'lucide-react';

export default function GroupRoster({
  activeTab,
  selectedGroup,
  debtors = [],
  onOpenPayment,
  onOpenDetails,
  onOpenRefund,
  formatCurrency
}) {
  const [filterMode, setFilterMode] = useState('all'); // all, unpaid, paid
  const [searchQuery, setSearchQuery] = useState('');

  // Depending on activeTab, we either render selectedGroup.students or debtors
  const isDebtorsTab = activeTab === 'debtors';

  const rawList = useMemo(() => {
    if (isDebtorsTab) {
      return (debtors || []).filter(s => s.status !== 'discount');
    }
    return selectedGroup?.students || [];
  }, [isDebtorsTab, debtors, selectedGroup]);

  // Filtered by status and search
  const filteredStudents = useMemo(() => {
    let list = rawList;

    if (!isDebtorsTab && filterMode === 'unpaid') {
      list = list.filter(s => (s.remaining_amount || 0) > 0 && s.status !== 'discount');
    } else if (!isDebtorsTab && filterMode === 'paid') {
      list = list.filter(s => s.is_paid || s.status === 'discount');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.student_name && s.student_name.toLowerCase().includes(q)) ||
        (s.student_phone && s.student_phone.includes(q)) ||
        (s.group_name && s.group_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [rawList, isDebtorsTab, filterMode, searchQuery]);

  // If no group is selected and not in debtors tab
  if (!isDebtorsTab && !selectedGroup) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--gold)]/10 border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] mb-4">
          <Layers size={32} />
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Guruh Tanlanmagan</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-sm mb-4">
          Chap tarafdagi ro'yxatdan guruhni tanlang yoki "Qarzdorlar" bo'limiga o'ting.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
      {/* Column Header */}
      <div className="p-4 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-[var(--text-primary)]">
                {isDebtorsTab ? "Filial Qarzdorlari Ro'yxati" : selectedGroup.name}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/25">
                {filteredStudents.length} ta o'quvchi
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {isDebtorsTab ? (
                "Barcha guruhlar bo'yicha to'lanmagan oylik to'lovlar"
              ) : (
                <>
                  <span className="text-[var(--text-secondary)] font-semibold">{selectedGroup.mentor_name || "O'qituvchi yo'q"}</span>
                  {" · "}
                  <span>Oylik to'lov: <strong className="text-[var(--gold)]">{formatCurrency(selectedGroup.monthly_price)}</strong></span>
                  {selectedGroup.days && ` · ${selectedGroup.days}`}
                </>
              )}
            </p>
          </div>

          {/* Quick Metrics */}
          {!isDebtorsTab && selectedGroup && (
            <div className="flex items-center gap-2 text-xs">
              <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 size={13} />
                <span>To'lagan: <strong>{selectedGroup.paid_count || 0}</strong></span>
              </div>
              <div className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-1.5 text-rose-400">
                <AlertCircle size={13} />
                <span>Qarzdor: <strong>{selectedGroup.unpaid_count || 0}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 mt-3 pt-3 border-t border-[var(--border-glass)]">
          {!isDebtorsTab && (
            <div className="flex items-center gap-1 bg-[var(--bg-void)] p-0.5 rounded-xl border border-[var(--border-glass)] w-full sm:w-auto">
              <button
                onClick={() => setFilterMode('all')}
                className={`flex-1 sm:flex-none px-3 py-1 text-xs font-bold rounded-lg transition-all ${filterMode === 'all'
                    ? 'bg-[var(--gold)] text-white font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                Barchasi ({selectedGroup.students_count || 0})
              </button>
              <button
                onClick={() => setFilterMode('unpaid')}
                className={`flex-1 sm:flex-none px-3 py-1 text-xs font-bold rounded-lg transition-all ${filterMode === 'unpaid'
                    ? 'bg-rose-500 text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                Qarzdorlar ({selectedGroup.unpaid_count || 0})
              </button>
              <button
                onClick={() => setFilterMode('paid')}
                className={`flex-1 sm:flex-none px-3 py-1 text-xs font-bold rounded-lg transition-all ${filterMode === 'paid'
                    ? 'bg-emerald-500 text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                To'laganlar ({selectedGroup.paid_count || 0})
              </button>
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="O'quvchi ismi yoki telefoni..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border-glass)]">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-12 text-xs text-[var(--text-muted)]">
            O'quvchilar topilmadi
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-glass)]">
            {filteredStudents.map((st) => {
              const isDiscount = Boolean(st.status === 'discount' || st.is_discount);
              const isPaid = isDiscount || st.is_paid;
              const isPartial = !isDiscount && st.is_partial;
              const remaining = isDiscount ? 0 : (st.remaining_amount || 0);
              const hasDebt = !isDiscount && remaining > 0;

              return (
                <div
                  key={`${st.student_id}-${st.group_id}`}
                  className="p-3.5 sm:px-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[var(--border-glass)]/20 transition-colors group/row"
                >
                  {/* Student Details */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      onClick={() => onOpenDetails(st)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-transform hover:scale-105 ${isDiscount
                          ? 'bg-amber-500/15 border border-amber-500/30 text-amber-500'
                          : isPaid
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-500'
                            : isPartial
                              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-500'
                              : 'bg-rose-500/15 border border-rose-500/30 text-rose-500'
                        }`}
                    >
                      {st.student_name ? st.student_name.charAt(0).toUpperCase() : 'O'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          onClick={() => onOpenDetails(st)}
                          className="font-bold text-sm text-[var(--text-primary)] hover:text-[var(--gold)] cursor-pointer truncate transition-colors"
                        >
                          {st.student_name}
                        </span>

                        {st.status !== 'regular' && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${isDiscount
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              : st.status === 'negotiated'
                                ? 'bg-purple-500/15 text-purple-500 border border-purple-500/30'
                                : 'bg-indigo-500/15 text-indigo-500 border border-indigo-500/30'
                            }`}>
                            {isDiscount && <Award size={10} />}
                            {st.status_display || (isDiscount ? "Imtiyozli" : st.status)}
                          </span>
                        )}

                        {st.other_groups_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 font-medium">
                            +{st.other_groups_count} guruh
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] mt-1 flex-wrap">
                        {st.student_phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={11} />
                            {st.student_phone}
                          </span>
                        )}
                        {isDebtorsTab && (
                          <span className="text-[var(--gold)] flex items-center gap-1 font-medium">
                            <BookOpen size={11} />
                            {st.group_name} ({st.mentor_name})
                          </span>
                        )}
                        {st.passed_lessons > 0 && (
                          <span className="text-[var(--text-secondary)]">
                            Davomat: {st.present_count}/{st.passed_lessons}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial Status & Action Buttons */}
                  <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 shrink-0 pl-12 md:pl-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        {isDiscount ? (
                          <span className="text-xs sm:text-sm font-black text-amber-500 flex items-center gap-1">
                            <Award size={13} />
                            Imtiyozli
                          </span>
                        ) : hasDebt ? (
                          <span className="text-xs sm:text-sm font-black text-rose-500 tabular-nums">
                            -{formatCurrency(remaining)}
                          </span>
                        ) : (
                          <span className="text-xs sm:text-sm font-black text-emerald-500 flex items-center gap-1 tabular-nums">
                            <CheckCircle2 size={13} />
                            To'langan
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] tabular-nums mt-0.5">
                        {isDiscount
                          ? "Davlat puli orqali qoplanadi"
                          : `Jami: ${formatCurrency(st.expected_amount)} ${st.paid_amount > 0 ? `(To'langan: ${formatCurrency(st.paid_amount)})` : ''}`
                        }
                      </p>
                    </div>

                    {/* Quick Buttons */}
                    <div className="flex items-center gap-1.5">
                      {isDiscount ? (
                        <button
                          type="button"
                          onClick={() => onOpenDetails(st)}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/25 text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center gap-1.5"
                          title="Imtiyozli o'quvchi ma'lumotlari"
                        >
                          <Award size={13} />
                          <span>Imtiyozli</span>
                        </button>
                      ) : hasDebt ? (
                        <button
                          type="button"
                          onClick={() => onOpenPayment(st)}
                          className="px-3 py-1.5 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white text-xs font-black rounded-xl shadow-md shadow-[var(--gold)]/10 active:scale-95 transition-all flex items-center gap-1.5"
                        >
                          <CreditCard size={13} />
                          <span>To'lov</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenRefund(st)}
                          className="px-2.5 py-1.5 bg-[var(--bg-void)] hover:bg-[var(--gold)]/10 text-[var(--text-secondary)] hover:text-[var(--gold)] text-xs font-semibold rounded-xl border border-[var(--border-glass)] active:scale-95 transition-all flex items-center gap-1"
                          title="Bekor qilish yoki refund"
                        >
                          <RotateCcw size={12} />
                          <span className="hidden sm:inline">Qaytarish</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenDetails(st)}
                        className="p-1.5 bg-[var(--bg-void)] hover:bg-[var(--border-glass)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl border border-[var(--border-glass)] transition-colors"
                        title="Tafsilotlar"
                      >
                        <Eye size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
