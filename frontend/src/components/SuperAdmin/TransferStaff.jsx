import React, { useState, useEffect } from"react";
import { X, ArrowRightLeft, Users, Shield, MapPin, UserCheck } from"lucide-react";
import api from"../../tokenUpdater/updater";
import toast from"react-hot-toast";
import { safeArray } from"../../utils/safeArray";

export default function TransferStaff({ isOpen, onClose }) {
 const [activeTab, setActiveTab] = useState("mentor");
 const [staff, setStaff] = useState([]);
 const [loading, setLoading] = useState(false);
 const [branch, SetBRanch] = useState([]);

 const [selectedSourceBranch, setSelectedSourceBranch] = useState("");
 const [formData, setFormData] = useState({
 user_id:'',
 branch_id:'',
 access_level:'admin' // Tabga qarab avtomatik o'zgaradi
 });

 // 1. Filiallarni yuklash
 useEffect(() => {
 if (isOpen) {
 api.get(`/add_branch/branches/`)
 .then(res => SetBRanch(safeArray(res.data)))
 .catch(err => {
 });
 }
 }, [isOpen]);

 // Tab o'zgarganda access_level ni ham yangilash
 useEffect(() => {
 setFormData(prev => ({ ...prev, access_level:'admin' }));
 }, [activeTab]);

 // 2. Xodimlarni olish funksiyasi
 async function FetchStaffData() {
 if (!selectedSourceBranch) return;

 try {
 setLoading(true);
 setStaff([]);

 let url = activeTab ==="mentor"
 ? `/register/users/?role=mentor&branch=${selectedSourceBranch}`
 : `/groups/admins/?branch_id=${selectedSourceBranch}`;

 const res = await api.get(url);
 setStaff(safeArray(res.data));
 } catch (error) {
 } finally {
 setLoading(false);
 }
 }

 useEffect(() => {
 if (isOpen && selectedSourceBranch) {
 FetchStaffData();
 }
 }, [activeTab, selectedSourceBranch, isOpen]);

 const handleChange = (e) => {
 const { name, value } = e.target;
 setFormData((prev) => ({
 ...prev,
 [name]: value
 }));
 };
 const handleSubmit = async (e) => {
 if (e) e.preventDefault();

 if (!formData.user_id || !formData.branch_id) {
 toast.error("Iltimos, xodim va yangi filialni tanlang!");
 return;
 }

 // Backend string qabul qilmasligi mumkin, shuning uchun Number ga o'giramiz
 const payload = {
 user_id: Number(formData.user_id),
 branch_id: Number(formData.branch_id),
 access_level: formData.access_level
 };

 try {
 const response = await api.post(`/register/branch-access/`, payload);
 toast.success("Xodim muvaffaqiyatli ko'chirildi!");
 onClose();
 } catch (error) {
 // General error toast is handled by interceptor
 setLoading(false);
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-[var(--text-primary)]">
 <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

 <div className="relative bg-[var(--bg-void)] border border-[var(--border-glass)] w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

 {/* Header */}
 <div className="px-8 py-6 border-b border-[var(--border-glass)] flex items-center justify-between bg-gradient-to-r from-[var(--gold)]/5 to-transparent">
 <div className="flex items-center gap-3">
 <div className="p-3 bg-[var(--gold)]/10 rounded-2xl text-[var(--gold)]">
 <ArrowRightLeft size={24} />
 </div>
 <div>
 <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight capitalize">Xodimni ko'chirish</h2>
 <p className="text-[var(--text-muted)] text-[10px] capitalize font-black tracking-widest mt-1">Boshqa filialga o'tkazish tizimi</p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-[var(--text-muted)] hover:text-white transition-colors">
 <X size={20} />
 </button>
 </div>

 {/* Tab Switcher */}
 <div className="flex p-1.5 bg-[var(--bg-panel)] mx-8 mt-8 rounded-2xl gap-1">
 <button
 onClick={() => setActiveTab("mentor")}
 className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-xs font-black capitalize tracking-widest ${activeTab ==="mentor" ?"bg-[var(--gold)] text-black shadow-lg" :"text-[var(--text-muted)] hover:text-[var(--text-primary)]"
 }`}
 >
 <Users size={16} /> MENTORLAR
 </button>
 <button
 onClick={() => setActiveTab("admin")}
 className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-xs font-black capitalize tracking-widest ${activeTab ==="admin" ?"bg-[var(--gold)] text-black shadow-lg" :"text-[var(--text-muted)] hover:text-[var(--text-primary)]"
 }`}
 >
 <Shield size={16} /> ADMINLAR
 </button>
 </div>

 {/* Form Content */}
 <div className="p-8 space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

 {/* 1. JORIY FILIAL (Source) */}
 <div className="space-y-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] flex items-center gap-2 px-1">
 <MapPin size={12} className="text-[var(--gold)]" /> Filialni tanlang
 </label>
 <div className="relative group">
 <select
 value={selectedSourceBranch}
 onChange={(e) => {
 setSelectedSourceBranch(e.target.value);
 setFormData(prev => ({ ...prev, user_id:"" })); // Filial o'zgarsa xodimni tanlashni reset qilish
 }}
 className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 appearance-none transition-all cursor-pointer shadow-inner text-xs font-bold capitalize tracking-wide"
 >
 <option value="" className="bg-[var(--bg-void)]">Filial tanlanmagan</option>
 {branch.map((b) => (
 <option key={b.id} value={b.id} className="bg-[var(--bg-void)]">{b.name}</option>
 ))}
 </select>
 </div>
 </div>

 {/* 2. XODIM (Staff) */}
 <div className="space-y-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] flex items-center gap-2 px-1">
 <UserCheck size={12} className="text-emerald-500" />
 {activeTab ==='mentor' ?'Mentorni tanlang' :'Adminni tanlang'}
 </label>
 <div className="relative group">
 <select
 name="user_id"
 value={formData.user_id}
 onChange={handleChange}
 disabled={loading || !selectedSourceBranch}
 className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] outline-none focus:border-emerald-500/50 appearance-none transition-all cursor-pointer disabled:opacity-50 shadow-inner text-xs font-bold capitalize tracking-wide"
 >
 <option value="" className="bg-[var(--bg-void)]">
 {!selectedSourceBranch ?"Avval filialni tanlang" : loading ?"Yuklanmoqda..." :"Xodimni tanlang"}
 </option>
 {staff.map((s) => (
 <option key={s.id} value={s.id} className="bg-[var(--bg-void)]">
 {s.first_name} {s.last_name}
 </option>
 ))}
 </select>
 </div>
 </div>

 </div>

 {/* 3. MAQSAD FILIAL (Target) */}
 <div className="space-y-2 pt-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] flex items-center gap-2 px-1">
 <ArrowRightLeft size={12} className="text-[var(--gold)]" /> Qaysi filialga ko'chiriladi?
 </label>
 <div className="relative group">
 <select
 name="branch_id"
 value={formData.branch_id}
 onChange={handleChange}
 className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl px-4 py-3.5 text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 appearance-none transition-all cursor-pointer shadow-inner text-xs font-bold capitalize tracking-wide"
 >
 <option value="" className="bg-[var(--bg-void)]">Yangi filialni tanlang</option>
 {/* Filtrlash logikasi: Tanlangan branch Targetda chiqmaydi */}
 {branch
 .filter(b => String(b.id) !== String(selectedSourceBranch))
 .map((b) => (
 <option key={b.id} value={b.id} className="bg-[var(--bg-void)]">{b.name}</option>
 ))}
 </select>
 </div>
 </div>
 </div>

 {/* Footer Actions */}
 <div className="p-8 bg-[var(--bg-panel)]/50 border-t border-[var(--border-glass)] flex gap-4">
 <button onClick={onClose} className="flex-1 py-4 px-6 rounded-2xl border border-[var(--border-glass)] text-[var(--text-muted)] font-black text-xs capitalize tracking-widest hover:bg-[var(--bg-panel)] transition-all">
 BEKOR QILISH
 </button>
 <button
 onClick={handleSubmit}
 disabled={loading || !formData.user_id || !formData.branch_id}
 className={`flex-[2] py-4 px-6 rounded-2xl font-black text-xs capitalize tracking-widest text-[#000] shadow-[0_0_20px_rgba(184,134,11,0.3)] transition-all active:scale-[0.98] disabled:opacity-30 bg-[var(--gold)] hover:bg-[var(--gold)]/90
 }`}
 >
 {loading ?"YUKLANMOQDA..." :"TRANSFERNI AMALGA OSHIRISH"}
 </button>
 </div>
 </div>
 </div>
 );
}