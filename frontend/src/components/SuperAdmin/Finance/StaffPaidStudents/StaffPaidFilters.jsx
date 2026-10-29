import React from "react";
import { Search, X, Award, Users, Calculator, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";

const StaffPaidFilters = React.memo(
  ({
    pageData,
    searchQuery,
    setSearchQuery,
    selectedGroup,
    setSelectedGroup,
    selectedStatus,
    setSelectedStatus,
    activeTabFilter,
    setActiveTabFilter,
    totalDebtorsCount,
  }) => {
    return (
      <div className="space-y-3">
        {/* Status Counters Bar */}
        {pageData?.status_counts && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedStatus("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatus === "all"
                  ? "bg-[var(--gold)] text-white border-[var(--gold)] shadow-sm font-black"
                  : "bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--border-glass)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/40"
              }`}
            >
              <span>Barcha Toifalar:</span>
              <span className="tabular-nums font-bold">{pageData.total_students_count || 0}</span>
            </button>

            <button
              onClick={() => setSelectedStatus(selectedStatus === "discount" ? "all" : "discount")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatus === "discount"
                  ? "bg-purple-500 text-white border-purple-500 shadow-sm"
                  : "bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20"
              }`}
            >
              <Award size={12} />
              <span>Imtiyozli (Davlat puli):</span>
              <span className="tabular-nums font-bold">{pageData.status_counts.discount || 0}</span>
            </button>

            <button
              onClick={() => setSelectedStatus(selectedStatus === "low_income" ? "all" : "low_income")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatus === "low_income"
                  ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
              }`}
            >
              <Users size={12} />
              <span>Kam ta'minlangan:</span>
              <span className="tabular-nums font-bold">{pageData.status_counts.low_income || 0}</span>
            </button>

            <button
              onClick={() => setSelectedStatus(selectedStatus === "negotiated" ? "all" : "negotiated")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatus === "negotiated"
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
              }`}
            >
              <Calculator size={12} />
              <span>Kelishilgan:</span>
              <span className="tabular-nums font-bold">{pageData.status_counts.negotiated || 0}</span>
            </button>

            <button
              onClick={() => setSelectedStatus(selectedStatus === "teacher_negotiated" ? "all" : "teacher_negotiated")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatus === "teacher_negotiated"
                  ? "bg-cyan-500 text-white border-cyan-500 shadow-sm"
                  : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20"
              }`}
            >
              <TrendingUp size={12} />
              <span>O'qituvchi kelishgan:</span>
              <span className="tabular-nums font-bold">{pageData.status_counts.teacher_negotiated || 0}</span>
            </button>

            <button
              onClick={() => setSelectedStatus(selectedStatus === "regular" ? "all" : "regular")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedStatus === "regular"
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
              }`}
            >
              <CheckCircle size={12} />
              <span>Oddiy:</span>
              <span className="tabular-nums font-bold">{pageData.status_counts.regular || 0}</span>
            </button>
          </div>
        )}

        {/* Search & Tabs Toolbar */}
        <div className="p-4 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              placeholder="O'quvchi ismi, telefon yoki guruh bo'yicha izlash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-void)]/60 border border-[var(--border-glass)] focus:border-[var(--gold)] rounded-xl text-xs font-semibold text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Filter Tabs */}
            <div className="flex items-center p-1 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl">
              <button
                onClick={() => setActiveTabFilter("all")}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTabFilter === "all"
                    ? "bg-[var(--gold)] text-white font-black shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Barchasi ({pageData?.students?.length || 0})
              </button>
              <button
                onClick={() => setActiveTabFilter("paid")}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTabFilter === "paid"
                    ? "bg-emerald-500 text-white font-black shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                To'laganlar
              </button>
              <button
                onClick={() => setActiveTabFilter("special")}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTabFilter === "special"
                    ? "bg-purple-500 text-white font-black shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Faqat Maxsus
              </button>
              <button
                onClick={() => setActiveTabFilter("debt")}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                  activeTabFilter === "debt"
                    ? "bg-rose-500 text-white font-black shadow-sm"
                    : "text-rose-400/80 hover:text-rose-400"
                }`}
              >
                <AlertCircle size={10} />
                <span>Qarzdorlar</span>
                {totalDebtorsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-rose-500/20 text-rose-300">
                    {totalDebtorsCount}
                  </span>
                )}
              </button>
            </div>

            {/* Group Selector Dropdown */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2 max-w-[240px] bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)] outline-none cursor-pointer truncate"
              title={pageData?.groups?.find((g) => String(g.id) === String(selectedGroup))?.name || "Barcha Guruhlar"}
            >
              <option value="all">Barcha Guruhlar ({pageData?.students?.length || 0})</option>
              {pageData?.groups?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.total_students_count || g.paid_students_count || 0} st.)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Group Fast Navigation Tabs */}
        {pageData?.groups && pageData.groups.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setSelectedGroup("all")}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                selectedGroup === "all"
                  ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-sm"
                  : "bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--border-glass)] hover:text-[var(--text-primary)]"
              }`}
            >
              Barcha Guruhlar ({pageData.students.length})
            </button>
            {pageData.groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(String(g.id))}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer max-w-[220px] shrink-0 ${
                  String(selectedGroup) === String(g.id)
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                    : "bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--border-glass)] hover:text-[var(--text-primary)]"
                }`}
                title={g.name}
              >
                <span className="truncate max-w-[130px]">{g.name}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[8px] bg-black/20 font-bold shrink-0">
                  {g.total_students_count || g.paid_students_count}
                </span>
                {g.debtors_count > 0 && (
                  <span className="px-1 py-0.2 rounded-full text-[7px] bg-rose-500/30 text-rose-300 font-bold shrink-0" title="Guruhdagi qarzdorlar">
                    {g.debtors_count} qarz
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

export default StaffPaidFilters;
