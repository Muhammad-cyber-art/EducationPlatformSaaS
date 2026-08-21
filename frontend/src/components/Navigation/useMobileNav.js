import { useState } from"react";
import { useLocation, useNavigate } from"react-router-dom";
import { useQuery } from"@tanstack/react-query";
import api from"../../tokenUpdater/updater";
import { get_user_info } from"../Authorized/getRole";

export const useMobileNav = () => {
 const fromToken = get_user_info();
 const location = useLocation();
 const navigate = useNavigate();
 const [showBranchModal, setShowBranchModal] = useState(false);

 const { data: userMe } = useQuery({
 queryKey: ["user-me"],
 queryFn: () => api.get("/user/me/").then((res) => res.data),
 staleTime: 60 * 1000,
 });

 const userInfo = userMe && fromToken ? {
 ...fromToken,
 branch_id: userMe.branch?.id ?? fromToken.branch_id,
 branch_name: userMe.branch?.name ?? fromToken.branch_name,
 accessible_branches: Array.isArray(userMe.accessible_branches) ? userMe.accessible_branches : (fromToken.accessible_branches ?? []),
 } : fromToken;

 const currentPath = location.pathname;
 const searchParams = new URLSearchParams(location.search);
 const currentBranchParam = searchParams.get("branch");
 const activeBranchId = currentBranchParam ? Number(currentBranchParam) : userInfo?.branch_id || null;

 const getLinkWithBranch = (basePath) => {
 if (!currentBranchParam) return basePath;
 return `${basePath}?branch=${currentBranchParam}`;
 };

 const hasExtraBranches = userInfo?.accessible_branches && userInfo.accessible_branches.length > 0;

 return {
 userInfo,
 location,
 navigate,
 currentPath,
 currentBranchParam,
 activeBranchId,
 showBranchModal,
 setShowBranchModal,
 getLinkWithBranch,
 hasExtraBranches
 };
};
