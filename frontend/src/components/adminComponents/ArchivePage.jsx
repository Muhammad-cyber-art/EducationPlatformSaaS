import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { User, Users, Layers, RotateCcw, Trash2, X } from "lucide-react";
import { useCurrentBranch } from "../Authorized/useBranchId";
import { get_user_info } from "../Authorized/getRole";

// Hooks
import { useArchive } from "./Archive/useArchive";

// Components
import ArchiveHeader from "./Archive/ArchiveHeader";
import ArchiveTabs from "./Archive/ArchiveTabs";
import ArchiveTable from "./Archive/ArchiveTable";

export default function ArchivePage() {
  const [activeTab, setActiveTab] = useState("students");
  const user_info = get_user_info();
  const { currentBranchId } = useCurrentBranch();
  const outletContext = useOutletContext() || {};
  const { branchId: superAdminBranchId } = outletContext;

  const activeBranchId = user_info?.role === "super_admin"
    ? superAdminBranchId
    : currentBranchId;

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const {
    studentsQuery,
    staffQuery,
    groupsQuery,
    lidsQuery,
    restoreMutation,
    deleteMutation,
    bulkRestoreMutation,
    bulkDeleteMutation
  } = useArchive(debouncedSearch, activeBranchId);

  const [markedItems, setMarkedItems] = useState({});

  useEffect(() => {
    setMarkedItems({});
  }, [activeTab]);

  const onToggleMark = (id) => {
    setMarkedItems(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const markedCount = Object.keys(markedItems).length;

  const onRestore = (id) => restoreMutation.mutate({ type: activeTab, id });
  const onDelete = (id) => {
    if (window.confirm("DIQQAT: Ushbu yozuvni butunlay o'chirib tashlaysizmi?")) {
      deleteMutation.mutate({ type: activeTab, id });
    }
  };

  const onBulkAction = async (actionType) => {
    if (!markedCount) return;
    const isDelete = actionType === 'delete';
    const msg = isDelete
      ? `${markedCount} ta ma'lumotni arxivdan BUTUNLAY o'chirib tashlamoqchimisiz?`
      : `${markedCount} ta ma'lumotni qayta tiklamoqchimisiz?`;

    if (window.confirm(msg)) {
      const ids = Object.keys(markedItems).map(id => Number(id));
      if (isDelete) {
        await bulkDeleteMutation.mutateAsync({ type: activeTab, ids });
      } else {
        await bulkRestoreMutation.mutateAsync({ type: activeTab, ids });
      }
      setMarkedItems({});
    }
  };

  const tabs = [
    { id: "students", label: "O'quvchilar", icon: User, count: studentsQuery.data?.length || 0 },
    // { id: "lids", label: "Lidlar (Kutish zali)", icon: Users, count: lidsQuery.data?.length || 0 },
    { id: "staff", label: "Xodimlar", icon: Users, count: staffQuery.data?.length || 0 },
    { id: "groups", label: "Guruhlar", icon: Layers, count: groupsQuery.data?.length || 0 },
  ];

  const currentQuery = activeTab === "students"
    ? studentsQuery
    : activeTab === "lids"
      ? lidsQuery
      : activeTab === "staff"
        ? staffQuery
        : groupsQuery;

  return (
    <div className="animate-lux-fade space-y-10 pb-20 relative">
      {/* Atmosphere Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-radial-gradient opacity-[0.03]"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
      </div>

      {/* BULK ACTION BAR - Floating Premium UI */}
      {markedCount > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in zoom-in slide-in-from-bottom-10 duration-500 w-[95%] max-w-[850px] sm:w-auto">
          <div className="bg-[#0a0a0a]/95 backdrop-blur-md border border-[var(--gold)]/40 rounded-2xl p-2 sm:p-3 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col sm:flex-row items-center gap-3 sm:gap-4">

            {/* Left Info Section */}
            <div className="flex items-center gap-4 px-4 py-2 sm:border-r sm:border-white/10 sm:pr-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold)] flex items-center justify-center text-black font-black text-lg shadow-[0_0_15px_rgba(184,134,11,0.3)]">
                {markedCount}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-[var(--gold)] uppercase tracking-widest leading-none mb-1">Tanlangan</p>
                <p className="text-[12px] font-bold text-white whitespace-nowrap">Arxiv ma'lumotlari</p>
              </div>
            </div>

            {/* Actions Section */}
            <div className="flex items-center gap-2 w-full sm:w-auto px-2">
              <button
                onClick={() => onBulkAction('restore')}
                className="flex-1 sm:flex-none h-11 px-6 rounded-xl bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all active:scale-95 group whitespace-nowrap"
              >
                <RotateCcw size={14} />
                <span>Hammasini Tiklash</span>
              </button>

              <button
                onClick={() => onBulkAction('delete')}
                className="flex-1 sm:flex-none h-11 px-6 rounded-xl bg-red-600/10 text-red-500 border border-red-500/20 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all shadow-lg active:scale-95 group whitespace-nowrap"
              >
                <Trash2 size={14} className="group-hover:rotate-12 transition-transform" />
                <span>Butunlay O'chirish</span>
              </button>

              {/* Close Button Integrated */}
              <div className="w-[1px] h-8 bg-white/10 mx-2 hidden sm:block"></div>

              <button
                onClick={() => setMarkedItems({})}
                className="w-11 h-11 shrink-0 rounded-xl bg-white/5 text-white/40 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all active:scale-95"
                title="Yopish"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      <ArchiveHeader searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      <ArchiveTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      <ArchiveTable
        type={activeTab}
        data={currentQuery.data || []}
        isLoading={currentQuery.isLoading}
        onRestore={onRestore}
        onDelete={onDelete}
        hasNextPage={currentQuery.hasNextPage}
        isFetchingNextPage={currentQuery.isFetchingNextPage}
        fetchNextPage={currentQuery.fetchNextPage}
        markedItems={markedItems}
        onToggleMark={onToggleMark}
        onSelectAll={(all) => {
          const next = {};
          all.forEach(item => next[item.id] = true);
          setMarkedItems(next);
        }}
        onClearAll={() => setMarkedItems({})}
      />
    </div>
  );
}
