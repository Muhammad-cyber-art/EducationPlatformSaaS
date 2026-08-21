import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Building2, UserCircle, Sparkles, LogOut, ShieldAlert, Zap, Circle, Sun, Moon, DollarSign } from "lucide-react";
import { get_user_info } from "../Authorized/getRole";
import api from "../../tokenUpdater/updater";


export default function MentorSidebar() {
    const navigate = useNavigate();
    const fromToken = get_user_info();
    const { data: userMe } = useQuery({
        queryKey: ["user-me"],
        queryFn: () => api.get("/user/me/").then((res) => res.data),
        staleTime: 60 * 1000,
    });

    const userInfo = userMe && fromToken ? {
        ...fromToken,
        branch_id: userMe.branch?.id ?? fromToken.branch_id,
        branch_name: userMe.branch?.name ?? fromToken.branch_name,
        accessible_branches: Array.isArray(userMe.accessible_branches) ? userMe.accessible_branches : (fromToken.accessible_branches ?? []),
    } : fromToken;

    const location = useLocation();
    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const currentBranchParam = searchParams.get("branch");
    const activeBranchId = currentBranchParam ? Number(currentBranchParam) : userInfo?.branch_id || null;

    const hasExtraBranches = userInfo?.accessible_branches && userInfo.accessible_branches.length > 0;

    const getLinkWithBranch = (basePath) => {
        if (!currentBranchParam) return basePath;
        return `${basePath}?branch=${currentBranchParam}`;
    };

    const menuItems = [
        { name: "Guruhlar", path: "/mentor", icon: <LayoutDashboard size={18} /> },
        ...(userMe?.permissions?.pay_slip !== false ? [{ name: "Moliya", path: "/mentor/finance", icon: <DollarSign size={18} /> }] : [])
    ];

    return (
        <div className={`lux-sidebar h-screen sticky top-0 flex flex-col transition-all duration-500 z-[200]`}>
            {/* LOGO SECTION */}
            <div className="flex items-center justify-between mb-12 px-3">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="w-12 h-12 flex items-center justify-center transition-all duration-500">
                            <img src="/YNlogo_without_word.png" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tighter capitalize leading-none">
                            Yaxshi Niyat
                        </h2>
                    </div>
                </div>


            </div>

            {/* NAVIGATION */}
            <div className="flex-1 space-y-8 overflow-y-auto px-1 scrollbar-hide">
                <section>
                    <div className="text-[9px] text-[var(--text-muted)] tracking-[0.3em] font-black capitalize px-4 mb-5 flex items-center gap-3">
                        <Circle size={4} className="fill-[var(--gold)]" /> Asosiy Bo'limlar
                    </div>
                    <nav className="space-y-1.5">
                        {menuItems.map((item) => {
                            const linkTo = getLinkWithBranch(item.path);
                            const isActive = item.path === "/mentor"
                                ? location.pathname === "/mentor" || location.pathname === "/mentor/"
                                : location.pathname.startsWith(item.path);

                            return (
                                <NavLink
                                    key={item.path}
                                    to={linkTo}
                                    className={`nav-link-v2 ${isActive ? 'active' : ''}`}
                                >
                                    <span className="shrink-0">{item.icon}</span>
                                    <span className="font-bold text-[11px] capitalize tracking-widest">{item.name}</span>
                                    {isActive && (
                                        <div className="ml-auto w-1 h-1 bg-[var(--gold)] rounded-full shadow-[0_0_10px_var(--gold)]" />
                                    )}
                                </NavLink>
                            );
                        })}
                    </nav>
                </section>

                {hasExtraBranches && (
                    <section>
                        <div className="text-[9px] text-[var(--text-muted)] tracking-[0.3em] font-black capitalize px-4 mb-5 flex items-center gap-3">
                            <Circle size={4} className="fill-[var(--gold)]" /> Biriktirilgan Filiallar
                        </div>
                        <div className="space-y-1.5">
                            {/* MAIN BRANCH */}
                            {/* MAIN BRANCH */}
                            <NavLink
                                to={currentPath}
                                className={({ isActive }) =>
                                    `nav-link-v2 ${(!currentBranchParam || Number(currentBranchParam) === Number(userInfo?.branch_id)) ? 'active' : ''}`
                                }
                            >
                                <Building2 size={16} className="shrink-0" />
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-[11px] capitalize tracking-widest truncate">{userInfo.branch_name}</span>
                                    <span className="text-[7px] font-black capitalize tracking-widest text-[var(--gold)] opacity-60">Asosiy Filial</span>
                                </div>
                            </NavLink>

                            {/* EXTRA BRANCHES */}
                            {userInfo.accessible_branches
                                .filter(b => Number(b.branch_id) !== Number(userInfo.branch_id))
                                .map((branch) => (
                                    <NavLink
                                        key={branch.branch_id}
                                        to={`${currentPath}?branch=${branch.branch_id}`}
                                        className={({ isActive }) =>
                                            `nav-link-v2 ${Number(currentBranchParam) === Number(branch.branch_id) ? 'active' : ''}`
                                        }
                                    >
                                        <Building2 size={16} className="shrink-0" />
                                        <span className="font-bold text-[11px] capitalize tracking-widest truncate">{branch.branch_name}</span>
                                    </NavLink>
                                ))}
                        </div>
                    </section>
                )}
            </div>

            {/* PROFILE SECTION */}
            <div className="mt-auto pt-6 border-t border-[var(--border-glass)]">
                <div
                    onClick={() => navigate(getLinkWithBranch("/mentor/profile"))}
                    className={`flex items-center gap-4 px-4 py-4 mb-6 group cursor-pointer border rounded-2xl transition-all shadow-inner ${location.pathname === "/mentor/profile" ? 'bg-[var(--gold-dim)] border-[var(--gold)]/30' : 'bg-[var(--bg-void)]/40 border-[var(--border-glass)] hover:bg-[var(--gold-dim)] hover:border-[var(--gold)]/20'}`}
                >
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center overflow-hidden border border-[var(--border-glass)] group-hover:border-[var(--gold)]/40 transition-all shadow-xl">
                        <img
                            src={userMe?.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userMe?.first_name || 'Mentor'}&backgroundColor=000000`}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-black capitalize tracking-tighter truncate ${location.pathname === "/mentor/profile" ? 'text-[var(--gold)]' : 'text-[var(--text-primary)]'}`}>
                            {userMe?.first_name || userMe?.username || "O'qituvchi"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <p className="text-[7px] text-[var(--gold)] font-black capitalize tracking-[0.2em]">Tizimda</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => { if (confirm("Tizimdan chiqmoqchimisiz?")) { localStorage.clear(); window.location.href = '/'; } }}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-red-500/5 hover:bg-red-500/10 text-red-500 text-[10px] font-black capitalize tracking-[0.2em] rounded-2xl border border-red-500/10 transition-all active:scale-95 group"
                >
                    <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    <span>Chiqish</span>
                </button>
            </div>

            <style>{`
 .nav-link-v2 {
 display: flex;
 align-items: center;
 gap: 16px;
 padding: 12px 16px;
 border-radius: 14px;
 color: var(--text-secondary);
 transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
 border: 1px solid transparent;
 }
 .nav-link-v2:hover {
 background: var(--bg-void);
 color: var(--text-primary);
 border-color: var(--border-glass);
 }
 .nav-link-v2.active {
 background: var(--gold-dim);
 color: var(--gold);
 border-color: rgba(184, 134, 11, 0.2);
 }
 `}</style>
        </div>
    );
}
