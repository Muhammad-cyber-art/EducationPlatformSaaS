import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { CreditCard, Loader2, Banknote, Smartphone, Image as ImageIcon, CheckCircle2, AlertCircle } from "lucide-react";
import AmountInput from "../../../Common/AmountInput";
import { PaymentTypeChoiceModal } from "./PaymentTypeChoiceModal";

export const PaymentConfirmModal = ({ isOpen, onClose, onConfirm, data, loading }) => {
    const [method, setMethod] = useState("cash");
    const [amount, setAmount] = useState("");
    const [receiptImage, setReceiptImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [notes, setNotes] = useState("");
    const [noReceipt, setNoReceipt] = useState(false);
    const [calculateRefund, setCalculateRefund] = useState(true);
    const [showTypeChoice, setShowTypeChoice] = useState(false);

    // Boshlang'ich holatni o'rnatish
    useEffect(() => {
        if (data) {
            setCalculateRefund(!data.ignore_refund);
        }
    }, [data]);

    // Hisoblangan summani o'rnatish
    const expectedAmount = useMemo(() => {
        if (!data) return 0;
        const refund = data.refundAmount || 0;
        const fullAmount = data.fullAmount || 0;
        const remaining = data.remainingAmount;

        // BUG #1 FIX: Agar bu davomiy (partial) to'lov bo'lsa — qolgan summani ko'rsatamiz.
        // Davomiy to'lov: remaining > 0 VA remaining < fullAmount (allaqachon bir qismi to'langan).
        // Yangi to'lov: remaining == fullAmount (hali hech narsa to'lanmagan).
        const isPartialContinuation = remaining != null && remaining > 0 && remaining < fullAmount;
        if (isPartialContinuation) {
            // Davomiy to'lovda refund qo'llanmaydi — qolgan summani to'laydi
            return remaining;
        }

        // Yangi to'lov: refund toggle to'g'ri ishlaydi
        // calculateRefund = true  → fullAmount - refund (masalan 400 - 314 = 86)
        // calculateRefund = false → fullAmount           (masalan 400)
        return calculateRefund ? Math.max(0, fullAmount - refund) : fullAmount;
    }, [data, calculateRefund]);

    useEffect(() => {
        if (data) {
            setAmount(String(Math.floor(expectedAmount) || 0));
        }
    }, [data, expectedAmount]);

    useEffect(() => {
        if (!isOpen) setShowTypeChoice(false);
    }, [isOpen]);

    if (!isOpen) return null;

    const buildPayload = (isPartial, payAmount, isCustom) => {
        const remaining = data?.remainingAmount;
        const fullAmount = data?.fullAmount || 0;
        // Agar allaqachon qisman to'langan bo'lsa va hozir qolganini to'layotgan bo'lsa
        const isPartialContinuation = remaining != null && remaining > 0 && remaining < fullAmount;

        return {
            payment_method: method,
            receipt_image: method === 'click' ? receiptImage : null,
            is_receiptless: method === 'click' ? noReceipt : false,
            notes: notes,
            ignore_refund: isPartialContinuation ? true : !calculateRefund,
            // pay_full_month: refund hisoblamaslik uchun (calculateRefund=false holati)
            pay_full_month: isPartialContinuation ? true : (!isPartial && !isCustom && !calculateRefund),
            // BUG #1 FIX: is_full_amount — to'liq oylik to'lov (refund bilan yoki refundsiz).
            // Backend bu flag orqali is_paid=True belgilaydi (kontrakt narxiga emas, flag ga qaraydi).
            is_full_amount: !isPartial && !isCustom,
            is_partial_payment: isPartial,
            is_custom_amount: isCustom,
            amount: String(Math.floor(payAmount)),
        };
    };

    const submitPayment = (isPartial, payAmount, isCustom = false) => {
        onConfirm(buildPayload(isPartial, payAmount, isCustom));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setReceiptImage(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleConfirmClick = () => {
        const entered = Math.floor(Number(amount) || 0);
        const expected = Math.floor(expectedAmount || 0);

        if (expected > 0 && entered !== expected) {
            setShowTypeChoice(true);
            return;
        }
        submitPayment(false, entered || expected);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('uz-UZ', { month: 'long', year: 'numeric' });
        } catch { return dateStr; }
    };

    return createPortal(
        <>
        <PaymentTypeChoiceModal
            isOpen={showTypeChoice}
            onClose={() => setShowTypeChoice(false)}
            enteredAmount={amount}
            expectedAmount={expectedAmount}
            onChooseFull={() => {
                setShowTypeChoice(false);
                submitPayment(false, expectedAmount);
            }}
            onChoosePartial={() => {
                setShowTypeChoice(false);
                submitPayment(true, amount);
            }}
            onChooseCustom={() => {
                setShowTypeChoice(false);
                submitPayment(false, amount, true);
            }}
        />
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
            <div className="bg-[var(--bg-panel)] border-2 border-amber-500/30 w-full max-w-lg rounded-[2.5rem] p-8 md:p-10 shadow-[0_0_50px_rgba(245,158,11,0.15)] animate-in zoom-in-95 duration-200 my-auto">
                <div className="flex flex-col items-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                        <CreditCard size={32} strokeWidth={1.5} />
                    </div>

                    <div className="text-center space-y-1">
                        <h3 className="text-2xl font-black text-white capitalize tracking-tighter">To'lovni Tasdiqlash</h3>
                        <p className="text-[9px] font-bold text-amber-500 uppercase tracking-[0.3em]">Moliya Operatsiyasi</p>
                    </div>

                    {/* Student Info Summary */}
                    <div className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-3xl p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[var(--text-muted)]">
                                <CheckCircle2 size={20} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{data?.studentName}</span>
                                <span className="text-xs font-bold text-white">{formatDate(data?.month)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-black text-emerald-500">{Number(amount).toLocaleString()} <span className="text-[8px] opacity-60">UZS</span></span>
                        </div>
                    </div>

                    {/* Payment Mode Selection (Refund Mode) */}
                    {data?.refundAmount > 0 && (
                        <div className="w-full p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl animate-in fade-in zoom-in">
                            <label className="flex items-center justify-between cursor-pointer group">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-white uppercase tracking-wider group-hover:text-amber-500 transition-colors">Refund qo'llash (Chegirma)</span>
                                    <span className="text-[9px] text-[var(--text-muted)] font-bold">Qoldirilgan darslar uchun chegirma qo'llash</span>
                                </div>
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={calculateRefund}
                                        onChange={(e) => setCalculateRefund(e.target.checked)}
                                    />
                                    <div className="w-10 h-5 bg-white/10 border border-white/20 rounded-full peer-checked:bg-amber-500 transition-all"></div>
                                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-all peer-checked:translate-x-5 shadow-sm"></div>
                                </div>
                            </label>
                        </div>
                    )}

                    {/* Method Tabs */}
                    <div className="w-full grid grid-cols-2 gap-2 bg-[var(--bg-void)] p-1.5 rounded-[2rem] border border-[var(--border-glass)]">
                        <button
                            onClick={() => setMethod('cash')}
                            className={`flex items-center justify-center gap-2 py-3.5 rounded-[1.7rem] text-[11px] font-black transition-all ${method === 'cash' ? 'bg-amber-500 text-black shadow-lg' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                        >
                            <Banknote size={16} /> Naqd
                        </button>
                        <button
                            onClick={() => setMethod('click')}
                            className={`flex items-center justify-center gap-2 py-3.5 rounded-[1.7rem] text-[11px] font-black transition-all ${method === 'click' ? 'bg-amber-500 text-black shadow-lg' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
                        >
                            <Smartphone size={16} /> Click / Karta
                        </button>
                    </div>


                    {/* Dynamic Inputs */}
                    <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Summa ko'rsatish - read-only, backend hisoblaydi */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">
                                {calculateRefund && data?.refundAmount > 0 ? "Chegirmali to'lov summasi" : "To'liq oylik to'lov summasi"}
                            </label>
                            <div className="relative">
                                <AmountInput
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl py-4 px-6 text-xl font-black text-emerald-400 focus:border-amber-500/50 outline-none transition-all cursor-text"
                                    placeholder="0"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-muted)]">UZS</span>
                            </div>
                        </div>

                        {method === 'click' && (
                            <div className="space-y-4">
                                {!noReceipt ? (
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Chek (Rasm)</label>
                                        <div 
                                            onClick={() => document.getElementById('receipt-upload').click()}
                                            className="w-full h-32 bg-[var(--bg-void)] border-2 border-dashed border-[var(--border-glass)] rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/5 transition-all overflow-hidden relative group"
                                        >
                                            {preview ? (
                                                <>
                                                    <img src={preview} alt="Receipt preview" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <ImageIcon className="text-white drop-shadow-lg" size={32} />
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <ImageIcon className="text-[var(--text-muted)]" size={32} />
                                                    <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Chekni yuklash</span>
                                                </>
                                            )}
                                            <input id="receipt-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                                        <AlertCircle className="text-amber-500 shrink-0" size={18} />
                                        <p className="text-[10px] font-medium text-amber-500 leading-relaxed">
                                            Chek yo'qligi sababini quyidagi eslatma maydoniga yozib qoldiring. Bu moliya bo'limi uchun zarur.
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 px-2">
                                    <input 
                                        type="checkbox" 
                                        id="no-receipt" 
                                        checked={noReceipt}
                                        onChange={(e) => setNoReceipt(e.target.checked)}
                                        className="w-4 h-4 accent-amber-500"
                                    />
                                    <label htmlFor="no-receipt" className="text-[10px] font-bold text-white cursor-pointer select-none">Chek mavjud emas (Cheksiz)</label>
                                </div>
                            </div>
                        )}

                        {/* Common Notes Field */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-4">Eslatma (Ehtiyoj bo'lsa)</label>
                            <textarea 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                required={noReceipt}
                                className={`w-full bg-[var(--bg-void)] border rounded-2xl py-4 px-6 text-xs font-bold text-white outline-none transition-all h-24 resize-none ${noReceipt && !notes ? 'border-red-500/50 bg-red-500/5' : 'border-[var(--border-glass)] focus:border-amber-500/50'}`}
                                placeholder={noReceipt ? "Chek yo'qligi sababini yozing..." : "Qo'shimcha ma'lumot..."}
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 w-full pt-2">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-4 rounded-2xl border border-[var(--border-glass)] text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all disabled:opacity-50"
                        >
                            Bekor qilish
                        </button>
                        <button
                            onClick={handleConfirmClick}
                            disabled={loading || (method === 'click' && !noReceipt && !receiptImage) || (noReceipt && !notes)}
                            className="flex-1 py-4 rounded-2xl bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(245,158,11,0.2)] hover:shadow-[0_15px_30px_rgba(245,158,11,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-500 disabled:shadow-none"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : "Tasdiqlash"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        </>,
        document.body
    );
};
