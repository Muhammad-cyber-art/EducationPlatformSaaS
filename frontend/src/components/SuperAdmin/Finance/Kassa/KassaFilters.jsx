import React from "react";
import { Search, Calendar, CreditCard, Building2, BookOpen, ChevronRight, FilterX, PlusCircle, TrendingDown } from "lucide-react";

const KassaFilters = ({
    filters,
    setFilters,
    branches = [],
    groups = [],
    loadingGroups = false,
    clearFilters,
    setToday,
    activeTab,
    setActiveTab,
    paymentsCount,
    withdrawalsCount
}) => {
    const [localSearch, setLocalSearch] = React.useState(filters.search || "");

    React.useEffect(() => {
        setLocalSearch(filters.search || "");
    }, [filters.search]);

    React.useEffect(() => {
        const handler = setTimeout(() => {
            if (localSearch !== filters.search) {
                setFilters(prev => ({ ...prev, search: localSearch }));
            }
        }, 350);
        return () => clearTimeout(handler);
    }, [localSearch, filters.search, setFilters]);

    return (
    <>
        <div className="flex flex-col lg:flex-row gap-4 p-4 bg-[var(--bg-panel)]/30 border border-[var(--border-glass)] rounded-2xl backdrop-blur-md">
            <div className="flex-1 relative group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors pointer-events-none" size={18} strokeWidth={2.2} />
                <input
                    type="text"
                    placeholder="Qidiruv (Ism, tel, guruh)..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="w-full h-12 bg-[var(--input-bg)] border border-[var(--border-glass)] rounded-xl pl-4 pr-12 text-[13px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold)]/50 transition-all"
                />
            </div>

            <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                {/* 1. Month Picker */}
                <div className="relative min-w-[140px] flex-1 md:flex-none">
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--gold)] opacity-70 pointer-events-none" size={17} strokeWidth={2.2} />
                    <input
                        type="month"
                        value={filters.month}
                        onChange={(e) => setFilters(prev => ({ ...prev, month: e.target.value }))}
                        className="w-full h-12 bg-[var(--input-bg)] border border-[var(--border-glass)] rounded-xl pl-4 pr-10 text-[12px] font-black text-[var(--gold)] outline-none focus:border-[var(--gold)]/50 transition-all [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                </div>

                {/* 2. Branch Selector */}
                <div className="relative min-w-[150px] flex-1 md:flex-none">
                    <select
                        value={filters.branch}
                        onChange={(e) => {
                            const newBranch = e.target.value;
                            setFilters(prev => ({ ...prev, branch: newBranch, group: "" }));
                        }}
                        className="w-full h-12 bg-[var(--input-bg)] border border-[var(--border-glass)] rounded-xl pl-4 pr-12 text-[11px] font-black text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">Barcha Filiallar</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id} className="bg-[var(--bg-panel)] text-[var(--text-primary)]">{b.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[var(--gold)] opacity-80 pointer-events-none">
                        <Building2 size={16} strokeWidth={2.2} />
                        <ChevronRight size={14} className="rotate-90 opacity-80" strokeWidth={2.5} />
                    </div>
                </div>

                {/* 3. Group Selector (Filial tanlangandan so'ng faollashadi) */}
                <div className="relative min-w-[160px] flex-1 md:flex-none">
                    <select
                        value={filters.group || ""}
                        onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value }))}
                        disabled={!filters.branch}
                        className={`w-full h-12 bg-[var(--input-bg)] border border-[var(--border-glass)] rounded-xl pl-4 pr-12 text-[11px] font-black text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-all appearance-none cursor-pointer ${
                            !filters.branch ? 'opacity-40 cursor-not-allowed text-[var(--text-muted)]' : ''
                        }`}
                        title={!filters.branch ? "Guruh bo'yicha filtrlash uchun avval filialni tanlang" : "Guruhni tanlang"}
                    >
                        <option value="" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">
                            {!filters.branch
                                ? "Guruh (Filial tanlang)"
                                : loadingGroups
                                    ? "Guruhlar yuklanmoqda..."
                                    : groups.length === 0
                                        ? "Guruhlar yo'q"
                                        : "Barcha Guruhlar"}
                        </option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id} className="bg-[var(--bg-panel)] text-[var(--text-primary)]">
                                {g.name}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[var(--gold)] opacity-80 pointer-events-none">
                        <BookOpen size={16} strokeWidth={2.2} />
                        <ChevronRight size={14} className="rotate-90 opacity-80" strokeWidth={2.5} />
                    </div>
                </div>

                {/* 4. Payment Method Selector */}
                <div className="relative min-w-[140px] flex-1 md:flex-none">
                    <select
                        value={filters.method}
                        onChange={(e) => setFilters(prev => ({ ...prev, method: e.target.value }))}
                        className="w-full h-12 bg-[var(--input-bg)] border border-[var(--border-glass)] rounded-xl pl-4 pr-12 text-[11px] font-black text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-all appearance-none cursor-pointer"
                    >
                        <option value="" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">Barcha Metodlar</option>
                        <option value="cash" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">Naqd (Cash)</option>
                        <option value="click" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">Click / Karta</option>
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[var(--gold)] opacity-80 pointer-events-none">
                        <CreditCard size={16} strokeWidth={2.2} />
                        <ChevronRight size={14} className="rotate-90 opacity-80" strokeWidth={2.5} />
                    </div>
                </div>

                {/* 5. Clear Filters Button */}
                {(filters.search || filters.branch || filters.group || filters.method) && (
                    <button
                        onClick={clearFilters}
                        className="w-12 h-12 flex items-center justify-center bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg cursor-pointer shrink-0"
                        title="Filtrlarni tozalash (Barchasi)"
                    >
                        <FilterX size={20} strokeWidth={2.2} />
                    </button>
                )}

                {/* 6. Today / Current Month Button */}
                <button
                    onClick={setToday}
                    className={`px-4 h-12 flex items-center justify-center border rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer shrink-0 ${filters.month === new Date().toISOString().slice(0, 7) ? 'bg-[var(--gold)] text-white border-[var(--gold)] shadow-sm' : 'bg-[var(--bg-panel)] text-[var(--gold)] border-[var(--border-glass)] hover:border-[var(--gold)]/50'}`}
                >
                    Joriy Oy
                </button>
            </div>
        </div>

        <div className="flex items-center gap-2 p-1.5 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl w-full sm:w-fit overflow-x-auto no-scrollbar">
            <button
                onClick={() => setActiveTab("incomes")}
                className={`flex-1 sm:flex-none whitespace-nowrap px-6 xl:px-10 py-3 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'incomes' ? 'bg-[var(--gold)] text-white shadow-lg scale-100 z-10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--gold-dim)]'}`}
            >
                <PlusCircle size={16} strokeWidth={2.2} />
                Tushumlar <span className="opacity-75 text-[10px]">({paymentsCount})</span>
            </button>
            <button
                onClick={() => setActiveTab("expenses")}
                className={`flex-1 sm:flex-none whitespace-nowrap px-6 xl:px-10 py-3 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${activeTab === 'expenses' ? 'bg-red-600 text-white shadow-lg scale-100 z-10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--gold-dim)]'}`}
            >
                <TrendingDown size={16} strokeWidth={2.2} />
                Chiqimlar <span className="opacity-75 text-[10px]">({withdrawalsCount})</span>
            </button>
        </div>
    </>
    );
};

export default KassaFilters;
