import React from "react";
import { UserCheck, Trash2, Target, MessageSquare, Activity, BookOpen, Archive, DownloadCloud } from "lucide-react";

const GroupSidebar = ({
    groupinfo,
    primaryColor,
    botStats,
    isGroupLogicActive,
    canSeeHomework,
    isAdmin,
    isSuperAdmin,
    isMentor,
    handleRemoveMentor,
    handleDownloadMonthlyReport,
    uiDispatch
}) => {
    return (
        <div className="xl:col-span-2 space-y-4">
            {/* PRIMARY MENTOR */}
            <div className="lux-card-static group">
                <div className="flex items-center gap-3 mb-3">
                    <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--gold)]"
                        style={{ color: primaryColor }}
                    >
                        <UserCheck size={16} />
                    </div>
                    <div>
                        <p className="text-[7px] font-bold text-[var(--text-muted)] capitalize tracking-widest leading-none">Mentor</p>
                    </div>
                </div>

                <p className="text-sm font-bold text-[var(--text-primary)] capitalize tracking-tight transition-colors">
                    {groupinfo?.mentor?.first_name} {groupinfo?.mentor?.last_name || ""}
                </p>

                {groupinfo.additional_mentors?.length > 0 && (
                    <div className="space-y-4 pt-6 mt-6 border-t border-[var(--border-glass)]">
                        <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-[0.3em]">Yordamchi o'qituvchilar</p>
                        <div className="flex flex-wrap gap-3">
                            {groupinfo.additional_mentors.map((am) => (
                                <div key={am.id} className="relative group/delegate">
                                    <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-void)]/80 border border-[var(--border-glass)] text-[9px] font-black text-[var(--text-secondary)] capitalize tracking-widest flex items-center gap-2 hover:border-[var(--gold)]/30 transition-all cursor-default">
                                        <div className="w-1 h-1 rounded-full bg-[var(--gold)]/50" />
                                        {am.mentor_name}
                                    </div>

                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl py-1.5 px-2 shadow-2xl opacity-0 invisible group-hover/delegate:opacity-100 group-hover/delegate:visible group-hover/delegate:-top-14 transition-all duration-300 z-50 flex items-center gap-2 min-w-[100px] whitespace-nowrap">
                                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--bg-panel)] border-b border-r border-[var(--border-glass)] rotate-45" />
                                        <span className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-tighter px-1">Olib tashlash?</span>
                                        <button
                                            onClick={() => handleRemoveMentor(am.mentor)}
                                            className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                            title="Olib tashlash"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* SCHEDULE PROTOCOL */}
            <div className="lux-card-static !p-4 border-[var(--border-glass)]">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)]">
                        <Target size={16} />
                    </div>
                    <p className="text-[8px] font-black text-[var(--text-primary)] capitalize tracking-widest">Jadval</p>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-[7px] font-bold text-[var(--text-muted)] capitalize tracking-widest opacity-50">Vaqt</p>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{groupinfo.dars_vaqti || "---"}</p>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="text-[7px] font-bold text-[var(--text-muted)] capitalize tracking-widest opacity-50">Kunlar</p>
                        <p className="text-xs font-bold">
                            {groupinfo.days === 'even' ? (
                                <span className="text-[var(--gold)]">Juft</span>
                            ) : groupinfo.days === 'everyday' ? (
                                <span className="text-emerald-500">Har kuni</span>
                            ) : (
                                <span className="text-blue-400">Toq</span>
                            )}
                        </p>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="text-[7px] font-bold text-[var(--text-muted)] capitalize tracking-widest opacity-50">Narx</p>
                        <p className="text-xs font-bold text-[var(--gold)]">
                            {Number(groupinfo.monthly_price || 0).toLocaleString()} UZS
                        </p>
                    </div>
                </div>
            </div>

            {/* BOT STATISTICS */}
            <div className="lux-card-static !p-4 border-[var(--gold)]/20 shadow-[0_0_20px_rgba(184,134,11,0.05)]">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[var(--gold-dim)] border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)]">
                        <MessageSquare size={14} />
                    </div>
                    <p className="text-[8px] font-black text-[var(--text-primary)] capitalize tracking-widest">Bot Stats</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-[var(--bg-void)]/40 border border-[var(--border-glass)]">
                        <p className="text-[6px] font-bold text-[var(--text-muted)] capitalize mb-1">O'quvchi</p>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{botStats?.students_bot_count || 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[var(--bg-void)]/40 border border-[var(--border-glass)]">
                        <p className="text-[6px] font-bold text-[var(--text-muted)] capitalize mb-1">Ota-ona</p>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{botStats?.parents_bot_count || 0}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {canSeeHomework && (
                    <>
                        <button
                            disabled={!isGroupLogicActive}
                            onClick={() => uiDispatch({ type: "SET_FIELD", field: "isHomeworkModalOpen", value: true })}
                            className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${isGroupLogicActive ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white' : 'opacity-50 cursor-not-allowed'}`}
                        >
                            <Activity size={16} />
                            <span className="text-[8px] font-black capitalize tracking-widest text-center">Vazifa</span>
                        </button>
                        <button
                            disabled={!isGroupLogicActive}
                            onClick={() => uiDispatch({ type: "SET_FIELD", field: "isMockTestModalOpen", value: true })}
                            className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${isGroupLogicActive ? 'bg-rose-600/20 border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white' : 'opacity-50 cursor-not-allowed'}`}
                        >
                            <Target size={16} />
                            <span className="text-[8px] font-black capitalize tracking-widest text-center">Mock</span>
                        </button>
                    </>
                )}
                <button
                    onClick={() => uiDispatch({ type: "SET_FIELD", field: "isViewAllModalOpen", value: true })}
                    className="flex flex-col sm:flex-row items-center justify-center gap-2 p-2.5 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)] hover:text-black transition-all"
                >
                    <BookOpen size={16} />
                    <span className="text-[8px] font-black capitalize tracking-widest text-center">Tarix</span>
                </button>
                <button
                    onClick={() => uiDispatch({ type: "SET_FIELD", field: "isStorageOpen", value: true })}
                    className="flex flex-col sm:flex-row items-center justify-center gap-2 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                >
                    <Archive size={16} />
                    <span className="text-[8px] font-black capitalize tracking-widest text-center">Arxiv</span>
                </button>
                {(isAdmin || isSuperAdmin || isMentor) && (
                    <button
                        onClick={handleDownloadMonthlyReport}
                        className="flex flex-col sm:flex-row items-center justify-center gap-2 p-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white transition-all"
                        title="Oylik hisobotni ko'rish / yuklab olish"
                    >
                        <DownloadCloud size={16} />
                        <span className="text-[8px] font-black capitalize tracking-widest text-center">Oylik</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default GroupSidebar;
