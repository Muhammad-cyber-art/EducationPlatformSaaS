import { useEffect, useCallback, useMemo, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { get_user_info } from "../../../Authorized/getRole";

export const formatCurrency = (val) => {
    return Number(val).toLocaleString() + " UZS";
};

const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const getDateRange = (monthFilter) => {
    let year, month;
    if (monthFilter) {
        const parts = monthFilter.split('-');
        year = parseInt(parts[0]);
        month = parseInt(parts[1]);
    } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1;
    }
    const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const end = new Date(year, month, 0).toISOString().split('T')[0];
    return { date_gte: start, date_lte: end };
};

const initialState = {
    payments: [],
    withdrawals: [],
    paymentsPage: 1,
    withdrawalsPage: 1,
    hasMorePayments: true,
    hasMoreWithdrawals: true,
    loading: true,
    loadingMore: false,
    branches: [],
    selectedPayment: null,
    showDetailModal: false,
    showWithdrawModal: false,
    withdrawData: { amount: "", description: "" },
    isSubmitting: false,
    activeTab: "incomes",
    filters: {
        branch: "",
        method: "",
        search: "",
        month: getCurrentMonth()
    },
    todayStats: {
        totalToday: 0,
        totalVerified: 0,
        totalWithdrawn: 0
    }
};

function kassaReducer(state, action) {
    switch (action.type) {
        case 'SET_PAYMENTS':
            return { 
                ...state, 
                payments: action.payload.page === 1 ? action.payload.data : [...state.payments, ...action.payload.data],
                hasMorePayments: action.payload.hasMore
            };
        case 'SET_WITHDRAWALS':
            return { 
                ...state, 
                withdrawals: action.payload.page === 1 ? action.payload.data : [...state.withdrawals, ...action.payload.data],
                hasMoreWithdrawals: action.payload.hasMore
            };
        case 'SET_PAGES':
            return { ...state, ...action.payload };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_LOADING_MORE':
            return { ...state, loadingMore: action.payload };
        case 'SET_BRANCHES':
            return { ...state, branches: action.payload };
        case 'SET_SELECTED_PAYMENT':
            return { ...state, selectedPayment: action.payload };
        case 'SET_SHOW_DETAIL_MODAL':
            return { ...state, showDetailModal: action.payload };
        case 'SET_SHOW_WITHDRAW_MODAL':
            return { ...state, showWithdrawModal: action.payload };
        case 'SET_WITHDRAW_DATA':
            return { ...state, withdrawData: typeof action.payload === 'function' ? action.payload(state.withdrawData) : action.payload };
        case 'SET_IS_SUBMITTING':
            return { ...state, isSubmitting: action.payload };
        case 'SET_ACTIVE_TAB':
            return { ...state, activeTab: action.payload };
        case 'SET_FILTERS':
            return { ...state, filters: typeof action.payload === 'function' ? action.payload(state.filters) : action.payload };
        case 'RESET_WITHDRAW_DATA':
            return { ...state, withdrawData: { amount: "", description: "" } };
        case 'SET_TODAY_STATS':
            return { ...state, todayStats: action.payload };
        case 'VERIFY_PAYMENT_SUCCESS':
            return {
                ...state,
                payments: state.payments.map(p => (p.payment_details?.original_payment_id === action.payload || p.id === action.payload) ? { ...p, payment_details: { ...(p.payment_details || {}), is_verified: true } } : p)
            };
        default:
            return state;
    }
}

