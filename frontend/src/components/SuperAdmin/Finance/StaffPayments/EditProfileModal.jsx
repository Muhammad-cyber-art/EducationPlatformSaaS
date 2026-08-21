import React from"react";
import { createPortal } from"react-dom";
import { X, Loader2, Save } from"lucide-react";
import AmountInput from"../../../Common/AmountInput";

const EditProfileModal = ({
 isOpen,
 onClose,
 editForm,
 editLoading,
 dispatch,
 updateEditForm,
 handleUpdate
}) => {
 if (!isOpen) return null;

 return createPortal(
 <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
 <div className="bg-[var(--bg-void)] border border-[#2a2a2a] rounded-[2.5rem] w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--gold)]/20 animate-in zoom-in-95 duration-200">
 <div className="sticky top-0 z-10 h-1 w-full bg-gradient-to-r from-[var(--gold)]/50 via-[var(--gold)] to-[var(--gold)]/50"></div>
 <div className="p-5">
 <div className="flex justify-between items-center mb-5">
 <h2 className="text-base font-black text-[var(--text-primary)] capitalize tracking-tight">Tahrirlash</h2>
 <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors p-1.5 hover:bg-[var(--gold)]/10 rounded-xl"><X size={18} /></button>
 </div>

 <div className="space-y-4">
 <div>
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1 mb-1.5 block">Maosh turi</label>
 <div className="grid grid-cols-3 gap-2">
 {['fixed','percentage','student_count'].map((type) => (
 <button
 key={type}
 type="button"
 onClick={() => dispatch(updateEditForm({ salary_type: type }))}
 className={`py-2.5 px-3 rounded-xl transition-all ${editForm.salary_type === type ?'bg-[var(--gold)] text-black shadow-[0_0_15px_rgba(184,134,11,0.3)]' :'bg-[var(--bg-panel)] text-[var(--text-muted)] border border-[#2a2a2a]'}`}
 >
 <span className="text-[10px] font-black capitalize">
 {type ==='fixed' ?'Belgilangan' : type ==='percentage' ?'Foiz' :'Student'}
 </span>
 </button>
 ))}
 </div>
 </div>

 {editForm.salary_type ==='fixed' ? (
 <div>
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1 mb-1.5 block">Maosh (UZS)</label>
 <AmountInput
 value={editForm.fixed_salary}
 onChange={(e) => dispatch(updateEditForm({ fixed_salary: e.target.value }))}
 placeholder="0"
 className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-xl py-2.5 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-all font-black text-sm shadow-inner"
 />
 </div>
 ) : editForm.salary_type ==='percentage' ? (
 <div>
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1 mb-1.5 block">Foiz (%)</label>
 <input
 type="number"
 value={editForm.commission_percentage}
 onChange={(e) => dispatch(updateEditForm({ commission_percentage: e.target.value }))}
 className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-xl py-2.5 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-all font-bold text-sm shadow-inner"
 />
 </div>
 ) : (
 <div>
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1 mb-1.5 block">Har bir o'quvchi uchun (UZS)</label>
 <AmountInput
 value={editForm.per_student_amount}
 onChange={(e) => dispatch(updateEditForm({ per_student_amount: e.target.value }))}
 placeholder="0"
 className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-xl py-2.5 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-all font-black text-sm shadow-inner"
 />
 </div>
 )}

 <div>
 <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1 mb-1.5 block">Karta</label>
 <input
 type="text"
 value={editForm.karta}
 onChange={(e) => dispatch(updateEditForm({ karta: e.target.value }))}
 className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-xl py-2.5 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-all font-bold text-sm font-mono tracking-widest shadow-inner"
 />
 </div>

 <button
 onClick={() => handleUpdate(editForm)}
 disabled={editLoading}
 className="w-full bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-2 text-xs capitalize tracking-widest shadow-[0_0_20px_rgba(184,134,11,0.3)] active:scale-[0.98] disabled:opacity-50"
 >
 {editLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
 Saqlash
 </button>
 </div>
 </div>
 </div>
 </div>,
 document.body
 );
};

export default EditProfileModal;
