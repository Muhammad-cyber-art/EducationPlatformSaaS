import React from "react";
import { ArrowLeft, Wallet, PlusCircle, TrendingDown, Verified, MinusCircle, Circle } from "lucide-react";
import { formatCurrency } from "./useKassa";
import ThemeToggle from "../../../ThemeToggle";

const KassaHeader = ({ navigate, totalToday, totalVerified, totalWithdrawn, onWithdraw, isSuperAdmin }) => (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 p-5 bg-[var(--bg-panel)]/40 border border-[#333] rounded-2xl shadow-xl backdrop-blur-xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

        <div className="flex items-center gap-4 sm:gap-6 relative z-10 w-full xl:w-auto justify-between xl:justify-start">
            <div className="flex items-center gap-4 sm:gap-6">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-[var(--bg-void)] border border-[var(--gold)]/20 rounded-xl text-[var(--gold)] hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-black hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shrink-0"
                >
                    <ArrowLeft size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} />
                </button>
                <div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Wallet className="text-[var(--gold)] w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                        <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight capitalize drop-shadow-sm truncate">
                            Kassa Tizimi
                        </h1>
                    </div>
                    <p className="text-[7px] sm:text-[9px] text-[var(--text-muted)] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 sm:mt-1.5 flex items-center gap-1.5 sm:gap-2">
                        <Circle size={5} className="sm:w-[6px] sm:h-[6px] fill-emerald-500 text-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)] shrink-0" />
                        Jonli Moliyaviy Tushumlar
                    </p>
                </div>
            </div>
            
            {/* Mobile Theme Toggle */}
            <div className="xl:hidden shrink-0">
                <ThemeToggle />
            </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-3 relative z-10 w-full xl:w-auto">
            <div className="px-2 py-2 sm:px-5 sm:py-3 bg-[var(--bg-void)]/60 border border-[var(--gold)]/20 rounded-xl group/total flex flex-col justify-center">
                <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 opacity-70">
                    <PlusCircle size={8} className="text-[var(--gold)] sm:w-[10px] sm:h-[10px] shrink-0" />
                    <p className="text-[6px] sm:text-[8px] font-black text-[var(--gold)] uppercase tracking-wider sm:tracking-widest truncate">Umumiy Kirim</p>
                </div>
                <span className="text-[9px] sm:text-base font-black text-white tabular-nums tracking-tighter truncate">{formatCurrency(totalToday)}</span>
            </div>

            <div className="px-2 py-2 sm:px-5 sm:py-3 bg-red-500/5 border border-red-500/20 rounded-xl group/withdraw flex flex-col justify-center">
                <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 opacity-70">
                    <TrendingDown size={8} className="text-red-500 sm:w-[10px] sm:h-[10px] shrink-0" />
                    <p className="text-[6px] sm:text-[8px] font-black text-red-500 uppercase tracking-wider sm:tracking-widest truncate">Olingan</p>
                </div>
                <span className="text-[9px] sm:text-base font-black text-red-500 tabular-nums tracking-tighter truncate">{formatCurrency(totalWithdrawn)}</span>
            </div>

            <div className="px-2 py-2 sm:px-5 sm:py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl group/verified flex flex-col justify-center">
                <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 opacity-70">
                    <Verified size={8} className="text-emerald-500 sm:w-[10px] sm:h-[10px] shrink-0" />
                    <p className="text-[6px] sm:text-[8px] font-black text-emerald-500 uppercase tracking-wider sm:tracking-widest truncate">Tasdiqlangan</p>
                </div>
                <span className="text-[9px] sm:text-base font-black text-emerald-500 tabular-nums tracking-tighter truncate">{formatCurrency(totalVerified)}</span>
            </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
            {isSuperAdmin && (
                <button
                    onClick={onWithdraw}
                    className="w-full xl:w-auto px-6 xl:px-8 h-12 bg-red-600 hover:bg-red-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 shrink-0"
                >
                    <MinusCircle size={16} />
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
