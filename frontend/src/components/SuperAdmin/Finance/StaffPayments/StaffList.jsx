import React from "react";
import { Search, RefreshCw, Undo2, Loader2, ShieldAlert, Mail, Phone, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const ActionBtn = ({ icon }) => (
    <button onClick={(e) => e.stopPropagation()} className="p-2 sm:p-2.5 bg-black/40 border border-[#2a2a2a] rounded-xl text-[var(--text-muted)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all shadow-inner shrink-0">
        {icon}
    </button>
);

const StaffList = ({
    staffSearchQuery,
    setStaffSearchQuery,
    handleRefreshPayments,
    staffRefreshing,
    staffLoading,
    filteredStaffData
}) => {
    const navigate = useNavigate();

    return (
        <div className="lg:col-span-9 space-y-8">
            {/* SEARCH & ACTIONS */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors sm:w-5 sm:h-5 w-4 h-4" />
                    <input
                        type="text"
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        placeholder="QIDIRISH..."
                        className="w-full bg-black/40 border border-[#2a2a2a] hover:border-[var(--gold)]/30 focus:border-[var(--gold)]/50 rounded-2xl py-3.5 sm:py-5 pl-12 sm:pl-16 pr-6 text-white placeholder:text-white/5 outline-none transition-all text-xs sm:text-sm font-bold capitalize tracking-widest shadow-inner"
                    />
                </div>

                <button
                    onClick={handleRefreshPayments}
                    disabled={staffRefreshing}
                    className="px-6 sm:px-8 py-3.5 sm:py-4 flex items-center justify-center gap-3 sm:gap-4 bg-[var(--bg-panel)]/40 border border-[#2a2a2a] hover:border-[var(--gold)]/30 rounded-2xl text-[9px] sm:text-[10px] font-black capitalize tracking-widest transition-all active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={staffRefreshing ? "animate-spin" : "text-[var(--gold)] sm:w-4 sm:h-4"} />
                    <span>{staffRefreshing ? "..." : "Oylik Ochish"}</span>
                </button>

            </div>

            {/* LIST */}
            <div className="space-y-4">
                {staffLoading ? (
                    <div className="lux-card !py-20 text-center opacity-40">
                        <Loader2 size={48} className="mx-auto mb-6 text-[var(--gold)] animate-spin" />
                        <p className="text-[10px] font-black capitalize tracking-[0.4em]">Yuklanmoqda...</p>
                    </div>
                ) : filteredStaffData.length > 0 ? (
                    filteredStaffData.map((person) => (
                        <div
                            onClick={() => {
                                if (person.current_payment_id) {
                                    navigate(`staff/${person.current_payment_id}`);
                                } else {
                                    toast.error("Ushbu oy uchun maosh hisoblanmagan.'Oylik Ochish' tugmasini bosing.");
                                }
                            }}
                            key={person.id}
                            className="lux-card !p-4 group/row cursor-pointer hover:border-[var(--gold)]/40 transition-all flex flex-col md:flex-row items-center justify-between gap-6"
                        >
                            <div className="flex items-center gap-4 sm:gap-5 w-full md:w-auto">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[var(--bg-void)] border border-[#2a2a2a] flex items-center justify-center text-[var(--gold)] shadow-inner group-hover/row:scale-110 transition-transform duration-500 shrink-0">
                                    <span className="text-xs sm:text-sm font-black capitalize">
                                        {person.full_name?.charAt(0) || person.username?.charAt(0)}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-base sm:text-lg font-black text-white capitalize tracking-tight group-hover/row:text-[var(--gold)] transition-colors truncate">
                                        {person.full_name || person.username}
                                    </h4>
                                    <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-1.5">
                                        <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 ${person.current_payment_id ? 'bg-emerald-500' : 'bg-rose-500'} rounded-full animate-pulse`} />
                                        <span className="text-[7px] sm:text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest">
                                            {person.current_payment_id ? "Hisob-kitob mavjud" : "Hisoblanmagan"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 sm:gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-[#2a2a2a] pt-3 sm:pt-4 md:pt-0">
                                <div className="hidden sm:block text-right">
                                    <p className="text-[7px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5">Maosh Turi / Karta</p>
                                    <p className="text-[10px] sm:text-xs font-black text-white capitalize tracking-tighter">
                                        {person.salary_display || person.salary_type} {person.karta ? `(${person.karta})` : ''}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <ActionBtn icon={<Mail size={12} className="sm:w-3.5 sm:h-3.5" />} />
                                    <ActionBtn icon={<Phone size={12} className="sm:w-3.5 sm:h-3.5" />} />
                                    <div className="w-px h-5 sm:h-6 bg-[var(--border-glass)] mx-1 sm:mx-2" />
                                    <div className="p-2 sm:p-2.5 bg-[var(--gold-dim)] rounded-xl text-[var(--gold)] group-hover/row:bg-[var(--gold)] group-hover/row:text-black transition-all">
                                        <ChevronRight size={16} className="sm:w-4.5 sm:h-4.5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="lux-card !py-20 text-center opacity-40">
                        <ShieldAlert size={48} className="mx-auto mb-6 text-[var(--text-muted)]" />
                        <p className="text-[10px] font-black capitalize tracking-[0.4em]">Ma'lumot topilmadi.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffList;
