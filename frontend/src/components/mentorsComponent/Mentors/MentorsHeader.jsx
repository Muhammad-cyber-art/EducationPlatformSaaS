import React from"react";
import GoBackButton from"../../sendback";
import { Loader2, Search, UserPlus, LayoutGrid, List } from"lucide-react";

const MentorsHeader = ({
 currentBranchName,
 mentorsCount,
 isLoading,
 isFetching,
 searchTerm,
 setSearchQuery,
 canCreateMentor,
 navigate,
 effectiveBranchId,
 viewMode,
 setViewMode,
 dispatch
}) => {
 return (
 <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 pb-10 border-b border-[var(--border-glass)] relative">
 <div className="space-y-3">
 <div className="flex items-center gap-3">
 <GoBackButton />
 <div className="px-3 py-1 bg-[var(--gold-dim)] rounded-full border border-[var(--gold)]/20">
 <span className="text-[10px] font-black text-[var(--gold)] tracking-[0.2em] capitalize">Faqat rasmiy xodimlar</span>
 </div>
 </div>
 <h1 className="gold-text !text-2xl sm:!text-4xl">O'qituvchilar Tarkibi</h1>
 <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] font-bold capitalize tracking-[0.3em] sm:tracking-[0.4em] flex items-center gap-2 sm:gap-3">
 {currentBranchName ||'Boshqaruv bo\'limi'} <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] opacity-30"></span> {mentorsCount} FAOL O'QITUVCHILAR
 </p>
 </div>

 <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 max-w-2xl lg:pr-32">
 <div className="relative flex-1 group w-full">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]">
 {isLoading || isFetching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
 </div>
 <input
 value={searchTerm}
 onChange={(e) => dispatch(setSearchQuery(e.target.value))}
 placeholder="Qidirish..."
 className="lux-input !pl-12 sm:!pl-14 !py-4 sm:!py-5 shadow-2xl"
 />
 </div>

 <div className="flex items-center gap-2 w-full sm:w-auto">
 {canCreateMentor && (
 <button
 onClick={() => navigate(`add-mentor?branch=${effectiveBranchId}`)}
 className="lux-btn lux-btn-primary !px-6 sm:!px-10 !h-[48px] sm:!h-[58px] flex-1 sm:flex-none shadow-xl"
 >
 <UserPlus size={18} />
 <span>Qo'shish</span>
 </button>
 )}
 </div>
 </div>

 {/* View Toggle Buttons */}
 <div className="absolute top-0 right-0 h-fit bg-[var(--bg-panel)] p-1 rounded-xl border border-[var(--border-glass)] flex gap-1 shadow-lg z-10 transition-transform">
 <button
 onClick={() => setViewMode('grid')}
 className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${viewMode ==='grid' ?'bg-[var(--gold)] text-black' :'text-[var(--text-muted)] hover:text-[var(--gold)]'}`}
 title="Grid View"
 >
 <LayoutGrid size={14} className="sm:w-4 sm:h-4" />
 </button>
 <button
 onClick={() => setViewMode('list')}
 className={`p-1.5 sm:p-2.5 rounded-lg transition-all ${viewMode ==='list' ?'bg-[var(--gold)] text-black' :'text-[var(--text-muted)] hover:text-[var(--gold)]'}`}
 title="List View"
 >
 <List size={14} className="sm:w-4 sm:h-4" />
 </button>
 </div>
 </div>
 );
};

export default MentorsHeader;
