import React, { useState, useEffect } from"react";
import { X, ArrowRightLeft, MapPin, Loader2, CheckCircle2 } from"lucide-react";
import api from"../../tokenUpdater/updater";
import toast from"react-hot-toast";
import { safeArray } from"../../utils/safeArray";

export default function StaffTransferModal({ isOpen, onClose, staffMember, onTransferSuccess }) {
 const [branches, setBranches] = useState([]);
 const [targetBranchId, setTargetBranchId] = useState("");
 const [loading, setLoading] = useState(false);
 const [fetchingBranches, setFetchingBranches] = useState(false);

 // 1. Filiallarni yuklash
 useEffect(() => {
 if (isOpen) {
 setFetchingBranches(true);
 api.get(`/add_branch/branches/`)
 .then(res => {
 setBranches(safeArray(res.data));
 setFetchingBranches(false);
 })
 .catch((err) => {
 console.error("Filiallarni yuklashda xatolik:", err.response?.status, err.response?.data);
 setFetchingBranches(false);
 // Agar 403 bo'lsa, ehtimol ruxsat muammosi
 if (err.response?.status === 403) {
 toast.error("Filiallarga kirish ruxsati yo'q");
 }
 });
 }
 }, [isOpen]);

 // 2. Transferni yuborish
 const handleSubmit = async () => {
 // Tekshiruv: Ma'lumotlar borligiga ishonch hosil qilish
 if (!staffMember?.id) {
 toast.error("Xodim ID-si topilmadi!");
 return;
 }
 if (!targetBranchId) {
 toast.error("Iltimos, yangi filialni tanlang!");
 return;
 }

 try {
 setLoading(true);

 // BACKEND RAW DATA FORMATIGA MOS PAYLOAD
 const payload = {
 user_id: Number(staffMember.id), // null bo'lmasligi uchun
 branch_id: Number(targetBranchId), // null bo'lmasligi uchun
 access_level:'admin' // Mentor profilida bo'lganimiz uchun
 };

 // POST so'rovi
 const response = await api.post(`/register/branch-access/`, payload);

 if (response.status === 200 || response.status === 201) {
 toast.success(`${staffMember.first_name} muvaffaqiyatli ko'chirildi!`);
 if (onTransferSuccess) {
 onTransferSuccess(Number(targetBranchId));
 }
 onClose();
 }
 } catch (error) {
 // Backend qaytargan aniq xatolikni ko'rish
 const serverError = error.response?.data;
 console.error("Backend xatosi:", serverError);

 // Xatolik xabarini chiqarish
 const msg = serverError && typeof serverError ==='object'
 ? Object.values(serverError).flat()[0]
 :"Ko'chirishda xatolik yuz berdi";

 toast.error(msg);
 } finally {
 setLoading(false);
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

 <div className="relative bg-[var(--bg-panel)] border border-[var(--border-glass)] w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

 {/* Header */}
 <div className="px-6 py-5 border-b border-[var(--border-glass)] flex items-center justify-between bg-[var(--gold)]/5">
 <div className="flex items-center gap-3">
 <div className="p-2.5 bg-[var(--gold)]/10 rounded-xl text-[var(--gold)]">
 <ArrowRightLeft size={20} />
 </div>
 <div>
 <h2 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-widest leading-none">Xodimni ko'chirish</h2>
 <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-bold">Filiallararo transfer</p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-[var(--bg-void)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
 <X size={18} />
 </button>
 </div>

 {/* Content */}
 <div className="p-6 space-y-6">
 {/* Mentor Info */}
 <div className="flex items-center gap-4 p-4 bg-[var(--bg-void)] rounded-2xl border border-[var(--border-glass)]">
 <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20">
 {staffMember.first_name?.charAt(0)}{staffMember.last_name?.charAt(0)}
 </div>
 <div>
 <p className="text-xs font-black text-[var(--text-primary)] leading-tight">
 {staffMember.first_name} {staffMember.last_name}
 </p>
 <p className="text-[9px] font-black text-[var(--text-secondary)] capitalize tracking-widest mt-1">
 {staffMember.role ||'mentor'}
 </p>
 </div>
 </div>

 {/* Target Branch Select */}
 <div className="space-y-3">
 <label className="text-[9px] font-black text-[var(--text-secondary)] capitalize tracking-[0.2em] flex items-center gap-2 px-1">
 <MapPin size={12} className="text-[var(--gold)]" /> Yangi filialni tanlang
 </label>

 <div className="relative">
 <select
 value={targetBranchId}
 onChange={(e) => setTargetBranchId(e.target.value)}
 disabled={fetchingBranches}
 className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl px-4 py-4 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-glass)] appearance-none transition-all cursor-pointer disabled:opacity-50"
 >
 <option value="" className="bg-[var(--bg-panel)]">Filialni tanlang</option>
 {branches
 .filter(b => b.id !== staffMember.branch_id && b.id !== staffMember.branch?.id)
 .map((b) => (
 <option key={b.id} value={b.id} className="bg-[var(--bg-panel)]">{b.name}</option>
 ))}
 </select>
 {fetchingBranches && (
 <div className="absolute right-4 top-1/2 -translate-y-1/2">
 <Loader2 size={16} className="animate-spin text-[var(--text-secondary)]" />
 </div>
 )}
 </div>
 </div>

 <div className="p-4 bg-[var(--gold)]/5 rounded-2xl border border-[var(--border-glass)] text-center">
 <p className="text-[9px] text-[var(--gold)]/70 font-bold capitalize tracking-widest leading-relaxed">
 Ko'chirishdan so'ng mentor yangi filial guruhlariga biriktirilishi mumkin bo'ladi.
 </p>
 </div>
 </div>

 {/* Footer */}
 <div className="p-6 pt-0">
 <button
 onClick={handleSubmit}
 disabled={loading || !targetBranchId}
 className="w-full py-4 lux-btn !bg-[var(--gold)] hover:!bg-amber-600 !text-white rounded-2xl font-black text-[10px] capitalize tracking-widest shadow-xl !shadow-[var(--gold)]/20 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
 {loading ?"O'tkazilmoqda..." :"Tasdiqlash va ko'chirish"}
 </button>
 </div>
 </div>
 </div>
 );
}