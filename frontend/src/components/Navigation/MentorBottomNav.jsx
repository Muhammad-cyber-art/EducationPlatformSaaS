import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, UserCircle, Building2, X, Building, Sparkles, CreditCard } from "lucide-react";
import { useMobileNav } from "./useMobileNav";

const MentorBranchModal = ({ isOpen, onClose, userInfo, activeBranchId, currentBranchParam, currentPath, navigate }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-x-4 bottom-24 bg-[var(--bg-panel)] rounded-[2.5rem] p-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-10 duration-300 z-[60]">
                <div className="w-12 h-1 bg-[var(--border-glass)] rounded-full mx-auto mb-8"></div>
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-[var(--text-primary)] capitalize tracking-tight flex items-center gap-3">
                        <Building size={20} className="text-[var(--gold)]" />
                        FILIALNI <span className="text-[var(--gold)]">TANLASH</span>
                    </h3>
                    <button onClick={onClose} className="p-2 bg-[var(--bg-void)] rounded-full text-[var(--text-secondary)] border border-[var(--border-glass)]">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 scrollbar-none">
                    {/* Main Branch */}
                    <div
                        onClick={() => { navigate(currentPath); onClose(); }}
                        className={`p-5 rounded-[1.8rem] transition-all duration-500 flex items-center gap-4 ${activeBranchId === userInfo?.branch_id || !currentBranchParam ? "bg-[var(--gold)]/10 shadow-lg shadow-[var(--gold)]/5" : "bg-white/5"}`}
                    >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeBranchId === userInfo?.branch_id || !currentBranchParam ? "bg-[var(--gold)] text-black shadow-lg" : "bg-white/10 text-[var(--text-secondary)]"}`}>
                            <Building2 size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-[var(--text-primary)] capitalize tracking-tight">{userInfo.branch_name}</p>
                            <p className="text-[9px] font-black text-[var(--gold)] capitalize tracking-widest mt-0.5">Asosiy ish joyi</p>
                        </div>
                        {(activeBranchId === userInfo?.branch_id || !currentBranchParam) && <Sparkles size={16} className="text-[var(--gold)]" />}
                    </div>

                    {/* Extra Branches */}
                    {userInfo.accessible_branches?.filter(b => b.branch_id !== userInfo.branch_id).map((branch) => (
                        <div
                            key={branch.branch_id}
                            onClick={() => { navigate(`${currentPath}?branch=${branch.branch_id}`); onClose(); }}
                            className={`p-5 rounded-[1.8rem] transition-all duration-500 flex items-center gap-4 ${activeBranchId === branch.branch_id ? "bg-[var(--gold)]/10 shadow-lg shadow-[var(--gold)]/5" : "bg-white/5"}`}
                        >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeBranchId === branch.branch_id ? "bg-[var(--gold)] text-black shadow-lg" : "bg-white/10 text-[var(--text-secondary)]"}`}>
                                <Building2 size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-[var(--text-primary)] capitalize tracking-tight">{branch.branch_name}</p>
                                <p className="text-[9px] font-black text-blue-500 capitalize tracking-widest mt-0.5">{branch.access_level}</p>
                            </div>
                            {activeBranchId === branch.branch_id && <Sparkles size={16} className="text-[var(--gold)]" />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function MentorBottomNav() {
    const {
        userInfo, currentPath, currentBranchParam, activeBranchId,
        showBranchModal, setShowBranchModal, navigate, hasExtraBranches
    } = useMobileNav();

    const menuItems = [
        { name: "Guruhlar", path: "/mentor", icon: <LayoutDashboard size={20} /> },
        { name: "Moliya", path: "/mentor/finance", icon: <CreditCard size={20} /> },
        { name: "Profil", path: "/mentor/profile", icon: <UserCircle size={20} /> },
    ];

    if (hasExtraBranches) {
        menuItems.splice(menuItems.length - 1, 0, {
            name: "Filial",
            type: "action",
            onClick: () => setShowBranchModal(true),
            icon: <Building2 size={20} />,
        });
    }

    return (
        <>
            <div
                className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around h-20 px-4 border-t border-[var(--border-glass)] z-50 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.3)]"
                style={{ backgroundColor: 'var(--bg-panel)' }}
            >
                {menuItems.map((item, idx) => {
                    const isActive = item.type !== 'action' && (currentPath === item.path || (item.path === "/mentor" && currentPath === "/mentor/"));

                    if (item.type === 'action') {
                        return (
                            <button
                                key={idx}
                                onClick={item.onClick}
                                className="flex flex-col items-center justify-center gap-1 min-w-[64px] transition-all duration-300"
                            >
                                <div className="p-2 rounded-xl text-[var(--text-secondary)]">{item.icon}</div>
                                <span className="text-[10px] font-black capitalize tracking-widest text-[var(--text-secondary)]">{item.name}</span>
                            </button>
                        );
                    }

                    return (
                        <NavLink
                            key={item.path}
                            to={currentBranchParam ? `${item.path}?branch=${currentBranchParam}` : item.path}
                            end={item.path === "/mentor"}
                            className={() =>
                                `flex flex-col items-center justify-center gap-1 min-w-[64px] transition-all duration-500 relative
                                ${isActive ? "text-[var(--gold)]" : "text-[var(--text-secondary)] opacity-60"}`
                            }
                        >
                            <div className={`p-2 rounded-2xl transition-all duration-200 ${isActive ? "bg-[var(--gold)]/10" : ""}`}>
                                {item.icon}
                            </div>
                            <span className="text-[10px] font-black capitalize tracking-[0.1em]">{item.name}</span>
                            {isActive && <div className="absolute -top-1 w-1 h-1 rounded-full bg-[var(--gold)] shadow-[0_0_10px_var(--gold)]"></div>}
                        </NavLink>
                    );
                })}
            </div>

            <MentorBranchModal
                isOpen={showBranchModal}
                onClose={() => setShowBranchModal(false)}
                userInfo={userInfo}
                activeBranchId={activeBranchId}
                currentBranchParam={currentBranchParam}
                currentPath={currentPath}
                navigate={navigate}
            />
        </>
    );
}
