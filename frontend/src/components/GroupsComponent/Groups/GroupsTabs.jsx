import React from "react";
import { Kanban, LayoutGrid, Clock } from "lucide-react";

const GroupsTabs = ({ activeTab, setTab, dispatch }) => {
  const tabs = [
    { id: "all", label: "Barcha", icon: Kanban },
    { id: "odd", label: "Toq kunlar", icon: LayoutGrid },
    { id: "even", label: "Juft kunlar", icon: LayoutGrid },
    { id: "everyday", label: "Har kuni", icon: Clock },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide items-center">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => dispatch(setTab(tab.id))}
            className={`flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border shrink-0
            ${isActive
              ? "bg-[var(--gold)] text-black border-transparent shadow-[0_2px_12px_rgba(184,134,11,0.25)] font-bold"
              : "bg-[var(--bg-panel)]/50 text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/40 hover:text-[var(--text-primary)]"}`}
          >
            <Icon size={14} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default GroupsTabs;
