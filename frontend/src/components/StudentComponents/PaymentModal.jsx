import React from'react';
import { X, CheckCircle2, ShieldCheck, Loader2 } from'lucide-react';
import AmountInput from'../Common/AmountInput';

const PaymentModal = ({ isOpen, onClose, onConfirm, loading, amount: initialAmount }) => {
 const [amount, setAmount] = React.useState(initialAmount);

 React.useEffect(() => {
 setAmount(initialAmount);
 }, [initialAmount, isOpen]);

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 sm:pt-32 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">

 {/* Modal Content */}
 <div className="relative w-full max-w-sm overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2rem] shadow-2xl shadow-[var(--gold)]/5">

 {/* Yuqoridagi dekorativ gradient line */}
 <div className="h-1.5 w-full bg-gradient-to-r from-[var(--gold)] via-amber-200 to-[var(--gold)]"></div>

 <div className="p-6 md:p-8">
 {/* Yopish tugmasi */}
 <button
 onClick={onClose}
 className="absolute top-6 right-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1 hover:bg-[var(--bg-void)] rounded-full"
 >
 <X size={20} />
 </button>

 {/* Markaziy Ikonka */}
 <div className="flex justify-center mb-5 md:mb-6">
 <div className="relative">
 <div className="absolute inset-0 bg-[var(--gold)] blur-2xl opacity-20 animate-pulse"></div>
 <div className="relative bg-[var(--gold)]/10 p-4 md:p-5 rounded-full border border-[var(--border-glass)]">
 <ShieldCheck size={36} className="text-[var(--gold)]" />
 </div>
 </div>
 </div>

 {/* Sarlavha va Tavsif */}
 <div className="text-center mb-6 md:mb-8">
 <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">To'lovni tasdiqlash</h2>
 <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-4">
 To'lov summasini tekshiring va tasdiqlang. Zarurat bo'lsa o'zgartirishingiz mumkin:
 </p>

 <div className="relative group/input">
 <AmountInput
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 className="lux-input !bg-[var(--bg-void)] !text-center !text-2xl !font-black !py-6 !border-[var(--gold)]/30 focus:!border-[var(--gold)] transition-all"
 placeholder="0"
 />
 <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[var(--gold)] text-black text-[7px] font-black capitalize tracking-[0.2em] rounded">To'lov summasi</div>
 </div>
 </div>

 {/* Harakat tugmalari */}
 <div className="space-y-3">
 <button
 onClick={() => onConfirm(amount)}
 disabled={loading || !amount}
 className="w-full flex items-center justify-center gap-2 lux-btn !bg-emerald-600 hover:!bg-emerald-500 disabled:!bg-emerald-800 disabled:cursor-not-allowed text-white font-bold py-3 md:py-4 rounded-xl md:rounded-2xl transition-all shadow-lg !shadow-emerald-600/20 active:scale-[0.97] text-sm md:text-base border-none"
 >
 {loading ? (
 <>
 <Loader2 className="animate-spin" size={20} />
 Amalga oshirilmoqda...
 </>
 ) : (
 <>
 <CheckCircle2 size={20} />
 Ha, To'landi
 </>
 )}
 </button>

 <button
 onClick={onClose}
 disabled={loading}
 className="w-full bg-transparent hover:bg-[var(--bg-void)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium py-2.5 md:py-3 rounded-xl md:rounded-2xl transition-all border border-transparent hover:border-[var(--border-glass)] text-[11px] md:text-[13px]"
 >
 Bekor qilish
 </button>
 </div>

 {/* Footer Info */}
 <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-[var(--text-secondary)] capitalize tracking-[0.1em] font-bold">
 <div className="w-1 h-1 bg-[var(--text-secondary)] rounded-full"></div>
 Tizim orqali avtomatik qayd etiladi
 <div className="w-1 h-1 bg-[var(--text-secondary)] rounded-full"></div>
 </div>
 </div>
 </div>
 </div>
 );
};

export default PaymentModal;