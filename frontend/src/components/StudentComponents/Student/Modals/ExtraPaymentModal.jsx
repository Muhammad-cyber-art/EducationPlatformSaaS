import React, { useState, useEffect } from"react";
import { createPortal } from"react-dom";
import { CreditCard, Save, Loader2 } from"lucide-react";
import AmountInput from "../../../Common/AmountInput";

export const ExtraPaymentModal = ({ isOpen, onClose, onSave, loading, studentName, adminName, groups = [] }) => {
  const [data, setData] = useState({
    amount: "",
    payer_name: studentName || "",
    description: "",
    transaction_type: "income",
    group: ""
  });

  useEffect(() => {
    if (isOpen) {
      setData({
        amount: "",
        payer_name: studentName || "",
        description: "",
        transaction_type: "income",
        group: groups && groups.length > 0 ? groups[0].id : ""
      });
    }
  }, [isOpen, studentName, groups]);

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] w-full max-w-md rounded-[2.5rem] p-10 shadow-3xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
            <CreditCard size={20} />
          </div>
          <h3 className="text-xl font-black text-white capitalize tracking-widest">Portal Mas'uli</h3>
        </div>

        <div className="mb-6 flex flex-col gap-1">
          <p className="text-[10px] text-[var(--white)] font-bold capitalize tracking-widest opacity-60">O'quvchi: {studentName}</p>
          <p className="text-[10px] text-[var(--gold)] font-bold capitalize tracking-widest flex items-center gap-1.5 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]"></span>
            Mas'ul: {adminName}
          </p>
        </div>

        <div className="flex p-1 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl mb-6">
          <button
            onClick={() => setData({ ...data, transaction_type: 'income' })}
            className={`flex-1 py-3 rounded-xl text-[9px] font-black capitalize tracking-widest transition-all ${data.transaction_type === 'income' ? 'bg-[var(--gold)] text-black shadow-lg' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            Kirim
          </button>
          <button
            onClick={() => setData({ ...data, transaction_type: 'expense' })}
            className={`flex-1 py-3 rounded-xl text-[9px] font-black capitalize tracking-widest transition-all ${data.transaction_type === 'expense' ? 'bg-red-500 text-white shadow-lg' : 'text-[var(--text-muted)] hover:text-white'}`}
          >
            Chiqim
          </button>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Summa (UZS)</label>
            <AmountInput className="lux-input !bg-[var(--bg-void)] !py-4" value={data.amount} onChange={e => setData({ ...data, amount: e.target.value })} placeholder="Masalan: 50000" autoFocus />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Guruh</label>
            {groups && groups.length > 0 ? (
              <select
                className="lux-input !bg-[var(--bg-void)] !py-4 text-xs text-white w-full"
                value={data.group}
                onChange={e => setData({ ...data, group: e.target.value })}
                required
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id} className="bg-[var(--bg-panel)] text-white">
                    {g.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-[9px] text-red-400 font-bold border border-red-500/20 bg-red-500/5 p-3 rounded-2xl tracking-wide leading-relaxed">
                Ushbu o'quvchi birorta ham guruhga biriktirilmagan. Maxsus to'lov kiritish uchun o'quvchi kamida bitta faol guruhda bo'lishi kerak.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">{data.transaction_type === 'income' ? 'Kim to\'ladi?' : 'Kimga berildi?'}</label>
            <input className="lux-input !bg-[var(--bg-void)] !py-4" value={data.payer_name} onChange={e => setData({ ...data, payer_name: e.target.value })} placeholder="Ism-sharif" />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Izohlar</label>
            <textarea className="lux-input !bg-[var(--bg-void)] !py-4 !h-24 resize-none" value={data.description} onChange={e => setData({ ...data, description: e.target.value })} placeholder="Dars uchun, kitob uchun yoki boshqa..." />
          </div>

          <div className="flex gap-4 pt-6">
            <button onClick={onClose} className="flex-1 py-4 rounded-2xl border border-[var(--border-glass)] text-[10px] font-black capitalize tracking-widest hover:bg-white/5 transition-all">Yopish</button>
            <button disabled={loading || !data.group || groups.length === 0} onClick={() => onSave(data)} className={`flex-1 py-4 rounded-2xl text-[10px] font-black capitalize tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 ${data.transaction_type === 'income' ? 'bg-[var(--gold)] text-black shadow-[0_0_20px_#b8860b30]' : 'bg-red-500 text-white shadow-[0_0_20px_#ef444430]'}`}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Saqlash
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
