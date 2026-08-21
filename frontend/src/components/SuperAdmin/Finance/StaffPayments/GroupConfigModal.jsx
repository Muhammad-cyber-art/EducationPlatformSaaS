import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../../../tokenUpdater/updater';
import toast from 'react-hot-toast';
import AmountInput from '../../../Common/AmountInput';
import {
    setGroupConfigModal,
    setGroupConfigs,
    setGroupConfigsLoading,
    setGroupConfigForm,
    updateGroupConfigForm,
    resetGroupConfigForm
} from '../../../../store/slices/financeSlice';

const GroupConfigModal = ({ isOpen, onClose, staffId, data }) => {
    const dispatch = useDispatch();
    const finance = useSelector(state => state.finance);
    const {
        groupConfigs,
        groupConfigsLoading,
        groupConfigForm
    } = finance;

    // Guruhlarni olish
    const mentorGroups = useMemo(() => data?.mentor_groups || [], [data]);
    
    // Mavjud guruh ID'larini olish (objekt yoki son bo'lishi mumkin)
    const existingGroupIds = useMemo(() => groupConfigs.map(config => {
        if (typeof config.group === 'object' && config.group !== null) {
            return config.group.id;
        }
        return Number(config.group);
    }), [groupConfigs]);
    
    // Konfiguratsiyasi yo'q guruhlarni olish
    const availableGroups = useMemo(() => 
        mentorGroups.filter(group => !existingGroupIds.includes(Number(group.id))), 
        [mentorGroups, existingGroupIds]
    );

    // Konfiguratsiyalarni olish
    const fetchGroupConfigs = async () => {
        if (!staffId) return;
        
        dispatch(setGroupConfigsLoading(true));
        try {
            console.log('Fetching group configs for staffId:', staffId);
            const response = await api.get(`/finance/mentor-group-salary-configs/`, {
                params: { mentor: staffId }
            });
            console.log('API Response:', response);
            
            // Paginatsiyani va oddiy javobni qo'llab-quvvatlash
            let processedData;
            if (response.data.results) {
                processedData = response.data.results;
            } else if (Array.isArray(response.data)) {
                processedData = response.data;
            } else {
                processedData = [];
            }
            
            console.log('Processed data:', processedData);
            dispatch(setGroupConfigs(processedData));
        } catch (err) {
            console.error('Group configs yuklashda xatolik:', err);
            console.error('Error details full:', err);
            console.error('Error response data:', err.response?.data);
            
            let errorMessage = 'Noma\'lum xatolik';
            if (err.response?.data) {
                if (err.response.data.mentor) {
                    errorMessage = `Mentor xatosi: ${err.response.data.mentor.join(', ')}`;
                } else if (err.response.data.group) {
                    errorMessage = `Guruh xatosi: ${err.response.data.group.join(', ')}`;
                } else if (err.response.data.non_field_errors) {
                    errorMessage = err.response.data.non_field_errors.join(', ');
                } else if (typeof err.response.data === 'object') {
                    const messages = [];
                    for (const key in err.response.data) {
                        const value = err.response.data[key];
                        if (Array.isArray(value)) {
                            messages.push(...value);
                        } else {
                            messages.push(`${key}: ${value}`);
                        }
                    }
                    errorMessage = messages.join(', ');
                } else {
                    errorMessage = err.response.data;
                }
            }
            
            toast.error(`Guruh konfiguratsiyalarini yuklashda xatolik: ${errorMessage}`);
            dispatch(setGroupConfigs([]));
        } finally {
            dispatch(setGroupConfigsLoading(false));
        }
    };

    // Yangi konfiguratsiya qo'shish
    const handleAddConfig = async () => {
        // Validation
        if (!groupConfigForm.group) {
            toast.error('Iltimos guruhni tanlang');
            return;
        }
        
        if (groupConfigForm.salary_type === 'percentage') {
            if (!groupConfigForm.commission_percentage || groupConfigForm.commission_percentage < 0 || groupConfigForm.commission_percentage > 100) {
                toast.error('Iltimos 0-100 oralig\'idagi foizni kiriting');
                return;
            }
        } else if (groupConfigForm.salary_type === 'student_count') {
            if (!groupConfigForm.per_student_amount || groupConfigForm.per_student_amount < 0) {
                toast.error('Iltimos 0 dan katta summani kiriting');
                return;
            }
        }
        
        dispatch(setGroupConfigsLoading(true));
        try {
            const submitData = {
                mentor: Number(staffId),
                group: Number(groupConfigForm.group),
                salary_type: groupConfigForm.salary_type,
                commission_percentage: groupConfigForm.salary_type === 'percentage' 
                    ? Number(groupConfigForm.commission_percentage)
                    : 0,
                per_student_amount: groupConfigForm.salary_type === 'student_count' 
                    ? Number(groupConfigForm.per_student_amount)
                    : 0
            };
            
            console.log('Submitting config:', submitData);
            await api.post('/finance/mentor-group-salary-configs/', submitData);
            toast.success('Konfiguratsiya muvaffaqiyatli qo\'shildi!');
            dispatch(resetGroupConfigForm());
            await fetchGroupConfigs();
        } catch (err) {
            console.error('Konfiguratsiya qo\'shishda xatolik:', err);
            console.error('Error response full:', err);
            console.error('Error response data:', err.response?.data);
            
            let errorMessage = 'Konfiguratsiya qo\'shishda xatolik';
            if (err.response?.data) {
                if (err.response.data.mentor) {
                    errorMessage = `Mentor xatosi: ${err.response.data.mentor.join(', ')}`;
                } else if (err.response.data.group) {
                    errorMessage = `Guruh xatosi: ${err.response.data.group.join(', ')}`;
                } else if (err.response.data.non_field_errors) {
                    errorMessage = err.response.data.non_field_errors.join(', ');
                } else if (typeof err.response.data === 'object') {
                    const messages = [];
                    for (const key in err.response.data) {
                        const value = err.response.data[key];
                        if (Array.isArray(value)) {
                            messages.push(...value);
                        } else {
                            messages.push(`${key}: ${value}`);
                        }
                    }
                    errorMessage = messages.join(', ');
                } else {
                    errorMessage = err.response.data;
                }
            }
            toast.error(errorMessage);
        } finally {
            dispatch(setGroupConfigsLoading(false));
        }
    };

    // Konfiguratsiyani o'chirish
    const handleDeleteConfig = async (configId, configName) => {
        if (!confirm(`${configName} uchun konfiguratsiyani o'chirishni xohlaysizmi?`)) return;
        
        dispatch(setGroupConfigsLoading(true));
        try {
            await api.delete(`/finance/mentor-group-salary-configs/${configId}/`);
            toast.success('Konfiguratsiya muvaffaqiyatli o\'chirildi!');
            await fetchGroupConfigs();
        } catch (err) {
            console.error('Konfiguratsiya o\'chirishda xatolik:', err);
            toast.error('Konfiguratsiya o\'chirishda xatolik');
        } finally {
            dispatch(setGroupConfigsLoading(false));
        }
    };

    // Modal ochilganda konfiguratsiyalarni yuklash va formani reset qilish
    useEffect(() => {
        if (isOpen) {
            console.log('GroupConfigModal opened, staffId:', staffId);
            dispatch(resetGroupConfigForm());
            fetchGroupConfigs();
        }
    }, [isOpen, staffId, dispatch]);

    // Modalni yopish
    const handleClose = () => {
        dispatch(setGroupConfigModal(false));
        onClose?.();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
            <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[var(--bg-void)] border border-[#2a2a2a] rounded-2xl shadow-2xl scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--gold)]/20 animate-in zoom-in-95 duration-200">
                <div className="sticky top-0 z-10 h-1 w-full bg-gradient-to-r from-[var(--gold)]/50 via-[var(--gold)] to-[var(--gold)]/50"></div>

                <div className="p-3">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-black text-[var(--text-primary)] tracking-tight capitalize">
                            Guruh Konfiguratsiyalari
                        </h2>
                        <button
                            onClick={handleClose}
                            disabled={groupConfigsLoading}
                            className="text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors p-1 hover:bg-[var(--gold)]/10 rounded-lg"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Mavjud konfiguratsiyalar */}
                    <div className="mb-4">
                        <h3 className="text-[10px] font-bold text-[var(--text-muted)] mb-2 tracking-widest uppercase">
                            Mavjud Konfiguratsiyalar
                        </h3>
                        {groupConfigsLoading ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="animate-spin" size={20} />
                            </div>
                        ) : groupConfigs.length === 0 ? (
                            <div className="text-center py-4 text-[var(--text-muted)] text-[10px]">
                                Hozircha konfiguratsiya yo'q
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {groupConfigs.map(config => {
                                    // Guruh nomini olish
                                    let groupName = 'Noma\'lum guruh';
                                    if (config.group_name) {
                                        groupName = config.group_name;
                                    } else if (typeof config.group === 'object' && config.group?.name) {
                                        groupName = config.group.name;
                                    }
                                    
                                    // Maosh turini ko'rsatish
                                    let salaryTypeText = '';
                                    if (config.salary_type_display) {
                                        salaryTypeText = config.salary_type_display;
                                    } else {
                                        salaryTypeText = config.salary_type === 'percentage' 
                                            ? 'Foiz' 
                                            : 'O\'quvchi';
                                    }
                                    
                                    let salaryValueText = '';
                                    if (config.salary_type === 'percentage') {
                                        salaryValueText = `${config.commission_percentage}%`;
                                    } else if (config.salary_type === 'student_count') {
                                        salaryValueText = `${Number(config.per_student_amount).toLocaleString('uz-UZ')} UZS`;
                                    }

                                    return (
                                        <div
                                            key={config.id}
                                            className="flex items-center justify-between p-2.5 bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-lg"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-[var(--text-primary)] text-[10px] truncate">
                                                    {groupName}
                                                </div>
                                                <div className="text-[var(--text-muted)] text-[8px] flex items-center gap-1">
                                                    <span>{salaryTypeText}:</span>
                                                    <span className="font-bold">{salaryValueText}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteConfig(config.id, groupName)}
                                                className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded-md transition-colors ml-2"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Yangi konfiguratsiya qo'shish */}
                    <div>
                        <h3 className="text-[10px] font-bold text-[var(--text-muted)] mb-2 tracking-widest uppercase">
                            Yangi Konfiguratsiya
                        </h3>
                        
                        <div className="space-y-2">
                            {/* Guruh tanlash */}
                            <div>
                                <select
                                    value={groupConfigForm.group}
                                    onChange={(e) => dispatch(updateGroupConfigForm({ group: e.target.value }))}
                                    disabled={groupConfigsLoading}
                                    className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] text-[var(--text-primary)] rounded-lg px-3 py-2.5 text-[10px] font-bold focus:outline-none focus:border-[var(--gold)]/50 transition-all disabled:opacity-50"
                                >
                                    <option value="">Guruhni tanlang</option>
                                    {availableGroups.map(group => (
                                        <option key={group.id} value={group.id}>
                                            {group.name} ({group.students_count})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {/* Maosh turi */}
                                <div>
                                    <select
                                        value={groupConfigForm.salary_type}
                                        onChange={(e) => dispatch(updateGroupConfigForm({ salary_type: e.target.value }))}
                                        disabled={groupConfigsLoading}
                                        className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] text-[var(--text-primary)] rounded-lg px-3 py-2.5 text-[10px] font-bold focus:outline-none focus:border-[var(--gold)]/50 transition-all disabled:opacity-50"
                                    >
                                        <option value="percentage">Foiz</option>
                                        <option value="student_count">Talaba</option>
                                    </select>
                                </div>

                                {/* Value */}
                                <div>
                                    {groupConfigForm.salary_type === 'percentage' ? (
                                        <div className="relative">
                                            <AmountInput
                                                value={groupConfigForm.commission_percentage}
                                                onChange={(e) => dispatch(updateGroupConfigForm({ commission_percentage: e.target.value }))}
                                                disabled={groupConfigsLoading}
                                                placeholder="15"
                                                showCurrency={false}
                                                allowDecimal={true}
                                                className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] text-[var(--text-primary)] rounded-lg px-3 py-2.5 text-[10px] font-bold focus:outline-none focus:border-[var(--gold)]/50 transition-all placeholder-[var(--text-muted)]/50 disabled:opacity-50"
                                            />
                                            {/* Percentage label */}
                                            {groupConfigForm.commission_percentage && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black opacity-30 pointer-events-none">
                                                    %
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <AmountInput
                                            value={groupConfigForm.per_student_amount}
                                            onChange={(e) => dispatch(updateGroupConfigForm({ per_student_amount: e.target.value }))}
                                            disabled={groupConfigsLoading}
                                            placeholder="200000"
                                            className="w-full bg-[var(--bg-panel)] border border-[#2a2a2a] text-[var(--text-primary)] rounded-lg px-3 py-2.5 text-[10px] font-bold focus:outline-none focus:border-[var(--gold)]/50 transition-all placeholder-[var(--text-muted)]/50 disabled:opacity-50"
                                        />
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={handleAddConfig}
                                disabled={groupConfigsLoading || availableGroups.length === 0}
                                className="w-full flex items-center justify-center gap-2 bg-[var(--gold)] hover:bg-[var(--gold)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black text-[10px] capitalize tracking-widest py-2.5 rounded-lg transition-all shadow-[0_0_15px_rgba(184,134,11,0.25)] active:scale-[0.97]"
                            >
                                {groupConfigsLoading ? (
                                    <Loader2 className="animate-spin" size={14} />
                                ) : (
                                    <Plus size={14} />
                                )}
                                Qo'shish
                            </button>
                        </div>
                    </div>

                    <div className="pt-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={groupConfigsLoading}
                            className="w-full bg-transparent hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-black text-[9px] capitalize tracking-[0.2em] py-2 rounded-lg transition-all border border-transparent hover:border-[#2a2a2a]"
                        >
                            Yopish
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default GroupConfigModal;
