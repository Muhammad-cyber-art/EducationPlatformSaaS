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

export default function GroupsListPage() {
 const { currentBranchId, currentBranchName, isLoading: branchLoading, hasAccess } = useCurrentBranch();
 const navigate = useNavigate();
 const { branchId: superAdminBranchId } = useOutletContext();
 const user_info = get_user_info();

 const dispatch = useDispatch();
 const searchTerm = useSelector(state => state.mentor.searchQuery);
 const activeTab = useSelector(state => state.mentor.activeTab);
 const [debouncedSearch, setDebouncedSearch] = useState("");
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
 <div className="p-3 sm:p-6 space-y-10">
 <GroupsHeader
 {...{ currentBranchName, isLoading, isFetching, searchTerm, setSearchQuery, canCreateGroup, navigate, currentBranchId, dispatch }}
 groupsCount={filteredData.length}
 />

 <GroupsTabs {...{ activeTab, setTab, dispatch }} />

 <div className="min-h-[500px]">
 {isLoading && !filteredData.length ? (
 <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-50">
 <Loader2 className="animate-spin text-[var(--gold)]" size={48} />
 <p className="text-[10px] font-black tracking-[0.3em] capitalize">Ma'lumotlar yuklanmoqda...</p>
 </div>
 ) : filteredData.length > 0 ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-8">
 {filteredData.map((item) => (
 <GroupCard key={item.id} group={item} readOnly={!canCreateGroup} currentBranchId={effectiveBranchId} />
 ))}
 </div>
 ) : (
 <GroupsEmptyState currentBranchName={currentBranchName} />
 )}

 <div ref={ref} className="py-10 flex justify-center">
 {isFetchingNextPage && (
 <div className="flex items-center gap-2 text-[var(--gold)]">
 <Loader2 size={24} className="animate-spin" />
 <span className="text-[10px] font-black capitalize tracking-widest">Yana yuklanmoqda...</span>
 </div>
 )}
 </div>
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