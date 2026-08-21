import React from 'react';
import { Users, User, Banknote, DollarSign, Percent, AlertCircle } from 'lucide-react';
import AmountInput from '../../../Common/AmountInput';

export const RoleSelector = ({ selectedRole, setSelectedRole, loading }) => (
    <div>
        <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-2 px-1">
            <Users size={12} className="text-[var(--gold)]" /> Lavozim Turi
        </label>
        <div className="grid grid-cols-2 gap-3">
            {['admin', 'mentor'].map(role => (
                <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    disabled={loading}
                    className={`rounded-xl px-4 py-3 text-[11px] font-black capitalize tracking-widest transition-all ${selectedRole === role ? 'bg-[var(--gold)] text-black shadow-[0_0_20px_rgba(184,134,11,0.3)] scale-[1.02]' : 'bg-[var(--bg-panel)] border border-[#2a2a2a] text-[var(--text-secondary)] hover:border-[var(--gold)]/50'}`}
                >
                    {role === 'admin' ? 'Admin' : 'Mentor'}
                </button>
            ))}
        </div>
    </div>
);

export const UserSelector = ({ formData, setFormData, availableUsers, loadingUsers, loading, selectedRole }) => (
    <div>
        <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-2 px-1">
            <User size={12} className="text-[var(--gold)]" /> Xodimni Tanlang
        </label>
        <select
            className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] text-[var(--text-primary)] rounded-xl px-4 py-3.5 text-xs font-bold capitalize focus:outline-none focus:border-[var(--gold)]/50 transition-all appearance-none cursor-pointer shadow-inner"
            value={formData.user}
            onChange={(e) => setFormData({ ...formData, user: e.target.value })}
            required
            disabled={loadingUsers || loading}
        >
            <option disabled value="">{loadingUsers ? '... YuKLANMOQDA' : 'XODIMNI TANLANG'}</option>
            {availableUsers.map(user => (
                <option key={user.id} value={user.id}>{user.first_name} {user.last_name} ({user.username})</option>
            ))}
        </select>
        {availableUsers.length === 0 && !loadingUsers && (
            <p className="text-[10px] text-amber-500 mt-2 flex items-center gap-2 font-bold capitalize tracking-wide">
                <AlertCircle size={12} /> Barcha {selectedRole === 'admin' ? 'adminlar' : 'mentorlar'}ga profil yaratilgan
            </p>
        )}
    </div>
);

export const SalaryTypeSelector = ({ salaryType, setSalaryType, loading, selectedRole }) => (
    <div>
        <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-2 px-1">
            <Banknote size={12} className="text-[var(--gold)]" /> Maosh Turi
        </label>
        <div className="grid grid-cols-2 gap-3">
            <button
                type="button"
                onClick={() => setSalaryType('fixed')}
                disabled={loading}
                className={`rounded-xl px-4 py-3 text-[10px] font-black capitalize tracking-widest transition-all ${salaryType === 'fixed' ? 'bg-[var(--bg-panel)] text-[var(--gold)] border border-[var(--gold)] shadow-[inset_0_0_20px_rgba(184,134,11,0.1)]' : 'bg-[var(--bg-panel)] border border-[#2a2a2a] text-[var(--text-muted)]'}`}
            >
                <div className="flex items-center justify-center gap-2"><DollarSign size={14} /> <span>Belgilangan</span></div>
            </button>
            <button
                type="button"
                onClick={() => setSalaryType('percentage')}
                disabled={loading}
                className={`rounded-xl px-4 py-3 text-[10px] font-black capitalize tracking-widest transition-all ${salaryType === 'percentage' ? 'bg-[var(--bg-panel)] text-[var(--gold)] border border-[var(--gold)] shadow-[inset_0_0_20px_rgba(184,134,11,0.1)]' : 'bg-[var(--bg-panel)] border border-[#2a2a2a] text-[var(--text-muted)]'}`}
            >
                <div className="flex items-center justify-center gap-2"><Percent size={14} /> <span>Foiz Asosida</span></div>
            </button>
            {selectedRole === 'mentor' && (
                <button
                    type="button"
                    onClick={() => setSalaryType('student_count')}
                    disabled={loading}
                    className={`rounded-xl px-4 py-3 text-[10px] font-black capitalize tracking-widest transition-all ${salaryType === 'student_count' ? 'bg-[var(--bg-panel)] text-[var(--gold)] border border-[var(--gold)] shadow-[inset_0_0_20px_rgba(184,134,11,0.1)]' : 'bg-[var(--bg-panel)] border border-[#2a2a2a] text-[var(--text-muted)]'}`}
                >
                    <div className="flex items-center justify-center gap-2"><Users size={14} /> <span>O'quvchi Boshi</span></div>
                </button>
            )}
        </div>
    </div>
);

export const SalaryInputFields = ({ salaryType, formData, setFormData, loading }) => {
    if (salaryType === 'fixed') return (
        <div>
            <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-2 px-1">
                <Banknote size={12} className="text-[var(--gold)]" /> Belgilangan Oylik Maosh (UZS)
            </label>
            <AmountInput
                value={formData.fixed_salary}
                onChange={(e) => setFormData({ ...formData, fixed_salary: e.target.value })}
                placeholder="Masalan: 5 000 000"
                required
                className="lux-input !py-3.5 font-black"
            />
            <p className="text-[9px] text-[var(--text-muted)] mt-2 font-bold capitalize tracking-wide opacity-60">💡 Har oylik bir xil summa to'lanadi</p>
        </div>
    );
    if (salaryType === 'percentage') return (
        <div>
            <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-2 px-1">
                <Percent size={12} className="text-[var(--gold)]" /> Komissiya Foizi (%)
            </label>
            <input
                type="number"
                value={formData.commission_percentage}
                onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
                placeholder="Masalan: 40"
                required min="0" max="100" step="0.1"
                disabled={loading}
                className="lux-input !py-3.5"
            />
            <p className="text-[9px] text-[var(--text-muted)] mt-2 font-bold capitalize tracking-wide opacity-60">💡 Guruh daromadidan foiz hisoblanadi (0-100%)</p>
        </div>
    );
    return (
        <div>
            <label className="flex items-center gap-2 text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-2 px-1">
                <Users size={12} className="text-[var(--gold)]" /> Har bir o'quvchi uchun (UZS)
            </label>
            <AmountInput
                value={formData.per_student_amount}
                onChange={(e) => setFormData({ ...formData, per_student_amount: e.target.value })}
                placeholder="Masalan: 50 000"
                required
                className="lux-input !py-3.5 font-black"
            />
            <p className="text-[9px] text-[var(--text-muted)] mt-2 font-bold capitalize tracking-wide opacity-60">💡 Guruhdagi har bir o'quvchi uchun summa to'lanadi</p>
        </div>
    );
};
