import { useState, useRef, useEffect } from"react";
import api from"../../../tokenUpdater/updater";
import { useNavigate } from"react-router-dom";
import { useQueryClient } from"@tanstack/react-query";
import toast from"react-hot-toast";
import {
 Plus,
 MapPin,
 Building2,
 CheckCircle2,
 Loader2,
 LayoutGrid
} from"lucide-react";
import GoBackButton from"../../sendback";

export default function BranchCreateView() {
 const [name, setName] = useState("");
 const [address, setAddress] = useState("");
 const [loading, setLoading] = useState(false);
 const navigate = useNavigate();
 const queryClient = useQueryClient();
 const isMounted = useRef(true);

 useEffect(() => {
 return () => { isMounted.current = false; };
 }, []);

 const handleSubmit = async (e) => {
 e.preventDefault();
 setLoading(true);

 const branchData = {
 name: name,
 address: address,
 is_active: true,
 };

 try {
 const response = await api.post("/add_branch/branches/", branchData);
 if (response.status === 201 || response.status === 200) {
 toast.success("Filial muvaffaqiyatli qo'shildi!");

 // Invalidate branches cache so parent component refetches
 await queryClient.invalidateQueries({ queryKey: ['branches'] });

 // Navigate back - the parent will have fresh data
 navigate(-1);
 }
 } catch (error) {
 console.error("Xatolik:", error);
 if (isMounted.current) setLoading(false);
 }
 };

 return (
 <div className="flex-1 min-h-screen bg-[var(--bg-void)] p-3 md:p-5 text-[var(--text-primary)] animate-lux-fade">

 {/* HEADER */}
 <div className="max-w-xl mx-auto flex items-center justify-between mb-8 bg-[var(--bg-panel)] p-4 rounded-2xl border border-[var(--border-glass)] backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.2)]">
 <div className="flex items-center gap-4">
 <GoBackButton />
 <div>
 <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight leading-tight capitalize">Yangi Filial</h1>
 <p className="text-[10px] text-[var(--gold)] font-black capitalize tracking-[0.3em] opacity-80 mt-1">Tizim kengayishi</p>
 </div>
 </div>
 <div className="w-12 h-12 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl flex items-center justify-center shadow-inner">
 <Building2 size={24} className="text-[var(--gold)]" />
 </div>
 </div>

 {/* FORM SECTION */}
 <div className="max-w-xl mx-auto px-1 sm:px-0">
 <form onSubmit={handleSubmit} className="space-y-6">

 <div className="bg-[var(--bg-panel)]/50 border border-[var(--border-glass)] rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 backdrop-blur-sm shadow-xl relative overflow-hidden">

 {/* Decorative Elements */}
 <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--gold)]/5 rounded-full blur-[40px] pointer-events-none" />

 <div className="flex items-center gap-2.5 mb-8 border-b border-[var(--border-glass)] pb-4">
 <LayoutGrid size={18} className="text-[var(--gold)]" />
 <h2 className="text-xs font-black text-[var(--text-primary)] capitalize tracking-[0.2em]">Filial ma'lumotlari</h2>
 </div>

 <div className="space-y-6">
 <div className="space-y-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] ml-1">Filial nomi</label>
 <div className="relative group">
 <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-hover:text-[var(--gold)] group-focus-within:text-[var(--gold)]" />
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="Masalan: Toshkent"
 required
 className="w-full pl-12 pr-4 py-3.5 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)]/50 hover:border-[var(--gold)]/30 focus:border-[var(--gold)]/50 outline-none transition-all shadow-inner capitalize tracking-wide"
 />
 </div>
 </div>

 <div className="space-y-2">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] ml-1">Manzil</label>
 <div className="relative group">
 <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-hover:text-[var(--gold)] group-focus-within:text-[var(--gold)]" />
 <input
 type="text"
 value={address}
 onChange={(e) => setAddress(e.target.value)}
 placeholder="Ko'cha, uy raqami..."
 required
 className="w-full pl-12 pr-4 py-3.5 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder-[var(--text-muted)]/50 hover:border-[var(--gold)]/30 focus:border-[var(--gold)]/50 outline-none transition-all shadow-inner capitalize tracking-wide"
 />
 </div>
 </div>
 </div>
 </div>

 {/* Submit Button */}
 <div className="flex justify-end gap-3 pt-4">
 <button
 type="button"
 onClick={() => navigate(-1)}
 className="px-8 py-4 border border-[var(--border-glass)] text-[10px] font-black capitalize tracking-widest text-[var(--text-muted)] rounded-xl hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)] transition-all active:scale-95"
 >
 Bekor qilish
 </button>
 <button
 type="submit"
 disabled={loading}
 className="px-10 py-4 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black text-[10px] font-black capitalize tracking-widest rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(184,134,11,0.3)] hover:shadow-[0_0_30px_rgba(184,134,11,0.5)] disabled:opacity-50 flex items-center gap-3"
 >
 {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
 {loading ?"Saqlanmoqda..." :"Filialni saqlash"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}