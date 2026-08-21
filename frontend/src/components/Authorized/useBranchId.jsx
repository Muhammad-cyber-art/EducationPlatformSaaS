// src/hooks/useCurrentBranch.js

import { useMemo, useEffect } from"react";
import { useSearchParams } from"react-router-dom";
import { useQuery } from"@tanstack/react-query";
import { get_user_info } from"./getRole";
import api from"../../tokenUpdater/updater";

/**
 * Admin panelda joriy filialni aniqlash uchun universal hook
 * Query param (?branch=8) yoki asosiy branch ni hisobga oladi
 * Ruxsatni ham tekshiradi. /user/me/ dan accessible_branches olinadi (transfer qilingan filiallar ham).
 */
import { useDispatch } from"react-redux";
import { setBranch } from"../../store/slices/mentorSlice";

export function useCurrentBranch() {
 const [searchParams] = useSearchParams();
 const urlBranchId = searchParams.get("branch"); // ?branch=8
 const dispatch = useDispatch();

 const { data: userMe } = useQuery({
 queryKey: ["user-me"],
 queryFn: () => api.get("/user/me/").then((res) => res.data),
 staleTime: 60 * 1000,
 });

 const userInfo = useMemo(() => {
 const fromToken = get_user_info();
 if (!fromToken) return null;
 if (userMe) {
 return {
 ...fromToken,
 branch_id: userMe.branch?.id ?? fromToken.branch_id,
 branch_name: userMe.branch?.name ?? fromToken.branch_name,
 accessible_branches: Array.isArray(userMe.accessible_branches) ? userMe.accessible_branches : (fromToken.accessible_branches ?? []),
 };
 }
 return fromToken;
 }, [userMe]);

 // Agar user hali yuklanmagan bo'lsa
 if (!userInfo) {
 return {
 currentBranchId: null,
 currentBranchName:"Yuklanmoqda...",
 hasAccess: false,
 isLoading: true,
 };
 }

 // URL dan kelgan branch ID
 const requestedBranchId = urlBranchId ? Number(urlBranchId) : null;

 // Ruxsat borligini tekshirish
 const hasAccessToRequested =
 !requestedBranchId ||
 requestedBranchId === userInfo.branch_id ||
 userInfo.accessible_branches?.some(b => b.branch_id === requestedBranchId);

 // Agar ruxsat yo'q bo'lsa — asosiy branch ga tushamiz
 const finalBranchId = hasAccessToRequested && requestedBranchId
 ? requestedBranchId
 : userInfo.branch_id;

 // Filial nomini topish
 let finalBranchName = userInfo.branch_name;

 if (finalBranchId !== userInfo.branch_id) {
 const accessibleBranches = Array.isArray(userInfo.accessible_branches) ? userInfo.accessible_branches : [];
 const extraBranch = accessibleBranches.find(
 b => b.branch_id === finalBranchId
 );
 if (extraBranch) {
 finalBranchName = extraBranch.branch_name;
 }
 }

 // SYNC WITH REDUX
 useEffect(() => {
 if (finalBranchId) {
 dispatch(setBranch({ id: finalBranchId, name: finalBranchName }));
 }
 }, [finalBranchId, finalBranchName, dispatch]);

 return {
 currentBranchId: finalBranchId,
 currentBranchName: finalBranchName ||"Filial nomi yo'q",
 hasAccess: hasAccessToRequested || true,
 isExtraBranch: finalBranchId !== userInfo.branch_id,
 isLoading: false,
 };
}