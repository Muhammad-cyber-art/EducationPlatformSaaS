import React from "react";
import { X, FileText, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "./useKassa";

const DetailModal = ({ show, payment, onClose, onVerify, isSuperAdmin }) => {
    if (!show || !payment) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--gold)]/20 rounded-2xl shadow-2xl overflow-hidden animate-lux-pop">
                <div className="p-8 border-b border-[var(--gold)]/10 flex items-center justify-between bg-gradient-to-r from-[var(--gold)]/10 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[var(--gold-dim)] flex items-center justify-center text-[var(--gold)] border border-[var(--gold)]/20 shadow-inner"><FileText size={24} /></div>
                        <div><h2 className="text-xl font-black text-[var(--text-color)] tracking-tight">To'lov Tafsilotlari</h2><p className="text-[9px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">ID: STP-{payment.id}</p></div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-[var(--bg-void)] border border-[var(--gold)]/20 text-[var(--text-muted)] hover:text-[var(--text-color)] hover:border-[var(--gold)] rounded-xl transition-all"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6 text-[var(--text-color)]">
                    <div className="grid grid-cols-2 gap-6 font-bold text-sm">
                        <div><p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">O'quvchi</p><span className={payment.status === 'cancelled' ? 'line-through text-red-400' : payment.student_name?.includes("O'chirilgan") ? 'text-red-500 font-black' : ''}>{payment.student_name}</span></div>
                        <div className="text-right"><p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Guruh</p><span className="text-[var(--gold)]">{payment.payment_details?.group_name || 'Guruhsiz'}</span></div>
                        <div><p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">To'langan Summa</p><span className={payment.status === 'cancelled' ? 'line-through text-red-400' : ''}>{formatCurrency(payment.amount)}</span></div>
                        <div className="text-right"><p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Metod</p><span className={payment.student_name?.includes("O'chirilgan") && payment.status !== 'cancelled' ? 'bg-red-500/10 text-red-500 border border-red-500/30 px-2 py-1 rounded-lg text-xs uppercase' : ''}>{payment.payment_details?.payment_method_display || payment.payment_details?.payment_method || (payment.payment_details ? "Click / Card" : "Noma'lum")}</span></div>
                        <div>
                            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Qabul qildi</p>
                            <span className="text-[var(--text-color)]">{payment.marked_by_name || "Tizim"}</span>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Vaqt</p>
                            <span className="text-[var(--text-color)]">
                                {new Date(payment.created_at || payment.date).toLocaleDateString('uz-UZ')} {new Date(payment.created_at || payment.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        {payment.status === 'cancelled' && (
                            <div className="col-span-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mt-2">
                                <p className="text-[9px] text-red-400 uppercase tracking-widest mb-1">Bekor qilingan</p>
                                <p className="text-sm font-black text-red-400">
                                    {payment.cancelled_by_name || 'Noma\'lum'} tomonidan bekor qilingan
                                    {payment.cancelled_at && ` (${new Date(payment.cancelled_at).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })})`}
                                </p>
                            </div>
                        )}
                        {payment.payment_details?.refund_amount > 0 && !payment.payment_details?.refund_ignored && (
                            <>
                                <div className="col-span-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-[9px] text-emerald-500 uppercase tracking-widest mb-1">Refund (Qaytarilgan)</p>
                                            <p className="text-lg font-black text-emerald-500">-{formatCurrency(payment.payment_details.refund_amount)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Oylik to'lov</p>
                                            <p className="text-sm font-bold text-[var(--text-color)]">{formatCurrency(Number(payment.amount) + Number(payment.payment_details.refund_amount))}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        {payment.payment_details?.refund_amount > 0 && payment.payment_details?.refund_ignored && (
                            <div className="col-span-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <p className="text-[9px] text-amber-400 uppercase tracking-widest mb-1">Refund Status</p>
                                <p className="text-sm font-black text-amber-400">Refund bekor qilingan (Hisoblanmadi)</p>
                            </div>
                        )}
                    </div>
                    {payment.description && <div className="p-4 bg-[var(--bg-void)] border border-[var(--gold)]/10 rounded-xl text-xs italic text-[var(--text-muted)]">"{payment.description}"</div>}
                </div>
                <div className="p-6 bg-[var(--bg-void)] border-t border-[var(--gold)]/10 flex gap-3">
                    {isSuperAdmin && !payment.payment_details?.is_verified && (
                        <button onClick={() => onVerify(payment.payment_details?.original_payment_id || payment.id)} className="flex-1 h-12 bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-emerald-500 transition-all shadow-lg active:scale-95">Tasdiqlash</button>
                    )}
                    <button onClick={onClose} className="flex-1 h-12 bg-[var(--bg-panel)] text-[var(--text-color)] font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-[var(--gold-dim)] transition-all border border-[var(--gold)]/20 hover:border-[var(--gold)]">Yopish</button>
                </div>
            </div>
        </div>
    );
};

export default DetailModal;
