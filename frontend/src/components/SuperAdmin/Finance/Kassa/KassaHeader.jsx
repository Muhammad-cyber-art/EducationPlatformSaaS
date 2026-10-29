import React from "react";
import { ArrowLeft, Wallet, PlusCircle, TrendingDown, Verified, MinusCircle, Circle } from "lucide-react";
import { formatCurrency } from "./useKassa";
import ThemeToggle from "../../../ThemeToggle";

const KassaHeader = ({ navigate, totalToday, totalVerified, totalWithdrawn, onWithdraw, isSuperAdmin }) => (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 p-5 bg-[var(--bg-panel)]/40 border border-[var(--border-glass)] rounded-2xl shadow-xl backdrop-blur-xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

        <div className="flex items-center gap-4 sm:gap-6 relative z-10 w-full xl:w-auto justify-between xl:justify-start">
            <div className="flex items-center gap-4 sm:gap-6">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-[var(--bg-void)] border border-[var(--gold)]/20 rounded-xl text-[var(--gold)] hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-white hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shrink-0"
                >
                    <ArrowLeft size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} />
                </button>
                <div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Wallet className="text-[var(--gold)] w-6 h-6 sm:w-7 sm:h-7 shrink-0" strokeWidth={2.2} />
                        <h1 className="text-lg sm:text-2xl font-black text-[var(--text-primary)] tracking-tight capitalize drop-shadow-sm truncate">
                            Kassa Tizimi
                        </h1>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 sm:mt-1.5 flex items-center gap-1.5 sm:gap-2">
                        <Circle size={7} className="sm:w-2 sm:h-2 fill-emerald-500 text-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)] shrink-0" />
                        Jonli Moliyaviy Tushumlar
                    </p>
                </div>
            </div>
            
            {/* Mobile Theme Toggle */}
            <div className="xl:hidden shrink-0">
                <ThemeToggle />
            </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 relative z-10 w-full xl:w-auto">
            <div className="px-2.5 py-2.5 sm:px-5 sm:py-3 bg-[var(--bg-void)]/60 border border-[var(--gold)]/20 rounded-xl group/total flex flex-col justify-center">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 opacity-80">
                    <PlusCircle size={15} className="text-[var(--gold)] sm:w-4 sm:h-4 shrink-0" strokeWidth={2.2} />
                    <p className="text-[8px] sm:text-[10px] font-black text-[var(--gold)] uppercase tracking-wider sm:tracking-widest truncate">Umumiy Kirim</p>
                </div>
                <span className="text-xs sm:text-base font-black text-[var(--text-primary)] tabular-nums tracking-tight truncate">{formatCurrency(totalToday)}</span>
            </div>

            <div className="px-2.5 py-2.5 sm:px-5 sm:py-3 bg-red-500/5 border border-red-500/20 rounded-xl group/withdraw flex flex-col justify-center">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 opacity-80">
                    <TrendingDown size={15} className="text-red-500 sm:w-4 sm:h-4 shrink-0" strokeWidth={2.2} />
                    <p className="text-[8px] sm:text-[10px] font-black text-red-500 uppercase tracking-wider sm:tracking-widest truncate">Olingan</p>
                </div>
                <span className="text-xs sm:text-base font-black text-red-500 tabular-nums tracking-tight truncate">{formatCurrency(totalWithdrawn)}</span>
            </div>

            <div className="px-2.5 py-2.5 sm:px-5 sm:py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl group/verified flex flex-col justify-center">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 opacity-80">
                    <Verified size={15} className="text-emerald-500 sm:w-4 sm:h-4 shrink-0" strokeWidth={2.2} />
                    <p className="text-[8px] sm:text-[10px] font-black text-emerald-500 uppercase tracking-wider sm:tracking-widest truncate">Tasdiqlangan</p>
                </div>
                <span className="text-xs sm:text-base font-black text-emerald-500 tabular-nums tracking-tight truncate">{formatCurrency(totalVerified)}</span>
            </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
            {isSuperAdmin && (
                <button
                    onClick={onWithdraw}
                    className="w-full xl:w-auto px-6 xl:px-8 h-12 bg-red-600 hover:bg-red-500 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2.5 shrink-0"
                >
                    <MinusCircle size={18} strokeWidth={2.2} />
                    Pul Olish
                </button>
            )}
            <div className="hidden xl:block">
                <ThemeToggle />
            </div>
        </div>
    </div>
);

export default KassaHeader;
