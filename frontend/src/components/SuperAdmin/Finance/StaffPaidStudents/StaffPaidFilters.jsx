import React from "react";
import { Search, X, AlertCircle } from "lucide-react";

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
    const statusCounts = pageData?.status_counts || {};

    // Only show categories that have actual students (count > 0) to avoid visual clutter
    const availableCategories = [
      { key: "regular", label: "Oddiy", count: statusCounts.regular, color: "emerald" },
      { key: "discount", label: "Imtiyozli (Davlat)", count: statusCounts.discount, color: "purple" },
      { key: "negotiated", label: "Kelishilgan", count: statusCounts.negotiated, color: "amber" },
      { key: "teacher_negotiated", label: "O'qituvchi kelishgan", count: statusCounts.teacher_negotiated, color: "cyan" },
      { key: "low_income", label: "Kam ta'minlangan", count: statusCounts.low_income, color: "blue" },
    ].filter((cat) => (cat.count || 0) > 0);

    return (
      <div className="space-y-2.5">
        {/* Main Toolbar: Search + Primary Payment Status Tabs */}
        <div className="p-3 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              placeholder="O'quvchi ismi, telefon yoki guruh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 bg-[var(--bg-void)]/70 border border-[var(--border-glass)] focus:border-[var(--gold)]/60 rounded-xl text-xs font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Segmented Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-0.5 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl">
              <button
                onClick={() => setActiveTabFilter("all")}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTabFilter === "all"
                    ? "bg-[var(--gold)] text-black shadow-sm font-black"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Barchasi ({pageData?.students?.length || 0})
              </button>
              <button
                onClick={() => setActiveTabFilter("paid")}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTabFilter === "paid"
                    ? "bg-emerald-500 text-white shadow-sm font-black"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                To'laganlar
              </button>
              <button
                onClick={() => setActiveTabFilter("special")}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTabFilter === "special"
                    ? "bg-purple-500 text-white shadow-sm font-black"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Maxsus
              </button>
              <button
                onClick={() => setActiveTabFilter("debt")}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                  activeTabFilter === "debt"
                    ? "bg-rose-500 text-white shadow-sm font-black"
                    : "text-rose-400/80 hover:text-rose-400"
                }`}
              >
                <AlertCircle size={11} />
                <span>Qarzdorlar</span>
                {totalDebtorsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/20 text-rose-300 font-bold">
                    {totalDebtorsCount}
                  </span>
                )}
              </button>
            </div>

            {/* Optional Group Selector Dropdown when many groups */}
            {pageData?.groups && pageData.groups.length > 2 && (
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-2.5 py-1 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)] outline-none cursor-pointer truncate max-w-[180px]"
                title="Guruh bo'yicha filter"
              >
                <option value="all">Barcha Guruhlar</option>
                {pageData.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.total_students_count || g.paid_students_count || 0})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Sub-toolbar: Category Chips + Fast Group Selector Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          {/* Active Categories Chips (Zero-count hidden) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mr-0.5">
              Toifa:
            </span>
            <button
              onClick={() => setSelectedStatus("all")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                selectedStatus === "all"
                  ? "bg-[var(--text-primary)] text-[var(--bg-panel)] border-[var(--text-primary)] shadow-sm font-black"
                  : "bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--border-glass)] hover:text-[var(--text-primary)]"
              }`}
            >
              Barchasi ({pageData?.total_students_count || 0})
            </button>

            {availableCategories.map((cat) => {
              const isSelected = selectedStatus === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setSelectedStatus(isSelected ? "all" : cat.key)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? `bg-${cat.color}-500 text-white border-${cat.color}-500 shadow-sm font-black`
                      : `bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--border-glass)] hover:text-[var(--text-primary)]`
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="tabular-nums opacity-80">({cat.count})</span>
                </button>
              );
            })}
          </div>

          {/* Group Navigation Pills */}
          {pageData?.groups && pageData.groups.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
              <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider mr-0.5 shrink-0">
                Guruh:
              </span>
              <button
                onClick={() => setSelectedGroup("all")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                  selectedGroup === "all"
                    ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]/40 font-black"
                    : "bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--border-glass)] hover:text-[var(--text-primary)]"
                }`}
              >
                Barchasi ({pageData.students.length})
              </button>
              {pageData.groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroup(String(g.id))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border flex items-center gap-1 cursor-pointer shrink-0 ${
                    String(selectedGroup) === String(g.id)
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-black"
                      : "bg-[var(--bg-panel)] text-[var(--text-muted)] border-[var(--border-glass)] hover:text-[var(--text-primary)]"
                  }`}
                  title={g.name}
                >
                  <span className="truncate max-w-[120px]">{g.name}</span>
                  <span className="opacity-75">({g.total_students_count || g.paid_students_count})</span>
                  {g.debtors_count > 0 && (
                    <span className="px-1 py-0.2 rounded-full text-[8px] bg-rose-500/20 text-rose-300 font-bold">
                      {g.debtors_count} qarz
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default StaffPaidFilters;
