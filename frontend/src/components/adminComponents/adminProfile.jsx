import React, { useReducer, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, ShieldCheck, ChevronRight, CreditCard, User, Camera, Copy, Calendar, Building2, Phone, Eye, EyeOff, Save, Trash2 } from "lucide-react";

// Hooks
import { useAdminProfile, PERMISSION_LABELS } from "./AdminProfile/useAdminProfile";
import { useAdminActions } from "./AdminProfile/useAdminActions";

// Components
import AdminHeader from "./AdminProfile/AdminHeader";
import AdminBranches from "./AdminProfile/AdminBranches";
import AdminModals from "./AdminProfile/AdminModals";

const initialState = {
    isPermModalOpen: false, // We won't use this modal anymore for permissions, but kept for legacy/modals reducer
    isEditModalOpen: false,
    isTransferModalOpen: false,
    editForm: { first_name: "", last_name: "", phone_number: "", username: "", password: "", is_active: true },
    permissions: {},
    showPassword: false,
};

function reducer(state, action) {
    switch (action.type) {
        case 'TOGGLE_PERM_MODAL': return { ...state, isPermModalOpen: action.payload };
        case 'TOGGLE_EDIT_MODAL': return { ...state, isEditModalOpen: action.payload };
        case 'TOGGLE_TRANSFER_MODAL': return { ...state, isTransferModalOpen: action.payload };
        case 'SET_EDIT_FORM': return { ...state, editForm: action.payload };
        case 'UPDATE_EDIT_FIELD': return { ...state, editForm: { ...state.editForm, ...action.payload } };
        case 'SET_PERMISSIONS': return { ...state, permissions: action.payload };
        case 'TOGGLE_PERMISSION_KEY':
            return { ...state, permissions: { ...state.permissions, [action.key]: !state.permissions[action.key] } };
        case 'TOGGLE_SHOW_PASSWORD': return { ...state, showPassword: !state.showPassword };
        default: return state;
    }
}

