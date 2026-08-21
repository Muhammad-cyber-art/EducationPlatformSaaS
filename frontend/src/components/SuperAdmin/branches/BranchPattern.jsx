import { Outlet, useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import WarningModal from "../../Errors/Warning";
import { Plus, LayoutGrid, MapPin, UserCircle, WalletCards, ChevronRight, Building2, ExpandIcon, Trash2, ArrowLeftRight } from "lucide-react";
import TransferStaff from "../TransferStaff";
import ThemeToggle from "../../ThemeToggle";

const BranchPattern = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { branch_id } = useParams();
    const message = "Filial qo'shish hazil ish emas, keyin uni o'chirib tashlab bo'lmaydi";
    const [activeBranchId, setActiveBranchId] = useState(null);
    const [modal, setModal] = useState(false);
    const [stafmodal, setStaffModal] = useState(false);

    // Use React Query to fetch branches
    const { data: branchesData, isLoading } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await api.get("/add_branch/branches/");
            // Pagination yoki oddiy massivni qo'llab-quvvatlash
            return res.data.results || res.data || [];
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
    });

    const branches = Array.isArray(branchesData) ? branchesData : [];
    const activeBranch = branches.find(b => b.id === activeBranchId);

    useEffect(() => {
        if (branches.length > 0) {
            const urlId = branch_id ? Number(branch_id) : null;
            if (urlId) {
                setActiveBranchId(urlId);
            } else {
                const firstId = branches[0].id;
                setActiveBranchId(firstId);
                if (location.pathname === '/dashboard' || location.pathname === '/') {
                    navigate(`branch/${firstId}`, { replace: true });
                }
            }
        }
    }, [branches, branch_id, location.pathname, navigate]);

    useEffect(() => {
        if (branch_id) {
            setActiveBranchId(Number(branch_id));
        }
    }, [branch_id]);

    const handleTabClick = (id) => {
        setActiveBranchId(id);
        navigate(`branch/${id}`);
    };

    return (
        <div className="flex flex-col min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans">

            {/* Modal Components */}
            {stafmodal && <TransferStaff isOpen={stafmodal} onClose={() => setStaffModal(false)} />}
            {modal && <WarningModal close={setModal} sms={message} />}

            <main className="flex-1 flex flex-col min-w-0">

                {/* TOP BAR: Branch Switcher & Actions */}
                <div className="sticky top-0 z-40 bg-[var(--bg-void)] border-b border-[var(--border-glass)]">
                    <div className="flex items-center justify-between px-4 md:px-6">

                        {/* Horizontal Branch List */}
                        <div className="flex-1 flex overflow-x-auto py-2 md:py-3 gap-2 scrollbar-hide items-center">
                            <div className="md:hidden pr-2 border-r border-[var(--border-glass)]">
                                <LayoutGrid size={14} className="text-[var(--gold)]" />
                            </div>

                            {branches.map((branch) => {
                                const isActive = activeBranchId === branch.id && location.pathname.includes('branch');
                                return (
                                    <button
                                        key={branch.id}
                                        onClick={() => handleTabClick(branch.id)}
                                        className={`shrink-0 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[9px] md:text-[10px] font-black capitalize transition-all flex items-center gap-2 border
                                        ${isActive
                                                ? "bg-[var(--gold)] border-[var(--gold)] text-black shadow-[0_0_15px_rgba(184,134,11,0.3)]"
                                                : "bg-[var(--bg-panel)] border-[var(--border-glass)] text-[var(--text-secondary)] hover:border-[var(--gold)]/30 hover:text-[var(--text-primary)]"}`}
                                    >
                                        <Building2 size={isActive ? 12 : 11} className={isActive ? "text-black" : "text-[var(--text-muted)]"} />
                                        {branch.name}
                                    </button>
                                );
                            })}

                            {/* ACTION BUTTONS (Moved from sidebar) */}
                            <div className="flex items-center gap-2 pl-2 md:pl-4 border-l border-[var(--border-glass)] ml-2">
                                <button
                                    onClick={() => setStaffModal(true)}
                                    className="p-2 rounded-lg flex bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all group"
                                    title="Xodimlarni ko'chirish"
                                >
                                    <ArrowLeftRight size={14} className="group-hover:scale-110 transition-transform" /> <span className="hidden md:inline ps-2 text-[9px] font-black capitalize tracking-wider">Xodim transfer qilish</span>
                                </button>

                                <button
                                    onClick={() => {
                                        navigate("add-branch");
                                        setModal(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all group"
                                >
                                    <Plus size={14} />
                                    <span className="hidden md:inline text-[9px] font-black capitalize tracking-wider">Yangi filial</span>
                                </button>
                            </div>
                        </div>

                        <div className="ml-4 shrink-0">
                            <ThemeToggle />
                        </div>
                    </div>
                </div>

                {/* BREADCRUMBS / PATH INDICATOR */}
                <div className="px-4 md:px-10 py-2.5 md:py-4 flex items-center gap-2 flex-wrap border-b border-[var(--border-glass)] bg-[var(--bg-void)]/50">
                    <div className="flex items-center gap-1.5 text-[8.5px] md:text-[9.5px] font-black capitalize tracking-[0.15em] text-[var(--text-secondary)]">
                        <LayoutGrid size={10} className="mb-0.5" /> Boshqaruv
                    </div>
                    <ChevronRight size={10} className="text-[var(--text-muted)]" />
                    <div className="text-[8.5px] md:text-[9.5px] font-black capitalize tracking-[0.15em] text-[var(--gold)]">
                        {location.pathname.includes('profile') ? 'Profil' :
                            location.pathname.includes('all-payments') ? 'To\'lovlar' :
                                activeBranch?.name || 'Filial'}
                    </div>
                </div>

                <div className="px-3 md:px-10 py-5">
                    <Outlet context={{ branchId: activeBranchId }} />
                </div>
            </main>
        </div>
    );
};

export default BranchPattern;
