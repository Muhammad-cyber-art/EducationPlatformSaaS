import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { X, GraduationCap, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { safeArray } from "../../../../utils/safeArray";

const JoinGroupModal = ({ isOpen, onClose, student, currentBranchId, api, onSuccess }) => {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [createPayment, setCreatePayment] = useState(true);

  // Guruhlarni yuklab olish
  useEffect(() => {
    const branchToUse = currentBranchId || student?.branch_id || student?.branch?.id;
    if (isOpen) {
      setFetchingGroups(true);
      const url = branchToUse ? `/groups/nested_groups/?branch_id=${branchToUse}&page_size=500` : `/groups/nested_groups/?page_size=500`;
      api.get(url)
        .then(res => {
          const allGroups = safeArray(res.data?.results || res.data);
          const studentGroupIds = safeArray(student?.groups).map(g => g.id);
          // Faqat student hozir a'zo bo'lgan guruhlarni chiqaramiz
          const filteredGroups = allGroups.filter(g => !studentGroupIds.includes(g.id));
          setGroups(filteredGroups);
        })
        .catch(err => console.error("Guruhlarni yuklashda xato:", err))
        .finally(() => setFetchingGroups(false));
    }
  }, [isOpen, currentBranchId, student, api]);

  const handleJoin = async () => {
    if (!selectedGroupId) return;

    setLoading(true);
    try {
      await api.post(`/groups/groups/${selectedGroupId}/enroll-student/`, {
        student_id: student.id,
        create_payment: createPayment
      });
      toast.success("O'quvchi guruhga muvaffaqiyatli qo'shildi!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">

      {/* Modal Container */}
      <div className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="relative p-6 border-b border-[var(--border-glass)]">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 rounded-xl hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
              <GraduationCap size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--text-primary)] leading-tight tracking-tight">Yangi Guruhga Qo'shish</h3>
              <p className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">O'quvchini boshqa guruhga biriktirish</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">

          {/* Student Info */}
          <div className="p-4 bg-[var(--bg-void)]/50 border border-[var(--border-glass)] rounded-2xl">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1.5">O'quvchi</p>
            <h4 className="text-lg font-black text-[var(--text-primary)]">{student?.full_name}</h4>
          </div>

          {/* Select Group */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-widest px-1">Guruhni tanlang</label>
            <div className="relative">
              {fetchingGroups ? (
                <div className="flex items-center justify-center p-4 bg-[var(--bg-void)] rounded-2xl border border-[var(--border-glass)]">
                  <Loader2 className="animate-spin text-[var(--gold)]" size={24} />
                </div>
              ) : (
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-primary)] text-sm font-bold rounded-2xl focus:ring-2 focus:ring-[var(--gold)]/20 focus:border-[var(--gold)]/50 block p-4 appearance-none cursor-pointer hover:border-[var(--gold)]/30 transition-all outline-none shadow-inner"
                >
                  <option value="" className="bg-[var(--bg-panel)]">Guruhlar ro'yxati...</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id} className="bg-[var(--bg-panel)] font-bold">
                      {group.name} — {group.subject || "Kurs"}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {groups.length === 0 && !fetchingGroups && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-500 font-bold leading-tight">
                  Ushbu filialda o'quvchi qo'shilishi mumkin bo'lgan bo'sh guruhlar topilmadi.
                </p>
              </div>
            )}
          </div>

          {/* Payment Toggle */}
          <div className="flex items-center justify-between p-4 bg-[var(--bg-void)]/30 border border-[var(--border-glass)] rounded-2xl">
            <div>
              <p className="text-[12px] font-black text-[var(--text-primary)]">Oylik To'lovni Yaratish</p>
              <p className="text-[10px] text-[var(--text-muted)] font-medium">Joriy oy uchun to'lov varaqasini avtomatik yaratish</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={createPayment}
                onChange={(e) => setCreatePayment(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--bg-panel)] peer-focus:outline-none rounded-full peer border border-[var(--border-glass)] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-muted)] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-white"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[var(--bg-void)]/50 border-t border-[var(--border-glass)] flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl border border-[var(--border-glass)] text-[var(--text-secondary)] text-[12px] font-black uppercase tracking-widest hover:bg-white/5 hover:text-[var(--text-primary)] transition-all active:scale-95"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleJoin}
            disabled={!selectedGroupId || loading}
            className={`flex-[1.5] flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl ${!selectedGroupId || loading
              ? 'bg-[var(--bg-void)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border-glass)]'
              : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20'
              }`}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <CheckCircle2 size={20} />
                Guruhga qo'shish
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default JoinGroupModal;