export const useKassa = () => {
    const navigate = useNavigate();
    const [state, dispatch] = useReducer(kassaReducer, initialState);

    const {
        payments,
        withdrawals,
        paymentsPage,
        withdrawalsPage,
        hasMorePayments,
        hasMoreWithdrawals,
        loading,
        loadingMore,
        branches,
        selectedPayment,
        showDetailModal,
        showWithdrawModal,
        withdrawData,
        isSubmitting,
        activeTab,
        filters,
        todayStats
    } = state;

    const userInfo = useMemo(() => get_user_info(), []);

    const fetchTodayStats = useCallback(async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const baseParams = { date: today, branch: filters.branch || undefined };
            
            // Fetch all incomes for today
            const incRes = await api.get("/finance/transactions/", { params: { ...baseParams, transaction_type: 'income', category: 'student_fee', exclude_reversals: 'true', page_size: 1000 } });
            const todayIncomes = incRes.data.results || incRes.data;
            
            const expRes = await api.get("/finance/transactions/", { params: { ...baseParams, transaction_type: 'expense', page_size: 1000 } });
            const todayExpenses = (expRes.data.results || expRes.data).filter(t => t.category === 'owner_withdrawal' || t.category === 'other');

            const totalToday = todayIncomes.reduce((sum, p) => p.status === 'cancelled' ? sum : sum + Number(p.amount), 0);
            const totalVerified = todayIncomes.filter(p => p.payment_details?.is_verified && p.status !== 'cancelled').reduce((sum, p) => sum + Number(p.amount), 0);
            const totalWithdrawn = todayExpenses.reduce((sum, w) => sum + Number(w.amount), 0);

            dispatch({ type: 'SET_TODAY_STATS', payload: { totalToday, totalVerified, totalWithdrawn } });
        } catch (err) {
            console.error("Error fetching today stats:", err);
        }
    }, [filters.branch]);

    const fetchPayments = useCallback(async (page = 1, isLoadMore = false) => {
        try {
            if (isLoadMore) dispatch({ type: 'SET_LOADING_MORE', payload: true });
            else dispatch({ type: 'SET_LOADING', payload: true });

            const { date_gte, date_lte } = getDateRange(filters.month);
            const params = {
                transaction_type: 'income',
                category: 'student_fee',
                exclude_reversals: 'true',
                search: filters.search || undefined,
                branch: filters.branch || undefined,
                date__gte: date_gte,
                date__lte: date_lte,
                page: page
            };

            const res = await api.get("/finance/transactions/", { params });
            const data = res.data.results || res.data;
            const hasMore = res.data.next !== null && res.data.next !== undefined;

            dispatch({ 
                type: 'SET_PAYMENTS', 
                payload: { data, page, hasMore } 
            });
            if (!isLoadMore) dispatch({ type: 'SET_PAGES', payload: { paymentsPage: 1 } });
        } catch (error) {
            console.error(error);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
            dispatch({ type: 'SET_LOADING_MORE', payload: false });
        }
    }, [filters.month, filters.search, filters.branch]);

    const fetchWithdrawals = useCallback(async (page = 1, isLoadMore = false) => {
        try {
            if (isLoadMore) dispatch({ type: 'SET_LOADING_MORE', payload: true });
            else dispatch({ type: 'SET_LOADING', payload: true });

            const { date_gte, date_lte } = getDateRange(filters.month);
            const params = {
                transaction_type: 'expense',
                branch: filters.branch || undefined,
                date__gte: date_gte,
                date__lte: date_lte,
                page: page
            };

            const res = await api.get("/finance/transactions/", { params });
            const rawData = res.data.results || res.data;
            const data = rawData.filter(t => t.category === 'owner_withdrawal' || t.category === 'other');
            const hasMore = res.data.next !== null && res.data.next !== undefined;

            dispatch({ 
                type: 'SET_WITHDRAWALS', 
                payload: { data, page, hasMore } 
            });
            if (!isLoadMore) dispatch({ type: 'SET_PAGES', payload: { withdrawalsPage: 1 } });
        } catch (error) {
            console.error(error);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
            dispatch({ type: 'SET_LOADING_MORE', payload: false });
        }
    }, [filters.month, filters.branch]);

    const fetchKassaData = useCallback(async () => {
        fetchTodayStats();
        if (activeTab === 'incomes') {
            fetchPayments(1, false);
        } else {
            fetchWithdrawals(1, false);
        }
    }, [fetchTodayStats, fetchPayments, fetchWithdrawals, activeTab]);

    const loadMore = useCallback(() => {
        if (activeTab === 'incomes' && hasMorePayments && !loading && !loadingMore) {
            const nextPage = paymentsPage + 1;
            dispatch({ type: 'SET_PAGES', payload: { paymentsPage: nextPage } });
            fetchPayments(nextPage, true);
        } else if (activeTab === 'expenses' && hasMoreWithdrawals && !loading && !loadingMore) {
            const nextPage = withdrawalsPage + 1;
            dispatch({ type: 'SET_PAGES', payload: { withdrawalsPage: nextPage } });
            fetchWithdrawals(nextPage, true);
        }
    }, [activeTab, hasMorePayments, hasMoreWithdrawals, loading, loadingMore, paymentsPage, withdrawalsPage, fetchPayments, fetchWithdrawals]);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await api.get("/add_branch/branches/");
                dispatch({ type: 'SET_BRANCHES', payload: res.data.results || res.data });
            } catch (err) { console.error(err); }
        };
        fetchBranches();
    }, []);

    useEffect(() => {
        fetchKassaData();
    }, [fetchKassaData]);

    const handleAmountChange = useCallback((e) => {
        const val = e.target.value.replace(/\D/g, "");
        const formatted = val ? Number(val).toLocaleString() : "";
        dispatch({
            type: 'SET_WITHDRAW_DATA',
            payload: prev => ({ ...prev, amount: formatted })
        });
    }, []);

    const handleWithdraw = useCallback(async (e) => {
        e.preventDefault();
        const rawAmount = withdrawData.amount.replace(/,/g, "");

        if (!rawAmount || Number(rawAmount) <= 0) {
            return toast.error("Summani to'g'ri kiriting");
        }

        try {
            dispatch({ type: 'SET_IS_SUBMITTING', payload: true });
            await api.post("/finance/transactions/", {
                transaction_type: 'expense',
                category: 'owner_withdrawal',
                amount: rawAmount,
                title: "Super Admin pul oldi",
                description: withdrawData.description,
                branch: filters.branch || get_user_info()?.branch || 1,
                date: new Date().toISOString().split('T')[0]
            });
            toast.success("Pul olish muvaffaqiyatli qayd etildi!");
            dispatch({ type: 'SET_SHOW_WITHDRAW_MODAL', payload: false });
            dispatch({ type: 'RESET_WITHDRAW_DATA' });
            fetchKassaData();
        } catch (error) {
            toast.error("Xatolik yuz berdi");
        } finally {
            dispatch({ type: 'SET_IS_SUBMITTING', payload: false });
        }
    }, [withdrawData.amount, withdrawData.description, filters.branch, fetchKassaData]);

    const handleVerify = useCallback(async (paymentId) => {
        try {
            const res = await api.post(`/finance/student-payments/${paymentId}/verify/`);
            if (res.data.status === 'success') {
                toast.success("To'lov muvaffaqiyatli tasdiqlandi!");
                dispatch({ type: 'VERIFY_PAYMENT_SUCCESS', payload: paymentId });
                fetchTodayStats();
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "Tasdiqlashda xatolik");
        }
    }, [fetchTodayStats]);

    const clearFilters = useCallback(() => {
        dispatch({ type: 'SET_FILTERS', payload: { branch: "", method: "", search: "", month: getCurrentMonth() } });
    }, []);

    const setToday = useCallback(() => {
        dispatch({
            type: 'SET_FILTERS',
            payload: prev => ({ ...prev, month: getCurrentMonth() })
        });
    }, []);

    // Setters wrap dispatch to keep backward compatibility if they are used as standalone setters in the UI
    const setSelectedPayment = useCallback((val) => dispatch({ type: 'SET_SELECTED_PAYMENT', payload: val }), []);
    const setShowDetailModal = useCallback((val) => dispatch({ type: 'SET_SHOW_DETAIL_MODAL', payload: val }), []);
    const setShowWithdrawModal = useCallback((val) => dispatch({ type: 'SET_SHOW_WITHDRAW_MODAL', payload: val }), []);
    const setWithdrawData = useCallback((val) => dispatch({ type: 'SET_WITHDRAW_DATA', payload: val }), []);
    const setActiveTab = useCallback((val) => dispatch({ type: 'SET_ACTIVE_TAB', payload: val }), []);
    const setFilters = useCallback((val) => dispatch({ type: 'SET_FILTERS', payload: val }), []);

    return {
        navigate,
        payments,
        withdrawals,
        loading,
        loadingMore,
        hasMorePayments,
        hasMoreWithdrawals,
        loadMore,
        branches,
        selectedPayment,
        setSelectedPayment,
        showDetailModal,
        setShowDetailModal,
        showWithdrawModal,
        setShowWithdrawModal,
        withdrawData,
        setWithdrawData,
        isSubmitting,
        activeTab,
        setActiveTab,
        filters,
        setFilters,
        userInfo,
        handleAmountChange,
        handleWithdraw,
        handleVerify,
        totalToday: todayStats.totalToday,
        totalVerified: todayStats.totalVerified,
        totalWithdrawn: todayStats.totalWithdrawn,
        clearFilters,
        setToday,
        fetchKassaData
    };
};
