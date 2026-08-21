import React from"react";
import { createPortal } from"react-dom";
import { X, Loader2, BookOpen, ChevronRight } from"lucide-react";

const AssignGroupModal = ({
 student,
 isOpen,
 onClose,
 groups,
 loadingGroups,
 onAssign
}) => {
 const safeGroups = Array.isArray(groups) ? groups : (groups && Array.isArray(groups.results) ? groups.results : []);

 if (!isOpen || !student) return null;

 return createPortal(
 <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
 <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300" onClick={onClose}></div>
 <div className="lux-card w-full max-w-lg max-h-[90vh] relative z-10 animate-in slide-in-from-bottom-10 duration-500 flex flex-col p-0 overflow-hidden shadow-[0_30px_60px_-15px_rgba(184,134,11,0.2)]">
 <div className="p-8 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/80 flex-shrink-0">
 <div className="flex justify-between items-center mb-4">
 <h3 className="text-2xl font-black gold-text capitalize">Guruh tanlash</h3>
 <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition-colors"><X size={24} /></button>
 </div>
 <p className="text-[10px] text-[var(--text-secondary)] font-bold capitalize tracking-widest flex items-center gap-2">
 O'quvchi: <span className="text-white">{student.full_name}</span>
 </p>
 </div>

 <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
 <div className="space-y-3">
 {loadingGroups ? (
 <div className="py-20 flex justify-center">
 <Loader2 className="animate-spin text-[var(--gold)]" size={32} />
 </div>
 ) : safeGroups.length === 0 ? (
 <div className="text-center py-10 opacity-50 text-sm text-[var(--text-muted)] capitalize tracking-widest">Faol guruhlar topilmadi.</div>
 ) : (
 safeGroups.map(group => (
 <button
 key={group.id}
 onClick={() => onAssign(student.id, group.id)}
 className="w-full flex items-center justify-between p-5 rounded-[20px] bg-[var(--bg-void)]/50 border border-[var(--border-glass)] hover:border-[var(--gold)]/40 hover:bg-[var(--gold-dim)] transform transition-all active:scale-[0.98] text-left group/item"
 >
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-xl bg-black border border-[var(--gold)]/10 flex items-center justify-center group-hover/item:border-[var(--gold)]/30 transition-colors shadow-lg">
 <BookOpen size={20} className="text-[var(--gold)]" />
 </div>
 <div>
 <p className="text-sm font-black text-[var(--text-primary)] group-hover/item:text-[var(--gold)] transition-colors capitalize tracking-tight">{group.name}</p>
 <div className="flex items-center gap-3 mt-1">
 <span className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-wider">{group.subject ||"No Subject"}</span>
 <span className="w-1 h-1 rounded-full bg-[var(--border-glass)]"></span>
 <span className="text-[9px] font-bold text-[var(--gold)] opacity-70 capitalize tracking-widest">{group.students_count} o'quvchi</span>
 </div>
 </div>
 </div>
 <ChevronRight size={18} className="text-[var(--text-muted)] group-hover/item:text-[var(--gold)] group-hover/item:translate-x-1 transition-all" />
 </button>
 ))
 )}
 </div>
 </div>

 <div className="p-6 bg-[var(--bg-void)]/40 border-t border-[var(--border-glass)] flex-shrink-0">
 <p className="text-[8px] text-[var(--text-muted)] text-center capitalize tracking-[0.2em] font-black">
 Guruh tanlaganingizdan so'ng, o'quvchi avtomatik tarzda Studentlar ro'yxatiga ko'chiriladi.
 </p>
 </div>
 </div>
 </div>,
 document.body
 );
};

export default AssignGroupModal;
