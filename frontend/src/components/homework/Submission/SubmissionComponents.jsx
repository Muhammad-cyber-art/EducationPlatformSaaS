import React from'react';
import { 
 Hash, CalendarDays, Loader2, Trash2, Activity, 
 XCircle, CircleDot, CheckCircle2 
} from"lucide-react";
import GoBackButton from"../../sendback";

export const SubmissionHeader = ({ homeworkData, mission_id, onDelete, deleteLoading }) => (
 <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
 <div className="flex items-start md:items-center gap-5">
 <GoBackButton />
 <div>
 <div className="flex items-center gap-3 mb-1">
 <h2 className="text-xl md:text-2xl font-bold tracking-tight capitalize">{homeworkData.title}</h2>
 <div className="hidden sm:flex bg-[var(--gold-dim)] text-[var(--gold)] px-2 py-0.5 rounded border border-[var(--gold)]/20 text-[9px] font-black tracking-widest items-center gap-1">
 <Hash size={10} /> VAZIFA {mission_id}
 </div>
 </div>
 <p className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] flex items-center gap-2">
 <span className="w-1.5 h-1.5 bg-[var(--gold)] rounded-full shadow-[0_0_5px_var(--gold)]"></span>
 Guruh: <span className="text-[var(--text-primary)]">{homeworkData.group_name}</span>
 </p>
 </div>
 </div>
 <div className="flex items-center justify-between lg:justify-end gap-3 border-t lg:border-t-0 border-[var(--border-glass)] pt-4 lg:pt-0">
 <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--bg-void)]/40 rounded-xl border border-[var(--border-glass)] shadow-inner">
 <CalendarDays size={14} className="text-[var(--gold)] opacity-60" />
 <span className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-[0.1em]">
 {new Date(homeworkData.created_at).toLocaleDateString('uz-UZ', { day:'2-digit', month:'short' })}
 </span>
 </div>
 <button
 onClick={onDelete}
 disabled={deleteLoading}
 className="w-10 h-10 bg-red-500/5 text-red-500 border border-red-500/10 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
 >
 {deleteLoading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
 </button>
 </div>
 </div>
);

export const SubmissionAnalytics = ({ stats }) => (
 <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-[var(--border-glass)]">
 <div className="space-y-3">
 <div className="flex justify-between items-end">
 <span className="text-[8px] font-black text-[var(--gold)] capitalize tracking-[0.3em]">O'zlashtirish</span>
 <span className="text-2xl font-black text-[var(--text-primary)]">{stats.percent}%</span>
 </div>
 <div className="w-full bg-[var(--bg-void)]/60 rounded-full h-2 overflow-hidden border border-[var(--border-glass)]">
 <div className="bg-gradient-to-r from-[var(--gold)] to-amber-400 h-full rounded-full transition-all duration-700 shadow-[0_0_10px_var(--gold-dim)]" style={{ width: `${stats.percent}%` }} />
 </div>
 </div>
 <div className="flex items-center justify-around border-y sm:border-y-0 sm:border-x border-[var(--border-glass)] py-4 sm:py-0">
 <div className="text-center">
 <p className="text-xl font-black text-emerald-500">{stats.fullCount}</p>
 <p className="text-[7px] font-black text-[var(--text-muted)] capitalize tracking-widest">Bajarilgan</p>
 </div>
 <div className="text-center">
 <p className="text-xl font-black text-amber-500">{stats.halfCount}</p>
 <p className="text-[7px] font-black text-[var(--text-muted)] capitalize tracking-widest">Chala</p>
 </div>
 </div>
 <div className="flex flex-col items-center sm:items-end justify-center">
 <span className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1">Jami o'quvchilar</span>
 <p className="text-3xl font-black text-[var(--text-primary)]">{stats.total}</p>
 </div>
 </div>
);

