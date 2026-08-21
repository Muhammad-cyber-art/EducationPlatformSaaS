import { useState } from"react";
import { useNavigate, useOutletContext } from"react-router-dom";
import { ArrowLeft, UserPlus, User, ShieldCheck, Phone, BookOpen, Key, Loader2, Building2, Eye, EyeOff } from"lucide-react";
import api from"../../tokenUpdater/updater";
import toast from"react-hot-toast";
import { useCurrentBranch } from"../Authorized/useBranchId";

export default function AdminRegisterView() {
 const navigate = useNavigate();
 const { branchId } = useOutletContext() || {};
 const { currentBranchId, currentBranchName, isLoading: branchLoading } = useCurrentBranch();

 const [formData, setFormData] = useState({
 username:"",
 first_name:"",
 last_name:"",
 subject:"",
 phone_number:"",
 role:"admin",
 branch_id: branchId || currentBranchId,
 password:""
 });

 const [loading, setLoading] = useState(false);
 const [showPassword, setShowPassword] = useState(false);

 const handleChange = (e) => {
 setFormData({ ...formData, [e.target.name]: e.target.value });
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 setLoading(true);

 // Use branchId from context if available (Super Admin view), otherwise use currentBranchId
 const finalBranchId = branchId || currentBranchId;

 const dataToSend = {
 ...formData,
 branch_id: finalBranchId
 };

 try {
 const response = await api.post("/register/users/", dataToSend);
 if (response.status === 201 || response.status === 200) {
 toast.success("Admin muvaffaqiyatli ro'yxatdan o'tkazildi!");
 navigate(-1);
 }
 } catch (error) {
 console.error("Xatolik:", error);
 toast.error(error.response?.data?.username ?"Bu username allaqachon mavjud." :"Xatolik yuz berdi.");
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen bg-[var(--bg-void)] flex items-start justify-center pt-4 md:pt-8 pb-12 px-4 relative overflow-hidden transition-colors duration-500">

 {/* Decorative Background Orbs */}
 <div className="fixed top-[-10%] right-[-5%] w-[400px] h-[400px] bg-[var(--gold)]/5 blur-[100px] rounded-full pointer-events-none z-0"></div>
 <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none z-0"></div>

 <div className="w-full max-w-2xl relative z-10 animate-lux-fade">
 <div className="lux-card !bg-[var(--bg-panel)]/40 backdrop-blur-3xl !rounded-[2.5rem] !border-glass overflow-hidden">

 {/* --- HEADER --- */}
 <div className="w-full py-6 border-b border-[var(--border-glass)] flex justify-between items-center px-6 md:px-10">
 <div className="flex items-center gap-4 md:gap-5">
 <button
 onClick={() => navigate(-1)}
 className="w-10 h-10 bg-[var(--gold-dim)] hover:bg-[var(--gold)]/20 text-[var(--gold)] rounded-xl flex items-center justify-center transition-all border border-[var(--gold)]/20 active:scale-90"
 >
 <ArrowLeft size={18} />
 </button>
 <div className="w-1 h-8 bg-[var(--gold)] rounded-full shadow-[0_0_15px_rgba(184,134,11,0.4)]"></div>
 <div>
 <h1 className="text-xl font-black text-[var(--text-primary)] leading-none capitalize tracking-tighter">
 Admin <br /> <span className="text-[var(--text-secondary)] font-medium not-italic opacity-40 text-sm">Qo'shish</span>
 </h1>
 </div>
 </div>

 <div className="text-right hidden sm:block">
 <p className="text-[9px] text-[var(--gold)] font-black capitalize tracking-[0.2em] opacity-80 mb-1">
 Filial
 </p>
 <div className="flex items-center justify-end gap-2 text-[var(--text-primary)] font-bold text-xs capitalize">
 <Building2 size={12} className="text-[var(--gold)]" />
 {branchLoading ?"..." : (branchId ?"Barcha filiallar" : currentBranchName)}
 </div>
 </div>
 </div>

 {/* --- FORM --- */}
 <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-8">

 {/* Shaxsiy Ma'lumotlar Section */}
 <div className="space-y-6">
 <div className="flex items-center gap-4 mb-4">
 <h2 className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-[0.4em] opacity-40">
 <User size={12} className="inline mr-2" /> Shaxsiy Ma'lumotlar
 </h2>
 <div className="h-px flex-1 bg-[var(--border-glass)]"></div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
 <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
 <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Ism</label>
 <div className="relative group">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--gold)] transition-all">
 <User size={16} />
 </div>
 <input
 onChange={handleChange}
 name="first_name"
 value={formData.first_name}
 type="text"
 placeholder="Masalan: Ali"
 required
 className="lux-input !pl-11 !rounded-2xl"
 />
 </div>
 </div>

 <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
 <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Familiya</label>
 <div className="relative group">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--gold)] transition-all">
 <User size={16} />
 </div>
 <input
 onChange={handleChange}
 name="last_name"
 value={formData.last_name}
 type="text"
 placeholder="Masalan: Valiyev"
 required
 className="lux-input !pl-11 !rounded-2xl"
 />
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
 <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
 <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Telefon raqam</label>
 <div className="relative group">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--gold)] transition-all">
 <Phone size={16} />
 </div>
 <input
 onChange={handleChange}
 name="phone_number"
 value={formData.phone_number}
 type="tel"
 required
 placeholder="+998 90 123 45 67"
 className="lux-input !pl-11 !rounded-2xl"
 />
 </div>
 </div>

 <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
 <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Mutaxassislik</label>
 <div className="relative group">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--gold)] transition-all">
 <BookOpen size={16} />
 </div>
 <input
 onChange={handleChange}
 name="subject"
 value={formData.subject}
 type="text"
 placeholder="Masalan: Menejer"
 className="lux-input !pl-11 !rounded-2xl"
 />
 </div>
 </div>
 </div>
 </div>

 {/* Tizim Sozlamalari Section */}
 <div className="space-y-6">
 <div className="flex items-center gap-4 mb-4">
 <h2 className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-[0.4em] opacity-40">
 <ShieldCheck size={12} className="inline mr-2" /> Tizim Sozlamalari
 </h2>
 <div className="h-px flex-1 bg-[var(--border-glass)]"></div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
 <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
 <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Username (Login)</label>
 <div className="relative group">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--gold)] transition-all">
 <UserPlus size={16} />
 </div>
 <input
 onChange={handleChange}
 name="username"
 value={formData.username}
 type="text"
 placeholder="ali_admin"
 required
 className="lux-input !pl-11 !rounded-2xl"
 />
 </div>
 </div>

 <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
 <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Parol</label>
 <div className="relative group">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--gold)] transition-all">
 <Key size={16} />
 </div>
 <input
 onChange={handleChange}
 name="password"
 value={formData.password}
 type={showPassword ?"text" :"password"}
 placeholder="••••••••"
 required
 className="lux-input !pl-11 !pr-11 !rounded-2xl"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
 >
 {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* Submit Button */}
 <div className="pt-4">
 <button
 type="submit"
 disabled={loading || branchLoading}
 className="lux-btn lux-btn-primary w-full !py-4 !rounded-[1.5rem] !text-[11px] shadow-xl shadow-[var(--gold)]/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
 >
 {loading ? (
 <Loader2 className="animate-spin" size={18} />
 ) : (
 <>
 <UserPlus size={18} /> Adminni Ro'yxatdan o'tkazish
 </>
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>
 );
}