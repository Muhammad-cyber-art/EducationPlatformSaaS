import React, { useState } from"react";
import { CreditCard } from"lucide-react";

export const ProfileAttribute = React.memo(({ icon, label, value, colorClass }) => (
 <div className="flex justify-between items-start gap-4">
 <div className="flex items-center gap-3">
 <div className="text-[var(--gold)] opacity-60">{icon}</div>
 <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-widest">
 {label}
 </p>
 </div>
 <div className="text-right flex-1 min-w-0">
 <div className={`text-[11px] font-bold capitalize tracking-tight ${colorClass ? `${colorClass} px-2 py-0.5 rounded-full inline-block shadow-sm mt-[-2px]` :'text-[var(--text-primary)]'} ${label ==="Eslatmalar" ?"whitespace-pre-wrap break-words leading-relaxed" :"truncate"}`}>
 {value}
 </div>
 </div>
 </div>
));

export const PaymentCheckout = ({ payment, onConfirm }) => {
    // To'lov allaqachon amalga oshirilgan bo'lsa, umuman ko'rsatilmaydi
    if (payment?.is_paid) {
        return null;
    }

    const [ignoreRefund, setIgnoreRefund] = useState(false);
    const refundAmount = payment?.refund_amount;

    if (!refundAmount || refundAmount <= 0) {
        return (
            <button
                onClick={() => onConfirm(payment.id)}
                className="p-2 sm:p-3 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-black rounded-lg sm:rounded-xl font-black capitalize tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
                title="To'lash"
            >
                <CreditCard size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="text-[10px] hidden sm:inline">To'lash</span>
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2 sm:gap-3 bg-[var(--bg-void)]/40 border border-[var(--border-glass)] py-1 px-2 sm:py-1.5 sm:px-2.5 rounded-xl sm:rounded-2xl shadow-lg animate-in fade-in zoom-in-95">
            <label className="flex items-center gap-2 sm:gap-2.5 cursor-pointer pl-0.5 select-none group" title={!ignoreRefund ? "Chegirmani qo'llash" : "Chegirmani bekor qilish"}>
                <div className="relative inline-flex items-center">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={!ignoreRefund}
                        onChange={() => setIgnoreRefund(!ignoreRefund)}
                    />
                    <div className="w-7 h-3.5 sm:w-8 sm:h-4 bg-[var(--text-muted)]/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-2.5 after:w-2.5 sm:after:h-3 sm:after:w-3 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                </div>
                <div className="flex flex-col justify-center">
                    <span className="text-[6px] sm:text-[7px] font-black capitalize tracking-[0.2em] text-[var(--text-muted)] leading-none mb-0.5">
                        Chegirma
                    </span>
                    <span className={`text-[8px] sm:text-[10px] font-black capitalize tracking-widest leading-none transition-all ${!ignoreRefund ? "text-emerald-500" : "text-gray-500 line-through opacity-50"}`}>
                        -{Math.floor(refundAmount).toLocaleString()}
                    </span>
                </div>
            </label>

            <div className="w-px h-5 sm:h-6 bg-[var(--border-glass)]"></div>

            <button
                onClick={() => onConfirm(payment.id, null, ignoreRefund)}
                className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-black transition-all shadow-md active:scale-90 flex items-center justify-center cursor-pointer relative z-10"
                title="Tasdiqlash"
            >
                <CreditCard size={14} className="sm:w-[16px] sm:h-[16px]" />
            </button>
        </div>
    );
};
