import React, { useState, useEffect } from"react";
import { createPortal } from"react-dom";
import { X, Search, User, Phone, Check, Loader2, AlertTriangle, Layers } from"lucide-react";
import api from"../../tokenUpdater/updater";
import toast from"react-hot-toast";
import { safeArray } from"../../utils/safeArray";

const MergeStudentModal = ({ isOpen, onClose, masterStudent, onMerge }) => {
 const [searchQuery, setSearchQuery] = useState("");
 const [results, setResults] = useState([]);
 const [loading, setLoading] = useState(false);
 const [selectedStudent, setSelectedStudent] = useState(null);

 useEffect(() => {
 if (!searchQuery.trim()) {
 setResults([]);
 return;
 }

 const delayDebounceFn = setTimeout(async () => {
 setLoading(true);
 try {
 const res = await api.get(`/groups/students/search/?q=${searchQuery}`);
 // Filter out the master student itself
 const studentsArray = safeArray(res.data);
 const filtered = studentsArray.filter(s => s.id !== masterStudent.id);
 setResults(filtered);
 } catch (err) {
 console.error("Search error:", err);
 } finally {
 setLoading(false);
 }
 }, 500);

 return () => clearTimeout(delayDebounceFn);
 }, [searchQuery, masterStudent.id]);

 if (!isOpen) return null;

 const handleConfirmMerge = () => {
 if (!selectedStudent) return;
 if (window.confirm(`${selectedStudent.full_name} ma'lumotlarini ${masterStudent.full_name} ga birlashtirishni tasdiqlaysizmi? Bu amalni ortga qaytarib bo'lmaydi!`)) {
 onMerge(selectedStudent.id);
 }
 };

 return createPortal(
 <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
 <div className="bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-[2.5rem] w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">

 {/* Header */}
 <div className="p-6 border-b border-[var(--border-glass)] flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-transparent">
 <div className="flex items-center gap-3">
 <div className="p-2.5 bg-amber-500/20 rounded-2xl text-amber-500">
 <Layers size={22} />
 </div>
 <div>
 <h2 className="text-lg font-black text-[var(--text-primary)] capitalize tracking-tight">O'quvchilarni Birlashtirish</h2>
 <p className="text-[10px] font-bold text-[var(--text-muted)] capitalize tracking-widest">Dublikat profillarni bittaga jamlash</p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-[var(--gold)]/10 rounded-xl transition-colors">
 <X size={20} className="text-[var(--text-muted)]" />
 </button>
 </div>

 <div className="p-6 space-y-6 overflow-y-auto">
 {/* Master Student Info (Reference) */}
 <div className="p-4 rounded-2xl bg-[var(--gold)]/5 border border-[var(--gold)]/20">
 <p className="text-[9px] font-black text-[var(--gold)] capitalize tracking-widest mb-2">Asosiy Profil (Saqlanib qoladi)</p>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-[var(--bg-panel)] border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold)]">
 <User size={20} />
 </div>
 <div>
 <h4 className="text-sm font-black text-[var(--text-primary)] capitalize">{masterStudent.full_name}</h4>
 <p className="text-xs font-bold text-[var(--text-muted)]">{masterStudent.phone}</p>
 </div>
 </div>
 </div>

 <div className="flex items-center justify-center py-2 text-amber-500/50">
 <ArrowDown size={20} />
 </div>

 {/* Search Section */}
 <div className="space-y-4">
 <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Dublikat profilni qidiring</label>
 <div className="relative group">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--gold)] transition-colors" size={18} />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Ism yoki telefon raqami..."
 className="w-full pl-12 pr-4 py-4 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-all placeholder:text-[var(--text-muted)]/50 shadow-inner"
 />
 {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[var(--gold)]" size={18} />}
 </div>

 {/* Results list */}
 <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin pr-1">
 {results.map((student) => (
 <div
 key={student.id}
 onClick={() => setSelectedStudent(student)}
 className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${selectedStudent?.id === student.id
 ?'bg-red-500/10 border-red-500/30'
 :'bg-[var(--bg-void)]/50 border-[var(--border-glass)] hover:border-[var(--gold)]/30'
 }`}
 >
 <div className="flex items-center gap-3">
 <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selectedStudent?.id === student.id ?'bg-red-500/20 text-red-500' :'bg-[var(--bg-panel)] text-[var(--text-muted)]'
 }`}>
 <User size={16} />
 </div>
 <div>
 <h5 className="text-[11px] font-black text-[var(--text-primary)] capitalize">{student.full_name}</h5>
 <p className="text-[9px] font-bold text-[var(--text-muted)]">{student.phone}</p>
 </div>
 </div>
 {selectedStudent?.id === student.id && <Check size={16} className="text-red-500" />}
 </div>
 ))}
 {searchQuery && !loading && results.length === 0 && (
 <p className="text-center py-4 text-[10px] font-bold text-[var(--text-muted)] capitalize">O'quvchi topilmadi</p>
 )}
 </div>
 </div>

 {/* Warning Box */}
 {selectedStudent && (
 <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex gap-3 animate-in slide-in-from-top-2">
 <AlertTriangle className="text-red-500 shrink-0" size={18} />
 <div>
 <p className="text-[10px] font-black text-red-500 capitalize leading-tight">Diqqat!</p>
 <p className="text-[9px] font-bold text-red-500/70 leading-relaxed">
 Barcha guruhlar, davomatlar va to'lovlar <b>{masterStudent.full_name}</b> ga ko'chiriladi.
 <b> {selectedStudent.full_name}</b> profili butkul o'chiriladi.
 </p>
 </div>
 </div>
 )}
 </div>

 {/* Footer Actions */}
 <div className="p-6 border-t border-[var(--border-glass)] flex items-center gap-3">
 <button
 onClick={onClose}
 className="flex-1 py-4 rounded-2xl border border-[var(--border-glass)] text-[10px] font-black capitalize tracking-widest text-[var(--text-secondary)] hover:bg-white/5 transition-all"
 >
 Bekor qilish
 </button>
 <button
 disabled={!selectedStudent}
 onClick={handleConfirmMerge}
 className="flex-[2] py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black capitalize tracking-widest shadow-lg shadow-red-900/20 transition-all active:scale-[0.98] disabled:opacity-30 disabled:grayscale"
 >
 Birlashtirishni Boshlash
 </button>
 </div>
 </div>
 </div>,
 document.body
 );
};

const ArrowDown = ({ size }) => (
 <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <path d="M12 5v14M19 12l-7 7-7-7" />
 </svg>
);

export default MergeStudentModal;
