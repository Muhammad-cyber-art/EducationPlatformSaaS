import { useEffect, useCallback, useMemo, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { get_user_info } from "../../../Authorized/getRole";
import { db } from "../../../../db/db";

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
    groups: [],
    loadingGroups: false,
    selectedPayment: null,
    showDetailModal: false,
    showWithdrawModal: false,
    withdrawData: { amount: "", description: "" },
    isSubmitting: false,
    activeTab: "incomes",
    filters: {
        branch: "",
        group: "",
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
        case 'SET_GROUPS':
            return { ...state, groups: action.payload };
        case 'SET_LOADING_GROUPS':
            return { ...state, loadingGroups: action.payload };
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
        groups,
        loadingGroups,
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

    // Tanlangan filial bo'yicha guruhlarni dinamik yuklash
    useEffect(() => {
        let isCancelled = false;
        const fetchBranchGroups = async () => {
            if (!filters.branch) {
                dispatch({ type: 'SET_GROUPS', payload: [] });
                return;
            }
            const cacheKey = `branch_groups_${filters.branch}`;
            // 1. Keshdan darhol chiqarish (0ms qotishsiz render)
            try {
                const cached = await db.query_cache.get(cacheKey);
                if (cached?.data?.length && !isCancelled) {
                    dispatch({ type: 'SET_GROUPS', payload: cached.data });
                } else if (!isCancelled) {
                    dispatch({ type: 'SET_LOADING_GROUPS', payload: true });
                }
            } catch (e) {
                if (!isCancelled) dispatch({ type: 'SET_LOADING_GROUPS', payload: true });
            }

            try {
                const res = await api.get(`/groups/nested_groups/?branch_id=${filters.branch}&page_size=500`);
                const gData = res.data.results || res.data || [];
                if (!isCancelled) {
                    dispatch({ type: 'SET_GROUPS', payload: gData });
                }
                try {
                    await db.query_cache.put({
                        query_key: cacheKey,
                        data: gData,
                        updated_at: new Date().toISOString()
                    });
                } catch (e) {}
            } catch (err) {
                try {
                    const cached = await db.query_cache.get(cacheKey);
                    if (cached?.data && !isCancelled) {
                        dispatch({ type: 'SET_GROUPS', payload: cached.data });
                        return;
                    }
                } catch (e) {}
                if (!isCancelled) {
                    dispatch({ type: 'SET_GROUPS', payload: [] });
                }
            } finally {
                if (!isCancelled) {
                    dispatch({ type: 'SET_LOADING_GROUPS', payload: false });
                }
            }
        };
        fetchBranchGroups();
        return () => { isCancelled = true; };
    }, [filters.branch]);

    const fetchTodayStats = useCallback(async () => {
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `kassa_today_stats_${filters.branch || 'all'}`;
        try {
            const baseParams = { date: today, branch: filters.branch || undefined };
            
            // Fetch all incomes for today
            const incRes = await api.get("/finance/transactions/", { params: { ...baseParams, transaction_type: 'income', category: 'student_fee', exclude_reversals: 'true', page_size: 1000 } });
            const todayIncomes = incRes.data.results || incRes.data || [];
            
            const expRes = await api.get("/finance/transactions/", { params: { ...baseParams, transaction_type: 'expense', page_size: 1000 } });
            const todayExpenses = expRes.data.results || expRes.data || [];

            const totalToday = todayIncomes.reduce((sum, p) => p.status === 'cancelled' ? sum : sum + Number(p.amount), 0);
            const totalVerified = todayIncomes.filter(p => (p.is_verified || p.payment_details?.is_verified) && p.status !== 'cancelled').reduce((sum, p) => sum + Number(p.amount), 0);
            const totalWithdrawn = todayExpenses.reduce((sum, w) => w.status === 'cancelled' ? sum : sum + Number(w.amount), 0);

            const payload = { totalToday, totalVerified, totalWithdrawn };
            dispatch({ type: 'SET_TODAY_STATS', payload });

            // Keshga saqlash
            try {
                await db.query_cache.put({
                    query_key: cacheKey,
                    data: payload,
                    updated_at: new Date().toISOString()
                });
            } catch (e) {}
        } catch (err) {
            // Oflayn keshdan olish
            try {
                const cached = await db.query_cache.get(cacheKey);
                if (cached?.data) {
                    dispatch({ type: 'SET_TODAY_STATS', payload: cached.data });
                    return;
                }
                const fallbackCached = await db.query_cache.get('kassa_today_stats_all');
                if (fallbackCached?.data) {
                    dispatch({ type: 'SET_TODAY_STATS', payload: fallbackCached.data });
                    return;
                }
            } catch (e) {}
            console.warn("[Kassa] Error fetching today stats, falling back to empty:", err?.message);
        }
    }, [filters.branch]);

    const fetchPayments = useCallback(async (page = 1, isLoadMore = false) => {
        const cacheKey = `kassa_incomes_${filters.month}_${filters.branch || 'all'}_${filters.group || 'all'}_${filters.method || 'all'}`;
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
                group: filters.group || undefined,
                payment_method: filters.method || undefined,
                date__gte: date_gte,
                date__lte: date_lte,
                page: page
            };

            const res = await api.get("/finance/transactions/", { params });
            const data = res.data.results || res.data || [];
            const hasMore = res.data.next !== null && res.data.next !== undefined;

            dispatch({ 
                type: 'SET_PAYMENTS', 
                payload: { data, page, hasMore } 
            });
            if (!isLoadMore) dispatch({ type: 'SET_PAGES', payload: { paymentsPage: 1 } });

            // 1-sahifani keshga yozamiz
            if (page === 1 && !filters.search) {
                try {
                    await db.query_cache.put({
                        query_key: cacheKey,
                        data,
                        updated_at: new Date().toISOString()
                    });
                } catch (e) {}
            }
        } catch (error) {
            // Oflayn rejimda keshdan yuklash
            try {
                const cached = await db.query_cache.get(cacheKey);
                if (cached?.data) {
                    dispatch({ 
                        type: 'SET_PAYMENTS', 
                        payload: { data: cached.data, page: 1, hasMore: false } 
                    });
                    return;
                }
                const fallbackCached = await db.query_cache.get(`kassa_incomes_${filters.month}`);
                if (fallbackCached?.data) {
                    dispatch({ 
                        type: 'SET_PAYMENTS', 
                        payload: { data: fallbackCached.data, page: 1, hasMore: false } 
                    });
                    return;
                }
            } catch (e) {}
            console.warn("[Kassa] Error fetching payments, offline fallback:", error?.message);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
            dispatch({ type: 'SET_LOADING_MORE', payload: false });
        }
    }, [filters.month, filters.search, filters.branch, filters.group, filters.method]);

    const fetchWithdrawals = useCallback(async (page = 1, isLoadMore = false) => {
        const cacheKey = `kassa_expenses_${filters.month}_${filters.branch || 'all'}`;
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
            const rawData = res.data.results || res.data || [];
            const data = (rawData || []).filter(t => t.status !== 'cancelled');
            const hasMore = res.data.next !== null && res.data.next !== undefined;

            dispatch({ 
                type: 'SET_WITHDRAWALS', 
                payload: { data, page, hasMore } 
            });
            if (!isLoadMore) dispatch({ type: 'SET_PAGES', payload: { withdrawalsPage: 1 } });

            if (page === 1) {
                try {
                    await db.query_cache.put({
                        query_key: cacheKey,
                        data,
                        updated_at: new Date().toISOString()
                    });
                } catch (e) {}
            }
        } catch (error) {
            try {
                const cached = await db.query_cache.get(cacheKey);
                if (cached?.data) {
                    dispatch({ 
                        type: 'SET_WITHDRAWALS', 
                        payload: { data: cached.data, page: 1, hasMore: false } 
                    });
                    return;
                }
                const fallbackCached = await db.query_cache.get(`kassa_expenses_${filters.month}`);
                if (fallbackCached?.data) {
                    dispatch({ 
                        type: 'SET_WITHDRAWALS', 
                        payload: { data: fallbackCached.data, page: 1, hasMore: false } 
                    });
                    return;
                }
            } catch (e) {}
            console.warn("[Kassa] Error fetching withdrawals, offline fallback:", error?.message);
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
                const bData = res.data.results || res.data || [];
                dispatch({ type: 'SET_BRANCHES', payload: bData });
                try {
                    await db.query_cache.put({
                        query_key: 'branches_list',
                        data: bData,
                        updated_at: new Date().toISOString()
                    });
                } catch (e) {}
            } catch (err) {
                try {
                    const cached = await db.query_cache.get('branches_list');
                    if (cached?.data) {
                        dispatch({ type: 'SET_BRANCHES', payload: cached.data });
                    }
                } catch (e) {}
            }
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
            const msg = error.response?.data?.detail || error.response?.data?.error || error.response?.data?.message || "Tasdiqlashda xatolik";
            toast.error(msg);
        }
    }, [fetchTodayStats]);

    // Guruh bo'yicha qat'iy filtrlash (faqat shu guruhdagi to'lovlar/o'quvchilar chiqadi)
    const filteredPayments = useMemo(() => {
        if (!filters.group) return payments;
        const gid = String(filters.group);
        const selectedGroup = (groups || []).find(g => String(g.id) === gid);
        const groupName = selectedGroup?.name?.toLowerCase();

        return payments.filter(p => {
            if (p.group !== undefined && p.group !== null && String(p.group) === gid) return true;
            if (p.payment_details?.group_id !== undefined && p.payment_details?.group_id !== null && String(p.payment_details?.group_id) === gid) return true;
            if (groupName) {
                const pGroupName = (p.payment_details?.group_name || p.group_name || "").toLowerCase();
                if (pGroupName === groupName) return true;
                if (p.description && p.description.toLowerCase().includes(groupName)) return true;
            }
            return false;
        });
    }, [payments, filters.group, groups]);

    const clearFilters = useCallback(() => {
        dispatch({ type: 'SET_FILTERS', payload: { branch: "", group: "", method: "", search: "", month: getCurrentMonth() } });
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
        payments: filteredPayments,
        rawPayments: payments,
        withdrawals,
        loading,
        loadingMore,
        hasMorePayments,
        hasMoreWithdrawals,
        loadMore,
        branches,
        groups,
        loadingGroups,
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
