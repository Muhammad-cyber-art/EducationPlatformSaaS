import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRightLeft, Users, Info, CheckCircle2, Search } from "lucide-react";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";

const StudentTransferModal = ({ isOpen, onClose, student, currentGroupId, currentBranchId, onTransferSuccess }) => {
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [reason, setReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // useCallback — currentBranchId va currentGroupId har doim fresh qiymatda bo'lsin
  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      // Backend: mazkur filial guruhlarini filtrlab qaytaradi
      const params = new URLSearchParams();
      if (currentBranchId) {
        params.set("branch_id", currentBranchId);
      }
      const endpoint = `/groups/nested_groups/${params.toString() ? "?" + params.toString() : ""}`;
      const response = await api.get(endpoint);
      const allGroups = response.data.results || response.data;

      // Hozirgi guruhni ro'yxatdan olib tashlaymiz
      const filtered = allGroups.filter(
        (g) => Number(g.id) !== Number(currentGroupId)
      );
      setGroups(filtered);
    } catch (error) {
      toast.error("Guruhlarni yuklashda xatolik!");
    } finally {
      setLoadingGroups(false);
    }
  }, [currentBranchId, currentGroupId]);

  useEffect(() => {
    if (isOpen) {
      // Modal ochilganda state ni tozalaymiz
      setSelectedGroupId("");
      setReason("");
      setSearchTerm("");
      fetchGroups();
    }
  }, [isOpen, fetchGroups]);

  const handleTransfer = async () => {
    if (!selectedGroupId) return toast.error("Yangi guruhni tanlang!");

    setTransferring(true);
    try {
      await api.post(`/groups/students/${student.id}/transfer-group/`, {
        new_group_id: selectedGroupId,
        from_group_id: currentGroupId,
        reason: reason || `Guruhdan guruhga o'tkazildi`
      });
      toast.success("O'quvchi muvaffaqiyatli ko'chirildi!");
      onTransferSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || "Ko'chirishda xatolik!");
    } finally {
      setTransferring(false);
    }
  };

  if (!isOpen) return null;

  // Qidiruv + filial filtri (ikkinchi himoya qatlami — backend allaqachon filtrlab beradi)
  const filteredGroups = groups.filter(g => {
    const matchSearch =
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.subject || "").toLowerCase().includes(searchTerm.toLowerCase());
    // branch_id — serializer tomonidan integer qaytariladi
    const matchBranch = currentBranchId
      ? Number(g.branch_id) === Number(currentBranchId)
      : true;
    return matchSearch && matchBranch;
  });

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
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
                <h3 className="text-xl font-black gold-text capitalize tracking-tighter">O'quvchini ko'chirish</h3>
                <p className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-[0.2em] mt-1">{student.full_name}</p>
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
              O'quvchini boshqa guruhga ko'chirganingizda, uning ushbu guruhdagi a'zoligi tugatiladi va yangi guruhga qo'shiladi.
              Mentor faqat o'ziga tegishli guruhlar orasida ko'chira oladi.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3 block px-1">Yangi guruhni tanlang</label>
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Guruhni qidirish..."
                  className="lux-input !bg-[var(--bg-void)]/50 !pl-10 !py-3 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {loadingGroups ? (
                  <div className="py-10 text-center">
                    <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-[10px] text-[var(--text-muted)]">Guruhlar yuklanmoqda...</p>
                  </div>
                ) : filteredGroups.length > 0 ? (
                  filteredGroups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${selectedGroupId === g.id
                          ? 'bg-[var(--gold-dim)] border-[var(--gold)]/50 shadow-[var(--gold-glow)]'
                          : 'bg-[var(--bg-void)]/30 border-[var(--border-glass)] hover:border-[var(--gold)]/30'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selectedGroupId === g.id ? 'bg-[var(--gold)] text-black' : 'bg-[var(--gold-dim)] text-[var(--gold)]'
                          }`}>
                          <Users size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{g.name}</p>
                          <p className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-0.5">{g.subject}</p>
                        </div>
                      </div>
                      {selectedGroupId === g.id && <CheckCircle2 size={16} className="text-[var(--gold)]" />}
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center opacity-40">
                    <Users size={32} className="mx-auto mb-2" />
                    <p className="text-[10px]">Guruhlar topilmadi</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3 block px-1">Ko'chirish sababi (Ixtiyoriy)</label>
              <textarea
                className="lux-input !bg-[var(--bg-void)]/50 !h-24 !resize-none !text-xs"
                placeholder="Masalan: Vaqti to'g'ri kelmadi..."
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
            disabled={transferring || !selectedGroupId}
            className="lux-btn lux-btn-primary w-full py-5 shadow-[0_10px_40px_rgba(184,134,11,0.2)] flex items-center justify-center gap-3 group disabled:opacity-50 disabled:grayscale"
          >
            {transferring ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <CheckCircle2 size={20} />
                <span className="text-[11px] font-black capitalize tracking-[0.4em]">Ko'chirishni tasdiqlash</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StudentTransferModal;
