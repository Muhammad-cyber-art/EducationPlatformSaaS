import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../../../tokenUpdater/updater';
import {
    setProfileFormLoading,
    setProfileUsers,
    setProfileExisting,
    setProfileUsersLoading,
    setProfileError,
    setProfileSuccess,
    setProfileSelectedRole,
    setProfileSalaryType,
    updateProfileFormData,
    resetProfileForm
} from '../../../../store/slices/financeSlice';

export const useStaffProfileForm = (isOpen, branch, onClose, onSuccess) => {
    const dispatch = useDispatch();
    const finance = useSelector(state => state.finance);

    const {
        profileFormLoading: loading,
        profileUsers: users,
        profileExisting: existingProfiles,
        profileUsersLoading: loadingUsers,
        profileError: error,
        profileSuccess: success,
        profileSelectedRole: selectedRole,
        profileSalaryType: salaryType,
        profileFormData: formData
    } = finance;

    const fetchExistingProfiles = useCallback(async () => {
        try {
            const response = await api.get('/finance/staff-profiles/?page_size=200');
            const data = response.data.results || response.data;
            dispatch(setProfileExisting(Array.isArray(data) ? data : []));
        } catch (err) {
            console.error('Profillarni yuklashda xatolik:', err);
        }
    }, [dispatch]);

    const fetchUsers = useCallback(async () => {
        dispatch(setProfileUsersLoading(true));
        dispatch(setProfileError(''));
        try {
            const response = await api.get(`/register/users/?branch=${branch}&role=${selectedRole}&page_size=200`);
            const data = response.data.results || response.data;
            dispatch(setProfileUsers(Array.isArray(data) ? data : []));
        } catch (err) {
            dispatch(setProfileError('Xodimlarni yuklashda xatolik'));
            console.error(err);
        } finally {
            dispatch(setProfileUsersLoading(false));
        }
    }, [branch, selectedRole, dispatch]);

    useEffect(() => {
        if (isOpen && selectedRole) {
            fetchUsers();
            fetchExistingProfiles();
            dispatch(updateProfileFormData({
                user: '',
                salary_type: selectedRole === 'admin' ? 'fixed' : 'percentage'
            }));
            dispatch(setProfileSalaryType(selectedRole === 'admin' ? 'fixed' : 'percentage'));
        }
    }, [isOpen, selectedRole, fetchUsers, fetchExistingProfiles, dispatch]);

    useEffect(() => {
        dispatch(updateProfileFormData({
            salary_type: salaryType,
            ...(salaryType === 'fixed' ? { commission_percentage: '0', per_student_amount: '0' } :
                salaryType === 'percentage' ? { fixed_salary: '0', per_student_amount: '0' } :
                    { fixed_salary: '0', commission_percentage: '0' })
        }));
    }, [salaryType, dispatch]);

    const availableUsers = users.filter(user =>
        !existingProfiles.some(profile => profile.user === user.id)
    );

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        dispatch(setProfileFormLoading(true));
        dispatch(setProfileError(''));

        if (salaryType === 'fixed' && !formData.fixed_salary) {
            dispatch(setProfileError('Belgilangan maoshni kiriting'));
            dispatch(setProfileFormLoading(false));
            return;
        }
        if (salaryType === 'percentage' && (!formData.commission_percentage || formData.commission_percentage < 0 || formData.commission_percentage > 100)) {
            dispatch(setProfileError('Foiz 0 dan 100 gacha bo\'lishi kerak'));
            dispatch(setProfileFormLoading(false));
            return;
        }
        if (salaryType === 'student_count' && !formData.per_student_amount) {
            dispatch(setProfileError('Har bir o\'quvchi uchun summani kiriting'));
            dispatch(setProfileFormLoading(false));
            return;
        }

        try {
            const submitData = {
                user: formData.user,
                salary_type: salaryType,
                fixed_salary: salaryType === 'fixed' ? formData.fixed_salary : 0,
                commission_percentage: salaryType === 'percentage' ? formData.commission_percentage : 0,
                per_student_amount: salaryType === 'student_count' ? formData.per_student_amount : 0,
                karta: formData.karta
            };

            await api.post('/finance/staff-profiles/', submitData);
            dispatch(setProfileSuccess(true));
            setTimeout(() => {
                onSuccess?.();
                handleClose();
            }, 1500);
        } catch (err) {
            dispatch(setProfileError(err.response?.data?.message || err.response?.data?.error || 'Xatolik yuz berdi'));
        } finally {
            dispatch(setProfileFormLoading(false));
        }
    };

    const handleClose = () => {
        dispatch(resetProfileForm());
        onClose();
    };

    return {
        loading,
        loadingUsers,
        error,
        success,
        selectedRole,
        setSelectedRole: (role) => dispatch(setProfileSelectedRole(role)),
        salaryType,
        setSalaryType: (type) => dispatch(setProfileSalaryType(type)),
        formData,
        setFormData: (data) => dispatch(updateProfileFormData(data)),
        availableUsers,
        handleSubmit,
        handleClose
    };
};
