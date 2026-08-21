import React, { useState, useEffect } from "react";
import {
    Search, Calendar, Filter, Download, ArrowLeft,
    CreditCard, Banknote, Smartphone, Image as ImageIcon,
    User, Clock, ChevronRight, MoreHorizontal, FileText,
    CheckCircle2, XCircle, AlertCircle, ExternalLink,
    FilterX, Building2, Wallet, Loader2, Circle, ShieldCheck, X,
    Zap, Verified, MinusCircle, PlusCircle, TrendingDown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { get_user_info } from "../../Authorized/getRole";

const Kassa = () => {
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState([]);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawData, setWithdrawData] = useState({ amount: "", description: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("incomes"); // 'incomes' or 'expenses'
    
    const [filters, setFilters] = useState({
        branch: "",
        method: "",
        search: "",
        date: "" // Bo'sh bo'lsa - joriy oy (User talabi: bir oylik ma'lumot)
    });

    const fetchKassaData = async () => {
        try {
            setLoading(true);
            
            let date_gte = undefined;
            let date_lte = undefined;

            if (filters.date) {
                // Tanlangan sana bo'yicha (faqat shu kun)
                date_gte = filters.date;
                date_lte = filters.date;
            } else {
                // Tanlangan sana yo'q bo'lsa - joriy oy (User talabi: bir oylik ma'lumot)
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                date_gte = start;
                date_lte = end;
            }

            const params = {
                transaction_type: 'income',
                category: 'student_fee',
                search: filters.search || undefined,
                branch: filters.branch || undefined
            };

            if (filters.date) {
                params.date = filters.date;
            } else {
                params.date__gte = date_gte;
                params.date__lte = date_lte;
            }

            const payRes = await api.get("/finance/transactions/", { params });
            setPayments(payRes.data.results || payRes.data);

            const transParams = {
                transaction_type: 'expense',
                branch: filters.branch || undefined
            };

            if (filters.date) {
                transParams.date = filters.date;
            } else {
                transParams.date__gte = date_gte;
                transParams.date__lte = date_lte;
            }

            const transRes = await api.get("/finance/transactions/", { params: transParams });
            setWithdrawals((transRes.data.results || transRes.data).filter(t => t.category === 'owner_withdrawal' || t.category === 'other'));

        } catch (error) {
            console.error("Error fetching kassa data:", error);
            toast.error("Ma'lumotlarni yuklashda xatolik.");
        } finally {
            setLoading(false);
        }
    };

    const handleAmountChange = (e) => {
        const val = e.target.value.replace(/\D/g, ""); // Faqat raqamlar
        const formatted = val ? Number(val).toLocaleString() : "";
        setWithdrawData({ ...withdrawData, amount: formatted });
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        const rawAmount = withdrawData.amount.replace(/,/g, ""); // Vergullarni olib tashlash
        
        if (!rawAmount || Number(rawAmount) <= 0) {
            return toast.error("Summani to'g'ri kiriting");
        }
        
        try {
            setIsSubmitting(true);
            await api.post("/finance/transactions/", {
                transaction_type: 'expense',
                category: 'owner_withdrawal',
                amount: rawAmount,
                title: "Super Admin pul oldi",
                description: withdrawData.description,
                branch: filters.branch || get_user_info()?.branch || 1,
                date: filters.date || new Date().toISOString().split('T')[0]
            });
            toast.success("Pul olish muvaffaqiyatli qayd etildi!");
            setShowWithdrawModal(false);
            setWithdrawData({ amount: "", description: "" });
            fetchKassaData();
        } catch (error) {
            toast.error("Xatolik yuz berdi");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerify = async (paymentId) => {
        try {
            const res = await api.post(`/finance/student-payments/${paymentId}/verify/`);
            if (res.data.status === 'success') {
                toast.success("To'lov muvaffaqiyatli tasdiqlandi!");
                fetchKassaData();
                if (selectedPayment && selectedPayment.id === paymentId) {
                    setShowDetailModal(false);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "Tasdiqlashda xatolik");
        }
    };

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await api.get("/add_branch/branches/");
                setBranches(res.data.results || res.data);
            } catch (err) { console.error(err); }
        };
        fetchBranches();
    }, []);

    useEffect(() => {
        fetchKassaData();
    }, [filters.date, filters.method, filters.branch, filters.search]);

    const formatCurrency = (val) => {
        return Number(val).toLocaleString() + " UZS";
    };

    const totalToday = payments.filter(p => p.status !== 'cancelled').reduce((sum, p) => sum + Number(p.amount), 0);
    const totalVerified = payments.filter(p => p.payment_details?.is_verified && p.status !== 'cancelled').reduce((sum, p) => sum + Number(p.amount), 0);
    const totalWithdrawn = withdrawals.filter(w => w.status !== 'cancelled').reduce((sum, w) => sum + Number(w.amount), 0);

    return (
        <>
            <div className="space-y-8 animate-lux-fade pb-10 relative">
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
            </div>

            {/* HEADER ACTION AREA */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 p-6 bg-[var(--bg-panel)]/40 border border-[#2a2a2a] rounded-[2.5rem] shadow-2xl backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                <div className="flex items-center gap-6 relative z-10">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-14 h-14 flex items-center justify-center bg-[var(--bg-void)] border border-[var(--gold)]/20 rounded-[1.25rem] text-[var(--gold)] hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-black hover:scale-110 active:scale-95 transition-all duration-300 shadow-lg"
                    >
                        <ArrowLeft size={24} strokeWidth={2.5} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <Wallet className="text-[var(--gold)]" size={28} />
                            <h1 className="text-3xl font-black text-white tracking-tighter capitalize drop-shadow-sm">
                                Kassa Tizimi
                            </h1>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-3">
                            <Circle size={8} className="fill-emerald-500 text-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            Jonli Moliyaviy Tushumlar
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10 w-full xl:w-auto">
                    <div className="px-6 py-4 bg-[var(--bg-void)]/60 border border-[var(--gold)]/20 rounded-[2rem] group/total">
                        <div className="flex items-center gap-2 mb-1.5 opacity-70">
                            <PlusCircle size={10} className="text-[var(--gold)]" />
                            <p className="text-[8px] font-black text-[var(--gold)] uppercase tracking-widest">Umumiy Kirim</p>
                        </div>
                        <span className="text-lg font-black text-white tabular-nums tracking-tighter">{formatCurrency(totalToday)}</span>
                    </div>

                    <div className="px-6 py-4 bg-red-500/5 border border-red-500/20 rounded-[2rem] group/withdraw">
                        <div className="flex items-center gap-2 mb-1.5 opacity-70">
                            <TrendingDown size={10} className="text-red-500" />
                            <p className="text-[8px] font-black text-red-500 uppercase tracking-widest">Olingan</p>
                        </div>
                        <span className="text-lg font-black text-red-500 tabular-nums tracking-tighter">{formatCurrency(totalWithdrawn)}</span>
                    </div>

                    <div className="px-6 py-4 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] group/verified">
                        <div className="flex items-center gap-2 mb-1.5 opacity-70">
                            <Verified size={10} className="text-emerald-500" />
                            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Tasdiqlangan</p>
                        </div>
                        <span className="text-lg font-black text-emerald-500 tabular-nums tracking-tighter">{formatCurrency(totalVerified)}</span>
                    </div>
                </div>

                {get_user_info()?.role === 'super_admin' && (
                    <button
                        onClick={() => setShowWithdrawModal(true)}
                        className="relative z-10 px-6 xl:px-8 h-12 xl:h-14 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] xl:text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 shrink-0"
                    >
                        <MinusCircle size={18} />
                        Pul Olish
                    </button>
                )}
            </div>

            {/* SMART FILTER TOOLBAR */}
            <div className="flex flex-col lg:flex-row gap-4 p-4 bg-[var(--bg-panel)]/30 border border-[#2a2a2a] rounded-[2rem] backdrop-blur-md">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Qidiruv (Ism, tel, guruh)..."
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        className="w-full h-12 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl pl-12 pr-4 text-[13px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-[var(--gold)]/50 transition-all"
                    />
                </div>

                <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                    <div className="relative min-w-[140px] flex-1 md:flex-none">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)] opacity-50 pointer-events-none" size={14} />
                        <input
                            type="date"
                            value={filters.date}
                            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                            className="w-full h-12 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl pl-10 pr-3 text-[12px] font-black text-[var(--gold)] outline-none focus:border-[var(--gold)]/50 transition-all"
                        />
                    </div>

                    <div className="relative min-w-[150px] flex-1 md:flex-none">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)] opacity-50 pointer-events-none" size={14} />
                        <select
                            value={filters.branch}
                            onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                            className="w-full h-12 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl pl-10 pr-8 text-[11px] font-black text-white outline-none focus:border-[var(--gold)]/50 transition-all appearance-none cursor-pointer"
                        >
                            <option value="" className="bg-[#0a0a0a]">Filiallar</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id} className="bg-[#0a0a0a]">{b.name}</option>
                            ))}
                        </select>
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[var(--gold)] opacity-30 pointer-events-none" size={12} />
                    </div>

                    <div className="relative min-w-[150px] flex-1 md:flex-none">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)] opacity-50 pointer-events-none" size={14} />
                        <select
                            value={filters.method}
                            onChange={(e) => setFilters({ ...filters, method: e.target.value })}
                            className="w-full h-12 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl pl-10 pr-8 text-[11px] font-black text-white outline-none focus:border-[var(--gold)]/50 transition-all appearance-none cursor-pointer"
                        >
                            <option value="" className="bg-[#0a0a0a]">Metodlar</option>
                            <option value="cash" className="bg-[#0a0a0a]">Naqd (Cash)</option>
                            <option value="click" className="bg-[#0a0a0a]">Click / Karta</option>
                        </select>
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[var(--gold)] opacity-30 pointer-events-none" size={12} />
                    </div>

                    {(filters.search || filters.branch || filters.method) && (
                        <button 
                            onClick={() => setFilters({ branch: "", method: "", search: "", date: "" })}
                            className="w-12 h-12 flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
                            title="Filtrlarni tozalash (Oyga qaytish)"
                        >
                            <FilterX size={18} />
                        </button>
                    )}

                    <button 
                        onClick={() => setFilters({ ...filters, date: new Date().toISOString().split('T')[0] })}
                        className={`px-4 h-12 flex items-center justify-center border rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${filters.date === new Date().toISOString().split('T')[0] ? 'bg-[var(--gold)] text-black border-[var(--gold)]' : 'bg-white/5 text-[var(--gold)] border-[var(--gold)]/20 hover:bg-white/10'}`}
                    >
                        Bugun
                    </button>
                </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex items-center gap-2 p-1.5 bg-[var(--bg-panel)]/30 border border-[#2a2a2a] rounded-[1.25rem] w-full sm:w-fit overflow-x-auto no-scrollbar">
                <button 
                    onClick={() => setActiveTab("incomes")}
                    className={`flex-1 sm:flex-none whitespace-nowrap px-6 xl:px-10 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'incomes' ? 'bg-[var(--gold)] text-black shadow-[0_8px_20px_rgba(184,134,11,0.3)] scale-105 z-10' : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'}`}
                >
                    <PlusCircle size={14} />
                    Tushumlar <span className="opacity-50 text-[8px]">({payments.length})</span>
                </button>
                <button 
                    onClick={() => setActiveTab("expenses")}
                    className={`flex-1 sm:flex-none whitespace-nowrap px-6 xl:px-10 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'expenses' ? 'bg-red-600 text-white shadow-[0_8px_20px_rgba(220,38,38,0.3)] scale-105 z-10' : 'text-[var(--text-muted)] hover:text-white hover:bg-white/5'}`}
                >
                    <TrendingDown size={14} />
                    Chiqimlar <span className="opacity-50 text-[8px]">({withdrawals.length})</span>
                </button>
            </div>

            {/* DATA GRID PROTOCOL */}
            <div className="relative">
                {/* Desktop Table View */}
                <div className="hidden lg:block lux-card !p-0 !rounded-[2.5rem] overflow-hidden border-[#2a2a2a] shadow-2xl bg-[var(--bg-panel)]/20 backdrop-blur-xl">
                    <div className="overflow-x-auto">
                        {activeTab === "incomes" ? (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.03] border-b border-[#2a2a2a]">
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">O'quvchi / Guruh</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">To'lov Usuli</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Summa</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Qabul Qildi</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Vaqt</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em] text-right">Amallar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2a2a2a]">
                                    {loading ? (
                                        <tr><td colSpan="6" className="p-32 text-center text-[var(--gold)] animate-pulse uppercase font-black tracking-widest">Ma'lumotlar yuklanmoqda...</td></tr>
                                    ) : payments.length === 0 ? (
                                        <tr><td colSpan="6" className="p-32 text-center text-[var(--text-muted)] font-black uppercase tracking-widest">Hozircha hech qanday tushum topilmadi</td></tr>
                                    ) : payments.map((p) => {
                                        const isCancelled = p.status === 'cancelled';
                                        return (
                                        <tr key={p.id} className={`hover:bg-white/[0.04] transition-all duration-300 group/row ${isCancelled ? 'opacity-50' : ''}`}>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl bg-[var(--bg-void)] border flex items-center justify-center text-[var(--text-muted)] transition-colors ${isCancelled ? 'border-gray-500/30' : 'border-[#2a2a2a] group-hover/row:border-[var(--gold)]/30'}`}>
                                                        <User size={22} strokeWidth={1.5} />
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-black capitalize ${isCancelled ? 'text-[var(--text-muted)] line-through' : 'text-white'}`}>
                                                            {p.student_name}
                                                        </p>
                                                        <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-1 opacity-70">
                                                            {p.payment_details?.group_name || 'Guruhsiz'}
                                                            {isCancelled && <span className="ml-2 text-red-500">Bekor qilingan</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-wider ${isCancelled ? 'bg-gray-500/10 border-gray-500/20 text-gray-400' : p.payment_details?.payment_method === 'cash' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}>
                                                    {p.payment_details?.payment_method === 'cash' ? <Banknote size={14} /> : <Smartphone size={14} />}
                                                    {p.payment_details?.payment_method === 'cash' ? 'Naqd (Cash)' : 'Click / Card'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className={`text-base font-black tabular-nums tracking-tight ${isCancelled ? 'text-gray-500 line-through' : 'text-white'}`}>
                                                    {formatCurrency(p.amount)}
                                                </div>
                                                {p.payment_details?.refund_amount > 0 && !p.payment_details?.refund_ignored && (
                                                    <div className="mt-1 text-[9px] font-bold text-emerald-400">Refund: -{formatCurrency(p.payment_details.refund_amount)}</div>
                                                )}
                                                {p.payment_details?.refund_amount > 0 && p.payment_details?.refund_ignored && (
                                                    <div className="mt-1 text-[9px] font-bold text-amber-400">Refund bekor</div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${p.payment_details?.is_verified ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-[var(--gold)] border-white/10'}`}>
                                                        {p.payment_details?.is_verified ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}
                                                    </div>
                                                    <span className="text-[11px] font-black uppercase text-[var(--text-secondary)]">{p.marked_by_name || "Tizim"}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="text-[11px] font-black text-white">{new Date(p.date || p.created_at).toLocaleDateString('uz-UZ')}</div>
                                                <div className="text-[10px] text-[var(--text-muted)] font-black">{new Date(p.created_at || p.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex justify-end gap-3 opacity-0 group-hover/row:opacity-100 transition-all duration-300">
                                                    {get_user_info()?.role === 'super_admin' && !p.payment_details?.is_verified && p.payment_details?.original_payment_id && (
                                                        <button onClick={() => handleVerify(p.payment_details.original_payment_id)} className="w-11 h-11 flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg active:scale-90"><CheckCircle2 size={18} /></button>
                                                    )}
                                                    {p.payment_details?.receipt_image && <button onClick={() => window.open(p.payment_details.receipt_image, '_blank')} className="w-11 h-11 flex items-center justify-center bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-lg active:scale-90"><ImageIcon size={18} /></button>}
                                                    <button onClick={() => { setSelectedPayment(p); setShowDetailModal(true); }} className="w-11 h-11 flex items-center justify-center bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/20 rounded-xl hover:bg-[var(--gold)] hover:text-black transition-all shadow-lg active:scale-90"><FileText size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/[0.03] border-b border-[#2a2a2a]">
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Operatsiya</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Toifa</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Summa</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Mas'ul</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Vaqt</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em] text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2a2a2a]">
                                    {loading ? (
                                        <tr><td colSpan="6" className="p-32 text-center text-red-500 animate-pulse uppercase font-black tracking-widest">Yuklanmoqda...</td></tr>
                                    ) : withdrawals.length === 0 ? (
                                        <tr><td colSpan="6" className="p-32 text-center text-[var(--text-muted)] font-black uppercase tracking-widest">Hozircha hech qanday chiqim topilmadi</td></tr>
                                    ) : withdrawals.map((w) => (
                                        <tr key={w.id} className="hover:bg-white/[0.04] transition-all duration-300 group/row">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 group-hover/row:bg-red-500 group-hover/row:text-white transition-all">
                                                        <TrendingDown size={22} strokeWidth={1.5} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-white capitalize">{w.title}</p>
                                                        <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-1 opacity-70 truncate max-w-[200px]">{w.description}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-wider">
                                                    <CreditCard size={14} />
                                                    {w.category === 'owner_withdrawal' ? 'Avans / Pul Olish' : 'Boshqa Chiqim'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-base font-black text-red-500 tabular-nums tracking-tight">{formatCurrency(w.amount)}</td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 text-[var(--gold)]">
                                                        <User size={16} />
                                                    </div>
                                                    <span className="text-[11px] font-black uppercase text-[var(--text-secondary)]">{w.marked_by_name || "Super Admin"}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="text-[11px] font-black text-white">{w.date}</div>
                                                <div className="text-[10px] text-[var(--text-muted)] font-black">Chiqim operatsiyasi</div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                                                    <CheckCircle2 size={14} />
                                                    Bajarildi
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="lg:hidden space-y-4">
                    {loading ? (
                        <div className="p-20 text-center text-[var(--gold)] animate-pulse font-black uppercase tracking-widest">Yuklanmoqda...</div>
                    ) : (activeTab === 'incomes' ? payments : withdrawals).length === 0 ? (
                        <div className="p-20 text-center text-[var(--text-muted)] font-black uppercase tracking-widest">Hech qanday ma'lumot topilmadi</div>
                    ) : (activeTab === 'incomes' ? payments : withdrawals).map((item) => {
                        const isCancelled = item.status === 'cancelled';
                        return (
                        <div key={item.id} className={`p-5 bg-[var(--bg-panel)]/40 border border-[#2a2a2a] rounded-3xl backdrop-blur-xl relative overflow-hidden active:scale-[0.98] transition-all ${isCancelled ? 'opacity-50' : ''}`}>
                            {activeTab === 'incomes' ? (
                                <>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl bg-[var(--bg-void)] border flex items-center justify-center text-[var(--text-muted)] ${isCancelled ? 'border-gray-500/30' : 'border-[#2a2a2a]'}`}>
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <h3 className={`text-sm font-black capitalize ${isCancelled ? 'text-[var(--text-muted)] line-through' : 'text-white'}`}>{item.student_name}</h3>
                                                <p className={`text-[9px] font-black uppercase tracking-widest ${isCancelled ? 'text-gray-500' : 'text-[var(--gold)]'}`}>
                                                    {item.payment_details?.group_name || 'Guruhsiz'}
                                                    {isCancelled && <span className="ml-2 text-red-500">Bekor qilingan</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-xl border text-[8px] font-black uppercase tracking-widest ${isCancelled ? 'bg-gray-500/10 border-gray-500/20 text-gray-400' : item.payment_details?.payment_method === 'cash' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}>
                                            {item.payment_details?.payment_method === 'cash' ? 'Naqd' : 'Click/Card'}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <p className="text-[8px] text-[var(--text-muted)] font-black uppercase tracking-widest">To'lov summasi</p>
                                            <p className={`text-lg font-black tabular-nums ${isCancelled ? 'text-gray-500 line-through' : 'text-white'}`}>{formatCurrency(item.amount)}</p>
                                            {item.payment_details?.refund_amount > 0 && !item.payment_details?.refund_ignored && (
                                                <p className="text-[9px] font-bold text-emerald-400">Refund: -{formatCurrency(item.payment_details.refund_amount)}</p>
                                            )}
                                            {item.payment_details?.refund_amount > 0 && item.payment_details?.refund_ignored && (
                                                <p className="text-[9px] font-bold text-amber-400">Refund bekor</p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {get_user_info()?.role === 'super_admin' && !item.payment_details?.is_verified && item.payment_details?.original_payment_id && (
                                                <button onClick={() => handleVerify(item.payment_details.original_payment_id)} className="w-10 h-10 flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl active:scale-90 transition-all"><CheckCircle2 size={16} /></button>
                                            )}
                                            <button onClick={() => { setSelectedPayment(item); setShowDetailModal(true); }} className="w-10 h-10 flex items-center justify-center bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/20 rounded-xl active:scale-90 transition-all"><FileText size={16} /></button>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                                        <span>{new Date(item.date || item.created_at).toLocaleDateString('uz-UZ')}</span>
                                        <span className="flex items-center gap-1"><ShieldCheck size={10} /> {item.marked_by_name || "Tizim"}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                                                <TrendingDown size={18} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-white capitalize">{item.title}</h3>
                                                <p className="text-[9px] text-red-500/60 font-black uppercase tracking-widest">Chiqim Operatsiyasi</p>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] font-black uppercase tracking-widest">
                                            {item.category === 'owner_withdrawal' ? 'Avans' : 'Boshqa'}
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <p className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest mb-1">Chiqim summasi</p>
                                        <p className="text-xl font-black text-red-500 tabular-nums">{formatCurrency(item.amount)}</p>
                                    </div>
                                    <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                                        <span>{item.date}</span>
                                        <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 size={10} /> Bajarildi</span>
                                    </div>
                                </>
                            )}
                        </div>
                        );
                    })}
                </div>
            </div>
            </div> {/* Closing space-y-8 animate-lux-fade */}

            {/* PRO WITHDRAW MODAL (ADVANCED PROTOCOL) */}
            {showWithdrawModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowWithdrawModal(false)}></div>
                    <form 
                        onSubmit={handleWithdraw} 
                        className="relative w-full max-w-xl bg-[var(--bg-void)] border border-[#2a2a2a] rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden animate-lux-pop flex flex-col max-h-[90vh]"
                    >
                        {/* Header Section */}
                        <div className="p-8 xl:p-10 border-b border-[#2a2a2a] flex items-center justify-between bg-gradient-to-r from-red-600/10 via-transparent to-transparent">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-[1.5rem] bg-red-600/10 flex items-center justify-center text-red-500 border border-red-500/20 shadow-[inset_0_0_20px_rgba(220,38,38,0.1)]">
                                    <TrendingDown size={28} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight leading-tight">Pul Olish</h2>
                                    <p className="text-[10px] font-black text-red-500/70 uppercase tracking-[0.4em] mt-1">Withdrawal Authorization</p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setShowWithdrawModal(false)} 
                                className="w-12 h-12 flex items-center justify-center bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 rounded-2xl transition-all active:scale-90"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body Section (Scrollable) */}
                        <div className="p-8 xl:p-10 space-y-8 overflow-y-auto no-scrollbar">
                            {/* Branch Selector (For Super Admin) */}
                            {get_user_info()?.role === 'super_admin' && (
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                        <Building2 size={12} /> Filialni Tanlang
                                    </label>
                                    <div className="relative">
                                        <select 
                                            required
                                            value={withdrawData.branch || filters.branch}
                                            onChange={(e) => setWithdrawData({...withdrawData, branch: e.target.value})}
                                            className="w-full h-16 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl px-6 text-[13px] font-bold text-white outline-none focus:border-red-500/50 transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">Filialni tanlang...</option>
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id} className="bg-[#0a0a0a]">{b.name}</option>
                                            ))}
                                        </select>
                                        <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 rotate-90 text-red-500/50 pointer-events-none" size={16} />
                                    </div>
                                </div>
                            )}

                            {/* Amount Input Section */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end px-1">
                                    <label className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.2em]">Yechish Summasi (UZS)</label>
                                    <span className="text-[10px] font-black text-white/30 uppercase">Balansdan yechiladi</span>
                                </div>
                                <div className="relative group">
                                    <input 
                                        type="text" 
                                        required
                                        autoFocus
                                        value={withdrawData.amount}
                                        onChange={handleAmountChange}
                                        placeholder="0"
                                        className="w-full h-20 bg-[#0a0a0a] border border-[#2a2a2a] rounded-3xl px-8 text-white font-black text-3xl outline-none focus:border-red-500/50 transition-all placeholder:opacity-10 tabular-nums shadow-inner"
                                    />
                                </div>
                                
                                {/* Quick Amount Chips */}
                                <div className="flex flex-wrap gap-2">
                                    {[100000, 500000, 1000000, 5000000].map((val) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setWithdrawData({...withdrawData, amount: val.toLocaleString()})}
                                            className="px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 rounded-xl text-[10px] font-black text-gray-400 hover:text-red-500 transition-all uppercase tracking-widest"
                                        >
                                            +{val / 1000}k
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description Section */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.2em] ml-1">Chiqim Maqsadi / Izoh</label>
                                <textarea 
                                    required
                                    value={withdrawData.description}
                                    onChange={(e) => setWithdrawData({...withdrawData, description: e.target.value})}
                                    placeholder="Masalan: Ijara to'lovi, Kantselyariya yoki Shaxsiy avans..."
                                    className="w-full h-32 bg-[#0a0a0a] border border-[#2a2a2a] rounded-3xl p-6 text-white text-sm font-medium outline-none focus:border-red-500/50 transition-all resize-none placeholder:opacity-20 leading-relaxed shadow-inner"
                                />
                            </div>
                        </div>

                        {/* Footer Section */}
                        <div className="p-8 xl:p-10 bg-white/[0.02] border-t border-[#2a2a2a] flex flex-col sm:flex-row gap-4">
                            <button 
                                type="button"
                                onClick={() => setShowWithdrawModal(false)}
                                className="flex-1 h-16 bg-white/5 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white/10 transition-all border border-white/10 active:scale-95"
                            >
                                Bekor Qilish
                            </button>
                            <button 
                                disabled={isSubmitting}
                                type="submit"
                                className="flex-[1.5] h-16 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl transition-all shadow-[0_10px_30px_rgba(220,38,38,0.4)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={18} />
                                        Tasdiqlash va Yechish
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* DETAIL MODAL */}
            {showDetailModal && selectedPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDetailModal(false)}></div>
                    <div className="relative w-full max-w-lg bg-[var(--bg-void)] border border-[#2a2a2a] rounded-[2.5rem] shadow-2xl overflow-hidden animate-lux-pop">
                        <div className="p-8 border-b border-[#2a2a2a] flex items-center justify-between bg-gradient-to-r from-[var(--gold)]/10 to-transparent">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-[var(--gold-dim)] flex items-center justify-center text-[var(--gold)] border border-[var(--gold)]/20 shadow-inner"><FileText size={24} /></div>
                                <div><h2 className="text-xl font-black text-white tracking-tight">To'lov Tafsilotlari</h2><p className="text-[9px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">ID: STP-{selectedPayment.id}</p></div>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} className="w-10 h-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-6 text-white">
                            <div className="grid grid-cols-2 gap-6 font-bold text-sm">
                                <div><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">O'quvchi</p>{selectedPayment.student_name}</div>
                                <div className="text-right"><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Guruh</p><span className="text-[var(--gold)]">{selectedPayment.payment_details?.group_name || 'Guruhsiz'}</span></div>
                                <div><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">To'langan Summa</p>{formatCurrency(selectedPayment.amount)}</div>
                                <div className="text-right"><p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Metod</p>{selectedPayment.payment_details?.payment_method_display || 'Noma\'lum'}</div>
                                {/* Refund ma'lumoti */}
                                {selectedPayment.payment_details?.refund_amount > 0 && !selectedPayment.payment_details?.refund_ignored && (
                                    <>
                                        <div className="col-span-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-[9px] text-emerald-400 uppercase tracking-widest mb-1">Refund (Qaytarilgan)</p>
                                                    <p className="text-lg font-black text-emerald-400">-{formatCurrency(selectedPayment.payment_details.refund_amount)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Oylik to'lov</p>
                                                    <p className="text-sm font-bold text-white">{formatCurrency(Number(selectedPayment.amount) + Number(selectedPayment.payment_details.refund_amount))}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {selectedPayment.payment_details?.refund_amount > 0 && selectedPayment.payment_details?.refund_ignored && (
                                    <div className="col-span-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                        <p className="text-[9px] text-amber-400 uppercase tracking-widest mb-1">Refund Status</p>
                                        <p className="text-sm font-black text-amber-400">Refund bekor qilingan (Hisoblanmadi)</p>
                                    </div>
                                )}
                            </div>
                            {selectedPayment.notes && <div className="p-4 bg-white/5 rounded-xl text-xs italic text-gray-400">"{selectedPayment.notes}"</div>}
                        </div>
                        <div className="p-6 bg-white/[0.02] border-t border-[#2a2a2a] flex gap-3">
                            {get_user_info()?.role === 'super_admin' && !selectedPayment.payment_details?.is_verified && selectedPayment.payment_details?.original_payment_id && (
                                <button onClick={() => handleVerify(selectedPayment.payment_details.original_payment_id)} className="flex-1 h-12 bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all shadow-lg active:scale-95">Tasdiqlash</button>
                            )}
                            <button onClick={() => setShowDetailModal(false)} className="flex-1 h-12 bg-white/5 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-all border border-white/10">Yopish</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Kassa;
