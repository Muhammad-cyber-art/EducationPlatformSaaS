import { useMemo, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { get_user_info } from "./getRole";
import api from "../../tokenUpdater/updater";
import { useDispatch } from "react-redux";
import { setBranch } from "../../store/slices/mentorSlice";
import { cacheUserMe, getCachedUserMe } from "../../db/db";

/**
 * Admin panelda joriy filialni aniqlash uchun universal hook
 * Query param (?branch=8) yoki asosiy branch ni hisobga oladi
 * Ruxsatni ham tekshiradi. /user/me/ dan accessible_branches olinadi (transfer qilingan filiallar ham).
 */
export function useCurrentBranch() {
  const [searchParams] = useSearchParams();
  const routeParams = useParams();
  const rawUrlBranch = searchParams.get("branch");
  const urlBranchId = (rawUrlBranch && rawUrlBranch !== "null" && rawUrlBranch !== "undefined")
    ? rawUrlBranch
    : null;
  const routeBranchId = routeParams?.branch_id || routeParams?.b_id;
  const effectiveBranchParam = urlBranchId || (routeBranchId && routeBranchId !== "null" && routeBranchId !== "undefined" ? routeBranchId : null);
  const dispatch = useDispatch();

  const { data: userMe } = useQuery({
    queryKey: ["user-me"],
    queryFn: async () => {
      try {
        const res = await api.get("/user/me/");
        if (res.data) {
          cacheUserMe(res.data);
        }
        return res.data;
      } catch (err) {
        return (await getCachedUserMe()) || null;
      }
    },
    staleTime: Infinity,
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

  // URL yoki marshrut parametrlaridan kelgan branch ID
  const parsedBranchId = effectiveBranchParam ? Number(effectiveBranchParam) : null;
  const requestedBranchId = (parsedBranchId && !isNaN(parsedBranchId)) ? parsedBranchId : null;

  // Ruxsat borligini tekshirish (super_admin barcha filiallarga to'liq ruxsatga ega)
  const isSuperAdmin = (userInfo?.role || "").toLowerCase() === "super_admin";
  const hasAccessToRequested = useMemo(() => {
    if (!userInfo) return false;
    if (isSuperAdmin) return true;
    return (
      !requestedBranchId ||
      requestedBranchId === userInfo.branch_id ||
      Boolean(userInfo.accessible_branches?.some((b) => b.branch_id === requestedBranchId))
    );
  }, [userInfo, requestedBranchId, isSuperAdmin]);

  // Agar ruxsat bor bo'lsa requested, aks holda userning asosiy branchi, agar u ham bo'lmasa localStorage dan fallback
  const finalBranchId = useMemo(() => {
    if (!userInfo) return null;
    if (hasAccessToRequested && requestedBranchId) return requestedBranchId;
    if (userInfo.branch_id) return userInfo.branch_id;
    const stored = localStorage.getItem("active_branch_id") || localStorage.getItem("branch_id");
    const numStored = stored ? Number(stored) : null;
    if (numStored && !isNaN(numStored)) return numStored;
    return null;
  }, [userInfo, hasAccessToRequested, requestedBranchId]);

  // Filial nomini topish
  const finalBranchName = useMemo(() => {
    if (!userInfo) return null;
    let name = userInfo.branch_name;
    if (finalBranchId !== userInfo.branch_id) {
      const accessibleBranches = Array.isArray(userInfo.accessible_branches) ? userInfo.accessible_branches : [];
      const extraBranch = accessibleBranches.find((b) => b.branch_id === finalBranchId);
      if (extraBranch) {
        name = extraBranch.branch_name;
      }
    }
    return name;
  }, [userInfo, finalBranchId]);

  // SYNC WITH REDUX: CRITICAL FIX — Hook barcha renderlarda bir xil tartibda chaqiriladi (Rules of Hooks)
  useEffect(() => {
    if (finalBranchId) {
      dispatch(setBranch({ id: finalBranchId, name: finalBranchName }));
      try {
        localStorage.setItem("active_branch_id", String(finalBranchId));
        localStorage.setItem("branch_id", String(finalBranchId));
      } catch (_) {}
    }
  }, [finalBranchId, finalBranchName, dispatch]);

  // Agar user hali yuklanmagan bo'lsa
  if (!userInfo) {
    return {
      currentBranchId: null,
      currentBranchName: "Yuklanmoqda...",
      hasAccess: false,
      isLoading: true,
    };
  }

  return {
    currentBranchId: finalBranchId,
    currentBranchName: finalBranchName || "Filial nomi yo'q",
    hasAccess: hasAccessToRequested,
    isExtraBranch: finalBranchId !== userInfo.branch_id,
    isLoading: false,
  };
}