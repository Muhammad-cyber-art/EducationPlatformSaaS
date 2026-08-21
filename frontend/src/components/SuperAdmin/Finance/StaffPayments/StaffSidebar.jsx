import React from"react";
import { Circle, ShieldCheck, GraduationCap, Sparkles, UserPlus } from"lucide-react";

const CategoryBtn = ({ active, onClick, icon, label, shortLabel, count }) => (
 <button
 onClick={onClick}
 className={`w-full flex items-center justify-between p-2.5 sm:p-4 rounded-xl transition-all border ${
 active
 ?"bg-[var(--gold)] text-black border-transparent shadow-[var(--gold-glow)]"
 :"bg-transparent text-[var(--text-muted)] border-transparent hover:bg-white/5 hover:text-white"
 }`}
 >
 <div className="flex items-center gap-2 sm:gap-4">
 <div className={`${active ?"text-black" :"text-[var(--gold)]"} shrink-0`}>
 {React.cloneElement(icon, { size: 16, className:"sm:w-4 sm:h-4 w-3.5 h-3.5" })}
 </div>
 <span className="text-[8px] sm:text-[10px] font-black capitalize tracking-[0.1em] sm:tracking-[0.2em] whitespace-nowrap">
 <span className="hidden sm:inline">{label}</span>
 <span className="sm:hidden">{shortLabel}</span>
 </span>
 </div>
 <div className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black shrink-0 ${active ?"bg-black/10" :"bg-[var(--gold-dim)] text-[var(--gold)]"}`}>
 {count}
 </div>
 </button>
);

const StaffSidebar = ({ activeTab, setActiveTab, staffData, onAddStaff }) => {
 const adminCount = staffData.filter(s => s.role === 'admin').length || 0;
 const mentorCount = staffData.filter(s => s.role === 'mentor').length || 0;

 return (
 <div className="lg:col-span-3 space-y-6">
 <div className="lux-card !p-3 sm:!p-4 !rounded-2xl">
 <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em] px-3 mb-4 sm:mb-5 flex items-center gap-2 sm:gap-3">
 <Circle size={4} className="fill-[var(--gold)]" /> Xodimlar
 </p>
 <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-1.5">
 <CategoryBtn
 active={activeTab ==="admin"}
 onClick={() => setActiveTab("admin")}
 icon={<ShieldCheck size={16} />}
 label="Admin"
 shortLabel="Admin"
 count={adminCount}
 />
 <CategoryBtn
 active={activeTab ==="mentor"}
 onClick={() => setActiveTab("mentor")}
 icon={<GraduationCap size={16} />}
 label="Mentorlar"
 shortLabel="Mentor"
 count={mentorCount}
 />
 </div>
 </div>

 <div className="lux-card !p-6 !bg-gradient-to-br !from-[var(--gold-dim)] !to-transparent border-dashed border-[var(--gold)]/20">
 <div className="flex items-center gap-3 mb-4">
 <Sparkles size={16} className="text-[var(--gold)]" />
 <h4 className="text-[10px] font-black text-white capitalize tracking-widest">Yangi Xodim</h4>
 </div>
 <p className="text-[9px] text-[var(--text-muted)] font-bold capitalize leading-relaxed mb-6">Yangi xodimni ro'yxatdan o'tkazish.</p>
 <button
 onClick={onAddStaff}
 className="lux-btn lux-btn-primary !w-full !rounded-xl !h-10 sm:!h-12 text-[9px] sm:text-[10px]"
 >
 <UserPlus size={14} className="mr-2 sm:w-4 sm:h-4" /> QO'SHISH
 </button>
 </div>
 </div>
 );
};

export default StaffSidebar;
