import { useState, useEffect } from"react";
import { useInfiniteQuery } from"@tanstack/react-query";
import api from"../../../tokenUpdater/updater";

const fetchMentorsData = async ({ pageParam = 1, queryKey }) => {
 const [_key, branchId, search] = queryKey;
 const res = await api.get(`/groups/nested_mentors/`, {
 params: {
 branch_id: branchId,
 search: search,
 page: pageParam,
 page_size: 12
 }
 });
 return res.data;
};

export const useMentorsData = (effectiveBranchId, debouncedSearch, canFetch) => {
 return useInfiniteQuery({
 queryKey: ['mentors', effectiveBranchId, debouncedSearch],
 queryFn: fetchMentorsData,
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
