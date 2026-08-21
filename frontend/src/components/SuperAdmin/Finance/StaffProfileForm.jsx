import React from'react';
import { createPortal } from'react-dom';
import { X, UserPlus, Loader2, CreditCard, CheckCircle2, AlertCircle } from'lucide-react';
import { useStaffProfileForm } from'./StaffProfile/useStaffProfileForm';
import { RoleSelector, UserSelector, SalaryTypeSelector, SalaryInputFields } from'./StaffProfile/FormComponents';

const StaffProfileForm = ({ isOpen, onClose, onSuccess, branch }) => {
 const {
 loading,
 loadingUsers,
 error,
 success,
 selectedRole,
 setSelectedRole,
 salaryType,
 setSalaryType,
 formData,
 setFormData,
 availableUsers,
 handleSubmit,
 handleClose
 } = useStaffProfileForm(isOpen, branch, onClose, onSuccess);

 if (!isOpen) return null;

 return createPortal(
 <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
 <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-void)] border border-[#2a2a2a] rounded-[2.5rem] shadow-2xl scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--gold)]/20 animate-in zoom-in-95 duration-200">
 <div className="sticky top-0 z-10 h-1.5 w-full bg-gradient-to-r from-[var(--gold)]/50 via-[var(--gold)] to-[var(--gold)]/50"></div>

 <div className="p-4 md:p-5">
 <button
 onClick={handleClose}
 disabled={loading}
 className="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors p-1.5 hover:bg-[var(--gold)]/10 rounded-xl"
 >
 <X size={18} />
 </button>

 <div className="flex justify-center mb-3">
 <div className="relative">
 <div className="absolute inset-0 bg-[var(--gold)] blur-2xl opacity-20 animate-pulse"></div>
 <div className="relative bg-[var(--gold)]/10 p-3 rounded-[1.5rem] border border-[var(--gold)]/20">
 <UserPlus size={28} className="text-[var(--gold)]" />
 </div>
 </div>
 </div>

 <div className="text-center mb-4">
 <h2 className="text-lg font-black text-[var(--text-primary)] mb-1 tracking-tight capitalize">Yangi Xodim Profili</h2>
 <p className="text-[9px] text-[var(--text-muted)] leading-relaxed capitalize tracking-widest opacity-60">Xodim uchun moliyaviy profil yarating</p>
 </div>

 {success ? (
 <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 mb-4 text-center">
 <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={40} />
 <p className="text-emerald-300 font-bold capitalize tracking-wide text-sm">Profil muvaffaqiyatli yaratildi!</p>
 </div>
 ) : (
 <div className="space-y-4">
 {error && (
 <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
 <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
 <p className="text-xs text-red-300 font-bold">{error}</p>
 </div>
 )}

 <RoleSelector {...{ selectedRole, setSelectedRole, loading }} />
 <UserSelector {...{ formData, setFormData, availableUsers, loadingUsers, loading, selectedRole }} />
 <SalaryTypeSelector {...{ salaryType, setSalaryType, loading, selectedRole }} />
 <SalaryInputFields {...{ salaryType, formData, setFormData, loading }} />

 <div>
 <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-2 px-1">
 <CreditCard size={12} className="text-[var(--gold)]" /> Karta Raqami
 </label>
 <input
 type="text"
 value={formData.karta}
 onChange={(e) => setFormData({ ...formData, karta: e.target.value })}
 placeholder="8600 **** **** ****"
 maxLength="19"
 disabled={loading}
 className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] text-[var(--text-primary)] rounded-xl px-4 py-3.5 text-xs font-bold focus:outline-none focus:border-[var(--gold)]/50 transition-all placeholder:[var(--text-muted)]/50 disabled:opacity-50 shadow-inner tracking-widest font-mono"
 />
 </div>

 <div className="space-y-2 pt-2">
 <button
 type="button"
 onClick={handleSubmit}
 disabled={loading || loadingUsers || !formData.user || availableUsers.length === 0}
 className="w-full flex items-center justify-center gap-3 bg-[var(--gold)] hover:bg-[var(--gold)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-[11px] capitalize tracking-widest py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(184,134,11,0.3)] active:scale-[0.97]"
 >
 {loading ? (
 <><Loader2 className="animate-spin" size={18} /> Saqlanmoqda...</>
 ) : (
 <><CheckCircle2 size={18} /> Profilni Yaratish</>
 )}
 </button>
 <button
 type="button"
 onClick={handleClose}
 disabled={loading}
 className="w-full bg-transparent hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-black text-[9px] capitalize tracking-[0.2em] py-2.5 rounded-xl transition-all border border-transparent hover:border-[#2a2a2a]"
 >
 Bekor qilish
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>,
 document.body
 );
};

export default StaffProfileForm;