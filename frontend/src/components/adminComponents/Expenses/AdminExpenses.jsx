import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../tokenUpdater/updater';
import { 
    Plus, Search, Calendar, DollarSign, Tag, Trash2, 
    X, Loader2, AlertCircle, FileText, ChevronRight, TrendingDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentBranch } from '../../Authorized/useBranchId';
import AmountInput from '../../Common/AmountInput';


const AdminExpenses = () => {
    const { currentBranchId, currentBranchName } = useCurrentBranch();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newExpense, setNewExpense] = useState({
        title: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        branch: currentBranchId
    });

    // Fetch Expenses
    const { data: expenses = [], isLoading, isError } = useQuery({
        queryKey: ['admin-expenses', currentBranchId],
        queryFn: async () => {
            const res = await api.get(`/finance/admin-expenses/?branch_id=${currentBranchId}`);
            // DRF paginated response returns data in 'results' field
            return res.data.results || res.data;
        },
        enabled: !!currentBranchId
    });

    // Create Expense Mutation
    const createMutation = useMutation({
        mutationFn: (data) => api.post('/finance/admin-expenses/', data),
        onSuccess: () => {
            queryClient.invalidateQueries(['admin-expenses']);
            toast.success("Xarajat muvaffaqiyatli saqlandi");
            setIsModalOpen(false);
            setNewExpense({
                title: '',
                amount: '',
                description: '',
                date: new Date().toISOString().split('T')[0],
                branch: currentBranchId
            });
        },
        onError: () => toast.error("Saqlashda xatolik yuz berdi")
    });

    // Delete Expense Mutation
    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/finance/admin-expenses/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries(['admin-expenses']);
            toast.success("O'chirildi");
        }
    });

    const filteredExpenses = useMemo(() => {
        return (Array.isArray(expenses) ? expenses : []).filter(exp => 
            exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            exp.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [expenses, searchTerm]);

    const totalAmount = useMemo(() => {
        return filteredExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    }, [filteredExpenses]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newExpense.title || !newExpense.amount || !newExpense.date) {
            return toast.error("Barcha maydonlarni to'ldiring");
        }
        createMutation.mutate({
            ...newExpense,
            branch: currentBranchId
        });
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-50">
            <Loader2 className="animate-spin text-[var(--gold)]" size={48} />
            <p className="text-[10px] font-black tracking-[0.3em] uppercase">Yuklanmoqda...</p>
        </div>
    );

    if (isError) return (
        <div className="flex flex-col items-center justify-center py-40 gap-6">
            <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500">
                <AlertCircle size={48} />
            </div>
            <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-white capitalize">Xatolik yuz berdi</h3>
                <p className="text-xs text-[var(--text-muted)] font-bold max-w-xs mx-auto">
                    Ma'lumotlarni yuklashda muammo yuzaga keldi. Iltimos, internet aloqasini tekshiring va qaytadan urunib ko'ring.
                </p>
            </div>
            <button 
                onClick={() => queryClient.invalidateQueries(['admin-expenses'])}
                className="px-8 py-3 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl text-[var(--gold)] font-black text-[10px] uppercase tracking-widest hover:bg-[var(--gold)] hover:text-black transition-all"
            >
                Qayta yuklash
            </button>
        </div>
    );

    return (
        <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-[var(--gold)] rounded-full" />
                        <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
                            Mayda Harajatlar
                        </h1>
                    </div>
                    <p className="text-[10px] sm:text-xs font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">
                        {currentBranchName} bo'yicha operatsion chiqimlar
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-3 px-6 py-3 bg-[var(--gold)] text-black rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-[0_10px_25px_rgba(184,134,11,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <Plus size={16} strokeWidth={3} />
                        Qo'shish
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="lux-card-static p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
                            <TrendingDown size={20} />
                        </div>
                        <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Jami Chiqim</span>
                    </div>
                    <p className="text-2xl font-black text-[var(--text-primary)]">
                        {totalAmount.toLocaleString()} <span className="text-[var(--gold)] text-xs ml-1">UZS</span>
                    </p>
                </div>
                
                <div className="lux-card-static p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
                            <Tag size={20} />
                        </div>
                        <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Soni</span>
                    </div>
                    <p className="text-2xl font-black text-[var(--text-primary)]">
                        {filteredExpenses.length} <span className="text-[var(--gold)] text-xs ml-1">ta</span>
                    </p>
                </div>

                <div className="lux-card-static p-6 space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <AlertCircle size={80} />
                    </div>
                    <div className="flex items-center gap-2 text-amber-500 mb-2">
                        <AlertCircle size={14} />
                        <span className="text-[8px] font-black uppercase tracking-widest">Eslatma</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold leading-relaxed">
                        Bu harajatlar asosiy kassa balansiga ta'sir qilmaydi va faqat ichki hisob uchun yuritiladi.
                    </p>
                </div>
            </div>

            {/* Filter and List Section */}
            <div className="space-y-6">
                <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors group-focus-within:text-[var(--gold)]" size={18} />
                    <input 
                        type="text" 
                        placeholder="Nomi yoki tavsifi bo'yicha qidirish..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[var(--border-glass)] rounded-2xl py-4 pl-16 pr-6 text-sm text-[var(--text-primary)] focus:border-[var(--gold)] outline-none transition-all placeholder:text-[var(--text-muted)]/50"
                    />
                </div>

                <div className="space-y-4">
                    {filteredExpenses.length > 0 ? (
                        filteredExpenses.map((expense) => (
                            <div key={expense.id} className="lux-card-static !p-0 overflow-hidden group hover:border-[var(--gold)]/30 transition-all">
                                <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--gold)]">
                                            <FileText size={20} />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors capitalize">
                                                {expense.title}
                                            </h3>
                                            <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar size={12} className="text-[var(--gold)]" />
                                                    {expense.date}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Loader2 size={12} className="text-[var(--gold)]" />
                                                    {expense.marked_by_name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-none pt-4 sm:pt-0">
                                        <div className="text-right">
                                            <p className="text-lg font-black text-[var(--text-primary)]">
                                                {parseFloat(expense.amount).toLocaleString()}
                                                <span className="text-[var(--gold)] text-[10px] ml-1.5 font-bold uppercase">UZS</span>
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if(window.confirm("Rostdan ham o'chirmoqchimisiz?")) {
                                                    deleteMutation.mutate(expense.id);
                                                }
                                            }}
                                            className="p-2.5 rounded-xl bg-red-500/5 text-red-500/40 hover:bg-red-500/10 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                {expense.description && (
                                    <div className="px-6 pb-6 pt-0">
                                        <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed bg-[var(--bg-void)]/30 p-4 rounded-xl border border-[var(--border-glass)]/50 italic">
                                            "{expense.description}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="lux-card-static py-20 flex flex-col items-center gap-4 opacity-50">
                            <AlertCircle size={40} className="text-[var(--text-muted)]" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                                Harajatlar topilmadi
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-[var(--border-glass)] flex items-center justify-between bg-gradient-to-r from-[var(--gold)]/5 to-transparent">
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-[var(--text-primary)]">Yangi Harajat</h2>
                                <p className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.2em]">Ma'lumotlarni kiriting</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-white/5 text-[var(--text-muted)] transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Nomi</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="Masalan: Kantselyariya, Suv..."
                                        className="w-full bg-[#0a0a0a] border border-[var(--border-glass)] rounded-2xl py-4 px-6 text-sm outline-none focus:border-[var(--gold)] transition-all"
                                        value={newExpense.title}
                                        onChange={(e) => setNewExpense({...newExpense, title: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Summa (UZS)</label>
                                        <AmountInput 
                                            required
                                            name="amount"
                                            placeholder="0"
                                            className="w-full bg-[#0a0a0a] border border-[var(--border-glass)] rounded-2xl py-4 px-6 text-sm outline-none focus:border-[var(--gold)] transition-all"
                                            value={newExpense.amount}
                                            onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Sana</label>
                                        <input 
                                            type="date" 
                                            required
                                            className="w-full bg-[#0a0a0a] border border-[var(--border-glass)] rounded-2xl py-4 px-6 text-sm outline-none focus:border-[var(--gold)] transition-all [color-scheme:dark]"
                                            value={newExpense.date}
                                            onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Tavsif (Ixtiyoriy)</label>
                                    <textarea 
                                        rows={3}
                                        placeholder="Batafsil ma'lumot..."
                                        className="w-full bg-[#0a0a0a] border border-[var(--border-glass)] rounded-2xl py-4 px-6 text-sm outline-none focus:border-[var(--gold)] transition-all resize-none"
                                        value={newExpense.description}
                                        onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={createMutation.isLoading}
                                className="w-full py-5 bg-[var(--gold)] text-black rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                            >
                                {createMutation.isLoading ? <Loader2 className="animate-spin" size={20} /> : "Saqlash"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminExpenses;
