import React from"react";
import { NavLink } from"react-router-dom";
import { LayoutDashboard, Users, UserSquare2, Layers, Building2, User, X } from"lucide-react";
import { useMobileNav } from"./useMobileNav";

const BranchModal = ({ isOpen, onClose, userInfo, activeBranchId, currentBranchParam, currentPath }) => {
 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
 <div className="w-full md:w-auto md:min-w-[400px] max-w-md bg-[var(--bg-panel)] border-t md:border border-[var(--border-glass)] md:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom md:slide-in-from-bottom-0 duration-300" onClick={(e) => e.stopPropagation()}>
 <div className="flex items-center justify-between p-5 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/40">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-[var(--gold)]/10 rounded-xl">
 <Building2 size={20} className="text-[var(--gold)]" />
 </div>
 <div>
 <h3 className="text-base font-black text-[var(--text-primary)] capitalize tracking-tight">Filiallar</h3>
 <p className="text-[9px] text-[var(--text-secondary)] font-bold capitalize tracking-widest opacity-60">Ruxsat berilgan filiallar</p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-[var(--bg-void)] rounded-xl transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
 <X size={20} />
 </button>
 </div>

 <div className="p-5 max-h-[60vh] overflow-y-auto">
 <div className="space-y-2">
 {/* Main Branch */}
 <NavLink
 to={currentPath}
 onClick={onClose}
 className={`block p-4 rounded-2xl border transition-all duration-300 ${activeBranchId === userInfo?.branch_id || !currentBranchParam ?'bg-[var(--gold)]/10 border-[var(--gold)]/30' :'bg-[var(--bg-void)]/40 border-[var(--border-glass)]'}`}
 >
 <div className="flex items-start gap-3">
 <div className={`p-2 rounded-xl ${activeBranchId === userInfo?.branch_id || !currentBranchParam ?'bg-[var(--gold)] text-black' :'bg-[var(--bg-panel)] text-[var(--gold)]'}`}>
 <Building2 size={18} />
 </div>
 <div className="flex-1 min-w-0">
 <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1 flex items-center gap-2">
 {userInfo.branch_name}
 <span className="text-[8px] bg-[var(--gold)] text-black px-2 py-0.5 rounded font-black capitalize tracking-wider">Asosiy</span>
 </h4>
 <p className="text-[9px] text-[var(--text-secondary)] font-bold capitalize tracking-widest opacity-40">Asosiy filial</p>
 </div>
 </div>
 </NavLink>

 {/* Extra Branches */}
 {userInfo.accessible_branches?.filter(b => b.branch_id !== userInfo.branch_id).map((branch) => (
 <NavLink
 key={branch.branch_id}
 to={`${currentPath}?branch=${branch.branch_id}`}
 onClick={onClose}
 className={`block p-4 rounded-2xl border transition-all duration-300 ${activeBranchId === branch.branch_id ?'bg-[var(--gold)]/10 border-[var(--gold)]/30' :'bg-[var(--bg-void)]/40 border-[var(--border-glass)]'}`}
 >
 <div className="flex items-start gap-3">
 <div className={`p-2 rounded-xl ${activeBranchId === branch.branch_id ?'bg-[var(--gold)] text-black' :'bg-[var(--bg-panel)] text-[var(--gold)]'}`}>
 <Building2 size={18} />
 </div>
 <div className="flex-1 min-w-0">
 <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">{branch.branch_name}</h4>
 <p className="text-[9px] text-[var(--text-secondary)] font-bold capitalize tracking-widest opacity-60">
 {branch.access_level ==="admin" ?"To'liq admin" : branch.access_level ==="edit" ?"Tahrirlash" :"Faqat ko'rish"}
 </p>
 </div>
 </div>
 </NavLink>
 ))}
 </div>
 </div>
 </div>
 </div>
 );
};

export default function MobileBottomNav() {
 const { 
 userInfo, location, currentPath, currentBranchParam, activeBranchId, 
 showBranchModal, setShowBranchModal, getLinkWithBranch, hasExtraBranches 
 } = useMobileNav();

 const menuItems = [
 { name:"Asosiy", path:"/admin", icon: <LayoutDashboard size={18} /> },
 { name:"Guruhlar", path:"/admin/groups", icon: <Layers size={18} /> },
 { name:"Mentorlar", path:"/admin/mentors", icon: <UserSquare2 size={18} /> },
 { name:"O'quvchilar", path:"/admin/all_students", icon: <Users size={18} /> },
 { name:"Profil", path:"/admin/profile", icon: <User size={18} /> },
 ];

 return (
 <>
 <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--bg-panel)] border-t border-[var(--border-glass)] flex items-center justify-between px-2 z-50">
 {menuItems.map((item) => {
 const linkTo = getLinkWithBranch(item.path);
 const isActive = location.pathname === item.path || (item.path !=="/admin" && location.pathname.startsWith(item.path));

 return (
 <NavLink
 key={item.path}
 to={linkTo}
 className={() => `flex flex-col items-center justify-center gap-0.5 transition-all duration-300 px-2 py-1 rounded-xl ${isActive ?"text-[var(--gold)] scale-105" :"text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
 >
 <div className={`${isActive ?"text-[var(--gold)] shadow-[0_0_10px_rgba(212,175,55,0.3)]" :""}`}>{item.icon}</div>
 <span className="text-[8px] font-bold tracking-tight">{item.name}</span>
 </NavLink>
 );
 })}

 {hasExtraBranches && (
 <button
 onClick={() => setShowBranchModal(true)}
 className="flex flex-col items-center justify-center gap-0.5 transition-all duration-300 px-2 py-1 rounded-xl text-[var(--text-secondary)] hover:text-[var(--gold)]"
 >
 <div className="relative">
 <Building2 size={18} />
 <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--gold)] text-black text-[7px] font-bold rounded-full flex items-center justify-center">
 {userInfo.accessible_branches.length + 1}
 </span>
 </div>
 <span className="text-[8px] font-bold tracking-tight">Filiallar</span>
 </button>
 )}
 </div>

 <BranchModal 
 isOpen={showBranchModal}
 onClose={() => setShowBranchModal(false)}
 userInfo={userInfo}
 activeBranchId={activeBranchId}
 currentBranchParam={currentBranchParam}
 currentPath={currentPath}
 />
 </>
 );
}
