import React from"react";

const ProfileItem = ({ icon, label, value, color }) => (
 <div className="p-4 md:p-5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] flex flex-col items-center justify-center text-center gap-2 md:gap-3 hover:border-[var(--gold)]/30 hover:bg-[var(--bg-panel)]/80 transition-all hover:-translate-y-1 duration-300 group shadow-lg min-h-[110px]">
 <div className={`p-2.5 rounded-xl bg-[var(--bg-void)] ${color} group-hover:scale-110 transition-transform`}>
 {React.cloneElement(icon, { size: 18 })}
 </div>
 <div className="w-full">
 <p className="text-[11px] md:text-sm font-black text-[var(--text-primary)] capitalize tracking-tight truncate">{value}</p>
 <p className="text-[8px] md:text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest mt-0.5 truncate">{label}</p>
 </div>
 </div>
);

export default ProfileItem;
