import React, { useState, useMemo } from'react';
import {
 ArrowLeft, Search, Filter, Calendar,
 ChevronRight, ArrowUpRight, Wallet,
 Database, MapPin, Loader2, Plus,
 Zap, Building2, CreditCard, History
} from'lucide-react';
import { useNavigate } from'react-router-dom';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from'@tanstack/react-query';
import { useInView } from'react-intersection-observer';
import api from'../../../tokenUpdater/updater';
import { get_user_info } from'../../Authorized/getRole';
import toast from'react-hot-toast';
import AmountInput from'../../Common/AmountInput';

const UtilityPayments = () => {
 const navigate = useNavigate();
 const user = get_user_info();
 const queryClient = useQueryClient();

 // State
 const [showAddModal, setShowAddModal] = useState(false);
 const [formData, setFormData] = useState({
 amount:'',
 title:'',
 description:'',
 branch:'',
 date: new Date().toISOString().split('T')[0]
 });

 const { ref, inView } = useInView();

 // Fetch Transactions (Category: Utility)
 const {
 data,
 fetchNextPage,
 hasNextPage,
 isFetchingNextPage,
 isLoading,
 refetch
 } = useInfiniteQuery({
 queryKey: ['utility-transactions'],
 queryFn: async ({ pageParam = 1 }) => {
 const params = new URLSearchParams();
 params.append('page', pageParam);
 params.append('category','utility');
 const res = await api.get(`/finance/transactions/?${params.toString()}`);
 return res.data;
 },
 getNextPageParam: (lastPage) => {
 if (!lastPage.next) return undefined;
 const url = new URL(lastPage.next);
 return url.searchParams.get('page') || undefined;
 },
 initialPageParam: 1
 });

 // Fetch Branches for SuperAdmin
 const { data: branches } = useQuery({
 queryKey: ['branches-list'],
 queryFn: async () => {
 const res = await api.get('/add_branch/branches/');
 return res.data;
 },
 enabled: user.role ==='super_admin'
 });

 // Mutation to create utility payment
 const createMutation = useMutation({
 mutationFn: async (newData) => {
 return await api.post('/finance/transactions/', {
 ...newData,
 transaction_type:'expense',
 category:'utility'
 });
 },
 onSuccess: () => {
 toast.success("To'lov muvaffaqiyatli saqlandi!");
 setShowAddModal(false);
 setFormData({ amount:'', title:'', description:'', branch:'', date: new Date().toISOString().split('T')[0] });
 queryClient.invalidateQueries(['utility-transactions']);
 queryClient.invalidateQueries(['finance-stats']);
 },
 onError: (error) => {
 toast.error(error.response?.data?.detail ||"Xatolik yuz berdi");
 }
 });

 const transactions = useMemo(() => {
 return data?.pages.flatMap(page => page.results) || [];
 }, [data]);

 const handleFetchNext = React.useCallback(() => {
 if (inView && hasNextPage && !isFetchingNextPage) {
 fetchNextPage();
 }
 }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

 React.useEffect(() => {
 handleFetchNext();
 }, [handleFetchNext]);

 const handleSubmit = (e) => {
 e.preventDefault();
 if (!formData.amount || !formData.title) {
 toast.error("Ma'lumotlarni to'liq to'ldiring");
 return;
 }
 createMutation.mutate(formData);
 };

 const formatCurrency = (amount) => {
 return Math.floor(amount).toLocaleString() +" UZS";
 };

 return (
 <div className="space-y-10 pb-20">
 {/* Atmosphere Background */}
 <div className="fixed inset-0 pointer-events-none -z-10">
 <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-rose-500/5 rounded-full blur-[140px]"></div>
 <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
 </div>

 {/* HEADER SECTION */}
 <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-6 border-b border-[#2a2a2a]">
 <div className="flex items-center gap-6">
 <button onClick={() => navigate(-1)} className="p-3 bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-xl text-[var(--gold)] hover:scale-110 transition-all shadow-inner">
 <ArrowLeft size={20} />
 </button>
 <div>
 <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter capitalize mb-2 flex items-center gap-4">
 Kommunal To'lovlar
 <Zap className="text-[var(--gold)]" size={24} />
 </h1>
 <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-[0.4em] flex items-center gap-3">
 <Building2 size={12} className="text-[var(--gold)]" /> Markaz Xarajatlari Boshqaruvi
 </p>
 </div>
 </div>

 <button
 onClick={() => setShowAddModal(true)}
 className="px-8 py-4 bg-[var(--gold)] text-black rounded-2xl text-[10px] font-black capitalize tracking-widest hover:shadow-[var(--gold-glow)] transition-all flex items-center gap-3"
 >
 <Plus size={18} /> Yangi To'lov
 </button>
 </div>

 {/* TRANSACTION LIST */}
 <div className="space-y-4">
 {isLoading ? (
 <div className="py-40 flex flex-col items-center justify-center gap-6">
 <Loader2 className="animate-spin text-[var(--gold)]" size={48} />
 <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em]">Yuklanmoqda...</p>
 </div>
 ) : transactions.length === 0 ? (
 <div className="lux-card !py-32 flex flex-col items-center justify-center text-[var(--text-muted)] opacity-30">
 <History size={48} className="mb-6 opacity-20" />
 <p className="text-[10px] font-black capitalize tracking-[0.4em]">To'lovlar topilmadi.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {transactions.map((trx) => (
 <div key={trx.id} className="lux-card !p-5 group/row hover:border-rose-500/30 transition-all flex flex-col md:flex-row items-center justify-between gap-8">
 <div className="flex items-center gap-6 w-full md:w-auto">
 <div className="w-14 h-14 rounded-2xl flex items-center justify-center border bg-rose-500/10 border-rose-500/20 text-rose-400 transition-all duration-500 group-hover/row:scale-110 shadow-inner">
 <ArrowUpRight size={24} />
 </div>
 <div>
 <h4 className="text-lg font-black text-[var(--text-primary)] capitalize tracking-tight group-hover/row:text-rose-400 transition-colors">{trx.title}</h4>
 <p className="text-[10px] text-[var(--text-muted)] font-bold opacity-60">
 {trx.description ||"Kommunal xarajat"} • <span className="text-[var(--gold)]">#{trx.id?.toString().slice(-6)}</span>
 </p>
 </div>
 </div>

 <div className="flex items-center justify-between md:justify-end w-full md:w-auto md:gap-16 border-t md:border-t-0 border-[#2a2a2a] pt-5 md:pt-0">
 <div className="text-left md:text-right">
 <div className="flex items-center gap-2 md:justify-end text-[var(--gold)] opacity-40 mb-1">
 <MapPin size={10} />
 <span className="text-[9px] font-black capitalize tracking-widest">{trx.branch_name ||"Noma'lum Filial"}</span>
 </div>
 <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest opacity-30">
 {new Date(trx.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
 </p>
 </div>
 <div className="text-right">
 <p className="text-xl font-black tabular-nums tracking-tighter text-rose-500">
 -{formatCurrency(trx.amount)}
 </p>
 <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest mt-1 opacity-20">
 AUTH: @{trx.marked_by_name?.split('')[0]}
 </p>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 <div ref={ref} className="h-10" />

 {/* ADD MODAL */}
 {showAddModal && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
 <div className="lux-card !p-8 w-full max-w-lg relative z-10 animate-in zoom-in-95 duration-300">
 <h2 className="text-2xl font-black text-white capitalize tracking-tighter mb-8 flex items-center gap-4">
 <Plus className="text-[var(--gold)]" /> Yangi Komunal To'lov
 </h2>

 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] ml-1">To'lov Maqsadi</label>
 <input
 type="text"
 placeholder="MASALAN: ELEKTR ENERGIYASI"
 className="lux-input !w-full"
 value={formData.title}
 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
 required
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] ml-1">Summa (UZS)</label>
 <AmountInput
 placeholder="200 000"
 className="lux-input !w-full"
 value={formData.amount}
 onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
 required
 />
 </div>
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] ml-1">Sana</label>
 <input
 type="date"
 className="lux-input !w-full"
 value={formData.date}
 onChange={(e) => setFormData({ ...formData, date: e.target.value })}
 required
 />
 </div>
 </div>

 {user.role ==='super_admin' && (
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] ml-1">Filial</label>
 <select
 className="lux-input !w-full cursor-pointer"
 value={formData.branch}
 onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
 required
 >
 <option value="">FILIALNI TANLANG</option>
 {branches?.map(b => (
 <option key={b.id} value={b.id} className="bg-[var(--bg-panel)]">{b.name}</option>
 ))}
 </select>
 </div>
 )}

 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] ml-1">Izoh (Ixtiyoriy)</label>
 <textarea
 className="lux-input !w-full !h-24 resize-none"
 placeholder="BATAFSIL MA'LUMOT..."
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 />
 </div>

 <div className="flex gap-4 pt-4">
 <button
 type="button"
 onClick={() => setShowAddModal(false)}
 className="flex-1 py-4 bg-white/5 text-white/40 rounded-2xl text-[10px] font-black capitalize tracking-widest hover:bg-white/10 transition-all"
 >
 Bekor qilish
 </button>
 <button
 type="submit"
 disabled={createMutation.isPending}
 className="flex-3 py-4 bg-[var(--gold)] text-black rounded-2xl text-[10px] font-black capitalize tracking-widest hover:shadow-[var(--gold-glow)] transition-all flex justify-center items-center gap-2"
 >
 {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> :"Tasdiqlash"}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
};

export default UtilityPayments;
