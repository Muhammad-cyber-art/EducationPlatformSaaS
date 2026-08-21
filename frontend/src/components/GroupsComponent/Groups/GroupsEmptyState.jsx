import React from"react";
import { Kanban } from"lucide-react";

const GroupsEmptyState = ({ currentBranchName }) => {
 return (
 <div className="py-24 flex flex-col items-center justify-center text-center">
 <div className="w-24 h-24 rounded-3xl bg-[var(--gold-dim)] border border-[var(--gold)]/20 flex items-center justify-center mb-8 text-[var(--gold)]">
 <Kanban size={48} />
 </div>
 <h2 className="text-2xl font-bold text-[var(--text-primary)] capitalize tracking-tight mb-3">Faol guruhlar topilmadi</h2>
 <p className="text-[var(--text-muted)] text-[11px] max-w-xs font-bold capitalize tracking-widest leading-relaxed">
 Ushbu filtr bo'yicha {currentBranchName ||'bazada'} hech qanday guruh topilmadi.
 </p>
 </div>
 );
};

export default GroupsEmptyState;
