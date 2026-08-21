import React from'react';
import { DollarSign } from"lucide-react";

// Soxta (Mock) o'quvchi va to'lov ma'lumotlari
const studentData = {
 name:"Sobirov Javohir",
 group:"React / React Native - 4-guruh",
 groupId:"G-104"
};

const paymentsData = [
 { id: 1, month:"Noyabr, 2025", amount: 650000, date:"2025-11-01", status:"To'langan", method:"Click" },
 { id: 2, month:"Oktyabr, 2025", amount: 650000, date:"2025-10-05", status:"To'langan", method:"Payme" },
 { id: 3, month:"Sentyabr, 2025", amount: 650000, date:"2025-09-02", status:"To'langan", method:"Naqd" },
 { id: 4, month:"Dekabr, 2025", amount: 650000, date:"---", status:"Kutilmoqda", method:"---" },
 { id: 5, month:"Yanvar, 2026", amount: 650000, date:"---", status:"Kutilmoqda", method:"---" },
];


const StudentPayments = () => {
 return (
 <div className="min-h-screen bg-[var(--bg-void)] relative overflow-hidden flex flex-col pt-4 md:pt-0">
 {/* Decorative Background Orbs */}
 <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[var(--gold)]/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
 <div className="fixed bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none z-0"></div>

 {/* Top bar (Sarlavha qismi) */}
 <div className="sticky top-0 z-50 bg-[var(--bg-void)] border-b border-[var(--border-glass)] px-6 md:px-10 py-4 flex items-center justify-between shadow-xl">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shadow-inner">
 <DollarSign size={20} />
 </div>
 <div>
 <h1 className="text-lg font-black text-[var(--text-primary)] capitalize tracking-tight">To‘lovlar Tarixi</h1>
 <p className="text-[9px] font-black text-[var(--text-secondary)] capitalize tracking-[0.3em] opacity-40">Moliyaviy Yozuvlar</p>
 </div>
 </div>
 <button className="flex items-center gap-2.5 px-5 py-2.5 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black rounded-xl transition-all text-[11px] font-black capitalize tracking-widest shadow-xl shadow-[var(--gold)]/20 active:scale-95 group overflow-hidden relative">
 <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
 <span className="relative z-10">+ To‘lov</span>
 </button>
 </div>

 <div className="p-6 md:p-10 relative z-10 max-w-6xl mx-auto w-full space-y-8">
 {/* O'quvchi ma'lumotlari kartochkasi */}
 <div className="group relative overflow-hidden rounded-[2.5rem] border border-[var(--border-glass)] bg-[var(--bg-panel)]/40 backdrop-blur-3xl p-8 shadow-3xl shadow-[var(--shadow-color)] transition-all duration-500">
 <div className="absolute top-0 left-0 w-2 h-full bg-[var(--gold)] opacity-30"></div>
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
 <div className="space-y-2">
 <p className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-[0.3em] opacity-60">O'quvchi</p>
 <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter capitalize">{studentData.name}</h2>
 </div>
 <div className="flex flex-col items-end gap-1">
 <p className="text-[11px] font-black text-[var(--gold)] capitalize tracking-widest bg-[var(--gold-dim)] px-4 py-1.5 rounded-full border border-[var(--gold)]/20 shadow-lg shadow-[var(--gold)]/5">
 {studentData.group}
 </p>
 <p className="mr-4 text-[9px] font-black text-[var(--text-secondary)] capitalize tracking-[0.4em] opacity-40">ID: {studentData.groupId}</p>
 </div>
 </div>
 </div>

 {/* To'lovlar ro‘yxati jadvali */}
 <div className="relative overflow-hidden rounded-[2.5rem] border border-[var(--border-glass)] bg-[var(--bg-panel)]/40 backdrop-blur-3xl shadow-3xl shadow-[var(--shadow-color)]">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border-glass)] bg-[var(--bg-void)]/30">
 <th className="px-8 py-5 text-[10px] font-black capitalize tracking-[0.3em]">Davr (Oy)</th>
 <th className="px-8 py-5 text-[10px] font-black capitalize tracking-[0.3em]">Miqdori</th>
 <th className="px-8 py-5 text-[10px] font-black capitalize tracking-[0.3em]">Sana</th>
 <th className="px-8 py-5 text-[10px] font-black capitalize tracking-[0.3em] text-center">Usul</th>
 <th className="px-8 py-5 text-[10px] font-black capitalize tracking-[0.3em] text-center">Holati</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--border-glass)]">
 {paymentsData.map(payment => (
 <tr
 key={payment.id}
 className="group hover:bg-[var(--gold-dim)]/30 transition-all duration-300"
 >
 <td className="px-8 py-6">
 <span className="text-[13px] font-black text-[var(--text-primary)] capitalize tracking-tight group-hover:text-[var(--gold)] transition-colors">
 {payment.month}
 </span>
 </td>
 <td className="px-8 py-6">
 <span className="text-[13px] font-black text-[var(--text-primary)] tracking-wide">
 {payment.amount.toLocaleString('uz-UZ')} <span className="text-[10px] text-[var(--text-secondary)]">UZS</span>
 </span>
 </td>
 <td className="px-8 py-6 text-[var(--text-secondary)] text-xs font-bold">
 {payment.date}
 </td>
 <td className="px-8 py-6 text-center">
 <span className="px-3 py-1.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest group-hover:border-[var(--gold)]/30 transition-all">
 {payment.method}
 </span>
 </td>
 <td className="px-8 py-6 text-center">
 <div className="flex justify-center">
 <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black capitalize tracking-[0.2em] shadow-lg border ${payment.status ==="To'langan"
 ?'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10'
 :'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/10'
 }`}>
 <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${payment.status ==="To'langan" ?'bg-emerald-500' :'bg-amber-500'}`}></div>
 {payment.status}
 </span>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </div>
 );
};

export default StudentPayments;