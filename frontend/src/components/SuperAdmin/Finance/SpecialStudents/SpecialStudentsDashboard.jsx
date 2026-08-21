import React from 'react';
import { useSpecialStudents } from './useSpecialStudents';
import GoBackButton from '../../../sendback';
import { 
  Users, Activity, Calendar, ShieldCheck, 
  DollarSign, Target, CheckCircle, Clock, 
  Search, Filter, Wallet, CreditCard 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SpecialStudentsDashboard() {
  const {
    loading,
    error,
    fetchSpecialStudents,
    formatNumber,
    summary,
    students,
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    goPrevMonth,
    goCurrentMonth,
    formatMonthLabel,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    b_id
  } = useSpecialStudents();

  const today = new Date();
  
  const periodControls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 h-9 px-2 bg-[var(--bg-void)]/40 border border-[#2a2a2a] rounded-lg">
        <Calendar size={12} className="text-[var(--gold)] opacity-60 shrink-0" />
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="bg-transparent text-[9px] font-black text-[var(--text-primary)] outline-none max-w-[3rem] cursor-pointer"
        >
          {Array.from({ length: 12 }).map((_, idx) => (
            <option key={idx + 1} value={idx + 1} className="bg-[var(--bg-panel)]">
              {String(idx + 1).padStart(2, '0')}
            </option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="bg-transparent text-[9px] font-black text-[var(--text-primary)] outline-none cursor-pointer"
        >
          {Array.from({ length: 6 }).map((_, i) => {
            const y = today.getFullYear() - i;
            return <option key={y} value={y} className="bg-[var(--bg-panel)]">{y}</option>;
          })}
        </select>
      </div>
      <span className="text-[9px] font-black text-[var(--gold)] tabular-nums px-1">
        {formatMonthLabel(selectedYear, selectedMonth)}
      </span>
      <button
        type="button"
        onClick={goPrevMonth}
        className="h-9 px-3 bg-[var(--bg-void)]/40 border border-red-500/20 text-red-400 rounded-lg font-black text-[9px] capitalize tracking-wider hover:bg-red-500/10 transition-colors"
      >
        O'tgan oy
      </button>
      <button
        type="button"
        onClick={goCurrentMonth}
        className="h-9 px-3 bg-[var(--bg-void)]/40 border border-emerald-500/20 text-emerald-400 rounded-lg font-black text-[9px] capitalize tracking-wider hover:bg-emerald-500/10 transition-colors"
      >
        Joriy oy
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Activity className="animate-spin text-[var(--gold)] mb-6" size={48} />
        <p className="text-[10px] font-black capitalize tracking-[0.4em] text-[var(--text-muted)]">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <ShieldCheck size={48} className="text-red-500/40 mb-6" />
        <p className="text-sm font-black text-red-400 capitalize tracking-widest mb-6">{error}</p>
        <button onClick={fetchSpecialStudents} className="lux-btn lux-btn-primary !px-10">
          Qayta urinish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mt-5">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-6">
          <GoBackButton />
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight capitalize">
              Maxsus O'quvchilar Moliya Dushbordi
            </h1>
            <p className="text-xs text-[var(--text-muted)] font-bold tracking-wide mt-1">
              Imtiyozli, kelishilgan va ehtiyojmand o'quvchilar tahlili
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-start lg:justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-transparent border border-[#2a2a2a] rounded-lg text-[10px] font-black text-[var(--text-primary)] outline-none cursor-pointer"
          >
            <option value="" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">Barcha Statuslar</option>
            <option value="discount" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">Imtiyozli</option>
            <option value="low_income" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">Kam ta'minlangan</option>
            <option value="negotiated" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">Kelishilgan</option>
            <option value="teacher_negotiated" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">O'qituvchi Kelishgan</option>
          </select>
          {periodControls}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="lux-card !p-3 sm:!p-5 border-t-4 border-t-blue-500">
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <div className="p-2 sm:p-2.5 bg-blue-500/10 rounded-lg sm:rounded-xl border border-blue-500/20 text-blue-400">
                <Users size={16} className="sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-[7px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Jami O'quvchilar</p>
            <h3 className="text-xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">{summary.students_count}</h3>
          </div>

          <div className="lux-card !p-3 sm:!p-5 border-t-4 border-t-amber-500">
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <div className="p-2 sm:p-2.5 bg-amber-500/10 rounded-lg sm:rounded-xl border border-amber-500/20 text-amber-400">
                <Target size={16} className="sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-[7px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Kutilayotgan (Dinamik)</p>
            <div className="flex items-baseline gap-1 sm:gap-2">
              <h3 className="text-lg sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">{formatNumber(summary.total_expected)}</h3>
              <span className="text-[8px] sm:text-[10px] text-[var(--text-muted)] font-bold">UZS</span>
            </div>
          </div>

          <div className="lux-card !p-3 sm:!p-5 border-t-4 border-t-emerald-500">
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <div className="p-2 sm:p-2.5 bg-emerald-500/10 rounded-lg sm:rounded-xl border border-emerald-500/20 text-emerald-400">
                <CheckCircle size={16} className="sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-[7px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">To'langan Summa</p>
            <div className="flex items-baseline gap-1 sm:gap-2">
              <h3 className="text-lg sm:text-2xl font-black text-emerald-400 tracking-tight">{formatNumber(summary.total_paid)}</h3>
              <span className="text-[8px] sm:text-[10px] text-emerald-400/50 font-bold">UZS</span>
            </div>
          </div>

          <div className="lux-card !p-3 sm:!p-5 border-t-4 border-t-rose-500">
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <div className="p-2 sm:p-2.5 bg-rose-500/10 rounded-lg sm:rounded-xl border border-rose-500/20 text-rose-400">
                <Clock size={16} className="sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-[7px] sm:text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Qolgan Qarz</p>
            <div className="flex items-baseline gap-1 sm:gap-2">
              <h3 className="text-lg sm:text-2xl font-black text-rose-400 tracking-tight">{formatNumber(summary.total_debt)}</h3>
              <span className="text-[8px] sm:text-[10px] text-rose-400/50 font-bold">UZS</span>
            </div>
          </div>
        </div>
      )}

      {/* Status Statistics */}
      {summary && summary.status_counts && (
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded border border-amber-500/20 text-amber-400">
            <span className="text-[9px] font-black uppercase tracking-widest">Imtiyozli:</span>
            <span className="text-sm font-bold tabular-nums">{summary.status_counts.discount || 0} ta</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded border border-blue-500/20 text-blue-400">
            <span className="text-[9px] font-black uppercase tracking-widest">Kam ta'minlangan:</span>
            <span className="text-sm font-bold tabular-nums">{summary.status_counts.low_income || 0} ta</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded border border-emerald-500/20 text-emerald-400">
            <span className="text-[9px] font-black uppercase tracking-widest">Kelishilgan:</span>
            <span className="text-sm font-bold tabular-nums">{summary.status_counts.negotiated || 0} ta</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 rounded border border-purple-500/20 text-purple-400">
            <span className="text-[9px] font-black uppercase tracking-widest">O'qituvchi:</span>
            <span className="text-sm font-bold tabular-nums">{summary.status_counts.teacher_negotiated || 0} ta</span>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="lux-card overflow-hidden border border-[#2a2a2a]">
        <div className="p-4 sm:p-5 border-b border-[#2a2a2a] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--bg-void)]/40 gap-4">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={16} className="text-[var(--gold)]" /> Maxsus Ro'yxat
          </h3>
          <div className="relative w-full sm:w-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-[var(--text-muted)]" />
            </div>
            <input
              type="text"
              placeholder="Ism, telefon yoki guruh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 h-9 pl-9 pr-3 bg-[var(--bg-void)] border border-[#2a2a2a] rounded-lg text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold)] transition-colors"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[var(--bg-void)]/80 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                <th className="py-4 px-5 border-b border-[#2a2a2a]">O'quvchi</th>
                <th className="py-4 px-5 border-b border-[#2a2a2a]">Status</th>
                <th className="py-4 px-5 border-b border-[#2a2a2a]">Guruh</th>
                <th className="py-4 px-5 border-b border-[#2a2a2a] text-right">Kelishilgan Narx</th>
                <th className="py-4 px-5 border-b border-[#2a2a2a] text-right">Hisoblangan qarz</th>
                <th className="py-4 px-5 border-b border-[#2a2a2a] text-right">Oy uchun to'landi</th>
                <th className="py-4 px-5 border-b border-[#2a2a2a] text-right text-rose-400">Qarz</th>
                <th className="py-4 px-5 border-b border-[#2a2a2a] text-center border-l border-[#2a2a2a]">Wallet (Tarix)</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-bold text-[var(--text-primary)] divide-y divide-[#2a2a2a]">
              {students && students.length > 0 ? (
                students.map((student, index) => (
                  <tr key={`${student.student_id}-${student.group_id}-${index}`} className="hover:bg-[var(--bg-void)]/20 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex flex-col">
                        <span className="text-[12px] text-white">{student.full_name}</span>
                        <span className="text-[9px] text-[var(--text-muted)] mt-0.5">{student.phone}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[9px] border 
                        ${student.status === 'discount' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                          student.status === 'low_income' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                          student.status === 'teacher_negotiated' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}
                      >
                        {student.status_display}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex flex-col">
                        <span className="text-[11px]">{student.group_name}</span>
                        <span className="text-[8px] text-[var(--text-muted)]">Standart: {formatNumber(student.monthly_price)} UZS</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-right font-black text-amber-400 tabular-nums">
                      {student.custom_fee ? `${formatNumber(student.custom_fee)} UZS` : '-'}
                    </td>
                    <td className="py-3 px-5 text-right font-black text-white tabular-nums">
                      {formatNumber(student.expected_amount)} <span className="text-[8px] text-[var(--text-muted)]">UZS</span>
                    </td>
                    <td className="py-3 px-5 text-right font-black text-emerald-400 tabular-nums">
                      {formatNumber(student.paid_amount)} <span className="text-[8px] text-emerald-400/50">UZS</span>
                    </td>
                    <td className="py-3 px-5 text-right font-black text-rose-400 tabular-nums">
                      {formatNumber(student.debt)} <span className="text-[8px] text-rose-400/50">UZS</span>
                    </td>
                    <td className="py-3 px-5 border-l border-[#2a2a2a]">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-2">
                          <Wallet size={12} className="text-[var(--gold)]" />
                          <span className="text-[10px] text-[var(--gold)] tabular-nums">{formatNumber(student.wallet_total_paid)} UZS</span>
                        </div>
                        {Number(student.wallet_total_refunded) > 0 && (
                          <div className="flex items-center gap-1.5 opacity-60">
                            <span className="text-[8px] text-rose-400">Refund: {formatNumber(student.wallet_total_refunded)}</span>
                          </div>
                        )}
                        <span className="text-[8px] text-[var(--text-muted)]">
                          Oxirgi to'lov: {student.last_payment_date ? student.last_payment_date : "Yo'q"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-[var(--text-muted)]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Search size={24} className="opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Ma'lumot topilmadi</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
