import React, { useState, useEffect, useRef } from"react";
import { X, Search, UserPlus, Check, Loader2, UserCheck } from"lucide-react";
import api from"../../tokenUpdater/updater";
import { get_user_info } from"../Authorized/getRole";
import { useQueryClient } from"@tanstack/react-query";
import toast from"react-hot-toast";
import { safeArray } from"../../utils/safeArray";

export default function AddMentorModal({ groupId, branchId, isOpen, onClose, currentMentors = [] }) {
 const [mentors, setMentors] = useState([]);
 const [loading, setLoading] = useState(false);
 const [submitting, setSubmitting] = useState(null); // Qaysi mentor qo'shilayotganini saqlaydi
 const [searchTerm, setSearchTerm] = useState("");
 const modalRef = useRef(null);
 const queryClient = useQueryClient();

 // Mentorlarni yuklash
 useEffect(() => {
 if (isOpen) {
 setLoading(true);
  const url = branchId ? `/groups/mentors/?branch_id=${branchId}` : "/groups/mentors/";
  api.get(url)
 .then((res) => {
 // Allaqachon guruhda bor mentorlarni filtrlab tashlash
 const currentIds = currentMentors.map(m => m.mentor || m.id);
 const mentorsArray = safeArray(res.data);
 const availableMentors = mentorsArray.filter(m => !currentIds.includes(m.id));
 setMentors(availableMentors);
 })
 .catch((err) => console.error("Mentorlarni yuklashda xato:", err))
 .finally(() => setLoading(false));
 }
 }, [isOpen, currentMentors]);

 // ESC tugmasi orqali yopish
 useEffect(() => {
 const handleEsc = (e) => { if (e.key ==="Escape") onClose(); };
 window.addEventListener("keydown", handleEsc);
 return () => window.removeEventListener("keydown", handleEsc);
 }, [onClose]);

 // Mentor biriktirish funksiyasi
 const handleAddMentor = async (mentorId) => {
 setSubmitting(mentorId);
 try {
 await api.post(`/groups/groups/${groupId}/assign-additional-mentor/`, { mentor: mentorId });
 // Muvaffaqiyatli bo'lsa ro'yxatdan o'sha mentorni olib tashlaymiz
 setMentors(prev => prev.filter(m => m.id !== mentorId));
 toast.success("Mentor muvaffaqiyatli biriktirildi!");
 // Cache invalidation replaces window.location.reload()
 queryClient.invalidateQueries(['group-detail', groupId]);
 onClose();
 } catch (err) {
 // Global interceptor handles the toast, but we can add specific handling if needed
 } finally {
 setSubmitting(null);
 }
 };

 if (!isOpen) return null;

 // Qidiruv bo'yicha filtrlash
 const filteredMentors = mentors.filter(m =>
 `${m.first_name} ${m.last_name} ${m.username}`.toLowerCase().includes(searchTerm.toLowerCase())
 );

 return (
 <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50">
 {/* Modal Content */}
 <div
 ref={modalRef}
 className="relative w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded shadow-lg overflow-hidden"
 >
 {/* Header */}
 <div className="px-5 py-4 border-b border-[var(--border-glass)] flex items-center justify-between bg-[var(--bg-void)]">
 <div className="flex items-center gap-3">
 <UserPlus size={18} className="text-[var(--gold)]" />
 <h2 className="text-sm font-bold text-[var(--text-primary)] capitalize tracking-wide">Mentor biriktirish</h2>
 </div>
 <button
 onClick={onClose}
 className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
 >
 <X size={18} />
 </button>
 </div>

 {/* Search Bar */}
 <div className="p-4 border-b border-[var(--border-glass)]">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={14} />
 <input
 type="text"
 placeholder="Mentor ismi yoki username..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] rounded py-2 pl-9 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--border-glass)] transition"
 />
 </div>
 </div>

 {/* Mentors List */}
 <div className="max-h-[300px] overflow-y-auto p-0">
 {loading ? (
 <div className="py-10 flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
 <Loader2 className="animate-spin text-[var(--gold)]" size={24} />
 <p className="text-[10px] font-bold capitalize tracking-widest opacity-60">Yuklanmoqda...</p>
 </div>
 ) : filteredMentors.length > 0 ? (
 <div className="divide-y divide-[var(--border-glass)]">
 {filteredMentors.map((mentor) => (
 <div
 key={mentor.id}
 className="flex items-center justify-between p-3 hover:bg-[var(--bg-void)] transition group cursor-pointer"
 onClick={() => handleAddMentor(mentor.id)}
 >
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-primary)] font-bold text-xs capitalize">
 {mentor.full_name?.charAt(0) || mentor.username?.charAt(0)}
 </div>
 <div>
 <p className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--gold)] transition">
 {mentor.full_name || `${mentor.first_name ||""} ${mentor.last_name ||""}`.trim() || mentor.username}
 </p>
 <p className="text-[10px] text-[var(--text-secondary)] font-medium tracking-wide opacity-60">
 @{mentor.username}
 </p>
 </div>
 </div>

 <button
 disabled={submitting === mentor.id}
 className="text-[var(--text-secondary)] group-hover:text-[var(--gold)] transition"
 >
 {submitting === mentor.id ? (
 <Loader2 size={16} className="animate-spin" />
 ) : (
 <Check size={16} />
 )}
 </button>
 </div>
 ))}
 </div>
 ) : (
 <div className="py-10 text-center space-y-2">
 <div className="inline-flex text-[var(--text-secondary)] opacity-20">
 <UserCheck size={32} />
 </div>
 <p className="text-[var(--text-secondary)] text-[10px] font-bold capitalize tracking-widest opacity-60">Mos mentorlar topilmadi</p>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-3 bg-[var(--bg-void)] border-t border-[var(--border-glass)]">
 <p className="text-[9px] text-center text-[var(--text-secondary)] font-bold capitalize tracking-[0.2em] opacity-50">
 Jami: {filteredMentors.length} ta mavjud
 </p>
 </div>
 </div>
 </div>
 );
}