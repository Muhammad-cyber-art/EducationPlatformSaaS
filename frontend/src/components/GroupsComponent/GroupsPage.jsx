import { useEffect, useState, useMemo } from"react";
import React from"react";
import { useNavigate, useOutletContext } from"react-router-dom";
import { useSelector, useDispatch } from"react-redux";
import { setSearchQuery, setTab } from"../../store/slices/mentorSlice";
import { useQuery } from"@tanstack/react-query";
import { useInView } from"react-intersection-observer";
import api from"../../tokenUpdater/updater";
import toast from"react-hot-toast";
import { Loader2, Plus } from"lucide-react";

import { useCurrentBranch } from"../Authorized/useBranchId";
import { get_user_info } from"../Authorized/getRole";

// Hooks
import { useGroupsData } from"./Groups/useGroupsData";

// Components
import GroupsHeader from"./Groups/GroupsHeader";
import GroupsTabs from"./Groups/GroupsTabs";
import GroupCard from"./Groups/GroupCard";
import GroupsEmptyState from"./Groups/GroupsEmptyState";
import GroupsTimetable from "./Groups/GroupsTimetable";
import { LayoutGrid, Calendar } from "lucide-react";

export default function GroupsListPage() {
 const { currentBranchId, currentBranchName, isLoading: branchLoading, hasAccess } = useCurrentBranch();
 const navigate = useNavigate();
 const { branchId: superAdminBranchId } = useOutletContext();
 const user_info = get_user_info();

 const dispatch = useDispatch();
 const searchTerm = useSelector(state => state.mentor.searchQuery);
 const activeTab = useSelector(state => state.mentor.activeTab);
 const [debouncedSearch, setDebouncedSearch] = useState("");
 const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'timetable'
 const { ref, inView } = useInView();

 const { data: userData = {} } = useQuery({
 queryKey: ['user-me'],
 queryFn: () => api.get('/user/me/').then(res => res.data),
 staleTime: Infinity,
 });

 const perms = userData.permissions || {};
 const isSuperAdmin = user_info?.role ==="super_admin";
 const isMentor = user_info?.role ==="mentor" || userData?.role ==="mentor";
 const canCreateGroup = (isSuperAdmin || perms.groups === true) && !isMentor;

 useEffect(() => {
 const searchTimer = setTimeout(() => {
 setDebouncedSearch(searchTerm);
 }, 500);
 return () => clearTimeout(searchTimer);
 }, [searchTerm]);

 const effectiveBranchId = user_info?.role ==="super_admin" ? superAdminBranchId : currentBranchId;
 const canFetch = user_info?.role ==="super_admin" ? !!superAdminBranchId : (!branchLoading && hasAccess);

 const {
 data,
 fetchNextPage,
 hasNextPage,
 isFetchingNextPage,
 isLoading,
 isFetching,
 isError,
 error
 } = useGroupsData(effectiveBranchId, debouncedSearch, canFetch);

 useEffect(() => {
 if (inView && hasNextPage && !isFetchingNextPage) {
 fetchNextPage();
 }
 }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

 useEffect(() => {
 if (isError) {
 toast.error(error?.message ||"Guruhlarni yuklashda xatolik yuz berdi!");
 }
 }, [isError, error]);

 const groupsArr = useMemo(() => {
 if (!data) return [];
 return data.pages.flatMap(page => page.results || []);
 }, [data]);

 const filteredData = useMemo(() => {
    const search = debouncedSearch?.toLowerCase().trim();
    
    return groupsArr.filter((group) => {
      // 1. Kunlar bo'yicha qat'iy filter
      if (activeTab !== "all") {
        // If group has no days, treat as "odd" (default)
        const groupDays = group.days || "odd";
        if (groupDays !== activeTab) return false;
      }

      // 2. Qidiruv bo'yicha qo'shimcha (kuchaytirilgan) filter
      if (search) {
        const name = (group.name || "").toLowerCase();
        const subject = (group.subject || "").toLowerCase();
        const mentor = (group.mentor?.full_name || group.mentor?.username || "").toLowerCase();
        
        // Agar qidiruv so'zi birorta ham muhim maydonda topilmasa - o'chirib tashlaymiz
        const matches = name.includes(search) || 
                        subject.includes(search) || 
                        mentor.includes(search);
        
        if (!matches) return false;
      }

      return true;
    });
  }, [groupsArr, activeTab, debouncedSearch]);

 return (
  <div className="px-3 sm:px-6 pt-3 pb-6 space-y-3.5">
    {/* Top Toolbar: Branch Info, Tabs, Mode Switcher, and Create Action */}
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 border-b border-[var(--border-glass)]">
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide py-0.5">
        <p className="text-xs text-[var(--text-secondary)] font-medium whitespace-nowrap shrink-0">
          {currentBranchName || 'Asosiy Boshqarma'} • {viewMode === "timetable" ? groupsArr.length : filteredData.length} ta guruh
        </p>
        <span className="w-1 h-1 rounded-full bg-[var(--text-muted)] opacity-30 shrink-0 hidden sm:inline-block"></span>
        {viewMode === "grid" ? (
          <GroupsTabs activeTab={activeTab} setTab={setTab} dispatch={dispatch} />
        ) : (
          <div className="flex items-center gap-1.5 text-[var(--gold)] h-9">
            <Calendar size={15} />
            <span className="text-xs font-bold uppercase tracking-wider">Haftalik Dars Jadvali</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
        {/* Rejim tanlagich: Kartochkalar vs Dars Jadvali */}
        <div className="flex items-center h-9 p-0.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-sm">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "grid"
                ? "bg-[var(--gold)] text-black shadow-sm font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <LayoutGrid size={13} />
            <span>Kartochkalar</span>
          </button>

          <button
            onClick={() => setViewMode("timetable")}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "timetable"
                ? "bg-[var(--gold)] text-black shadow-sm font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Calendar size={13} />
            <span>Dars Jadvali</span>
          </button>
        </div>

        {canCreateGroup && (
          <button
            onClick={() => navigate(`addgroup?branch=${currentBranchId}`)}
            className="lux-btn lux-btn-primary flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-semibold shadow-sm shrink-0"
          >
            <Plus size={15} />
            <span>Guruh yaratish</span>
          </button>
        )}
      </div>
    </div>

 <div className="min-h-[500px]">
 {isLoading && !groupsArr.length ? (
 <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-50">
 <Loader2 className="animate-spin text-[var(--gold)]" size={48} />
 <p className="text-[10px] font-black tracking-[0.3em] capitalize">Ma'lumotlar yuklanmoqda...</p>
 </div>
 ) : viewMode === "timetable" ? (
   <GroupsTimetable
     groups={groupsArr}
     currentBranchId={effectiveBranchId}
     readOnly={!canCreateGroup}
   />
 ) : filteredData.length > 0 ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-8">
 {filteredData.map((item) => (
 <GroupCard key={item.id} group={item} readOnly={!canCreateGroup} currentBranchId={effectiveBranchId} />
 ))}
 </div>
 ) : (
 <GroupsEmptyState currentBranchName={currentBranchName} />
 )}

 {viewMode === "grid" && (
   <div ref={ref} className="py-10 flex justify-center">
   {isFetchingNextPage && (
   <div className="flex items-center gap-2 text-[var(--gold)]">
   <Loader2 size={24} className="animate-spin" />
   <span className="text-[10px] font-black capitalize tracking-widest">Yana yuklanmoqda...</span>
   </div>
   )}
   </div>
 )}
 </div>

 {canCreateGroup && (
 <button
 onClick={() => navigate(`addgroup?branch=${currentBranchId}`)}
 className="lg:hidden fixed bottom-24 right-6 w-16 h-16 bg-[var(--gold)] text-black rounded-2xl shadow-[0_15px_40px_rgba(184,134,11,0.4)] flex items-center justify-center z-[110] active:scale-90 transition-transform"
 >
 <Plus size={28} />
 </button>
 )}
 </div>
 );
}