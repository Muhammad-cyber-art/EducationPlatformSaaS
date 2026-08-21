import { get_user_info } from "../Authorized/getRole";
import { useOutletContext } from "react-router-dom";
import {
    Users,
    Calendar,
    Clock,
    Target,
    ArrowUpRight,
    Layers
} from "lucide-react";
import { useCurrentBranch } from "../Authorized/useBranchId";

export default function MentorsGroupCards({ mentorsGroups, navig, horizontal = false, layout = 'grid' }) {
    const user_info = get_user_info();
    const { branchId } = useOutletContext() || {};
    const realBRanch = useCurrentBranch();

    const getGroupPath = (groupId) => {
        if (user_info.role === "admin") {
            return `/admin/groups/${groupId}/?branch=${realBRanch.currentBranchId}`;
        }
        if (user_info.role === "super_admin") {
            return `/super_admin/branch/${branchId}/groups/${groupId}`;
        }
        if (user_info.role === "mentor") {
            return `groups/${groupId}?branch=${realBRanch.currentBranchId}`;
        }
        return null;
    };

    if (!mentorsGroups || mentorsGroups.length === 0) {
        return (
            <div className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-3xl py-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[var(--gold)] opacity-50 shadow-inner">
                    <Layers size={24} />
                </div>
                <p className="text-[11px] font-black text-[var(--text-primary)] capitalize tracking-widest mb-1">Guruhlar biriktirilmagan</p>
                <p className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest opacity-60">Hozircha ushbu xodimga guruh biriktirilmagan.</p>
            </div>
        );
    }

    return (
        <div className={`w-full pb-6 ${horizontal ? 'flex flex-nowrap overflow-x-auto gap-4 snap-x snap-mandatory lux-scrollbar'
                : layout === 'sidebar' ? 'grid grid-cols-1 gap-4'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6'
            }`}>
            {mentorsGroups.map((card) => {
                const path = getGroupPath(card.id);
                const groupColor = card.color || "var(--gold)";

                return (
                    <div
                        key={card.id}
                        onClick={() => path && navig(path)}
                        className={`bg-[var(--bg-panel)] border border-[var(--border-glass)] hover:border-[var(--gold)]/40 transition-all rounded-3xl p-5 md:p-6 cursor-pointer group flex flex-col gap-5 shadow-lg shadow-black/20 ${horizontal ? 'min-w-[280px] max-w-[320px] snap-center shrink-0' : ''}`}
                    >
                        {/* Header: Icon, Name & Status */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 border border-[var(--border-glass)] shadow-inner"
                                    style={{ color: groupColor, backgroundColor: `${groupColor}10` }}
                                >
                                    <Target size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm md:text-base font-black text-[var(--text-primary)] tracking-tight capitalize truncate group-hover:text-[var(--gold)] transition-colors">
                                        {card.name}
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        {card.computed_status === 'active' && (
                                            <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div><span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Faol</span></>
                                        )}
                                        {card.computed_status === 'waiting' && (
                                            <><div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div><span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Kutilmoqda</span></>
                                        )}
                                        {card.computed_status === 'activating_soon' && (
                                            <><div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div><span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Yaqinda</span></>
                                        )}
                                        {card.computed_status === 'inactive' && (
                                            <><div className="w-1.5 h-1.5 rounded-full bg-red-500/50"></div><span className="text-[8px] font-black text-red-500/50 uppercase tracking-widest">Nofaol</span></>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--gold)] group-hover:scale-110 transition-all shrink-0">
                                <ArrowUpRight size={16} />
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl p-3 flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                                    <Users size={12} />
                                    <span className="text-[8px] font-bold uppercase tracking-widest">O'quvchilar</span>
                                </div>
                                <p className="text-sm font-black text-[var(--text-primary)]">
                                    {card.students_count} <span className="text-[9px] font-bold text-[var(--text-muted)] opacity-50 uppercase tracking-widest">Ta</span>
                                </p>
                            </div>

                            <div className="bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl p-3 flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                                    <Clock size={12} />
                                    <span className="text-[8px] font-bold uppercase tracking-widest">Vaqt</span>
                                </div>
                                <p className="text-sm font-black text-[var(--text-primary)] truncate">
                                    {card.dars_vaqti || "---"}
                                </p>
                            </div>
                        </div>

                        {/* Footer: Days */}
                        <div className="w-full bg-[var(--gold)]/5 border border-[var(--gold)]/10 rounded-xl p-3 flex items-center gap-3">
                            <Calendar size={14} className="text-[var(--gold)] shrink-0" />
                            <span className="text-[11px] font-black text-[var(--text-primary)] tracking-wide truncate">
                                {card.days || card.dars_kunlari || "Belgilanmagan"}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}