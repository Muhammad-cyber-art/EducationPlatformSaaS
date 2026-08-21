import React from "react";
import { ArrowLeft, Settings, Calculator, Loader2, Edit3, Coins, Trash2, Users } from "lucide-react";
import toast from "react-hot-toast";
import ThemeToggle from "../../../ThemeToggle";

const PaymentHeader = ({
    navigate,
    data,
    isPercentageType,
    isStudentCountType,
    handleRecalculate,
    recalculating,
    isSuperAdmin,
    dispatch,
    setEditModal,
    setSelectedHistoryItem,
    handleDelete,
    setGroupConfigModal
}) => {
    return (
        <div className="flex flex-col gap-3 mb-5">
            <button onClick={() => navigate(-1)} className="group flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--gold)] transition-all w-fit">
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-[9px] font-black capitalize tracking-[0.2em]">Orqaga</span>
            </button>

            <div className="w-full flex flex-col sm:flex-row items-center justify-between p-3 px-6 bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-2xl backdrop-blur-xl gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[var(--gold)]/10 rounded-lg text-[var(--gold)]">
                        <Settings size={16} />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest leading-none mb-1">Xodim Sozlamalari</h3>
                        <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-tighter">
                            {isPercentageType ? "Foiz asosida" : isStudentCountType ? "O'quvchi boshiga" : "Belgilangan maosh"}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        {(isPercentageType || isStudentCountType) && !data.is_paid && (
                            <button
                                onClick={handleRecalculate}
                                disabled={recalculating}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl text-[9px] font-black capitalize tracking-widest transition-all"
                                title="Qayta hisoblash"
                            >
                                {recalculating ? <Loader2 className="animate-spin" size={12} /> : <Calculator size={12} />}
                                <span className="hidden md:inline">Yangilash</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => isSuperAdmin ? dispatch(setEditModal(true)) : toast.error("Ruxsat yo'q")} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--bg-panel)] hover:bg-[var(--gold)]/10 border border-[#2a2a2a] hover:border-[var(--gold)]/50 rounded-xl text-[9px] font-black capitalize tracking-widest transition-all text-[var(--text-secondary)] hover:text-[var(--gold)]">
                            <Edit3 size={12} /> <span className="hidden md:inline">Tahrirlash</span>
                        </button>

                        {isSuperAdmin && (
                            <button
                                onClick={() => dispatch(setSelectedHistoryItem('advance'))}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20 rounded-xl text-[9px] font-black capitalize tracking-widest transition-all"
                            >
                                <Coins size={12} /> <span className="hidden md:inline">Avans</span>
                            </button>
                        )}

                        {isSuperAdmin && data?.mentor_groups && data.mentor_groups.length > 0 && (
                            <button
                                onClick={() => dispatch(setGroupConfigModal(true))}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white border border-blue-500/20 rounded-xl text-[9px] font-black capitalize tracking-widest transition-all"
                            >
                                <Users size={12} /> <span className="hidden md:inline">Guruh Konfiguratsiyalari</span>
                            </button>
                        )}

                        {isSuperAdmin && (
                            <button onClick={handleDelete} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-xl text-[9px] font-black capitalize tracking-widest transition-all" title="Butun profilni o'chirish">
                                <Trash2 size={12} /> <span className="hidden md:inline">Profilni O'chirish</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentHeader;
