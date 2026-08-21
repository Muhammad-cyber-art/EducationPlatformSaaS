import React, { useState, useEffect } from"react";
import { createPortal } from"react-dom";
import AmountInput from "../../../Common/AmountInput";

export const SmallFormModal = ({ isOpen, onClose, onSave, title, initialValue, label, isPaid }) => {
 const [val, setVal] = useState(initialValue ||"");
 useEffect(() => { if (isOpen) setVal(initialValue ||""); }, [isOpen, initialValue]);

 if (!isOpen) return null;
 return createPortal(
 <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
 <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
 <h3 className="text-lg font-black text-white capitalize tracking-widest mb-2">{title}</h3>
 
 {isPaid && (
 <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
 <p className="text-[9px] font-bold text-amber-500 capitalize tracking-wider leading-relaxed">
 ⚠️ Diqqat! Ushbu to'lov allaqachon tasdiqlangan. Tahrirlash moliya tizimiga ta'sir qiladi.
 </p>
 </div>
 )}

 <div className="space-y-4">
 <div className="space-y-2">
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">{label}</label>
 <AmountInput
 className="lux-input !bg-[var(--bg-void)]"
 value={val}
 onChange={e => setVal(e.target.value)}
 autoFocus
 />
 </div>
 <div className="flex gap-4 pt-4">
 <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-[var(--border-glass)] text-[9px] font-black capitalize tracking-widest hover:bg-white/5 transition-all">Bekor qilish</button>
 <button onClick={() => onSave(val)} className="flex-1 py-3 rounded-xl bg-[var(--gold)] text-black text-[9px] font-black capitalize tracking-widest active:scale-95 transition-all">Saqlash</button>
 </div>
 </div>
 </div>
 </div>,
 document.body
 );
};
