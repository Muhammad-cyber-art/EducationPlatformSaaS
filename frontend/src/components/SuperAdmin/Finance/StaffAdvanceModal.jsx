import React, { useState } from'react';
import { createPortal } from'react-dom';
import { X, Coins, FileText, Calendar, Wallet, Loader2, Save } from'lucide-react';
import AmountInput from'../../Common/AmountInput';

const StaffAdvanceModal = ({ isOpen, onClose, staffName, onConfirm }) => {
 const [amount, setAmount] = useState('');
 const [description, setDescription] = useState('');
 const [loading, setLoading] = useState(false);

 if (!isOpen) return null;

 const handleSubmit = async (e) => {
 e.preventDefault();
 if (!amount || parseFloat(amount) <= 0) return;
 setLoading(true);
 try {
 await onConfirm(amount, description);
 setAmount('');
 setDescription('');
 } finally {
 setLoading(false);
 }
 };

 return createPortal(
 <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
 <div className="bg-[var(--bg-void)] border border-[#2a2a2a] rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">

 <div className="sticky top-0 z-10 h-1 w-full bg-gradient-to-r from-amber-500/50 via-amber-500 to-amber-500/50"></div>

 <div className="p-6">
 <div className="flex justify-between items-center mb-6">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
 <Coins size={20} />
 </div>
 <div>
 <h2 className="text-base font-black text-[var(--text-primary)] capitalize tracking-tight">Avans Berish</h2>
 <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-widest">{staffName}</p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="text-[var(--text-muted)] hover:text-amber-500 transition-colors p-2 hover:bg-amber-500/10 rounded-xl"
 >
 <X size={20} />
 </button>
 </div>

 <form onSubmit={handleSubmit} className="space-y-5">
 <div>
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] ml-1 mb-2 block">Avans Summasi (UZS)</label>
 <div className="relative group">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500/50 group-focus-within:text-amber-500 transition-colors">
 <Wallet size={18} />
 </div>
 <AmountInput
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 placeholder="0"
 className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-2xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50 transition-all font-black text-lg shadow-inner"
 />
 </div>
 </div>

 <div>
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] ml-1 mb-2 block">Izoh (Ixtiyoriy)</label>
 <div className="relative group">
 <div className="absolute left-4 top-4 text-amber-500/50 group-focus-within:text-amber-500 transition-colors">
 <FileText size={18} />
 </div>
 <textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Sabab yoki qo'shimcha ma'lumot..."
 rows="3"
 className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-2xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50 transition-all font-medium text-sm shadow-inner resize-none"
 />
 </div>
 </div>

 <div className="pt-2">
 <button
 type="submit"
 disabled={loading || !amount}
 className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs capitalize tracking-widest shadow-[0_0_30px_rgba(245,158,11,0.2)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
 Tasdiqlash
 </button>

 <p className="text-center text-[9px] text-[var(--text-muted)] font-black capitalize mt-4 tracking-tighter">
 * Bu summa joriy oy yakuniy maoshidan avtomatik ayiriladi
 </p>
 </div>
 </form>
 </div>
 </div>
 </div>,
 document.body
 );
};

export default StaffAdvanceModal;
