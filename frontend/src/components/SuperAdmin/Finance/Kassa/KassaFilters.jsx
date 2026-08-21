import React from "react";
import { Search, Calendar, CreditCard, Building2, ChevronRight, FilterX, PlusCircle, TrendingDown } from "lucide-react";

const KassaFilters = ({ filters, setFilters, branches, clearFilters, setToday, activeTab, setActiveTab, paymentsCount, withdrawalsCount }) => (
    <>
        <div className="flex flex-col lg:flex-row gap-4 p-4 bg-[var(--bg-panel)]/30 border border-[#333] rounded-2xl backdrop-blur-md">
            <div className="flex-1 relative group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors pointer-events-none" size={16} />
                <input
                    type="text"
                    placeholder="Qidiruv (Ism, tel, guruh)..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full h-12 bg-[#0a0a0a] border border-[#333] rounded-xl pl-4 pr-12 text-[13px] font-bold text-white placeholder:text-gray-600 outline-none focus:border-[var(--gold)]/50 transition-all"
                />
            </div>

            <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                <div className="relative min-w-[140px] flex-1 md:flex-none">
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--gold)] opacity-50 pointer-events-none" size={14} />
                    <input
                        type="month"
                        value={filters.month}
                        onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value }))}
                        className="w-full h-12 bg-[#0a0a0a] border border-[#333] rounded-xl pl-4 pr-10 text-[12px] font-black text-[var(--gold)] outline-none focus:border-[var(--gold)]/50 transition-all [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                </div>

                <div className="relative min-w-[150px] flex-1 md:flex-none">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)] opacity-50 pointer-events-none" size={14} />
                    <select
                        value={filters.branch}
                        onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
                        className="w-full h-12 bg-[#0a0a0a] border border-[#333] rounded-xl pl-10 pr-8 text-[11px] font-black text-white outline-none focus:border-[var(--gold)]/50 transition-all appearance-none cursor-pointer"
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
                        onChange={(e) => setFilters(prev => ({ ...prev, method: e.target.value }))}
                        className="w-full h-12 bg-[#0a0a0a] border border-[#333] rounded-xl pl-10 pr-8 text-[11px] font-black text-white outline-none focus:border-[var(--gold)]/50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="" className="bg-[#0a0a0a]">Metodlar</option>
                        <option value="cash" className="bg-[#0a0a0a]">Naqd (Cash)</option>
                        <option value="click" className="bg-[#0a0a0a]">Click / Karta</option>
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[var(--gold)] opacity-30 pointer-events-none" size={12} />
                </div>

                {(filters.search || filters.branch || filters.method) && (
                    <button
                        onClick={clearFilters}
                        className="w-12 h-12 flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg"
                        title="Filtrlarni tozalash (Oyga qaytish)"
                    >
                        <FilterX size={18} />
                    </button>
                )}

                <button
                    onClick={setToday}
                    className={`px-4 h-12 flex items-center justify-center border rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${filters.month === new Date().toISOString().slice(0, 7) ? 'bg-[var(--gold)] text-black border-[var(--gold)]' : 'bg-[var(--bg-panel)] text-[var(--gold)] border-[#333] hover:border-[var(--gold)]/50'}`}
                >
                    Joriy Oy
                </button>
            </div>
        </div>

        <div className="flex items-center gap-2 p-1.5 bg-[var(--bg-panel)] border border-[#333] rounded-xl w-full sm:w-fit overflow-x-auto no-scrollbar">
            <button
                onClick={() => setActiveTab("incomes")}
                className={`flex-1 sm:flex-none whitespace-nowrap px-6 xl:px-10 py-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'incomes' ? 'bg-[var(--gold)] text-black shadow-lg scale-100 z-10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--gold-dim)]'}`}
            >
                <PlusCircle size={14} />
                Tushumlar <span className="opacity-50 text-[8px]">({paymentsCount})</span>
            </button>
            <button
                onClick={() => setActiveTab("expenses")}
                className={`flex-1 sm:flex-none whitespace-nowrap px-6 xl:px-10 py-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'expenses' ? 'bg-red-600 text-white shadow-lg scale-100 z-10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--gold-dim)]'}`}
            >
                <TrendingDown size={14} />
                Chiqimlar <span className="opacity-50 text-[8px]">({withdrawalsCount})</span>
            </button>
        </div>
    </>
);

export default KassaFilters;
