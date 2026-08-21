import React, { useState, useEffect } from'react';
import toast from'react-hot-toast';
import { X, ArrowRightLeft, CheckCircle2, AlertCircle, Loader2 } from'lucide-react';
import { safeArray } from'../../utils/safeArray';

const TransferStudentModal = ({ isOpen, onClose, student, fromGroup, currentBranchId, api, onSuccess }) => {
 const [groups, setGroups] = useState([]);
 const [selectedGroupId, setSelectedGroupId] = useState('');
 const [loading, setLoading] = useState(false);
 const [fetchingGroups, setFetchingGroups] = useState(false);

 // Guruhlarni yuklab olish
 useEffect(() => {
 if (isOpen && currentBranchId) {
 setFetchingGroups(true);
 api.get(`/groups/groups/?branch_id=${currentBranchId}&page_size=200`)
 .then(res => {
 // O'quvchining hozirgi guruhini ro'yxatdan chiqarib tashlaymiz
 const groupsArray = safeArray(res.data);
 const availableGroups = groupsArray.filter(
 g => g.id !== (fromGroup?.id || student?.group?.id)
 );
 setGroups(availableGroups);
 })
 .catch(err => console.error("Guruhlarni yuklashda xato:", err))
 .finally(() => setFetchingGroups(false));
 }
 }, [isOpen, currentBranchId, student, api]);

 const handleTransfer = async () => {
 if (!selectedGroupId) return;

 setLoading(true);
 try {
 await api.post(`/groups/students/${student.id}/transfer-group/`, {
 new_group_id: selectedGroupId,
 from_group_id: fromGroup?.id || student?.group?.id
 });
 toast.success("O'quvchi muvaffaqiyatli ko'chirildi!");
 onSuccess();
 onClose();
 } catch (error) {
 // General error toast is handled by interceptor
 setLoading(false);
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">

 {/* Modal Container */}
 <div className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

 {/* Header */}
 <div className="relative p-5 md:p-6 border-b border-[var(--border-glass)]">
 <button
 onClick={onClose}
 className="absolute right-4 top-4 p-1 rounded-full hover:bg-[var(--bg-void)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
 >
 <X size={20} />
 </button>

 <div className="flex items-center gap-3">
 <div className="p-1.5 md:p-2 bg-[var(--gold)]/10 rounded-lg text-[var(--gold)]">
 <ArrowRightLeft size={20} md:size={24} />
 </div>
 <div>
 <h3 className="text-lg md:text-xl font-semibold text-[var(--text-primary)] leading-tight">Guruhni almashtirish</h3>
 <p className="text-[11px] md:text-sm text-[var(--text-secondary)]">O'quvchini yangi guruhga ko'chirish</p>
 </div>
 </div>
 </div>

 {/* Content */}
 <div className="p-5 md:p-6 space-y-4 md:space-y-6">

 {/* Student Info Card */}
 <div className="p-3 md:p-4 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl">
 <p className="text-[10px] md:text-xs text-[var(--text-secondary)] capitalize tracking-wider font-bold">O'quvchi</p>
 <h4 className="text-base md:text-lg font-medium text-[var(--text-primary)]">{student?.full_name}</h4>
 <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
 <span className="px-2 py-0.5 bg-[var(--bg-panel)] rounded text-[var(--text-primary)] border border-[var(--border-glass)]">
 Eski: {fromGroup?.name || student?.group?.name || "Guruhsiz"}
 </span>
 </div>
 </div>

 {/* Select Group */}
 <div className="space-y-1.5 md:space-y-2">
 <label className="text-xs md:text-sm font-medium text-[var(--text-secondary)]">Yangi guruhni tanlang</label>
 <div className="relative">
 {fetchingGroups ? (
 <div className="flex items-center justify-center p-2.5 bg-[var(--bg-void)] rounded-xl border border-[var(--border-glass)]">
 <Loader2 className="animate-spin text-[var(--gold)]" size={18} />
 </div>
 ) : (
 <select
 value={selectedGroupId}
 onChange={(e) => setSelectedGroupId(e.target.value)}
 className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-primary)] text-[13px] md:text-sm rounded-xl focus:ring-1 focus:ring-[var(--border-glass)] focus:border-[var(--border-glass)] block p-2.5 md:p-3 appearance-none cursor-pointer hover:border-[var(--text-secondary)] transition-all outline-none"
 >
 <option value="">Guruhlar ro'yxati...</option>
 {groups.map((group) => (
 <option key={group.id} value={group.id} className="bg-[var(--bg-panel)]">
 {group.name} — {group.subject}
 </option>
 ))}
 </select>
 )}
 </div>
 {groups.length === 0 && !fetchingGroups && (
 <p className="flex items-center gap-1 text-[10px] md:text-xs text-amber-500 mt-1">
 <AlertCircle size={12} md:size={14} /> Bo'sh guruhlar topilmadi
 </p>
 )}
 </div>
 </div>

 {/* Footer Actions */}
 <div className="p-5 md:p-6 bg-[var(--bg-void)]/30 border-t border-[var(--border-glass)] flex items-center gap-3">
 <button
 onClick={onClose}
 className="flex-1 px-4 py-2 md:py-2.5 rounded-xl border border-[var(--border-glass)] text-[var(--text-secondary)] text-xs md:text-sm font-medium hover:bg-[var(--bg-void)] hover:text-[var(--text-primary)] transition-all active:scale-95"
 >
 Bekor qilish
 </button>
 <button
 onClick={handleTransfer}
 disabled={!selectedGroupId || loading}
 className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all active:scale-95 border-none ${!selectedGroupId || loading
 ?'bg-[var(--bg-void)] text-[var(--text-secondary)] cursor-not-allowed border border-[var(--border-glass)]'
 :'lux-btn !bg-blue-600 hover:!bg-blue-500 text-white shadow-lg shadow-blue-500/20'
 }`}
 >
 {loading ? (
 <Loader2 className="animate-spin" size={20} />
 ) : (
 <>
 <CheckCircle2 size={18} />
 Tasdiqlash
 </>
 )}
 </button>
 </div>

 </div>
 </div>
 );
};

export default TransferStudentModal;