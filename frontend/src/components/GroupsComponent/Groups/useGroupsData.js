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
    // Tarmoq xatosi yoki oflayn: avval db.query_cache dan, keyin db.groups dan olamiz
    try {
      // 1. attendanceOfflineService tomonidan oldindan to'ldirilgan cache ni tekshirish
      const cacheKey = branchId ? `groups_list_${branchId}` : 'groups_list_0';
      const cached = await db.query_cache.get(cacheKey);
      if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
        let filtered = cached.data;
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
          results: filtered,
        };
      }
    } catch (_) {}

    // 2. db.groups dan to'g'ridan-to'g'ri o'qish (fallback)
    try {
      const localGroups = await db.groups.toArray();
      if (localGroups && localGroups.length > 0) {
        let filtered = localGroups;
        if (branchId) {
          // branch_id maydonini ham, nested branch.id ni ham tekshiramiz
          const byBranch = filtered.filter(g =>
            Number(g.branch_id || g.branch?.id) === Number(branchId)
          );
          if (byBranch.length > 0) {
            filtered = byBranch;
          }
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
    } catch (_) {}

    return {
      count: 0,
      next: null,
      previous: null,
      results: []
    };
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
