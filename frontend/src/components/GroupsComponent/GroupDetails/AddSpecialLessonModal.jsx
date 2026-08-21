import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Plus, X, Loader2, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../../../tokenUpdater/updater";

export default function AddSpecialLessonModal({ isOpen, onClose, groupId, onAdded }) {
  const [loading, setLoading] = useState(false);
  
  const { data: specialDates = [] } = useQuery({
    queryKey: ['special-lessons', groupId],
    queryFn: async () => {
      const res = await api.get(`/groups/groups/${groupId}/special-lessons/`);
      return res.data;
    },
    enabled: isOpen
  });

  if (!isOpen) return null;

  // Keyingi 7 kunni hisoblash (bugunni ham qo'shgan holda)
  const nextDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('sv-SE');
  });

  const handleAdd = async (date) => {
    if (specialDates.includes(date)) return;
    if (!confirm(`${date} sanasiga qo'shimcha dars qo'shmoqchimisiz?`)) return;
    setLoading(true);
    try {
      await api.post(`/groups/groups/${groupId}/add-special-lesson/`, { date });
      toast.success("Dars kuni qo'shildi");
      if (onAdded) onAdded();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };


  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 pt-16 sm:pt-4 transition-all overflow-y-auto">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* --- HEADER --- */}
        <div className="px-8 py-6 border-b border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-void)]/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--gold)]/10 text-[var(--gold)]">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--text-primary)] tracking-tight capitalize">Dars qo'shish</h3>
              <p className="text-[9px] text-[var(--text-secondary)] font-bold capitalize tracking-widest opacity-60">Maxsus dars kuni</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-secondary)] hover:text-white transition-all bg-white/5 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* --- BODY --- */}
        <div className="p-8 space-y-6">
          <p className="text-[11px] font-bold text-[var(--text-secondary)] leading-relaxed text-center px-4">
            Quyidagi ro'yxatdan dars o'tiladigan sanani tanlang. Ushbu kuni davomat va barcha xizmatlar faol bo'ladi.
          </p>
          
          <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-2 scrollbar-hide">
            {nextDates.map(date => {
              const isBusy = specialDates.includes(date);
              return (
                <button
                  key={date}
                  onClick={() => handleAdd(date)}
                  disabled={loading || isBusy}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all group active:scale-95 disabled:opacity-80 ${
                    isBusy 
                      ? 'border-emerald-500/30 bg-emerald-500/5 cursor-default' 
                      : 'border-[var(--border-glass)] bg-[var(--bg-void)]/40 hover:border-[var(--gold)]/40'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[40px]">
                      <span className={`block text-[9px] font-black uppercase tracking-wider ${isBusy ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`}>
                        {new Date(date).toLocaleDateString(undefined, { weekday: 'short' })}
                      </span>
                      <span className={`block text-xl font-bold ${isBusy ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>
                        {date.split('-')[2]}
                      </span>
                    </div>
                    <div className="h-8 w-px bg-[var(--border-glass)]" />
                    <span className={`text-sm font-bold font-mono ${isBusy ? 'text-emerald-500/60' : 'text-[var(--text-secondary)]'}`}>
                      {date}
                    </span>
                  </div>
                  
                  {isBusy ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Qo'shilgan</span>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)] opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus size={16} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>


          <button
            onClick={onClose}
            className="w-full py-3 text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest hover:text-white transition-all underline underline-offset-4"
          >
            Bekor qilish
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

