import React from "react";
import { X, TrendingDown, ChevronRight, Building2, CheckCircle2 } from "lucide-react";

const WithdrawModal = ({
    show,
    onClose,
    onSubmit,
    withdrawData,
    setWithdrawData,
    isSubmitting,
    handleAmountChange,
    branches,
    filters,
    isSuperAdmin
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <form
                onSubmit={onSubmit}
                className="relative w-full max-w-xl bg-[var(--bg-void)] border border-[#2a2a2a] rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden animate-lux-pop flex flex-col max-h-[90vh]"
            >
                <div className="p-8 xl:p-10 border-b border-[#2a2a2a] flex items-center justify-between bg-gradient-to-r from-red-600/10 via-transparent to-transparent">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-red-600/10 flex items-center justify-center text-red-500 border border-red-500/20 shadow-[inset_0_0_20px_rgba(220,38,38,0.1)]">
                            <TrendingDown size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight leading-tight">Pul Olish</h2>
                            <p className="text-[10px] font-black text-red-500/70 uppercase tracking-[0.4em] mt-1">Withdrawal Authorization</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-12 h-12 flex items-center justify-center bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 rounded-2xl transition-all active:scale-90"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 xl:p-10 space-y-8 overflow-y-auto no-scrollbar">
                    {isSuperAdmin && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                <Building2 size={12} /> Filialni Tanlang
                            </label>
                            <div className="relative">
                                <select
                                    required
                                    value={withdrawData.branch || filters.branch}
                                    onChange={(e) => setWithdrawData(prev => ({ ...prev, branch: e.target.value }))}
                                    className="w-full h-16 bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl px-6 text-[13px] font-bold text-white outline-none focus:border-red-500/50 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Filialni tanlang...</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id} className="bg-[#0a0a0a]">{b.name}</option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 rotate-90 text-red-500/50 pointer-events-none" size={16} />
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex justify-between items-end px-1">
                            <label className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.2em]">Yechish Summasi (UZS)</label>
                            <span className="text-[10px] font-black text-white/30 uppercase">Balansdan yechiladi</span>
                        </div>
                        <div className="relative group">
                            <input
                                type="text"
                                required
                                autoFocus
                                value={withdrawData.amount}
                                onChange={handleAmountChange}
                                placeholder="0"
                                className="w-full h-20 bg-[#0a0a0a] border border-[#2a2a2a] rounded-3xl px-8 text-white font-black text-3xl outline-none focus:border-red-500/50 transition-all placeholder:opacity-10 tabular-nums shadow-inner"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[100000, 500000, 1000000, 5000000].map((val) => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setWithdrawData(prev => ({ ...prev, amount: val.toLocaleString() }))}
                                    className="px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 rounded-xl text-[10px] font-black text-gray-400 hover:text-red-500 transition-all uppercase tracking-widest"
                                >
                                    +{val / 1000}k
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.2em] ml-1">Chiqim Maqsadi / Izoh</label>
                        <textarea
                            required
                            value={withdrawData.description}
                            onChange={(e) => setWithdrawData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Masalan: Ijara to'lovi, Kantselyariya yoki Shaxsiy avans..."
                            className="w-full h-32 bg-[#0a0a0a] border border-[#2a2a2a] rounded-3xl p-6 text-white text-sm font-medium outline-none focus:border-red-500/50 transition-all resize-none placeholder:opacity-20 leading-relaxed shadow-inner"
                        />
                    </div>
                </div>

                <div className="p-8 xl:p-10 bg-white/[0.02] border-t border-[#2a2a2a] flex flex-col sm:flex-row gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 h-16 bg-white/5 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-white/10 transition-all border border-white/10 active:scale-95"
                    >
                        Bekor Qilish
                    </button>
                    <button
                        disabled={isSubmitting}
                        type="submit"
                        className="flex-[1.5] h-16 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl transition-all shadow-[0_10px_30px_rgba(220,38,38,0.4)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Processing...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={18} />
                                Tasdiqlash va Yechish
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default WithdrawModal;
