import { useEffect, useState, useCallback } from "react";
import api from "../../../tokenUpdater/updater";
import { useNavigate } from "react-router-dom";

export const useMentorFinance = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const formatCurrency = (amount) => {
        if (!amount && amount !== 0) return "0 UZS";
        return new Intl.NumberFormat('uz-UZ').format(amount) + " UZS";
    };

    const formatPercentage = (value) => {
        return `${value || 0}%`;
    };

    const fetchFinanceData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await api.get("/finance/employee-payments/current/");
            setData(res.data);
        } catch (err) {
            console.error("Finance fetch error:", err);
            setError(err.response?.data?.detail || "Ma'lumot topilmadi.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFinanceData();
        window.scrollTo(0, 0);
    }, [fetchFinanceData]);

    return {
        data,
        loading,
        error,
        navigate,
        formatCurrency,
        formatPercentage,
        isPercentageType: data?.salary_type === 'percentage'
    };
};
