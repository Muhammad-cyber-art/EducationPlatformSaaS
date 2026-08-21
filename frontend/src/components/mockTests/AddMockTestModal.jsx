import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, BookOpen, Send, AlertCircle, Loader2, Award, AlignLeft } from "lucide-react";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";

const AddMockTestModal = ({ isOpen, onClose, groupId }) => {
  const [formData, setFormData] = useState({ subject: '', type: '', group: groupId });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.post("/homework_attends/mock-tests/", {
        subject: formData.subject,
        type: formData.type,
        group: groupId
      });
      toast.success("Mock test muvaffaqiyatli yaratildi!");
      setFormData({ subject: '', type: '', group: groupId });
      onClose();
    } catch (err) {
      console.error("Mock Test yaratishda xato:", err);
      setError("Test yaratishda xatolik yuz berdi.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* --- HEADER --- */}
        <div className="relative px-8 py-8 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/30">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)] shadow-inner">
              <BookOpen size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tighter">Yangi Mock Test</h2>
              <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-[0.3em] mt-0.5">Imtihon ma'lumotlarini kiriting</p>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="absolute top-8 right-8 p-2 text-[var(--text-muted)] hover:text-white transition-all hover:bg-white/5 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* --- BODY --- */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* Fan nomi */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">
              Test Mavzusi
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors">
                <AlignLeft size={18} />
              </div>
              <input
                type="text"
                placeholder="Masalan: Full Mock #12"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="lux-input !bg-[var(--bg-void)]/40 !py-4 !pl-12 !border-[var(--border-glass)] focus:!border-[var(--gold)]/50 focus:!ring-4 focus:!ring-[var(--gold)]/5 transition-all"
                required
              />
            </div>
          </div>

          {/* Imtihon turi */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">
              Imtihon Turi
            </label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors">
                <Award size={18} />
              </div>
              <input
                type="text"
                placeholder="Masalan: Oylik test"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="lux-input !bg-[var(--bg-void)]/40 !py-4 !pl-12 !border-[var(--border-glass)] focus:!border-[var(--gold)]/50 focus:!ring-4 focus:!ring-[var(--gold)]/5 transition-all"
                required
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl animate-shake">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <p className="text-[11px] font-bold text-red-400">{error}</p>
            </div>
          )}

          {/* --- FOOTER --- */}
          <div className="flex flex-col gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4.5 h-14 flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest text-black bg-[var(--gold)] rounded-2xl hover:opacity-95 active:scale-95 transition-all shadow-[0_15px_30px_rgba(184,134,11,0.3)] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Send size={18} /> Testni Yaratish
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => onClose(false)}
              className="w-full py-2 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest hover:text-white transition-all"
            >
              Bekor qilish
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default AddMockTestModal;