const AdminProfile = () => {
    const navigate = useNavigate();
    const { admin_id } = useParams();
    const queryClient = useQueryClient();
    const [state, dispatch] = useReducer(reducer, initialState);

    const { admin, staffBranches, loading, error, user_info, refetchBranches } = useAdminProfile(admin_id, dispatch);
    const { archiveMutation, updateMutation, permMutation, removeBranchMutation, handleEditOpen, LogOut } = useAdminActions(admin_id, admin, dispatch, navigate, refetchBranches);

    useEffect(() => {
        if (error) {
            toast.error("Ruxsat rad etildi.");
            navigate(-1);
        }
    }, [error, navigate]);

    if (loading || !admin) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 size={32} className="text-[var(--gold)] animate-spin" />
            </div>
        );
    }

    const { isEditModalOpen, editForm, showPassword, permissions } = state;
    const adminColor = admin.color || '#b8860b';

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
                    <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-[var(--bg-panel)] transition-colors border border-[var(--border-glass)]">
                        <ChevronRight size={18} className="rotate-180" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--bg-panel)] flex items-center justify-center border border-[var(--border-glass)]">
                            {admin.image ? <img src={admin.image} className="w-full h-full object-cover" /> : <span className="text-xs font-black uppercase" style={{color: adminColor}}>{admin.first_name?.[0]}{admin.last_name?.[0]}</span>}
                        </div>
                        <span className="text-sm font-black capitalize tracking-wide">{admin.first_name} {admin.last_name}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <span className="hidden md:block text-[10px] text-[var(--text-muted)] font-black tracking-widest">
                        Qo'shilgan: {admin.date_joined ? new Date(admin.date_joined).toLocaleDateString() : '---'}
                    </span>
                    {user_info?.role === 'super_admin' && (
                        <button 
                            onClick={() => archiveMutation.mutate()} 
                            disabled={archiveMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-500/20 transition-all"
                        >
                            <Trash2 size={14} /> O'chirish
                        </button>
                    )}
                </div>
            </div>

            {/* Main 3-Column Grid */}
            <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-8 pb-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Column 1: Profile Image & Details (Left) */}
                    <div className="lg:col-span-4 flex flex-col space-y-8">
                        
                        {/* Profile Image Section */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Profile Image</h3>
                            <div className="w-[140px] md:w-[200px] lg:w-full aspect-square lg:max-w-[240px] mx-auto lg:mx-0 rounded-3xl overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-xl relative group">
                                {admin.image ? (
                                    <img src={admin.image} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-4xl md:text-6xl lg:text-7xl font-black uppercase" style={{ color: adminColor }}>
                                            {admin.first_name?.[0]}{admin.last_name?.[0]}
                                        </span>
                                    </div>
                                )}
                                {isEditModalOpen && (
                                    <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm">
                                        <Camera size={32} className="text-white mb-2" />
                                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">O'zgartirish</span>
                                    </label>
                                )}
                            </div>
                            
                            {!isEditModalOpen && user_info?.role === 'super_admin' && (
                                <button 
                                    onClick={handleEditOpen} 
                                    className="w-[140px] md:w-[200px] lg:w-full lg:max-w-[240px] mx-auto lg:mx-0 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center gap-2 transition-all uppercase text-[10px] font-black tracking-widest shadow-lg shadow-blue-500/10 active:scale-95"
                                >
                                    <Camera size={14} /> Tahrirlash rejimi
                                </button>
                            )}
                        </div>

                        {/* Employee Details Section */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Xodim Ma'lumotlari</h3>
                            

                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-[var(--text-muted)] ml-1">Username / Email</label>
                                    <div className="relative">
                                        <input 
                                            className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl pl-4 pr-10 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-colors read-only:opacity-80"
                                            value={isEditModalOpen ? editForm.username : admin.username}
                                            onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { username: e.target.value } })}
                                            readOnly={!isEditModalOpen}
                                        />
                                        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white" onClick={() => navigator.clipboard.writeText(admin.username)}><Copy size={14} /></button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-[var(--text-muted)] ml-1">Telefon Raqam</label>
                                    <div className="relative">
                                        <input 
                                            className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl pl-4 pr-10 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-colors read-only:opacity-80"
                                            value={isEditModalOpen ? editForm.phone_number : (admin.phone_number || "Kiritilmagan")}
                                            onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { phone_number: e.target.value } })}
                                            readOnly={!isEditModalOpen}
                                        />
                                        <Phone size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-[var(--text-muted)] ml-1">Lavozim</label>
                                    <input 
                                        className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--gold)] outline-none read-only:opacity-80 capitalize"
                                        value={admin.role}
                                        readOnly
                                    />
                                </div>
                                {isEditModalOpen && (
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold text-[var(--text-muted)] ml-1">Yangi Parol (ixtiyoriy)</label>
                                        <div className="relative">
                                            <input 
                                                type={showPassword ? "text" : "password"}
                                                className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-colors"
                                                value={editForm.password}
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

                            {isEditModalOpen && (
                                <div className="flex items-center gap-3 pt-4">
                                    <button 
                                        onClick={() => updateMutation.mutate(editForm)}
                                        disabled={updateMutation.isPending}
                                        className="flex-1 bg-[var(--gold)] text-black font-black text-[11px] uppercase tracking-widest py-3.5 rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(184,134,11,0.3)]"
                                    >
                                        {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Saqlash
                                    </button>
                                    <button 
                                        onClick={() => dispatch({ type: 'TOGGLE_EDIT_MODAL', payload: false })}
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
                                    value={isEditModalOpen ? editForm.first_name : admin.first_name}
                                    onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { first_name: e.target.value } })}
                                    readOnly={!isEditModalOpen}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-[var(--text-muted)] ml-1">Familiya</label>
                                <input 
                                    className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--gold)]/50 transition-colors read-only:opacity-80"
                                    value={isEditModalOpen ? editForm.last_name : admin.last_name}
                                    onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { last_name: e.target.value } })}
                                    readOnly={!isEditModalOpen}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Rol</h3>
                            <div className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl px-5 py-4 flex items-center justify-between">
                                <span className="text-sm font-bold capitalize">{admin.role}</span>
                                <ChevronRight size={16} className="text-[var(--text-muted)] rotate-90" />
                            </div>
                        </div>



                        {/* Moliya Daftari (Only if allowed) */}
                        {!admin_id && user_info?.role === "admin" && state.permissions?.pay_slip !== false && (
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Moliya</h3>
                                <button
                                    onClick={() => navigate('/admin/finance')}
                                    className="w-full bg-[var(--bg-panel)] border border-[var(--gold)]/30 rounded-2xl p-5 flex items-center justify-between group hover:bg-[var(--gold)]/5 transition-all active:scale-95 shadow-xl"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-[var(--gold)] text-black flex items-center justify-center shadow-[0_0_15px_rgba(184,134,11,0.3)]">
                                            <CreditCard size={20} />
                                        </div>
                                        <div className="text-left">
                                            <h4 className="text-xs font-black text-[var(--gold)] capitalize tracking-widest">Moliya Daftari</h4>
                                            <p className="text-[9px] font-bold text-[var(--text-muted)] mt-1">Oylik hisob-kitoblar</p>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 group-hover:border-[var(--gold)] group-hover:text-[var(--gold)] transition-all">
                                        <ChevronRight size={14} />
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Column 3: Permissions (Right) */}
                    <div className="lg:col-span-4 flex flex-col space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Ruxsatlar (Onboarding Scripts)</h3>
                            {user_info?.role === 'super_admin' && (
                                <button 
                                    onClick={() => permMutation.mutate(permissions)}
                                    disabled={permMutation.isPending}
                                    className="px-4 py-1.5 bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)] hover:text-black rounded-lg text-[9px] font-black uppercase tracking-widest border border-[var(--gold)]/20 transition-all flex items-center gap-1.5 shadow-lg shadow-[var(--gold)]/10 active:scale-95"
                                >
                                    {permMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Saqlash
                                </button>
                            )}
                        </div>

                        <div className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[2rem] p-6 shadow-2xl flex flex-col gap-3">
                            {Object.keys(PERMISSION_LABELS).map((key) => {
                                const isGranted = permissions[key];
                                const canEdit = user_info?.role === 'super_admin';
                                return (
                                    <div key={key} className="flex items-center justify-between py-2 border-b border-[var(--border-glass)] last:border-0 group">
                                        <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-wide">{PERMISSION_LABELS[key]}</span>
                                        <button
                                            onClick={() => canEdit && dispatch({ type: 'TOGGLE_PERMISSION_KEY', key })}
                                            disabled={!canEdit}
                                            className={`w-11 h-6 rounded-full relative flex items-center transition-all duration-300 border focus:outline-none ${isGranted ? 'bg-indigo-500 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-[var(--bg-void)] border-[var(--border-glass)] opacity-60'}`}
                                        >
                                            <div className={`absolute left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${isGranted ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-4 pt-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Jamoa / Filiallar</h3>
                                {user_info?.role === 'super_admin' && (
                                    <button 
                                        onClick={() => dispatch({ type: "TOGGLE_TRANSFER_MODAL", payload: true })}
                                        className="px-3 py-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-500/20 transition-all flex items-center gap-1 shadow-lg shadow-amber-500/10 active:scale-95"
                                    >
                                        Ko'chirish
                                    </button>
                                )}
                            </div>
                            <AdminBranches admin={admin} staffBranches={staffBranches} removeBranchMutation={removeBranchMutation} />
                        </div>
                    </div>

                </div>
            </div>

            <AdminModals state={state} admin={admin} dispatch={dispatch} queryClient={queryClient} toast={toast} />
        </div>
    );
};

export default AdminProfile;