import React, { useState, useMemo } from 'react';
import { 
  Users, Layers, GraduationCap, AlertCircle, CheckCircle2, 
  ChevronRight, Search, Sparkles, Filter, UserCheck, BookOpen 
} from 'lucide-react';

export default function ColumnTeachersGroups({
  teachers = [],
  allGroups = [],
  debtors = [],
  selectedGroupId,
  onSelectGroup,
  activeTab,
  onTabChange,
  formatCurrency
}) {
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);

  // Filter teachers by search
  const filteredTeachers = useMemo(() => {
    if (!searchFilter.trim()) return teachers;
    const q = searchFilter.toLowerCase();
    return teachers.filter(t => 
      t.name.toLowerCase().includes(q) ||
      t.groups?.some(g => g.name.toLowerCase().includes(q))
    );
  }, [teachers, searchFilter]);

  // Filter groups depending on selected teacher and search
  const visibleGroups = useMemo(() => {
    let list = allGroups;
    if (selectedTeacherId !== null) {
      list = list.filter(g => g.mentor_id === selectedTeacherId);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(g => 
        g.name.toLowerCase().includes(q) || 
        (g.mentor_name && g.mentor_name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allGroups, selectedTeacherId, searchFilter]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
      {/* Top Tab Switcher */}
      <div className="p-3 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/50">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl">
          <button
            type="button"
            onClick={() => onTabChange('groups')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'groups'
                ? 'bg-[var(--gold)] text-black shadow-md shadow-[var(--gold)]/20'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-glass)]/30'
            }`}
          >
            <Layers size={14} />
            <span>Guruhlar ({allGroups.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('debtors')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all relative ${
              activeTab === 'debtors'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-glass)]/30'
            }`}
          >
            <AlertCircle size={14} />
            <span>Qarzdorlar</span>
            {debtors.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'debtors' ? 'bg-white text-rose-600' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {debtors.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Input */}
        <div className="mt-2.5 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={activeTab === 'groups' ? "O'qituvchi yoki guruh izlash..." : "Qarzdor o'quvchi izlash..."}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-[var(--border-glass)]">
        {activeTab === 'debtors' ? (
          /* DEBTORS TAB: Quick Summary & Direct Debtors Trigger */
          <div className="space-y-3">
            <div className="p-3.5 bg-rose-500/10 border border-[var(--border-glass)] rounded-xl">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold mb-1">
                <AlertCircle size={15} />
                <span>Filial Bo'yicha Qarzdorlik</span>
              </div>
              <p className="text-xl font-black text-[var(--text-primary)] mt-1 tabular-nums">
                {formatCurrency(debtors.reduce((acc, d) => acc + (d.remaining_amount || 0), 0))}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Jami {debtors.length} ta o'quvchida to'lanmagan oylik to'lov mavjud.
              </p>
            </div>

            <div className="text-xs text-[var(--text-secondary)] font-medium p-2">
              👉 O'ng tomondagi jadvalda barcha qarzdorlar ro'yxati saralangan holda ko'rsatilgan. To'lovni qabul qilish uchun o'quvchi qatoridagi "To'lov" tugmasini bosing.
            </div>
          </div>
        ) : (
          /* GROUPS & TEACHERS TAB */
          <>
            {/* Teacher Pills / Filter */}
            {teachers.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">
                  <span>O'qituvchilar</span>
                  {selectedTeacherId !== null && (
                    <button
                      onClick={() => setSelectedTeacherId(null)}
                      className="text-[10px] text-[var(--gold)] hover:underline capitalize"
                    >
                      Barchasi
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setSelectedTeacherId(null)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                      selectedTeacherId === null
                        ? 'bg-[var(--gold)]/20 border border-[var(--gold)] text-[var(--gold)]'
                        : 'bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Barcha ({allGroups.length})
                  </button>
                  {filteredTeachers.map(teacher => {
                    const isSelected = selectedTeacherId === teacher.id;
                    return (
                      <button
                        key={teacher.id}
                        onClick={() => setSelectedTeacherId(isSelected ? null : teacher.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[var(--gold)]/20 border border-[var(--gold)] text-[var(--gold)]'
                            : 'bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <UserCheck size={12} className={isSelected ? 'text-[var(--gold)]' : 'text-[var(--text-muted)]'} />
                        <span>{teacher.name.split(' ')[0]}</span>
                        <span className="text-[10px] opacity-60">({teacher.groups_count})</span>
                        {teacher.debtors_count > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Groups List */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-1">
                <span>Guruhlar ({visibleGroups.length})</span>
                <span className="text-[10px] text-[var(--text-muted)]">Tanlash uchun bosing</span>
              </div>

              {visibleGroups.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--text-muted)] bg-[var(--bg-void)]/40 rounded-xl border border-dashed border-[var(--border-glass)]">
                  Guruhlar topilmadi
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleGroups.map((group) => {
                    const isSelected = selectedGroupId === group.id;
                    const hasDebtors = (group.unpaid_count || 0) > 0;

                    return (
                      <div
                        key={group.id}
                        onClick={() => onSelectGroup(group.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 relative group/card ${
                          isSelected
                            ? 'bg-[var(--gold)]/10 border-[var(--gold)] shadow-lg shadow-[var(--gold)]/5'
                            : 'bg-[var(--bg-void)]/70 border-[var(--border-glass)] hover:border-[var(--gold)]/40 hover:bg-[var(--bg-void)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-bold text-[var(--text-primary)] truncate group-hover/card:text-[var(--gold)] transition-colors">
                                {group.name}
                              </h4>
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-[var(--gold)] shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                              {group.mentor_name || "O'qituvchi yo'q"} · {group.days || ""} {group.time ? `(${group.time})` : ""}
                            </p>
                          </div>

                          <span className="text-xs font-black text-[var(--gold)] whitespace-nowrap tabular-nums">
                            {formatCurrency(group.monthly_price)}
                          </span>
                        </div>

                        {/* Group Stats Strip */}
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[var(--border-glass)] text-[11px]">
                          <div className="flex items-center gap-3">
                            <span className="text-[var(--text-secondary)] flex items-center gap-1">
                              <GraduationCap size={13} className="text-[var(--text-muted)]" />
                              <strong className="text-[var(--text-primary)]">{group.students_count || 0}</strong> o'quvchi
                            </span>
                            <span className="text-emerald-500 flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              {group.paid_count || 0}
                            </span>
                          </div>

                          {hasDebtors ? (
                            <span className="text-rose-500 font-bold flex items-center gap-1 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                              <AlertCircle size={11} />
                              {group.unpaid_count} qarzdor
                            </span>
                          ) : (
                            <span className="text-emerald-500 font-medium text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                              To'liq yopilgan
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
