import { useState, useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import { db } from "../../../db/db";

const fetchGroupsData = async ({ pageParam = 1, queryKey }) => {
  const [_key, branchId, search] = queryKey;
  let url = `/groups/groups/`;
  let params = [`page=${pageParam}`, `page_size=12`];
  if (branchId) params.push(`branch_id=${branchId}`);
  if (search) params.push(`search=${search}`);

  const finalUrl = `${url}?${params.join("&")}`;
  try {
    const res = await api.get(finalUrl);
    // Onlayn ma'lumot kelganda Dexie ga ham saqlaymiz
    if (res.data?.results && Array.isArray(res.data.results)) {
      const nowIso = new Date().toISOString();
      db.groups.bulkPut(res.data.results.map(g => ({
        ...g,
        id: Number(g.id),
        updated_at: nowIso
      }))).catch(() => {});
    }
    return res.data;
  } catch (err) {
    // Tarmoq xatosi yoki oflayn: Dexie dagi lokal guruhlardan olamiz
    const localGroups = await db.groups.toArray();
    if (localGroups && localGroups.length > 0) {
      let filtered = localGroups;
      if (branchId) {
        filtered = filtered.filter(g => Number(g.branch_id || g.branch?.id) === Number(branchId));
      }
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(g =>
          (g.name || '').toLowerCase().includes(q) ||
          (g.subject || '').toLowerCase().includes(q)
        );
      }
      return {
        count: filtered.length,
        next: null,
        previous: null,
        results: filtered
      };
    }
    throw err;
  }
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
