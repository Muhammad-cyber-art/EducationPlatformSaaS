import React, { useState, useMemo } from 'react';
import { TrendingDown, Search, Calendar, FileText, User } from 'lucide-react';

export const BranchExpensesTab = ({ adminExpenses = [], formatNumber }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredExpenses = useMemo(() => {
    if (!searchTerm.trim()) return adminExpenses;
    const term = searchTerm.toLowerCase();
    return adminExpenses.filter(
      (exp) =>
        (exp.title && exp.title.toLowerCase().includes(term)) ||
        (exp.marked_by && exp.marked_by.toLowerCase().includes(term)) ||
        (exp.description && exp.description.toLowerCase().includes(term))
    );
  }, [adminExpenses, searchTerm]);

  const totalAdminExpense = useMemo(() => {
    return adminExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [adminExpenses]);

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 lux-card border-rose-500/20 bg-rose-500/[0.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <TrendingDown size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                Filial Chiqimlari
              </h2>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Admin Chiqimlari
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] font-bold mt-0.5">
              Filial adminlari tomonidan kiritilgan barcha operatsion xarajatlar ro'yxati
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 bg-[var(--bg-void)]/60 border border-[#2a2a2a] rounded-xl">
            <span className="text-[8px] font-black uppercase text-[var(--text-muted)] block">
              Jami Chiqim Summasi
            </span>
            <span className="text-base font-black text-rose-400 tabular-nums">
              -{formatNumber(totalAdminExpense)} <span className="text-[10px] text-[var(--text-muted)] font-normal">UZS</span>
            </span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Qidirish (nom, admin)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[var(--bg-void)]/60 border border-[#2a2a2a] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--gold)] transition-colors w-48 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Chiqimlar Ro'yxati / Jadvali */}
      {filteredExpenses.length === 0 ? (
        <div className="lux-card !p-12 text-center border-dashed border-[#2a2a2a]">
          <FileText size={40} className="mx-auto text-[var(--text-muted)] opacity-30 mb-3" />
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">
            {searchTerm ? "Qidiruv bo'yicha chiqim topilmadi" : "Ushbu davrda adminlar tomonidan chiqim kiritilmagan"}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {searchTerm
              ? "Boshqa so'z bilan qidirib ko'ring yoki qidiruvni tozalang"
              : "Tanlangan oy uchun filialda hech qanday xarajat qayd etilmagan."}
          </p>
        </div>
      ) : (
        <div className="lux-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a2a] bg-[var(--bg-void)]/40 text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="p-3.5 pl-5">#</th>
                  <th className="p-3.5">Sana</th>
                  <th className="p-3.5">Chiqim Nomi</th>
                  <th className="p-3.5">Izoh / Tavsif</th>
                  <th className="p-3.5">Mas'ul Admin</th>
                  <th className="p-3.5 text-right pr-5">Summa (UZS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]/40">
                {filteredExpenses.map((exp, index) => (
                  <tr key={exp.id || index} className="hover:bg-[var(--bg-void)]/40 transition-colors">
                    <td className="p-3.5 pl-5 text-[var(--text-muted)] font-mono text-[10px]">
                      {index + 1}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
                        <Calendar size={13} className="text-[var(--gold)] opacity-70" />
                        <span>{exp.date || exp.created_at?.split(' ')[0] || '-'}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-[var(--text-primary)] text-xs">
                        {exp.title}
                      </span>
                    </td>
                    <td className="p-3.5 text-[var(--text-muted)] max-w-sm truncate" title={exp.description || ''}>
                      {exp.description || <span className="opacity-40 italic">-</span>}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] flex items-center justify-center text-[10px] font-black border border-[var(--gold)]/20">
                          {exp.marked_by ? exp.marked_by.charAt(0).toUpperCase() : 'A'}
                        </div>
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {exp.marked_by || 'Admin'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 text-right pr-5 whitespace-nowrap font-black text-rose-400 tabular-nums text-sm">
                      -{formatNumber(exp.amount)} <span className="text-[9px] font-normal text-[var(--text-muted)]">UZS</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchExpensesTab;
