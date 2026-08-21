import React from"react";
import { Loader2, Search, Plus } from"lucide-react";

const GroupsHeader = ({
 currentBranchName,
 groupsCount,
 isLoading,
 isFetching,
 searchTerm,
 setSearchQuery,
 canCreateGroup,
 navigate,
 currentBranchId,
 dispatch
}) => {
 return (
 <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pb-8 border-b border-[var(--border-glass)]">
 <div>
 <h1 className="gold-text">O'quv Guruhlari</h1>
 <p className="text-[11px] text-[var(--text-secondary)] font-bold capitalize tracking-[0.3em] mt-3">
 {currentBranchName ||'Asosiy Boshqarma'} • {groupsCount} faol guruhlar
 </p>
 </div>

 <div className="flex flex-1 max-w-2xl items-center gap-4">
 <div className="relative flex-1 group">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]">
 {isLoading || isFetching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
 </div>
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => dispatch(setSearchQuery(e.target.value))}
 placeholder="Guruh yoki fan bo'yicha qidirish..."
 className="lux-input !pl-12 !py-4"
 />
 </div>

 {canCreateGroup && (
 <button
 onClick={() => navigate(`addgroup?branch=${currentBranchId}`)}
 className="lux-btn lux-btn-primary hidden sm:flex shrink-0 !px-8 !h-[54px]"
 >
 <Plus size={18} />
 <span>Guruh yaratish</span>
 </button>
 )}
 </div>
 </div>
 );
};

export default GroupsHeader;
