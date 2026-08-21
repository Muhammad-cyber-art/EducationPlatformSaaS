import React from "react";
import { createPortal } from "react-dom";
import { Split, CheckCircle2, Settings2 } from "lucide-react";

/**
 * Summa tahrirlanganda: to'liq, bo'lib to'lash yoki custom.
 */
export const PaymentTypeChoiceModal = ({
    isOpen,
    onClose,
    onChooseFull,
    onChoosePartial,
    onChooseCustom,
    enteredAmount,
    expectedAmount,
}) => {
    if (!isOpen) return null;

    const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString();

    return createPortal(
        <div className="fixed inset-0 z-[3100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <div className="bg-[var(--bg-panel)] border-2 border-amber-500/40 w-full max-w-md rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="text-center space-y-2 mb-6">
                    <h3 className="text-xl font-black text-white capitalize tracking-tight">To'lov turini tanlang</h3>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        Kiritilgan summa hisoblangan summadan farq qiladi
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6 text-center">
                    <div className="p-3 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)]">
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Kiritilgan</p>
                        <p className="text-sm font-black text-amber-400 tabular-nums">{fmt(enteredAmount)} UZS</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)]">
                        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Kutilgan</p>
                        <p className="text-sm font-black text-white tabular-nums">{fmt(expectedAmount)} UZS</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={onChooseFull}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-left group"
                    >
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                            <CheckCircle2 size={22} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">To'liq to'lash</p>
                            <p className="text-[9px] font-bold text-[var(--text-muted)] mt-0.5">
                                Oy to'liq yopiladi ({fmt(expectedAmount)} UZS)
                            </p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={onChoosePartial}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-all text-left group"
                    >
                        <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                            <Split size={22} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-amber-400 uppercase tracking-wider">Bo'lib to'lash</p>
                            <p className="text-[9px] font-bold text-[var(--text-muted)] mt-0.5">
                                Hozir {fmt(enteredAmount)} UZS, qolgani keyinroq
                            </p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={onChooseCustom}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 transition-all text-left group"
                    >
                        <div className="w-11 h-11 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                            <Settings2 size={22} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-purple-400 uppercase tracking-wider">Belgilangan to'lov</p>
                            <p className="text-[9px] font-bold text-[var(--text-muted)] mt-0.5">
                                {fmt(enteredAmount)} UZS bilan oyni to'liq yopish
                            </p>
                        </div>
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full mt-4 py-3 rounded-xl border border-[var(--border-glass)] text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:bg-white/5 transition-all"
                >
                    Bekor qilish
                </button>
            </div>
        </div>,
        document.body
    );
};

export default PaymentTypeChoiceModal;
