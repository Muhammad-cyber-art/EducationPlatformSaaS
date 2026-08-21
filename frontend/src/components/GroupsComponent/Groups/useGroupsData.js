import { useState, useEffect, useMemo } from"react";
import { useInfiniteQuery } from"@tanstack/react-query";
import api from"../../../tokenUpdater/updater";

const fetchGroupsData = async ({ pageParam = 1, queryKey }) => {
 const [_key, branchId, search] = queryKey;
 let url = `/groups/groups/`;
 let params = [`page=${pageParam}`, `page_size=12` ]; // Increased page size for better UX
 if (branchId) params.push(`branch_id=${branchId}`);
 if (search) params.push(`search=${search}`);

 const finalUrl = `${url}?${params.join("&")}`;
 const res = await api.get(finalUrl);
 return res.data;
};

export const useGroupsData = (effectiveBranchId, debouncedSearch, canFetch) => {
 return useInfiniteQuery({
 queryKey: ['groups', effectiveBranchId, debouncedSearch],
 queryFn: fetchGroupsData,
 enabled: canFetch,
 staleTime: 1000 * 60 * 5,
 refetchOnWindowFocus: false,
 initialPageParam: 1,
 getNextPageParam: (lastPage) => {
 if (lastPage.next) {
 const url = new URL(lastPage.next);
 return url.searchParams.get('page');
 }
 return undefined;
 },
 });
};