export const SubmissionList = ({ students_status, updateStatus }) => (
 <div className="lux-card !p-0 overflow-hidden shadow-xl border border-[var(--border-glass)]">
 <div className="px-6 py-5 md:px-10 md:py-6 border-b border-[var(--border-glass)] bg-[var(--bg-panel)]/30 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <Activity size={20} className="text-[var(--gold)]" />
 <h3 className="text-sm md:text-base font-bold text-[var(--text-primary)] tracking-tight capitalize">O'quvchilar jurnali</h3>
 </div>
 <div className="hidden sm:block px-3 py-1 rounded bg-[var(--gold-dim)] text-[8px] font-black text-[var(--gold)] capitalize tracking-widest">Jonli Yangilanish</div>
 </div>

 {/* Desktop Table */}
 <div className="hidden md:block overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="text-[var(--text-muted)] text-[8px] font-black capitalize tracking-[0.3em] border-b border-[var(--border-glass)]">
 <th className="px-10 py-5">O'quvchi</th>
 <th className="px-10 py-5 text-center">Holati</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--border-glass)]">
 {students_status?.map((sub) => (
 <tr key={sub.id} className="hover:bg-[var(--gold-dim)]/30 transition-all group">
 <td className="px-10 py-5">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[9px] font-bold text-[var(--gold)] capitalize">
 {(sub.student_name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
 </div>
 <p className="text-xs font-bold capitalize truncate">{sub.student_name}</p>
 </div>
 </td>
 <td className="px-10 py-5">
 <div className="flex justify-center gap-2">
 <StatusButton active={sub.status ==='not_submitted'} type="red" onClick={() => updateStatus(sub.id,'not_submitted')} icon={<XCircle size={12} />} />
 <StatusButton active={sub.status ==='half'} type="yellow" onClick={() => updateStatus(sub.id,'half')} icon={<CircleDot size={12} />} />
 <StatusButton active={sub.status ==='full'} type="emerald" onClick={() => updateStatus(sub.id,'full')} icon={<CheckCircle2 size={12} />} />
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Mobile Cards */}
 <div className="block md:hidden p-4 space-y-3">
 {students_status?.map((sub) => (
 <div key={sub.id} className="p-4 bg-[var(--bg-void)]/30 border border-[var(--border-glass)] rounded-2xl flex flex-col gap-4">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] flex items-center justify-center text-[8px] font-bold text-[var(--gold)] capitalize">
 {(sub.student_name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
 </div>
 <p className="text-[10px] font-bold capitalize truncate">{sub.student_name}</p>
 </div>
 <div className="grid grid-cols-3 gap-2">
 <MobileStatusBtn active={sub.status ==='not_submitted'} type="red" onClick={() => updateStatus(sub.id,'not_submitted')} label="X" />
 <MobileStatusBtn active={sub.status ==='half'} type="yellow" onClick={() => updateStatus(sub.id,'half')} label="/" />
 <MobileStatusBtn active={sub.status ==='full'} type="emerald" onClick={() => updateStatus(sub.id,'full')} label="V" />
 </div>
 </div>
 ))}
 </div>
 </div>
);

const MobileStatusBtn = ({ active, type, onClick, label }) => {
 const bg = active ? {
 red:'bg-red-500 border-red-500 text-white',
 yellow:'bg-amber-500 border-amber-500 text-white',
 emerald:'bg-emerald-500 border-emerald-500 text-white'
 }[type] :'bg-transparent border-[var(--border-glass)] text-[var(--text-muted)]';

 return (
 <button onClick={onClick} className={`h-8 rounded-lg border text-[10px] font-black transition-all active:scale-90 ${bg}`}>
 {label}
 </button>
 );
};

const StatusButton = ({ active, type, onClick, icon }) => {
 const themes = {
 red: active ?'bg-red-500 text-white border-transparent' :'bg-[var(--bg-void)]/40 text-[var(--text-muted)] border-[var(--border-glass)] hover:text-red-500',
 yellow: active ?'bg-amber-500 text-white border-transparent' :'bg-[var(--bg-void)]/40 text-[var(--text-muted)] border-[var(--border-glass)] hover:text-amber-500',
 emerald: active ?'bg-emerald-500 text-white border-transparent' :'bg-[var(--bg-void)]/40 text-[var(--text-muted)] border-[var(--border-glass)] hover:text-emerald-500',
 };

 return (
 <button onClick={onClick} className={`w-8 h-8 md:w-10 md:h-10 rounded-lg border transition-all flex items-center justify-center active:scale-90 ${themes[type]}`}>
 {icon}
 </button>
 );
};
