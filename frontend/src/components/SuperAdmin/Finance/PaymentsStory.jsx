import React, { useState, useMemo, useEffect } from 'react';
import {
    ArrowLeft, Search, Filter, Calendar,
    User, CheckCircle2, ChevronRight,
    ArrowDownLeft, ArrowUpRight,
    Wallet, DollarSign, PieChart, Database,
    MapPin, Loader2, X, Trash2, RefreshCw,
    ShieldCheck, Zap, Globe, Circle, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import api from '../../../tokenUpdater/updater';
import { get_user_info } from '../../Authorized/getRole';
import toast from 'react-hot-toast';
import ThemeToggle from '../../ThemeToggle';

const PaymentsStory = () => {
    const navigate = useNavigate();
    const user = get_user_info();

    const [filters, setFilters] = useState({
        search: "",
        type: "",
        category: "",
        branch: "",
        startDate: "",
        endDate: ""
    });
    const [debouncedFilters, setDebouncedFilters] = useState(filters);
    const [showFilters, setShowFilters] = useState(false);
    const [selectedTrx, setSelectedTrx] = useState(null);

    // ✅ DEBOUNCE LOGIC: Qotishni oldini olish uchun
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedFilters(filters);
        }, 500);
        return () => clearTimeout(timer);
    }, [filters]);

    const { ref, inView } = useInView();

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isFetching,
        refetch
    } = useInfiniteQuery({
        queryKey: ['finance-transactions', debouncedFilters],
        queryFn: async ({ pageParam = 1 }) => {
            const params = new URLSearchParams();
            params.append('page', pageParam);
            if (debouncedFilters.search) params.append('search', debouncedFilters.search);
            if (debouncedFilters.type) params.append('transaction_type', debouncedFilters.type);
            if (debouncedFilters.category) params.append('category', debouncedFilters.category);
            if (debouncedFilters.branch) params.append('branch', debouncedFilters.branch);
            if (debouncedFilters.startDate) params.append('date__gte', debouncedFilters.startDate);
            if (debouncedFilters.endDate) params.append('date__lte', debouncedFilters.endDate);

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

    // ✅ Auto-load next page on scroll
    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [inView, hasNextPage, isFetchingNextPage]);

    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: async () => {
            const res = await api.get('/add_branch/branches/');
            return res.data;
        }
    });

    const transactions = useMemo(() => {
        const all = data?.pages.flatMap(page => page.results) || [];
        return all.filter(trx => !trx.title?.startsWith('Bekor qilindi:') && trx.record_type !== 'reversal');
    }, [data]);

    const stats = useMemo(() => {
        // ✅ Backenddan kelgan umumiy statistikadan foydalanamiz (Oxirgi olingan page dan)
        const latestPage = data?.pages[0];
        if (!latestPage?.stats) return { income: 0, expense: 0, net: 0 };
        return latestPage.stats;
    }, [data]);

    const formatCurrency = (amount) => {
        return Math.floor(amount).toLocaleString() + " UZS";
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const resetFilters = () => {
        setFilters({ search: "", type: "", category: "", branch: "", startDate: "", endDate: "" });
    };

    const handleDeleteTransaction = async (id) => {
        if (user.role !== 'super_admin' && user.role !== 'admin') return toast.error("Ruxsat yo'q");
        if (!window.confirm("Ushbu tranzaksiyani butkul o'chirmoqchimisiz?")) return;

        try {
            await api.delete(`/finance/transactions/${id}/`);
            toast.success("Tranzaksiya o'chirildi");
            refetch();
        } catch (error) {
            toast.error("O'chirishda xatolik");
        }
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Atmosphere Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
            </div>

            {/* HEADER SECTION */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-6 border-b border-[#2a2a2a]">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate(-1)} className="p-3 bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-xl text-[var(--gold)] hover:scale-110 transition-all shadow-inner"><ArrowLeft size={20} /></button>
                    <div>
                        <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter capitalize mb-2 flex items-center gap-4">
                            Moliya Tarixi
                            {isFetching && <Loader2 className="animate-spin text-[var(--gold)]/30" size={20} />}
                        </h1>
                        <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-[0.4em] flex items-center gap-3">
                            <ShieldCheck size={12} className="text-[var(--gold)]" /> Tasdiqlangan Tranzaksiyalar Tarixi
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="QIDIRISH..."
                            className="lux-input !pl-12 !w-full lg:!w-80 !bg-[var(--bg-void)]/40 !border-[#2a2a2a] hover:!border-[var(--gold)]/30 focus:!border-[var(--gold)]/50 transition-all placeholder:text-[9px] placeholder:tracking-[0.2em] placeholder:capitalize placeholder:text-[var(--text-muted)]/50"
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-4 border rounded-xl transition-all flex items-center justify-center shadow-inner ${showFilters ? 'bg-[var(--gold)] border-transparent text-black' : 'bg-[var(--bg-panel)]/40 border-[#2a2a2a] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/30'}`}
                    >
                        <Filter size={20} />
                    </button>
                    <button
                        onClick={() => refetch()}
                        className="p-4 bg-[var(--bg-panel)]/40 border border-[#2a2a2a] rounded-xl text-[var(--text-muted)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all active:rotate-180 duration-500"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <ThemeToggle />
                </div>
            </div>

            {/* EXPANDABLE FILTER BAR */}
            {showFilters && (
                <div className="lux-card !bg-[var(--bg-void)]/80 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-in slide-in-from-top-4 duration-500">
                    <FilterSelect
                        label="Tranzaksiya Turi"
                        value={filters.type}
                        onChange={(v) => handleFilterChange('type', v)}
                        options={[
                            { label: 'Barcha Operatsiyalar', value: '' },
                            { label: 'Kirim', value: 'income' },
                            { label: 'Chiqim', value: 'expense' },
                        ]}
                    />
                    <FilterSelect
                        label="Kategoriya"
                        value={filters.category}
                        onChange={(v) => handleFilterChange('category', v)}
                        options={[
                            { label: 'Barcha Yo\'nalishlar', value: '' },
                            { label: 'Talaba To\'lovi', value: 'student_fee' },
                            { label: 'Xodimlar Maoshi', value: 'salary' },
                            { label: 'Kommunal', value: 'utility' },
                            { label: 'Ijara', value: 'rent' },
                            { label: 'Boshqa', value: 'other' },
                        ]}
                    />
                    {user.role === 'super_admin' && (
                        <FilterSelect
                            label="Regional Node"
                            value={filters.branch}
                            onChange={(v) => handleFilterChange('branch', v)}
                            options={[
                                { label: 'Global Registry', value: '' },
                                ...(branches?.map(b => ({ label: b.name, value: b.id })) || [])
                            ]}
                        />
                    )}
                    <div className="space-y-2">
                        <label className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1 group-hover:text-[var(--gold)] transition-colors">Boshlanish Sanasi</label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => handleFilterChange('startDate', e.target.value)}
                            className="w-full bg-[var(--bg-void)]/40 border border-[#2a2a2a] rounded-xl px-4 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Tugash Sanasi</label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => handleFilterChange('endDate', e.target.value)}
                            className="w-full bg-[var(--bg-void)]/40 border border-[#2a2a2a] rounded-xl px-4 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-all"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={resetFilters}
                            className="w-full h-10 bg-red-500/5 hover:bg-red-500/10 text-red-500 border border-red-500/10 rounded-xl text-[9px] font-black capitalize tracking-widest transition-all"
                        >
                            Tozalash
                        </button>
                    </div>
                </div>
            )}

            {/* TRANSACTION LIST */}
            <div className="rounded-2xl bg-[var(--bg-panel)] shadow-sm overflow-hidden" style={{ border: '1px solid var(--border-glass)' }}>
                {/* TABLE HEADER */}
                <div className="px-6 py-4 hidden md:grid grid-cols-[40px_1fr_120px_140px_140px_40px] gap-6 items-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest bg-[var(--bg-void)]/40" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <div className="text-center">#</div>
                    <div>Tafsilotlar</div>
                    <div>Filial</div>
                    <div>Xodim & Sana</div>
                    <div className="text-right">Summa</div>
                    <div></div>
                </div>

                {isLoading ? (
                    <div className="py-40 flex flex-col items-center justify-center gap-6">
                        <Loader2 className="animate-spin text-[var(--gold)]" size={48} />
                        <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em]">Accessing Ledger Data...</p>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center text-[var(--text-muted)] opacity-50">
                        <Database size={48} className="mb-6 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Tarix topilmadi.</p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {transactions.map((trx, index) => (
                            <TransactionRow
                                key={trx.id || index}
                                trx={trx}
                                isLast={index === transactions.length - 1}
                                formatCurrency={formatCurrency}
                                onDelete={() => handleDeleteTransaction(trx.id)}
                                onClick={(t) => setSelectedTrx(t)}
                                isSuperAdmin={user.role === 'super_admin' || user.role === 'admin'}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* PAGINATION / SCROLL ANCHOR */}
            <div ref={ref} className="mt-16 flex flex-col items-center justify-center gap-4">
                {hasNextPage && (
                    <div className="py-8">
                        <Loader2 className="animate-spin text-[var(--gold)]/30" size={32} />
                    </div>
                )}
                {!hasNextPage && transactions.length > 0 && (
                    <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em] opacity-20">
                        History sync complete. All nodes reached.
                    </p>
                )}
            </div>

            <TransactionModal
                trx={selectedTrx}
                onClose={() => setSelectedTrx(null)}
                formatCurrency={formatCurrency}
                onDelete={() => handleDeleteTransaction(selectedTrx?.id)}
                isSuperAdmin={user.role === 'super_admin' || user.role === 'admin'}
            />
        </div>
    );
};

const FinanceStat = ({ label, value, color, icon, trend, isMain }) => {
    const colors = {
        emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.03]",
        rose: "text-rose-400 border-rose-500/20 bg-rose-500/[0.03]",
        gold: "text-[var(--gold)] border-[var(--gold)]/20 bg-[var(--gold-dim)] shadow-[var(--gold-glow-soft)]"
    };

    return (
        <div className={`lux-card !p-6 flex flex-col justify-between group overflow-hidden relative ${colors[color]}`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />
            <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-[var(--bg-void)]/40 rounded-2xl border border-[#2a2a2a] shadow-inner group-hover:scale-110 transition-transform duration-500">
                    {icon}
                </div>
                {trend && (
                    <div className="px-3 py-1 bg-[var(--bg-void)]/40 border border-[#2a2a2a] rounded-full text-[10px] font-black shadow-inner">
                        {trend}
                    </div>
                )}
            </div>
            <div>
                <p className="text-[10px] font-black capitalize tracking-[0.2em] mb-2 opacity-60">{label}</p>
                <p className={`text-2xl font-black tracking-tighter tabular-nums ${isMain ? 'text-[var(--text-primary)]' : ''}`}>{value}</p>
            </div>
        </div>
    );
};

const TransactionRow = React.memo(({ trx, formatCurrency, onDelete, onClick, isSuperAdmin, isLast }) => {
    const isIncome = trx.transaction_type === 'income';
    const isCancelled = trx.status === 'cancelled';

    // Refund ma'lumotini tekshirish
    const hasRefund = trx.description?.includes('Refund') || trx.description?.includes('refund');
    const refundMatch = trx.description?.match(/Refund:\s*([\d,]+)\s*UZS/);
    const refundAmount = refundMatch ? refundMatch[1] : null;

    // Backenddagi eski yozuvlar (To'lov, Qo'shimcha to'lov kabi) ni olib tashlash
    const cleanTitle = trx.title?.replace(/^(To'lov:\s*|Qo'shimcha to'lov:\s*|Chiqim \(Portal\):\s*)/i, '') || trx.title;

    return (
        <div
            className="p-4 md:px-6 md:py-3 group/row hover:bg-[var(--bg-void)]/30 transition-colors cursor-pointer md:cursor-default"
            onClick={() => window.innerWidth < 768 && onClick(trx)}
            style={{ borderBottom: isLast ? 'none' : 'var(--border-glass)' }}
        >
            {/* MOBILE LAYOUT */}
            <div className="flex md:hidden items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] tracking-tight truncate">{cleanTitle}</h4>
                        <div className="flex items-center gap-2 mt-0.5 opacity-70">
                            <span className="text-[10px] font-medium text-[var(--text-muted)]">{new Date(trx.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' })}</span>
                            <span className="w-1 h-1 rounded-full bg-[var(--border-glass)]"></span>
                            <span className="text-[10px] font-medium text-[var(--text-muted)]">{trx.category_display}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className={`text-sm font-black tabular-nums tracking-tight ${isCancelled ? 'text-amber-500' : (isIncome ? 'text-emerald-500' : 'text-rose-500')}`}>
                            {isIncome ? '+' : '-'}{formatCurrency(trx.amount)}
                        </p>
                    </div>
                    <div className="text-[var(--text-muted)] group-hover/row:text-[var(--gold)] transition-colors">
                        <ChevronRight size={16} />
                    </div>
                </div>
            </div>

            {/* DESKTOP LAYOUT (Table Row) */}
            <div className="hidden md:grid grid-cols-[40px_1fr_120px_140px_140px_40px] gap-6 items-center">
                {/* 1. Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover/row:scale-110 ${isCancelled ? 'bg-amber-500/10 text-amber-500' : (isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500')}`}>
                    {isIncome ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                </div>

                {/* 2. Title & Details */}
                <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm font-bold text-[var(--text-primary)] tracking-tight truncate group-hover/row:text-[var(--gold)] transition-colors">{cleanTitle}</h4>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isCancelled ? 'bg-amber-500/10 text-amber-500' : (isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500')}`}>
                            {trx.category_display}
                        </span>
                        {hasRefund && refundAmount && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
                                Refund: -{refundAmount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-[var(--text-muted)] font-medium truncate">
                            {trx.description}
                        </p>
                        <span className="text-[10px] font-bold text-[var(--gold)] opacity-70 whitespace-nowrap">#{trx.id?.toString().slice(-6)}</span>
                    </div>
                </div>

                {/* 3. Branch */}
                <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] opacity-90 uppercase truncate block">{trx.branch_name || "MARKAZIY"}</span>
                </div>

                {/* 4. User & Date */}
                <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] opacity-90 truncate block">{trx.marked_by_name || "Tizim"}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-medium tabular-nums">{new Date(trx.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>

                {/* 5. Amount */}
                <div className="text-right">
                    <p className={`text-base font-black tabular-nums tracking-tight ${isCancelled ? 'text-amber-500 line-through opacity-80' : (isIncome ? 'text-emerald-500' : 'text-rose-500')}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(trx.amount)}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
                        {new Date(trx.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>

                {/* 6. Actions */}
                <div className="flex justify-end">
                    {isSuperAdmin && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            className="p-2 text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-500 rounded-lg transition-colors"
                            title="O'chirish"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

const FilterSelect = ({ label, value, onChange, options }) => (
    <div className="space-y-2 group">
        <label className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1 group-hover:text-[var(--gold)] transition-colors">{label}</label>
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-[var(--bg-void)]/40 border border-[#2a2a2a] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest px-4 py-3 rounded-xl outline-none hover:border-[var(--gold)]/30 focus:border-[var(--gold)]/50 appearance-none transition-all cursor-pointer shadow-inner"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[var(--bg-panel)]">{opt.label}</option>
                ))}
            </select>
            <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] rotate-90 pointer-events-none group-focus-within:text-[var(--gold)] transition-colors shadow-inner" />
        </div>
    </div>
);

const TransactionModal = ({ trx, formatCurrency, onClose, onDelete, isSuperAdmin }) => {
    if (!trx) return null;
    const isIncome = trx.transaction_type === 'income';
    const hasRefund = trx.description?.includes('Refund') || trx.description?.includes('refund');
    const refundMatch = trx.description?.match(/Refund:\s*([\d,]+)\s*UZS/);
    const refundAmount = refundMatch ? refundMatch[1] : null;
    const cleanTitle = trx.title?.replace(/^(To'lov:\s*|Qo'shimcha to'lov:\s*|Chiqim \(Portal\):\s*)/i, '') || trx.title;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="lux-card !bg-[#0f0f13] w-full max-w-md p-6 md:rounded-2xl rounded-t-3xl rounded-b-none relative animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden"></div>

                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0 ${isIncome ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
                            {isIncome ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white">{cleanTitle}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black capitalize tracking-widest ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {trx.category_display}
                                </span>
                                <span className="text-[10px] font-bold text-white/50">HEX:#{trx.id?.toString().slice(-6)}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/50 hover:text-white bg-white/5 rounded-full transition-colors hidden md:block">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-6 mb-8">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                        <div>
                            <p className="text-[10px] font-black text-[var(--gold)] opacity-70 tracking-widest uppercase mb-1">Summa</p>
                            <p className={`text-2xl font-black tabular-nums tracking-tighter ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isIncome ? '+' : '-'}{formatCurrency(trx.amount)}
                            </p>
                            {hasRefund && refundAmount && (
                                <p className="text-xs font-bold text-emerald-400 mt-1">Refund: -{refundAmount} UZS</p>
                            )}
                        </div>
                        <div className="h-px w-full bg-white/10"></div>
                        <div>
                            <p className="text-[10px] font-black text-[var(--gold)] opacity-70 tracking-widest uppercase mb-1">Tafsilotlar</p>
                            <p className="text-sm text-white/90 leading-relaxed font-medium">{trx.description}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-white/40 tracking-widest uppercase mb-1 flex items-center gap-1.5"><MapPin size={10} /> Filial</p>
                            <p className="text-xs font-bold text-white/90 uppercase">{trx.branch_name || "MARKAZIY FILIAL"}</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-white/40 tracking-widest uppercase mb-1 flex items-center gap-1.5"><User size={10} /> Qabul qildi</p>
                            <p className="text-xs font-bold text-white/90">{trx.marked_by_name || "Tizim"}</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-white/40 tracking-widest uppercase mb-1 flex items-center gap-1.5"><Calendar size={10} /> Sana</p>
                            <p className="text-xs font-bold text-white/90 tabular-nums">{new Date(trx.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-black text-white/40 tracking-widest uppercase mb-1 flex items-center gap-1.5"><Activity size={10} /> Vaqt</p>
                            <p className="text-xs font-bold text-white/90 tabular-nums">{new Date(trx.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>
                </div>

                {isSuperAdmin && (
                    <button
                        onClick={() => {
                            onClose();
                            onDelete();
                        }}
                        className="w-full py-4 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 rounded-xl transition-all font-black tracking-widest uppercase text-xs flex items-center justify-center gap-2 shadow-inner"
                    >
                        <Trash2 size={16} /> O'chirish
                    </button>
                )}
            </div>
        </div>
    );
};

export default PaymentsStory;