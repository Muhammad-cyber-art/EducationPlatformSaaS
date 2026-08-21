import React from "react";
import { Loader2, ChevronRight, Camera, Copy, Phone, Eye, EyeOff, Save, Trash2, Building2, Activity, UserMinus, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

// Hooks
import { useMentorProfile } from "./MentorProfile/useMentorProfile";

// Components
import MentorsGroupCards from "./MentorsGroupCards";
import StaffTransferModal from "../SuperAdmin/StaffTransferModal";

export default function MentorProfilePage({ viewMode = "all" }) {
    const {
        state,
        dispatch,
        user_info,
        userData,
        isMentorLoading,
        staffBranches,
        isSuperAdmin,
        canEditMentor,
        handleUpdate,
        handleDelete,
        handleRemoveFromBranch,
        handleRemoveBranchAccess,
        permMutation,
        navigate,
        queryClient,
        PERMISSION_LABELS
    } = useMentorProfile();

    const { mentor, mentorsGroup, isEditing, editData, showPassword, isTransferModalOpen, permissions } = state;

    if (isMentorLoading || !mentor.id) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 size={32} className="text-[var(--gold)] animate-spin" />
            </div>
        );
    }

    const mentorColor = mentor.color || '#b8860b';
    const userRole = (userData.role || user_info?.role || "").toLowerCase();

    return (
        <div className="w-full min-h-screen relative pb-20 animate-lux-fade font-sans selection:bg-[var(--gold)]/20 text-[var(--text-primary)]">
            {/* Atmosphere & Background */}
            <div className="fixed inset-0 pointer-events-none -z-10 bg-[var(--bg-void)]">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--gold)]/5 rounded-full blur-[100px] opacity-60" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] opacity-40" />
            </div>

            {/* Header (Back, Name, Date, Delete) */}
            <div className="px-4 py-3 md:px-8 border-b border-[var(--border-glass)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {user_info.role !== "mentor" && (
                        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-[var(--bg-panel)] transition-colors border border-[var(--border-glass)]">
                            <ChevronRight size={18} className="rotate-180" />
                        </button>
                    )}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--bg-panel)] flex items-center justify-center border border-[var(--border-glass)]">
                            {mentor.image ? <img src={mentor.image} className="w-full h-full object-cover" /> : <span className="text-xs font-black uppercase" style={{ color: mentorColor }}>{mentor.first_name?.[0]}{mentor.last_name?.[0]}</span>}
                        </div>
                        <span className="text-sm font-black capitalize tracking-wide">{mentor.first_name} {mentor.last_name}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <span className="hidden md:block text-[10px] text-[var(--text-muted)] font-black tracking-widest">
                        ID Raqami: #{mentor.id?.toString().padStart(4, '0')}
                    </span>
                    {isSuperAdmin && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-500/20 transition-all"
                        >
                            <Trash2 size={14} /> O'chirish
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-8 pb-16">
                {viewMode === "groups" ? (
                    // Groups View Mode
                    <div className="space-y-10">
                        <div className="flex items-center justify-between px-2">
                            <div>
                                <h2 className="text-xl font-bold text-[var(--text-primary)] capitalize tracking-tight">Guruhlar</h2>
                                <p className="text-[10px] text-[var(--gold)] font-black capitalize tracking-[0.3em] mt-1">Ishchi maydoni taqsimoti</p>
                            </div>
                            <div className="flex items-center gap-6 px-6 py-3 bg-[var(--gold-dim)] rounded-2xl border border-[var(--gold)]/10 shadow-inner">
                                <div className="text-center">
                                    <p className="text-sm font-black text-[var(--text-primary)]">{mentorsGroup.length}</p>
                                    <p className="text-[7px] font-black text-[var(--gold)] capitalize tracking-widest">Faol guruhlar</p>
                                </div>
                                <div className="w-px h-6 bg-[var(--gold)]/20"></div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-[var(--text-primary)]">
                                        {mentorsGroup.reduce((acc, g) => acc + (g.students_count || 0), 0)}
                                    </p>
                                    <p className="text-[7px] font-black text-[var(--gold)] capitalize tracking-widest">O'quvchilar</p>
                                </div>
                            </div>
                        </div>
                        <MentorsGroupCards mentorsGroups={mentorsGroup} navig={navigate} />
                    </div>
                ) : (
                    // 3-Column Profile Layout
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                        {/* Column 1: Profile Image & Details (Left) */}
                        <div className="lg:col-span-4 flex flex-col space-y-8">
                            {/* Profile Image Section */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Profile Image</h3>
                                <div className="w-[140px] md:w-[200px] lg:w-full aspect-square lg:max-w-[240px] mx-auto lg:mx-0 rounded-3xl overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-xl relative group">
                                    {mentor.image ? (
                                        <img src={mentor.image} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-4xl md:text-6xl lg:text-7xl font-black uppercase" style={{ color: mentorColor }}>
                                                {mentor.first_name?.[0]}{mentor.last_name?.[0]}
                                            </span>
                                        </div>
                                    )}
                                    {isEditing && (
                                        <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm">
                                            <Camera size={32} className="text-white mb-2" />
                                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">O'zgartirish</span>
                                        </label>
                                    )}
                                </div>

                                {!isEditing && canEditMentor && (
                                    <button
                                        onClick={() => dispatch({ type: "START_EDITING" })}
                                        className="w-[140px] md:w-[200px] lg:w-full lg:max-w-[240px] mx-auto lg:mx-0 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center gap-2 transition-all uppercase text-[10px] font-black tracking-widest shadow-lg shadow-blue-500/10 active:scale-95"
                                    >
                                        <Camera size={14} /> Tahrirlash rejimi
                                    </button>
                                )}
                            </div>

                            {/* Employee Details Section Moved to Left */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Xodim Ma'lumotlari</h3>

                                <div className="space-y-3">

                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-[var(--text-muted)] ml-1">Username</label>
                                        <div className="relative">
                                            <input
                                                className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl pl-4 pr-10 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-colors read-only:opacity-80"
                                                value={isEditing ? editData.username : mentor.username}
                                                onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { username: e.target.value } })}
                                                readOnly={!isEditing}
                                            />
                                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white" onClick={() => navigator.clipboard.writeText(mentor.username)}><Copy size={14} /></button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-[var(--text-muted)] ml-1">Telefon Raqam</label>
                                        <div className="relative">
                                            <input
                                                className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl pl-4 pr-10 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-colors read-only:opacity-80"
                                                value={isEditing ? editData.phone_number : (mentor.phone_number || "Kiritilmagan")}
                                                onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { phone_number: e.target.value } })}
                                                readOnly={!isEditing}
                                            />
                                            <Phone size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                        </div>
                                    </div>
                                    {isEditing && (
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold text-[var(--text-muted)] ml-1">Yangi Parol (ixtiyoriy)</label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-colors"
                                                    value={editData.password || ""}
                                                    onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { password: e.target.value } })}
                                                    placeholder="••••••••"
                                                />
                                                <button type="button" onClick={() => dispatch({ type: 'TOGGLE_SHOW_PASSWORD' })} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {isEditing && (
                                    <div className="flex items-center gap-3 pt-4">
                                        <button
                                            onClick={handleUpdate}
                                            className="flex-1 bg-[var(--gold)] text-black font-black text-[11px] uppercase tracking-widest py-3.5 rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(184,134,11,0.3)]"
                                        >
                                            <Save size={16} /> Saqlash
                                        </button>
                                        <button
                                            onClick={() => dispatch({ type: "SET_FIELD", field: "isEditing", value: false })}
                                            className="flex-1 bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] font-black text-[11px] uppercase tracking-widest py-3.5 rounded-xl hover:bg-white/5 active:scale-95 transition-all"
                                        >
                                            Bekor qilish
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Role & Teams (Middle) */}
                        <div className="lg:col-span-4 flex flex-col space-y-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-[var(--text-muted)] ml-1">Ism</label>
                                    <input
                                        className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-colors read-only:opacity-80"
                                        value={isEditing ? editData.first_name : mentor.first_name}
                                        onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { first_name: e.target.value } })}
                                        readOnly={!isEditing}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-[var(--text-muted)] ml-1">Familiya</label>
                                    <input
                                        className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-colors read-only:opacity-80"
                                        value={isEditing ? editData.last_name : mentor.last_name}
                                        onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { last_name: e.target.value } })}
                                        readOnly={!isEditing}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Rol</h3>
                                <div className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl px-5 py-4 flex items-center justify-between">
                                    <span className="text-sm font-bold capitalize">{mentor.role?.replace('_', ' ') || "Mentor"}</span>
                                    <ChevronRight size={16} className="text-[var(--text-muted)] rotate-90" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Mutaxassislik</h3>
                                <div className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl px-5 py-4 flex items-center justify-between">
                                    <span className="text-sm font-bold capitalize">{mentor.subject || "Mentor"}</span>
                                    <ChevronRight size={16} className="text-[var(--text-muted)] rotate-90" />
                                </div>
                            </div>

                        </div>

                        {/* Column 3: Permissions & Extra (Right) */}
                        <div className="lg:col-span-4 flex flex-col space-y-8">

                            {isSuperAdmin && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Ruxsatlar (Onboarding Scripts)</h3>
                                        <button
                                            onClick={() => permMutation.mutate(permissions)}
                                            disabled={permMutation.isPending}
                                            className="px-4 py-1.5 bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)] hover:text-black rounded-lg text-[9px] font-black uppercase tracking-widest border border-[var(--gold)]/20 transition-all flex items-center gap-1.5 shadow-lg shadow-[var(--gold)]/10 active:scale-95"
                                        >
                                            {permMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Saqlash
                                        </button>
                                    </div>

                                    <div className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2rem] p-6 shadow-2xl flex flex-col gap-3">
                                        {Object.keys(PERMISSION_LABELS).map((key) => {
                                            const isGranted = permissions[key];
                                            return (
                                                <div key={key} className="flex items-center justify-between py-2 border-b border-[var(--border-glass)] last:border-0 group">
                                                    <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-wide">{PERMISSION_LABELS[key]}</span>
                                                    <button
                                                        onClick={() => dispatch({ type: 'TOGGLE_PERMISSION_KEY', key })}
                                                        className={`w-11 h-6 rounded-full relative flex items-center transition-all duration-300 border focus:outline-none ${isGranted ? 'bg-indigo-500 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-[var(--bg-void)] border-[var(--border-glass)] opacity-60'}`}
                                                    >
                                                        <div className={`absolute left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${isGranted ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Jamoa / Filiallar</h3>
                                    {isSuperAdmin && (
                                        <button
                                            onClick={() => dispatch({ type: "TOGGLE_TRANSFER_MODAL", payload: true })}
                                            className="px-3 py-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-500/20 transition-all flex items-center gap-1 shadow-lg shadow-amber-500/10 active:scale-95"
                                        >
                                            Ko'chirish
                                        </button>
                                    )}
                                </div>

                                <div className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl p-5 flex flex-col gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                                            <Building2 size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-tight">{mentor.branch?.name || "Asosiy filial"}</h4>
                                            <p className="text-[9px] text-[var(--text-muted)] font-bold capitalize tracking-widest mt-1">{mentor.branch?.address || "Manzil ko'rsatilmadi"}</p>
                                        </div>
                                    </div>
                                    {/* Native filialdan o'chirish tugmasi yashirildi */}
                                </div>

                                {/* Additional Accessible Branches */}
                                {((mentor.accessible_branches && mentor.accessible_branches.length > 0) || staffBranches.length > 0) && (
                                    <div className="grid gap-3 pt-2">
                                        {(mentor.accessible_branches || []).map((item) => (
                                            <div key={item.id} className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl p-4 flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-void)] text-blue-400 flex items-center justify-center border border-[var(--border-glass)]">
                                                        <Activity size={14} />
                                                    </div>
                                                    <span className="text-xs font-bold text-[var(--text-primary)] capitalize">{item.branch_name}</span>
                                                </div>
                                                {canEditMentor ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveBranchAccess(item.branch_id || item.id, item.branch_name); }}
                                                        className="p-2 rounded-lg text-red-500 hover:bg-red-500 hover:text-white border border-transparent hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <UserMinus size={14} />
                                                    </button>
                                                ) : (
                                                    <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </div>
                                        ))}
                                        {(!mentor.accessible_branches || mentor.accessible_branches.length === 0) && staffBranches.map((item) => (
                                            <div key={item.id} className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl p-4 flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-void)] text-blue-400 flex items-center justify-center border border-[var(--border-glass)]">
                                                        <Activity size={14} />
                                                    </div>
                                                    <span className="text-xs font-bold text-[var(--text-primary)] capitalize">{item.branch?.name}</span>
                                                </div>
                                                {canEditMentor ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveBranchAccess(item.branch?.id || item.branch_id || item.id, item.branch?.name); }}
                                                        className="p-2 rounded-lg text-red-500 hover:bg-red-500 hover:text-white border border-transparent hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <UserMinus size={14} />
                                                    </button>
                                                ) : (
                                                    <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* All Groups (Bottom Row) */}
                {viewMode !== "groups" && (
                    <div className="mt-12 space-y-6 pt-8 border-t border-[var(--border-glass)] w-full">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[12px] font-black text-[var(--text-muted)] uppercase tracking-widest">Guruhlar ro'yxati</h3>
                            <div className="text-[10px] font-black text-[var(--text-muted)] tracking-widest bg-[var(--bg-panel)] px-3 py-1.5 rounded-lg border border-[var(--border-glass)]">
                                Jami: <span className="text-[var(--gold)]">{mentorsGroup.length}</span>
                            </div>
                        </div>
                        <MentorsGroupCards mentorsGroups={mentorsGroup} navig={navigate} layout="grid" />
                    </div>
                )}
            </div>
            {/* Modals */}
            {isTransferModalOpen && (
                <StaffTransferModal
                    isOpen={isTransferModalOpen}
                    onClose={() => dispatch({ type: "TOGGLE_TRANSFER_MODAL", payload: false })}
                    staffMember={mentor}
                    onTransferSuccess={() => {
                        queryClient.invalidateQueries(['mentor-details']);
                        toast.success("Muvaffaqiyatli o'tkazildi.");
                    }}
                />
            )}
        </div>
    );
}
