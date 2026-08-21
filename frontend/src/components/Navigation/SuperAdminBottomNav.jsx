import { NavLink, useLocation } from "react-router-dom";
import {
    Building2,
    Wallet,
    UserCircle, Trash2
} from "lucide-react";
import { useCurrentBranch } from "../Authorized/useBranchId";

export default function SuperAdminBottomNav() {
    const location = useLocation();
    const { currentBranchId } = useCurrentBranch();

    const menuItems = [
        {
            name: "Filiallar",
            path: "/super_admin",
            icon: <Building2 size={18} />,
        },
        {
            name: "Moliya",
            path: "/super_admin/all-payments",
            icon: <Wallet size={18} />
        },
        {
            name: "Arxiv",
            path: `/super_admin/branch/${currentBranchId}/archive/`,
            icon: <Trash2 size={18} />
        },
        {
            name: "Profil",
            path: "/super_admin/profile",
            icon: <UserCircle size={18} />
        },
    ];

    return (
        <div
            className="md:hidden fixed bottom-0 left-0 right-0 h-14 border-t border-[var(--border-glass)] flex items-center justify-around px-2 z-50"
            style={{ backgroundColor: 'var(--bg-void)' }}
        >
            {menuItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== "/super_admin" && location.pathname.startsWith(item.path));

                return (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex flex-col items-center justify-center gap-1 transition-all duration-300 px-3 py-1 rounded-xl
                            ${isActive
                                ? "text-[var(--gold)] scale-105"
                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`
                        }
                    >
                        <div className={`${isActive ? "text-[var(--gold)] shadow-[var(--gold-glow)]" : ""}`}>
                            {item.icon}
                        </div>
                        <span className="text-[9px] font-bold tracking-tight">{item.name}</span>
                    </NavLink>
                );
            })}
        </div>
    );
}
