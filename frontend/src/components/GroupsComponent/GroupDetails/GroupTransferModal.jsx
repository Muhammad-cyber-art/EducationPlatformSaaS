import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRightLeft, MapPin, Info, CheckCircle2, Search } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../tokenUpdater/updater";

const GroupTransferModal = ({ isOpen, onClose, groupinfo, onSuccess }) => {
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchBranches();
    } else {
      // Reset state when modal closes
      setSelectedBranchId("");
      setReason("");
      setSearchTerm("");
    }
  }, [isOpen]);

  const fetchBranches = async () => {
    setLoadingBranches(true);
    try {
      const response = await api.get("/add_branch/branches/");
      // O'quvchining hozirgi filialini ro'yxatdan chiqarib tashlaymiz
      const filteredBranches = (response.data.results || response.data).filter(
        (b) => Number(b.id) !== Number(groupinfo?.branch?.id)
      );
      setBranches(filteredBranches);
    } catch (error) {
      toast.error("Filiallarni yuklashda xatolik!");
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedBranchId) return toast.error("Yangi filialni tanlang!");
    
    setTransferring(true);
    try {
      await api.post(`/groups/groups/${groupinfo.id}/transfer-branch/`, {
        new_branch_id: selectedBranchId,
        reason: reason || "Guruh filialga o'tkazildi"
      });
      toast.success("Guruh muvaffaqiyatli filialga o'tkazildi!");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || "O'tkazishda xatolik!");
    } finally {
      setTransferring(false);
    }
  };

  if (!isOpen) return null;

  const filteredBranches = branches.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose}></div>
      <div className="lux-card w-full max-w-lg max-h-[90vh] relative z-10 animate-in zoom-in-95 duration-500 flex flex-col p-0 overflow-hidden border-[var(--gold)]/20 shadow-[0_30px_60px_-15px_rgba(184,134,11,0.2)]">
        
        {/* Modal Header */}
        <div className="p-8 border-b border-[var(--border-glass)] bg-gradient-to-r from-[var(--bg-panel)] to-[var(--bg-void)] relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--gold)]/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="flex justify-between items-center relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--gold-dim)] rounded-2xl flex items-center justify-center text-[var(--gold)] border border-[var(--gold)]/20">
                <ArrowRightLeft size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black gold-text capitalize tracking-tight">Guruhni filialga o'tkazish</h3>
                <p className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-[0.3em] mt-1">{groupinfo?.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-[var(--bg-void)]/50 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar bg-[var(--bg-panel)]/40">
          <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl flex gap-3">
            <Info size={18} className="text-blue-400 flex-shrink-0" />
            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
              Guruhni boshqa filialga o'tkazganingizda, uning barcha o'quvchilari (faqat ushbu guruhda bo'lganlar), davomatlari, to'lovlari va barcha ma'lumotlari yangi filialga o'tadi.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3 block px-1">Yangi filialni tanlang</label>
              <div className="relative mb-3">
                <input 
                  type="text" 
                  placeholder="Filialni qidirish..."
                  className="lux-input !bg-[var(--bg-void)]/50 !pl-10 !py-3 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {loadingBranches ? (
                  <div className="py-10 text-center">
                    <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-[10px] text-[var(--text-muted)]">Filiallar yuklanmoqda...</p>
                  </div>
                ) : filteredBranches.length > 0 ? (
                  filteredBranches.map((branch) => (
                    <div 
                      key={branch.id}
                      onClick={() => setSelectedBranchId(branch.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                        selectedBranchId === branch.id 
                        ? 'bg-[var(--gold-dim)] border-[var(--gold)]/50 shadow-[var(--gold-glow)]' 
                        : 'bg-[var(--bg-void)]/30 border-[var(--border-glass)] hover:border-[var(--gold)]/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          selectedBranchId === branch.id ? 'bg-[var(--gold)] text-black' : 'bg-[var(--gold-dim)] text-[var(--gold)]'
                        }`}>
                          <MapPin size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{branch.name}</p>
                          <p className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-0.5">{branch.address || "Manzil yo'q"}</p>
                        </div>
                      </div>
                      {selectedBranchId === branch.id && <CheckCircle2 size={16} className="text-[var(--gold)]" />}
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center opacity-40">
                    <MapPin size={32} className="mx-auto mb-2" />
                    <p className="text-[10px]">Filiallar topilmadi</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3 block px-1">O'tkazish sababi (Ixtiyoriy)</label>
              <textarea 
                className="lux-input !bg-[var(--bg-void)]/50 !h-24 !resize-none !text-xs"
                placeholder="Masalan: Filiallar o'rtasida qayta taqsimlash..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-8 border-t border-[var(--border-glass)] bg-[var(--bg-void)]/30">
          <button
            onClick={handleTransfer}
            disabled={transferring || !selectedBranchId}
            className="lux-btn lux-btn-primary w-full py-5 shadow-[0_10px_40px_rgba(184,134,11,0.2)] flex items-center justify-center gap-3 group disabled:opacity-50 disabled:grayscale"
          >
            {transferring ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <CheckCircle2 size={20} />
                <span className="text-[11px] font-black capitalize tracking-[0.4em]">O'tkazishni tasdiqlash</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GroupTransferModal;
