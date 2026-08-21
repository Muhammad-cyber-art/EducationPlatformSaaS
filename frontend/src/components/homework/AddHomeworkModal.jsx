import React, { useState } from"react";
import { createPortal } from"react-dom";
import api from"../../tokenUpdater/updater";
import toast from"react-hot-toast";
import { X, BookOpen, AlignLeft, Send, AlertCircle, Loader2 } from"lucide-react";

const HomeworkModal = ({ isOpen, onClose, groupId }) => {
 const [formData, setFormData] = useState({ title:'', description:'', group: groupId });
 const [loading, setLoading] = useState(false);

 if (!isOpen) return null;

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData(prev => ({ ...prev, [name]: value }));
 };

 const handleSubmit = (e) => {
 e.preventDefault();
 setLoading(true);
 api.post(`/homework_attends/homeworks/`, formData)
 .then((res) => {
 toast.success("Vazifa muvaffaqiyatli yuborildi!");
 onClose(false);
 })
 .catch(err => {
 console.error("Vazifa yuborishda xato:", err);
 toast.error("Vazifa yuborishda xatolik yuz berdi");
 })
 .finally(() => setLoading(false));
 };

 return createPortal(
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 pt-16 sm:pt-4 transition-all overflow-y-auto">
 <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

 {/* --- HEADER --- */}
 <div className="px-8 py-6 border-b border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-void)]/40">
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-xl bg-[var(--gold)]/10 text-[var(--gold)]">
 <BookOpen size={20} />
 </div>
 <div>
 <h3 className="text-base font-black text-[var(--text-primary)] tracking-tight capitalize">Yangi vazifa</h3>
 <p className="text-[9px] text-[var(--text-secondary)] font-bold capitalize tracking-widest opacity-60">Guruh uchun topshiriq</p>
 </div>
 </div>
 <button
 onClick={() => onClose(false)}
 className="p-2 text-[var(--text-secondary)] hover:text-white transition-all bg-white/5 rounded-full"
 >
 <X size={20} />
 </button>
 </div>

 {/* --- BODY --- */}
 <form onSubmit={handleSubmit} className="p-8 space-y-6">

 {/* Sarlavha */}
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">
 Vazifa mavzusi
 </label>
 <div className="relative group">
 <input
 type="text"
 name="title"
 required
 placeholder="Mavzu nomini kiriting..."
 className="lux-input !bg-[var(--bg-void)]/50 !py-4"
 onChange={handleChange}
 />
 </div>
 </div>

 {/* Tavsif */}
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">
 Batafsil ma'lumot
 </label>
 <textarea
 name="description"
 rows="4"
 required
 placeholder="O'quvchilar nima qilishi kerakligi haqida yozing..."
 className="lux-input !bg-[var(--bg-void)]/50 !py-4 !h-32 resize-none leading-relaxed"
 onChange={handleChange}
 />
 </div>

 {/* --- FOOTER BUTTONS --- */}
 <div className="flex flex-col gap-4 pt-4">
 <button
 type="submit"
 disabled={loading}
 className="w-full py-4 flex items-center justify-center gap-2 text-[10px] font-black capitalize tracking-widest text-black bg-[var(--gold)] rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--gold-glow)]"
 >
 {loading ? (
 <Loader2 className="animate-spin" size={18} />
 ) : (
 <>
 <Send size={16} /> Vazifani yuborish
 </>
 )}
 </button>

 <button
 type="button"
 onClick={() => onClose(false)}
 className="w-full py-3 text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest hover:text-white transition-all underline underline-offset-4"
 >
 Bekor qilish
 </button>
 </div>
 </form>
 </div>
 </div>,
 document.body
 );
};

export default HomeworkModal;