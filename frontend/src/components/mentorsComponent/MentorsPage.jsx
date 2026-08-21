import { useOutletContext, useNavigate } from"react-router-dom";
import { useSelector, useDispatch } from"react-redux";
import { setSearchQuery } from"../../store/slices/mentorSlice";
import { useEffect, useState, useMemo } from"react";
import React from"react";
import toast from"react-hot-toast";
import { useQuery } from"@tanstack/react-query";
import { useInView } from"react-intersection-observer";
import api from"../../tokenUpdater/updater";
import { Loader2, UserPlus } from"lucide-react";

import { useCurrentBranch } from"../Authorized/useBranchId";
import { get_user_info } from"../Authorized/getRole";

// Hooks
import { useMentorsData } from"./Mentors/useMentorsData";

// Components
import MentorsHeader from"./Mentors/MentorsHeader";
import MentorCard from"./Mentors/MentorCard";
import MentorsEmptyState from"./Mentors/MentorsEmptyState";

export default function MentorsPage() {
 const { currentBranchName, currentBranchId, isLoading: branchLoading, hasAccess } = useCurrentBranch();
 const navigate = useNavigate();
 const { branchId: superAdminBranchId } = useOutletContext();
 const user_info = get_user_info();

 const dispatch = useDispatch();
 const searchTerm = useSelector(state => state.mentor.searchQuery);
 const [debouncedSearch, setDebouncedSearch] = useState("");
 const [viewMode, setViewMode] = useState("list"); // grid or list
 const { ref, inView } = useInView();

 const { data: userData = {} } = useQuery({
 queryKey: ['user-me'],
 queryFn: () => api.get('/user/me/').then(res => res.data),
 staleTime: Infinity,
 });

 const perms = userData.permissions || {};
 const userRole = (userData.role || user_info?.role ||"").toLowerCase();
 const isSuperAdmin = userRole ==="super_admin";
 const canCreateMentor = (isSuperAdmin || perms.teachers === true) && userRole !=="mentor";

 useEffect(() => {
 const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500);
 return () => clearTimeout(handler);
 }, [searchTerm]);

 const effectiveBranchId = userRole ==="super_admin" ? superAdminBranchId : currentBranchId;
 const canFetch = userRole ==="super_admin" ? !!effectiveBranchId : (!branchLoading && hasAccess && !!effectiveBranchId);

 const {
 data,
 fetchNextPage,
 hasNextPage,
 isFetchingNextPage,
 isLoading,
 isFetching,
 isError,
 error
 } = useMentorsData(effectiveBranchId, debouncedSearch, canFetch);

 useEffect(() => {
 if (inView && hasNextPage && !isFetchingNextPage) {
 fetchNextPage();
 }
 }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

 useEffect(() => {
 if (isError) {
 toast.error(error?.message ||"O'qituvchilarni yuklashda xatolik yuz berdi!");
 }
 }, [isError, error]);

 const mentors = useMemo(() => {
 if (!data) return [];
 return data.pages.flatMap(page => page.results || []);
 }, [data]);

 return (
 <div className="p-3 sm:p-6 space-y-12">
 <MentorsHeader
 {...{ currentBranchName, isLoading, isFetching, searchTerm, setSearchQuery, canCreateMentor, navigate, effectiveBranchId, viewMode, setViewMode, dispatch }}
 mentorsCount={mentors.length}
 />

 <div className="min-h-[500px]">
 {isLoading && !mentors.length ? (
 <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-50">
 <Loader2 className="animate-spin text-[var(--gold)]" size={56} />
 <p className="text-[10px] font-black tracking-[0.4em] capitalize">Ma'mulotlar tekshirilmoqda...</p>
 </div>
 ) : mentors.length > 0 ? (
 <div className={viewMode ==='grid'
 ?"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
 :"grid grid-cols-1 md:grid-cols-2 gap-4"
 }>
 {mentors.map((mentor) => (
 <MentorCard
 key={mentor.id}
 mentor={mentor}
 effectiveBranchId={effectiveBranchId}
 readOnly={!canCreateMentor}
 viewMode={viewMode}
 />
 ))}
 </div>
 ) : (
 <MentorsEmptyState />
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

 {canCreateMentor && (
 <button
 onClick={() => navigate(`add-mentor?branch=${effectiveBranchId}`)}
 className="lg:hidden fixed bottom-24 right-8 w-16 h-16 bg-[var(--gold)] text-black rounded-2xl shadow-[0_15px_40px_rgba(184,134,11,0.5)] flex items-center justify-center z-[110] active:scale-90 transition-transform"
 >
 <UserPlus size={28} />
 </button>
 )}
 </div>
 );
}