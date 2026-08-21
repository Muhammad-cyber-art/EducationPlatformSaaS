import React, { useState } from"react";
import { createPortal } from"react-dom";
import { X, Circle, User, Phone, BookOpen, Info, Plus } from"lucide-react";

const AddStudentModal = ({ isOpen, onClose, onAdd }) => {
 const [formData, setFormData] = useState({
 full_name:"",
 phone:"",
 subject:"",
 notes:""
 });

 const handleSubmit = async (e) => {
 e.preventDefault();
 const success = await onAdd(formData);
 if (success) {
 setFormData({ full_name:"", phone:"", subject:"", notes:"" });
 onClose();
 }
 };

 if (!isOpen) return null;

 return createPortal(
 <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose}></div>
 <div className="lux-card w-full max-w-lg max-h-[90vh] relative z-10 animate-in zoom-in-95 duration-500 flex flex-col p-0 overflow-hidden border-[var(--gold)]/20 shadow-[0_30px_60px_-15px_rgba(184,134,11,0.2)]">
 {/* Modal Header */}
 <div className="p-8 border-b border-[var(--border-glass)] bg-gradient-to-r from-[var(--bg-panel)] to-[var(--bg-void)] relative overflow-hidden flex-shrink-0">
 <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--gold)]/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
 <div className="flex justify-between items-center relative z-10">
 <div>
 <h3 className="text-2xl font-black gold-text capitalize tracking-tighter">O'quvchi rejalashtirish</h3>
 <p className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-[0.2em] mt-1">Kutishlar ro'yxatiga yangi yozuv qo'shish</p>
 </div>
 <button onClick={onClose} className="w-10 h-10 rounded-xl bg-[var(--bg-void)]/50 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:border-[var(--gold)]/40 transition-all flex-shrink-0">
 <X size={20} />
 </button>
 </div>
 </div>

 {/* Modal Body */}
 <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-[var(--bg-panel)]/40 overflow-y-auto custom-scrollbar">
 <div className="grid grid-cols-1 gap-6">
 <div className="group/field space-y-2">
 <label className="text-[9px] font-black capitalize tracking-[0.3em] text-[var(--text-muted)] px-1 flex items-center gap-2 group-focus-within/field:text-[var(--gold)] transition-colors">
 <Circle size={8} className="fill-[var(--gold)]/20" /> To'liq ismi
 </label>
 <div className="relative">
 <input
 autoFocus
 className="lux-input !py-4 !pl-12 text-sm font-bold w-full"
 value={formData.full_name}
 onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
 placeholder="Masalan: Ali Valiyev"
 required
 />
 <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/40" />
 </div>
 </div>

 <div className="group/field space-y-2">
 <label className="text-[9px] font-black capitalize tracking-[0.3em] text-[var(--text-muted)] px-1 flex items-center gap-2 group-focus-within/field:text-[var(--gold)] transition-colors">
 <Circle size={8} className="fill-[var(--gold)]/20" /> Telefon raqami
 </label>
 <div className="relative">
 <input
 className="lux-input !py-4 !pl-12 text-sm font-bold w-full"
 value={formData.phone}
 onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
 placeholder="+998 90 123 45 67"
 required
 />
 <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/40" />
 </div>
 </div>

 <div className="group/field space-y-2">
 <label className="text-[9px] font-black capitalize tracking-[0.3em] text-[var(--text-muted)] px-1 flex items-center gap-2 group-focus-within/field:text-[var(--gold)] transition-colors">
 <Circle size={8} className="fill-[var(--gold)]/20" /> Yo'nalish / Fan
 </label>
 <div className="relative">
 <input
 className="lux-input !py-4 !pl-12 text-sm font-bold w-full"
 value={formData.subject}
 onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
 placeholder="Matematika, Ingliz tili..."
 />
 <BookOpen size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]/40" />
 </div>
 </div>

 <div className="group/field space-y-2">
 <label className="text-[9px] font-black capitalize tracking-[0.3em] text-[var(--text-muted)] px-1 flex items-center gap-2 group-focus-within/field:text-[var(--gold)] transition-colors">
 <Circle size={8} className="fill-[var(--gold)]/20" /> Qisqa izoh
 </label>
 <div className="relative">
 <textarea
 className="lux-input !py-4 !pl-12 text-xs font-bold min-h-[100px] resize-none w-full"
 value={formData.notes}
 onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
 placeholder="Talabaning darajasi yoki qo'shimcha istaklari..."
 />
 <Info size={16} className="absolute left-4 top-6 text-[var(--gold)]/40" />
 </div>
 </div>
 </div>

 <div className="pt-4">
 <button
 type="submit"
 className="lux-btn lux-btn-primary w-full py-5 shadow-[var(--gold-glow)] flex items-center justify-center gap-3 relative overflow-hidden group/btn"
 >
 <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
 <Plus size={20} className="relative z-10" />
 <span className="text-[11px] font-black capitalize tracking-[0.4em] relative z-10">Ro'yxatga Qo'shish</span>
 </button>
 </div>
 </form>

 {/* Modal Footer Decorative */}
 <div className="px-8 py-4 bg-[var(--bg-void)]/60 border-t border-[var(--border-glass)] flex items-center justify-center flex-shrink-0">
 <p className="text-[7px] text-[var(--text-muted)] capitalize tracking-[0.5em] font-black">Secure Data Entry Protocol v2.0</p>
 </div>
 </div>
 </div>,
 document.body
 );
};

export default AddStudentModal;
