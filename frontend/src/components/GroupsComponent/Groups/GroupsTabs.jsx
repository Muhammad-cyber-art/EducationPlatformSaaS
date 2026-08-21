import React from"react";
import { Kanban, LayoutGrid, Clock } from"lucide-react";

const GroupsTabs = ({ activeTab, setTab, dispatch }) => {
 const tabs = [
 { id:"all", label:"Barcha", icon: Kanban },
 { id:"odd", label:"Toq kunlar", icon: LayoutGrid },
 { id:"even", label:"Juft kunlar", icon: LayoutGrid },
 { id:"everyday", label:"Har kuni", icon: Clock },
 ];

 return (
 <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
 {tabs.map((tab) => {
 const Icon = tab.icon;
 const isActive = activeTab === tab.id;
 return (
 <button
 key={tab.id}
 onClick={() => dispatch(setTab(tab.id))}
 className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black capitalize tracking-widest transition-all whitespace-nowrap border
 ${isActive
 ?"bg-[var(--gold)] text-black border-transparent shadow-[0_10px_30px_rgba(184,134,11,0.25)]"
 :"bg-[var(--bg-panel)]/40 text-[var(--text-secondary)] border-[var(--border-glass)] hover:border-[var(--gold)]/40"}`}
 >
 <Icon size={16} /> {tab.label}
 </button>
 );
 })}
 </div>
 );
};

export default GroupsTabs;
