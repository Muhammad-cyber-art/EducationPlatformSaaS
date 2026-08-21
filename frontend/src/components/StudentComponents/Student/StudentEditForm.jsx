import React from"react";
import { User, Phone, MapPin, GraduationCap, ShieldCheck, CreditCard, Loader2, Save } from"lucide-react";
import AmountInput from"../../Common/AmountInput";

const StudentEditForm = ({
 editData,
 branchGroups,
 editMutation,
 dispatch,
 handleSaveEdit
}) => {
 return (
 <div className="max-w-4xl mx-auto space-y-6 sm:space-y-10 px-3 sm:px-0">
 <div className="flex flex-col items-center gap-2 text-center mb-6">
 <div className="w-12 h-0.5 bg-[var(--gold)]/40 rounded-full mb-2" />
 <span className="text-[10px] font-black text-[var(--gold)] capitalize tracking-[0.5em]">Tahrirlash rejimi</span>
 <h3 className="text-xl font-black text-[var(--text-primary)] capitalize tracking-widest">Ma'lumotlarni yangilash</h3>
 </div>

 <div className="lux-card hover:!transform-none !p-5 sm:!p-10 border-[var(--gold)]/20 shadow-[0_30px_60px_-15px_rgba(184,134,11,0.1)]">
 <div className="flex flex-col space-y-10 sm:space-y-12">

 {/* Personal Section */}
 <div className="space-y-6">
 <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-glass)]">
 <div className="p-2 rounded-lg bg-[var(--gold)]/10">
 <User size={18} className="text-[var(--gold)]" />
 </div>
 <h4 className="text-[11px] font-black text-[var(--text-primary)] capitalize tracking-[0.3em]">Shaxsiy ma'lumotlar</h4>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
 <div className="space-y-2 sm:col-span-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">To'liq ism-sharifi</label>
 <input
 className="lux-input !bg-[var(--bg-void)]/50 !py-4"
 value={editData.full_name}
 onChange={e => dispatch({ type:'UPDATE_EDIT_FIELD', payload: { full_name: e.target.value } })}
 placeholder="Masalan: Muhammad Komilov"
 />
 </div>

 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Telefon raqami</label>
 <div className="relative">
 <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/50" />
 <input
 className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12"
 value={editData.phone ||""}
 onChange={e => dispatch({ type:'UPDATE_EDIT_FIELD', payload: { phone: e.target.value } })}
 placeholder="+998 90 123 45 67"
 />
 </div>
 </div>

 <div className="space-y-2 sm:col-span-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Yashash manzili</label>
 <div className="relative">
 <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/50" />
 <input
 className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12"
 value={editData.address ||""}
 onChange={e => dispatch({ type:'UPDATE_EDIT_FIELD', payload: { address: e.target.value } })}
 placeholder="Masalan: Toshkent sh., Chilonzor tumani"
 />
 </div>
 </div>

 <div className="space-y-2 sm:col-span-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Guruhni tanlang</label>
 <div className="relative">
 <GraduationCap size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/50" />
 <select
 className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12 appearance-none cursor-pointer"
 value={editData.group ||""}
 onChange={e => dispatch({ type:'UPDATE_EDIT_FIELD', payload: { group: e.target.value } })}
 >
 <option value="">Guruhga biriktirilmagan</option>
 {branchGroups.map(g => (
 <option key={g.id} value={g.id} className="bg-[var(--bg-panel)]">{g.name} — {g.subject}</option>
 ))}
 </select>
 </div>
 </div>
 </div>
 </div>

 {/* Guardian Section */}
 <div className="space-y-6 pt-4">
 <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-glass)]">
 <div className="p-2 rounded-lg bg-[var(--gold)]/10">
 <ShieldCheck size={18} className="text-[var(--gold)]" />
 </div>
 <h4 className="text-[11px] font-black text-[var(--text-primary)] capitalize tracking-[0.3em]">Vasiy ma'lumotlari</h4>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Vasiy telefoni</label>
 <div className="relative">
 <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/50" />
 <input
 className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12"
 value={editData.parent_phone ||""}
 onChange={e => dispatch({ type:'UPDATE_EDIT_FIELD', payload: { parent_phone: e.target.value } })}
 placeholder="+998 90 987 65 43"
 />
 </div>
 </div>

 <div className="space-y-2 sm:col-span-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Qo'shimcha eslatmalar</label>
 <textarea
 className="lux-input !bg-[var(--bg-void)]/50 !py-4 !h-[120px] !resize-none !leading-relaxed"
 value={editData.notes}
 onChange={e => dispatch({ type:'UPDATE_EDIT_FIELD', payload: { notes: e.target.value } })}
 placeholder="O'quvchi haqida muhim qaydlar..."
 />
 </div>
 </div>
 </div>

 {/* Financial Section */}
 <div className="space-y-6 pt-4">
 <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-glass)]">
 <div className="p-2 rounded-lg bg-[var(--gold)]/10">
 <CreditCard size={18} className="text-[var(--gold)]" />
 </div>
 <h4 className="text-[11px] font-black text-[var(--text-primary)] capitalize tracking-[0.3em]">Moliyaviy status</h4>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">O'quvchi holati</label>
 <select
 className="lux-input !bg-[var(--bg-void)]/50 !py-4"
 value={editData.status ||"regular"}
 onChange={e => {
    const newStatus = e.target.value;
    const updates = { status: newStatus };
    if (newStatus !== 'teacher_negotiated') {
      updates.include_in_mentor_salary = true;
    }
    dispatch({ type:'UPDATE_EDIT_FIELD', payload: updates });
  }}
 >
 <option value="regular">ODDIY</option>
 <option value="discount">IMTIYOZLI</option>
 <option value="low_income">KAM TA'MINLANGAN</option>
 <option value="negotiated">KELISHILGAN NARX</option>
 <option value="teacher_negotiated">O'QITUVCHI KELISHGAN</option>
 </select>
 </div>
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Individual to'lov narxi</label>
 <AmountInput
 className="lux-input !bg-[var(--bg-void)]/50 !py-4 pr-12"
 value={editData.custom_fee ||""}
 onChange={e => dispatch({ type:'UPDATE_EDIT_FIELD', payload: { custom_fee: e.target.value } })}
 placeholder="Guruh narxidan farqli bo'lsa"
 />
 </div>

 {editData.status === 'teacher_negotiated' && (
 <div className="sm:col-span-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
 <label className="flex items-center gap-3 cursor-pointer group">
 <div className="relative">
 <input
 type="checkbox"
 className="sr-only peer"
 checked={editData.include_in_mentor_salary}
 onChange={e => dispatch({ type:'UPDATE_EDIT_FIELD', payload: { include_in_mentor_salary: e.target.checked } })}
 />
 <div className="w-12 h-6 bg-slate-200 border border-slate-300 rounded-full peer-checked:bg-emerald-500 peer-checked:border-emerald-600 transition-all"></div>
 <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-6 shadow-md"></div>
 </div>
 <div>
 <span className="text-[11px] font-black capitalize tracking-widest text-white group-hover:text-emerald-500 transition-colors">
 Mentor oyligiga qo'shilsinmi?
 </span>
 <p className="text-[9px] text-[var(--text-muted)] capitalize font-bold mt-0.5">
 {editData.include_in_mentor_salary ? "O'quvchi bepul o'qiydi, lekin mentorga puli hisoblanadi" : "O'quvchi ham, mentor ham ushbu o'quvchidan daromad olmaydi"}
 </p>
 </div>
 </label>
 </div>
 )}
 </div>
 </div>

 <div className="mt-10 pt-8 border-t border-[var(--border-glass)] flex flex-col-reverse sm:flex-row items-center justify-end gap-3 sm:gap-5">
 <button
 onClick={() => dispatch({ type:'SET_EDITING', payload: false })}
 className="w-full sm:w-auto px-10 py-4 rounded-2xl border border-[var(--border-glass)] text-[10px] font-black capitalize tracking-widest hover:bg-white/5 transition-all text-[var(--text-secondary)] hover:text-white"
 >
 Bekor qilish
 </button>
 <button
 onClick={handleSaveEdit}
 disabled={editMutation.isPending}
 className="w-full sm:w-auto lux-btn-primary px-16 py-4 rounded-2xl text-[10px] font-black capitalize tracking-widest shadow-[0_15px_40px_rgba(184,134,11,0.25)] active:scale-95 transition-all flex items-center justify-center gap-3"
 >
 {editMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
 Saqlash
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};

export default StudentEditForm;
