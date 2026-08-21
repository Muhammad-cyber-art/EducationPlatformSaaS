import { useState, useEffect } from'react';
import { useParams } from'react-router-dom';
import api from'../../../../tokenUpdater/updater';
import toast from'react-hot-toast';

export const useBranchFinance = () => {
 const { b_id } = useParams();
 const [loading, setLoading] = useState(true);
 const [data, setData] = useState(null);
 const [error, setError] = useState(null);

 const today = new Date();
 const [selectedYear, setSelectedYear] = useState(today.getFullYear());
 const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

 const formatMonthLabel = (year, month) =>
 `${year}-${String(month).padStart(2,'0')}`;

 const goPrevMonth = () => {
 const d = new Date(selectedYear, selectedMonth - 1, 1);
 d.setMonth(d.getMonth() - 1);
 setSelectedYear(d.getFullYear());
 setSelectedMonth(d.getMonth() + 1);
 };

 const goCurrentMonth = () => {
 const now = new Date();
 setSelectedYear(now.getFullYear());
 setSelectedMonth(now.getMonth() + 1);
 };

 const fetchBranchFinance = async () => {
 try {
 setLoading(true);
 const response = await api.get(`/finance/statistics/branch-finance/${b_id}/`, {
 params: { year: selectedYear, month: selectedMonth }
 });
 setData(response.data);
 setError(null);
 } catch (err) {
 setError("Xatolik: Tizimga ulanishda muammo yuz berdi.");
 toast.error("Ma'lumotlarni yuklashda xatolik.");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchBranchFinance();
 }, [b_id, selectedYear, selectedMonth]);

 const formatNumber = (num) => {
 if (!num) return'0';
 return Math.floor(num).toLocaleString();
 };

 const progressPercentage = data?.finance?.expected_income > 0
 ? ((data.finance.received_income / data.finance.expected_income) * 100).toFixed(1)
 : 0;

  return {
    loading,
    data,
    error,
    fetchBranchFinance,
    formatNumber,
    progressPercentage,
    stats: data?.stats,
    finance: data?.finance,
    branch: data?.branch,
    groups: data?.groups,
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    goPrevMonth,
    goCurrentMonth,
    formatMonthLabel,
    b_id,
  };
};
