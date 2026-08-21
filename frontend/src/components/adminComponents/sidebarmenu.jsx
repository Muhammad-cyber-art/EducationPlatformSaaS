import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  UserSquare2,
  GraduationCap,
  Building2,
  Trash2,
  LogOut,
  Diamond,
  Layers,
  ChevronRight,
  Dna,
  CheckCircle2,
  User,
  DollarSign,
  UserPlus,
  TrendingDown,
} from "lucide-react";
import { get_user_info } from "../Authorized/getRole";
import api from "../../tokenUpdater/updater";


export default function SideBar({ isOpen, onClose }) {
  const fromToken = get_user_info();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: userMe } = useQuery({
    queryKey: ["user-me"],
    queryFn: () => api.get("/user/me/").then((res) => res.data),
    staleTime: 60 * 1000,
  });

  const userInfo = userMe && fromToken ? {
    ...fromToken,
    ...userMe,
    branch_id: userMe.branch?.id ?? fromToken.branch_id,
    branch_name: userMe.branch?.name ?? fromToken.branch_name,
    accessible_branches: Array.isArray(userMe.accessible_branches) ? userMe.accessible_branches : (fromToken.accessible_branches ?? []),
  } : fromToken;

  const currentPath = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const currentBranchParam = searchParams.get("branch");
  const activeBranchId = currentBranchParam ? Number(currentBranchParam) : userInfo?.branch_id || null;

  const menuItems = [
    { name: "Asosiy", path: "/admin", icon: <LayoutDashboard size={20} /> },
    { name: "Guruhlar", path: "/admin/groups", icon: <Layers size={20} /> },
    { name: "O'qituvchilar", path: "/admin/mentors", icon: <UserSquare2 size={20} /> },
    { name: "Kutishlar Zali", path: "/admin/waiting-hall", icon: <UserPlus size={20} /> },
    { name: "O'quvchilar", path: "/admin/all_students", icon: <GraduationCap size={20} /> },
    { name: "Arxiv", path: "/admin/archive", icon: <Trash2 size={20} /> },
    ...(userInfo?.permissions?.pay_slip !== false ? [{ name: "Moliya", path: "/admin/finance", icon: <DollarSign size={20} /> }] : []),
    { name: "Chiqimlar", path: "/admin/expenses", icon: <TrendingDown size={20} /> },
    { name: "Profil", path: "/admin/profile", icon: <User size={20} /> },
  ];

  const getLinkWithBranch = (basePath) => {
    if (!currentBranchParam) return basePath;
    return `${basePath}?branch=${currentBranchParam}`;
  };

  const handleLogout = () => {
    if (confirm("Tizimdan chiqmoqchimisiz?")) {
      localStorage.clear();
      window.location.href = "/";
    }
  };

  return (
    <>
      <div className={`lux-sidebar ${isOpen ? 'open' : ''}`}>

        {/* LOGO SECTION */}
        <div className="mb-12 px-2 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/admin')}>
            <div className="w-12 h-12 flex items-center justify-center transition-all">
              <img src="/YNlogo_without_word.png" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]" />
            </div>
            <h1 className="text-xl font-black text-[var(--text-primary)] leading-none tracking-tighter capitalize">
              Yaxshi Niyat
            </h1>
          </div>


        </div>

        {/* NAVIGATION SECTIONS */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2 scrollbar-hide space-y-10">

          <section>
            <h2 className="text-[9px] font-black text-[var(--gold)] capitalize tracking-[0.4em] px-4 mb-6 opacity-50">Asosiy Bo'limlar</h2>
            <nav className="space-y-1.5">
              {menuItems.map((item) => {
                const linkTo = getLinkWithBranch(item.path);
                const isActive = item.path === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={linkTo}
                    onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                    className={({ isActive: linkActive }) => `lux-nav-item ${isActive || linkActive ? 'active' : ''} group`}
                  >
                    <div className="relative">
                      {item.icon}
                      {isActive && <div className="absolute -inset-2 bg-[var(--gold)]/10 blur-md rounded-full -z-10" />}
                    </div>
                    <span>{item.name}</span>
                    {isActive && <ChevronRight size={14} className="ml-auto opacity-40" />}
                  </NavLink>
                );
              })}
            </nav>
          </section>

          {/* BRANCH PORTALS */}
          {(userInfo?.accessible_branches?.length > 0) && (
            <section>
              <h2 className="text-[9px] font-black text-[var(--gold)] capitalize tracking-[0.4em] px-4 mb-6 opacity-50">Biriktirilgan Filiallar</h2>
              <div className="space-y-1.5">
                {/* Main Branch Portal */}
                <Link
                  to={currentPath}
                  className={`lux-nav-item ${(!currentBranchParam || Number(currentBranchParam) === userInfo?.branch_id) ? 'active shadow-[var(--gold-glow)]' : ''} group`}
                >
                  <div className="relative">
                    <Building2 size={20} />
                    {(!currentBranchParam || Number(currentBranchParam) === userInfo?.branch_id) && <div className="absolute -inset-2 bg-[var(--gold)]/10 blur-md rounded-full -z-10" />}
                  </div>
                  <span>{userInfo.branch_name || "Asosiy Filial"}</span>
                  {(!currentBranchParam || Number(currentBranchParam) === userInfo?.branch_id) && <CheckCircle2 size={12} className="ml-auto text-[var(--gold)] transition-all animate-in zoom-in" />}
                </Link>

                {/* Additional Branch Portals */}
                {userInfo.accessible_branches.filter(b => b.branch_id !== userInfo.branch_id).map((branch) => {
                  const isThisActive = Number(currentBranchParam) === branch.branch_id;
                  return (
                    <Link
                      key={branch.branch_id}
                      to={`${currentPath}?branch=${branch.branch_id}`}
                      className={`lux-nav-item ${isThisActive ? 'active shadow-[var(--gold-glow)]' : ''} group`}
                    >
                      <div className="relative">
                        <Building2 size={20} />
                        {isThisActive && <div className="absolute -inset-2 bg-[var(--gold)]/10 blur-md rounded-full -z-10" />}
                      </div>
                      <span>{branch.branch_name}</span>
                      {isThisActive && <CheckCircle2 size={12} className="ml-auto text-[var(--gold)] transition-all animate-in zoom-in" />}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* FOOTER SECTION */}
        <div className="mt-auto pt-8 border-t border-[var(--border-glass)] space-y-4">
          <Link
            to="/admin/profile"
            onClick={() => { if (window.innerWidth < 1024) onClose(); }}
            className="lux-card !p-3 !bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center gap-3 hover:border-[var(--gold)]/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] flex items-center justify-center overflow-hidden group-hover:border-[var(--gold)]/20">
              {userInfo?.image ? (
                <img src={userInfo.image} className="w-full h-full object-cover" alt="" />
              ) : (
                <Dna size={18} className="text-[var(--gold)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-[var(--text-primary)] truncate capitalize group-hover:text-[var(--gold)] transition-colors">{userInfo?.first_name || "Tizimda"}</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-[8px] text-[var(--text-muted)] font-black capitalize tracking-widest">Tizimda</p>
              </div>
            </div>
            <ChevronRight size={12} className="text-[var(--text-muted)] group-hover:text-[var(--gold)] group-hover:translate-x-0.5 transition-all" />
          </Link>

          <button
            onClick={handleLogout}
            className="w-full h-12 rounded-2xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/30 text-red-500 flex items-center justify-center gap-3 transition-all active:scale-95 group font-black text-[10px] capitalize tracking-[0.2em]"
          >
            <LogOut size={18} className="transition-transform group-hover:-translate-x-1" />
            <span>Chiqish</span>
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[190] lg:hidden animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}
    </>
  );
}