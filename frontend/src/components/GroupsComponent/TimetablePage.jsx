import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { Calendar, Layers, Loader2, Building2 } from "lucide-react";
import api from "../../tokenUpdater/updater";
import { useCurrentBranch } from "../Authorized/useBranchId";
import { get_user_info } from "../Authorized/getRole";
import GroupsTimetable from "./Groups/GroupsTimetable";

export default function TimetablePage() {
  const user_info = get_user_info();
  const outletCtx = useOutletContext() || {};
  const { currentBranchId, currentBranchName } = useCurrentBranch();

  const isMentor = user_info?.role === "mentor";
  const mentorId = user_info?.user_id;

  const effectiveBranchId = user_info?.role === "super_admin"
    ? outletCtx.branchId
    : currentBranchId;

  // 1. Agar mentor bo'lsa: ushbu mentorga tegishli barcha guruhlarni olamiz
  const { data: mentorData, isLoading: mentorLoading } = useQuery({
    queryKey: ["mentor-timetable-groups", mentorId, effectiveBranchId],
    queryFn: async () => {
      if (!mentorId || !effectiveBranchId) return null;
      const res = await api.get(`/groups/nested_mentors/${mentorId}/?branch_id=${effectiveBranchId}`);
      return res.data;
    },
    enabled: isMentor && !!mentorId && !!effectiveBranchId,
    staleTime: 1000 * 60 * 3,
  });

  // 2. Agar admin / super_admin bo'lsa: filialdagi barcha faol guruhlar jadvalini olamiz
  const { data: branchGroupsData, isLoading: adminLoading } = useQuery({
    queryKey: ["branch-timetable-groups", effectiveBranchId],
    queryFn: async () => {
      if (!effectiveBranchId) return [];
      const res = await api.get(`/groups/groups/?branch_id=${effectiveBranchId}&page_size=200`);
      return res.data.results || res.data || [];
    },
    enabled: !isMentor && !!effectiveBranchId,
    staleTime: 1000 * 60 * 3,
  });

  const groups = useMemo(() => {
    if (isMentor) {
      const gList = mentorData?.mentor_groups || [];
      return gList.map((g) => ({
        ...g,
        mentor: {
          id: mentorData?.id,
          full_name: `${mentorData?.first_name || ""} ${mentorData?.last_name || ""}`.trim() || mentorData?.username,
        },
      }));
    }
    return Array.isArray(branchGroupsData) ? branchGroupsData : (branchGroupsData?.results || []);
  }, [isMentor, mentorData, branchGroupsData]);

  const isLoading = isMentor ? mentorLoading : adminLoading;

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 space-y-6 animate-lux-fade">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-glass)]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] shadow-[var(--gold-glow)]">
              <Calendar size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] capitalize tracking-tight">
                Dars Jadvali
              </h1>
              <p className="text-[10px] text-[var(--gold)] font-black uppercase tracking-[0.25em] mt-0.5">
                {isMentor ? "Mening haftalik darslarim jadvali" : "Filial haftalik dars jadvali va taqsimoti"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {currentBranchName && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[11px] font-bold text-[var(--text-secondary)]">
              <Building2 size={13} className="text-[var(--gold)]" />
              <span>{currentBranchName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/20 text-[11px] font-black text-[var(--gold)]">
            <Layers size={13} />
            <span>{groups.length} ta guruh</span>
          </div>
        </div>
      </div>

      {/* Timetable Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3 opacity-60">
          <Loader2 className="animate-spin text-[var(--gold)]" size={36} />
          <span className="text-xs font-bold tracking-widest text-[var(--text-muted)] uppercase">
            Jadval yuklanmoqda...
          </span>
        </div>
      ) : (
        <GroupsTimetable
          groups={groups}
          currentBranchId={effectiveBranchId}
          readOnly={isMentor}
        />
      )}
    </div>
  );
}
