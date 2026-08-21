import { useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import toast from "react-hot-toast";
import api from "../../../../tokenUpdater/updater";
import {
    setActiveBranch, setActiveTab, setAddStaffModal,
    setBranches, setStaffData, setStaffSearchQuery,
    setStaffRefreshing, setStaffLoading
} from "../../../../store/slices/financeSlice";

export const useStaffPaymentsMain = () => {
    const dispatch = useDispatch();
    const finance = useSelector((state) => state.finance);

    const {
        activeBranch,
        activeTab,
        addStaffModal,
        branches,
        staffData,
        staffSearchQuery,
        staffRefreshing,
        staffLoading
    } = finance;

    const fetchBranches = useCallback(async () => {
        try {
            const res = await api.get(`/add_branch/branches/`);
            const data = res.data.results || res.data;
            dispatch(setBranches(data));
            if (!activeBranch && data.length > 0) {
                dispatch(setActiveBranch(data[0].id));
            }
        } catch (err) {
            toast.error("Filial ma'lumotlarini yuklashda xatolik.");
        }
    }, [activeBranch, dispatch]);

    const fetchStaffData = useCallback(async () => {
        if (!activeBranch) return;
        dispatch(setStaffLoading(true));
        try {
            let url = `/finance/staff-profiles/?user__branch=${Number(activeBranch)}&page_size=200`;
            const res = await api.get(url);
            const data = res.data.results || res.data;
            dispatch(setStaffData(data));
        } catch (err) {
            console.error("Fetch Staff Error:", err);
            toast.error("Xodimlar ma'lumotlarini yuklashda xatolik.");
        } finally {
            dispatch(setStaffLoading(false));
        }
    }, [activeTab, activeBranch, dispatch]);

    useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    useEffect(() => {
        fetchStaffData();
    }, [fetchStaffData]);

    const handleRefreshPayments = async () => {
        dispatch(setStaffRefreshing(true));
        try {
            const response = await api.post('/finance/generate/');
            if (response.data.success) {
                toast.success("Oylik to'lovlar yangilandi.");
                await fetchStaffData();
            }
        } catch (error) {
            toast.error("Yangilashda xatolik yuz berdi.");
        } finally {
            dispatch(setStaffRefreshing(false));
        }
    };



    const filteredStaffData = staffData.filter((person) => {
        if (person.role !== activeTab) return false;

        const searchLower = staffSearchQuery.toLowerCase().trim();
        if (!searchLower) return true;
        const fullName = (person.full_name || person.username || '').toLowerCase();
        return fullName.includes(searchLower);
    });

    return {
        activeBranch,
        activeTab,
        addStaffModal,
        branches,
        staffData,
        staffSearchQuery,
        staffRefreshing,
        staffLoading,
        filteredStaffData,
        fetchStaffData,
        handleRefreshPayments,
        setAddStaffModal: (val) => dispatch(setAddStaffModal(val)),
        setActiveBranch: (val) => dispatch(setActiveBranch(val)),
        setActiveTab: (val) => dispatch(setActiveTab(val)),
        setStaffSearchQuery: (val) => dispatch(setStaffSearchQuery(val)),
    };
};
