import React from "react";

const ArchiveTabs = ({ tabs, activeTab, setActiveTab }) => {
    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 h-9 px-3.5 rounded-xl text-xs font-semibold transition-all border shrink-0
                        ${activeTab === tab.id
                            ? "bg-[var(--gold)] text-black border-transparent shadow-[0_2px_12px_rgba(184,134,11,0.25)] font-bold"
                            : "bg-[var(--bg-panel)]/50 text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/40 hover:text-[var(--text-primary)]"}`}
                >
                    <tab.icon size={14} />
                    <span>{tab.label}</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${activeTab === tab.id ? "bg-black/15 text-black" : "bg-[var(--gold-dim)] text-[var(--gold)]"}`}>
                        {tab.count}
                    </div>
                </button>
            ))}
        </div>
    );
};

export default ArchiveTabs;
