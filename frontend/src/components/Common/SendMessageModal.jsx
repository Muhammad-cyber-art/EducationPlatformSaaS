import React, { useState } from "react";
import { Send, X, Loader2 } from "lucide-react";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";

/**
 * Universal Xabar Yuborish Modali
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {number|null} groupId - Agar guruhga yuborilsa ID, agar bo'sh bo'lsa global xabar (Super Admin)
 */
const SendMessageModal = ({ isOpen, onClose, groupId = null, branchId = null, showGlobalOption = false }) => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendToAll, setSendToAll] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    try {
      const payload = {
        message: message,
        group_id: groupId,
        branch_id: branchId,
        send_to_all_branches: sendToAll
      };
      await api.post("/bot/broadcast/", payload);
      toast.success("Xabar yuborildi!");
      setMessage("");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-[var(--border-glass)] flex justify-between items-center bg-transparent">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[var(--gold)]/10 border border-[var(--gold)]/20 rounded-2xl text-[var(--gold)] shadow-[0_0_15px_rgba(184,134,11,0.15)]">
              <Send size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight leading-none">
                {sendToAll ? "Global Xabar" : (groupId ? "Guruhga Xabar" : (branchId ? "Filialga Xabar" : "Xabar Yuborish"))}
              </h3>
              <p className="text-[10px] font-bold text-[var(--text-muted)] mt-1.5 uppercase tracking-[0.2em]">
                {sendToAll ? "Barcha o'quvchilarga" : (groupId ? "Faqat guruh a'zolariga" : (branchId ? "Faqat filial o'quvchilariga" : "Tanlanganlar uchun"))}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSend} className="p-8 space-y-6 bg-transparent">
          {showGlobalOption && (
            <label
              htmlFor="sendToAll"
              className="flex items-center gap-4 p-4 bg-[var(--bg-void)]/50 rounded-2xl border border-[var(--border-glass)] cursor-pointer hover:border-[var(--gold)]/50 transition-all group"
            >
              <input
                type="checkbox"
                id="sendToAll"
                checked={sendToAll}
                onChange={(e) => setSendToAll(e.target.checked)}
                className="h-5 w-5 rounded bg-black/50 border-[var(--border-glass)] text-[var(--gold)] focus:ring-0 focus:ring-offset-0 cursor-pointer transition-all"
              />
              <span className="text-sm font-bold text-[var(--text-primary)] transition-colors">
                Barcha filialarga yuborish
              </span>
            </label>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse"></span>
              Xabar matnini kiriting
            </label>
            <textarea
              autoFocus
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Xabaringizni bu yerga yozing..."
              className="w-full bg-[#0a0a0a] border border-[var(--border-glass)] rounded-2xl p-5 text-sm font-bold text-white placeholder:text-gray-600 focus:border-[var(--gold)]/50 focus:ring-0 focus:outline-none transition-all resize-none shadow-inner"
            />
          </div>

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 bg-transparent border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-white hover:bg-white/5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="flex-[1.5] h-12 bg-[var(--gold)] hover:bg-[#a67c00] text-black rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-[0_5px_15px_rgba(184,134,11,0.2)] transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} strokeWidth={3} />
              ) : (
                <Send size={18} strokeWidth={2.5} />
              )}
              <span>{loading ? "Yuborilmoqda" : "Yuborish"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendMessageModal;
