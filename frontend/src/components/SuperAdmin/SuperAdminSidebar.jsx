import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
    Building2,
    Wallet,
    Trash2,
    UserCircle,
    LogOut,
    Diamond,
    ChevronRight
} from "lucide-react";
import { useCurrentBranch } from "../Authorized/useBranchId";
import { get_user_info } from "../Authorized/getRole";

export default function SuperAdminSidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentBranchId } = useCurrentBranch();
    const userInfo = get_user_info();

    const menuItems = [
        {
            name: "Filiallar",
            path: "/super_admin",
            icon: <Building2 size={20} />,
            exact: true
        },
        {
            name: "Moliya",
            path: "/super_admin/all-payments",
            icon: <Wallet size={20} />
        },
        {
            name: "Arxiv",
            path: `/super_admin/branch/${currentBranchId}/archive/`,
            icon: <Trash2 size={20} />
        },
        {
            name: "Profil",
            path: "/super_admin/profile",
            icon: <UserCircle size={20} />
        },
    ];

    const handleLogout = () => {
        if (confirm("Tizimdan chiqmoqchimisiz?")) {
            localStorage.clear();
            window.location.href = "/";
        }
    };

    return (
        <div className="w-full h-full bg-[var(--sidebar-bg)] border-r border-[var(--border-glass)] flex flex-col p-6 backdrop-blur-xl">
            {/* LOGO */}
            <div className="mb-12 flex items-center gap-4 cursor-pointer" onClick={() => navigate('/super_admin')}>
                <div className="w-12 h-12 flex items-center justify-center transition-all">
                    <img src="/YNlogo_without_word.png" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-[var(--text-primary)] leading-none tracking-tighter capitalize">
                        Yaxshi Niyat
                    </h1>
                </div>
            </div>

            {/* MENU */}
            <div className="flex-1 space-y-2">
                <p className="px-4 text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.3em] mb-4 opacity-50">Menu</p>

                {menuItems.map((item) => {
                    const isActive = item.exact
                        ? location.pathname === item.path
                        : location.pathname.startsWith(item.path) && item.path !== "/super_admin";

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.exact}
                            className={({ isActive: linkActive }) =>
                                `flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all group duration-300
 ${isActive || linkActive
                                    ? "bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/10 shadow-[var(--gold-glow)]"
                                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)]"
                                }`
                            }
                        >
                            <div className="relative">
                                {item.icon}
                                {(isActive) && <div className="absolute inset-0 bg-[var(--gold)] blur-lg opacity-20" />}
                            </div>
                            <span className="text-xs font-bold capitalize tracking-widest">{item.name}</span>
                            {(isActive) && <ChevronRight size={14} className="ml-auto opacity-60" />}
                        </NavLink>
                    );
                })}
            </div>

            {/* FOOTER */}
            <div className="pt-6 border-t border-[var(--border-glass)] space-y-4">
                <div className="p-3 bg-[var(--bg-void)]/50 rounded-xl border border-[var(--border-glass)] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)]">
                        <UserCircle size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{userInfo?.username || "Super Admin"}</p>
                        <p className="text-[8px] text-[var(--gold)] capitalize tracking-wider">Online</p>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full h-12 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/30 text-red-500 hover:text-red-400 flex items-center justify-center gap-3 transition-all font-bold text-[10px] capitalize tracking-widest group"
                >
                    <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span>Chiqish</span>
                </button>
            </div>
        </div>
    );
}
