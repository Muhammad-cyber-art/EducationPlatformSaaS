import React from "react";
import { GraduationCap, MoreVertical, LogIn, LogOut, CheckCircle2, XCircle, User, DollarSign, Clock } from "lucide-react";
import { getPaymentStatus } from "./paymentStatus";

const StudentGroupsSection = ({
    studentData,
    groups,
    paymentsAllGroups,
    showGroupMenu,
    unenrollMutation,
    generatePaymentMutation,
    navigate,
    dispatch
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {groups?.map(group => {
                const paymentsArray = Array.isArray(paymentsAllGroups) ? paymentsAllGroups : [];
                const groupPayment = paymentsArray.find(p => p.group === group.id);
                const payStatus = getPaymentStatus(groupPayment);
                const progressPct = groupPayment?.amount > 0 && payStatus.key === 'partial'
                    ? Math.min(100, Math.round((payStatus.paidAmount / Number(groupPayment.amount)) * 100))
                    : payStatus.key === 'paid' ? 100 : 8;

                return (
                    <div 
                        key={group.id} 
                        className="lux-card !p-0 overflow-hidden border border-[var(--border-glass)] hover:border-[var(--gold)]/30 transition-all flex flex-col"
                    >
                        {/* TOP: GROUP INFO */}
                        <div 
                            className="p-4 sm:p-5 flex justify-between items-start cursor-pointer hover:bg-[var(--gold)]/5 transition-colors"
                            onClick={() => navigate(`/admin/groups/${group.id}`)}
                        >
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shrink-0 shadow-inner">
                                    <GraduationCap size={20} className="sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[7px] sm:text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none mb-1">Guruh</p>
                                    <h3 className="text-sm sm:text-base font-black text-[var(--text-primary)] capitalize tracking-tight truncate">{group.name}</h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        {group.days && (
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${
                                                group.days === 'even' ? 'text-[var(--gold)] bg-[var(--gold)]/10 border-[var(--gold)]/20' : 
                                                group.days === 'everyday' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 
                                                'text-blue-400 bg-blue-400/10 border-blue-400/20'
                                            }`}>
                                                {group.days === 'even' ? 'Juft' : group.days === 'everyday' ? 'Har kuni' : 'Toq'}
                                            </span>
                                        )}
                                        <span className="text-[8px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                                            <User size={10} /> {group.mentor?.first_name || "Ustoz"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_MENU', payload: group.id }); }}
                                    className="p-2 text-[var(--text-muted)] hover:text-white transition-all rounded-lg"
                                >
                                    <MoreVertical size={16} />
                                </button>

                                {showGroupMenu === group.id && (
                                    <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-100 origin-top-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                dispatch({ type: 'TOGGLE_TRANSFER_MODAL', payload: true, group: group });
                                                dispatch({ type: 'TOGGLE_MENU', payload: false });
                                            }}
                                            className="w-full flex items-center gap-2.5 px-4 py-3 text-[9px] font-black text-[var(--text-primary)] uppercase tracking-widest hover:bg-[var(--gold)] hover:text-black transition-colors"
                                        >
                                            <LogIn size={14} /> Ko'chirish
                                        </button>
                                        {!groupPayment && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    dispatch({ type: 'TOGGLE_MENU', payload: false });
                                                    generatePaymentMutation.mutate(group.id);
                                                }}
                                                className="w-full flex items-center gap-2.5 px-4 py-3 text-[9px] font-black text-[var(--text-primary)] uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-colors"
                                                disabled={generatePaymentMutation.isLoading}
                                            >
                                                {generatePaymentMutation.isLoading ? <DollarSign size={14} className="animate-spin" /> : <DollarSign size={14} />} Oylik yaratish
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                dispatch({ type: 'TOGGLE_MENU', payload: false });
                                                if (studentData?.groups?.length > 1) {
                                                    dispatch({ type: 'TOGGLE_UNENROLL_SELECT_MODAL', payload: true });
                                                } else {
                                                    if (window.confirm("Guruhdan chiqarishni tasdiqlaysizmi?")) {
                                                        unenrollMutation.mutate(group.id);
                                                    }
                                                }
                                            }}
                                            className="w-full flex items-center gap-2.5 px-4 py-3 text-[9px] font-black text-red-500 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors"
                                        >
                                            <LogOut size={14} /> Chiqarish
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BOTTOM: STATUS & PRICES */}
                        <div className="mt-auto p-4 sm:p-5 bg-[var(--bg-void)]/30 border-t border-[var(--border-glass)] space-y-4">
                            <div className="flex justify-between items-center gap-4">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center border ${payStatus.badgeClass}`}>
                                        {payStatus.key === 'paid' ? <CheckCircle2 size={16} className="sm:w-5 sm:h-5" /> : payStatus.key === 'partial' ? <Clock size={16} className="sm:w-5 sm:h-5" /> : <XCircle size={16} className="sm:w-5 sm:h-5" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className={`text-[11px] sm:text-xs font-black uppercase tracking-widest leading-none ${payStatus.textClass}`}>
                                            {payStatus.label}
                                        </h3>
                                        {payStatus.key === 'partial' && (
                                            <p className="text-[8px] font-black text-amber-500/90 uppercase tracking-widest mt-1">
                                                Qolgan: {Math.floor(payStatus.remainingAmount).toLocaleString()} UZS
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <span className="text-[9px] font-bold text-[var(--text-muted)] whitespace-nowrap">
                                                Qatnashdi: {groupPayment?.attended_count || 0}/{groupPayment?.lessons_count || 0}
                                            </span>
                                            {groupPayment?.lessons_count > 0 && (
                                                <span className="text-[8px] font-black text-amber-500/80 bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10">
                                                    {Math.round(((groupPayment?.attended_count || 0) / groupPayment?.lessons_count) * 100)}%
                                                </span>
                                            )}
                                            {groupPayment?.absences_count > 0 && (
                                                <span className="text-[9px] font-bold text-red-400/80 whitespace-nowrap ml-1">
                                                    Qoldirdi: {groupPayment?.absences_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="shrink-0 text-right">
                                    <p className="text-[10px] sm:text-xs font-black text-[var(--text-primary)] tabular-nums">
                                        {group.monthly_price?.toLocaleString()} UZS
                                    </p>
                                    <p className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Guruh Narxi</p>
                                </div>
                            </div>

                            {/* PRICE PER LESSON INFO */}
                            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-glass)]/30">
                                <div className="flex items-center gap-2">
                                    <DollarSign size={12} className="text-[var(--gold)] opacity-50" />
                                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Dars Narxi:</span>
                                </div>
                                <span className="text-[10px] font-black text-[var(--text-secondary)] tabular-nums">
                                    {groupPayment?.daily_price ? `${Math.floor(groupPayment.daily_price).toLocaleString()} UZS` : 'N/A'}
                                </span>
                            </div>
                            
                            {/* PROGRESS BAR */}
                            <div className="h-1 w-full bg-[var(--bg-void)] rounded-full overflow-hidden shadow-inner">
                                <div 
                                    className={`h-full transition-all duration-1000 ${payStatus.barClass}`}
                                    style={{ width: `${progressPct}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* ADD GROUP CARD */}
            <div
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dispatch({ type: 'TOGGLE_JOIN_GROUP_MODAL', payload: true });
                }}
                className="lux-card !p-5 flex flex-col items-center justify-center border-dashed border-2 border-[var(--border-glass)] hover:border-[var(--gold)]/40 hover:bg-[var(--gold)]/5 transition-all cursor-pointer group/add min-h-[140px] active:scale-95"
            >
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] group-hover/add:text-[var(--gold)] group-hover/add:border-[var(--gold)]/30 transition-all mb-3">
                    <GraduationCap size={20} />
                </div>
                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] group-hover/add:text-[var(--text-primary)] transition-colors">Yangi Guruhga Qo'shish</p>
            </div>
        </div>
    );
};

export default StudentGroupsSection;
