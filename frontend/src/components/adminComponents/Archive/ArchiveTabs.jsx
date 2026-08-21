import React from "react";

const ArchiveTabs = ({ tabs, activeTab, setActiveTab }) => {
    return (
        <div className="flex items-center justify-center gap-4 scrollbar-hide -mt-3">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center  gap-4 px-8 py-3 rounded-2xl text-[10px] font-black capitalize transition-all border shrink-0
 ${activeTab === tab.id
                            ? "bg-[var(--gold)] text-black border-transparent shadow-[var(--gold-glow)] scale-105"
                            : "bg-[var(--bg-void)]/60 text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/30"}`}
                >
                    <tab.icon size={16} />
                    <span>{tab.label}</span>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black ${activeTab === tab.id ? "bg-black/10" : "bg-[var(--gold-dim)] text-[var(--gold)]"}`}>
                        {tab.count}
                    </div>
                </button>
            ))}
        </div>
    );
};

export default ArchiveTabs;
