import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../../../tokenUpdater/updater';
import toast from 'react-hot-toast';

export const useSpecialStudents = () => {
  const { b_id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  const formatMonthLabel = (year, month) =>
    `${year}-${String(month).padStart(2, '0')}`;

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

  const fetchSpecialStudents = async () => {
    try {
      setLoading(true);
      const params = { year: selectedYear, month: selectedMonth };
      if (statusFilter) {
        params.status = statusFilter;
      }
      
      const response = await api.get(`/finance/statistics/special-students-dashboard/${b_id}/`, { params });
      setData(response.data);
      setError(null);
    } catch (err) {
      setError("Ma'lumotlarni yuklashda xatolik yuz berdi.");
      toast.error("Ma'lumotlarni yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (b_id) {
      fetchSpecialStudents();
    }
  }, [b_id, selectedYear, selectedMonth, statusFilter]);

  const formatNumber = (num) => {
    if (!num) return '0';
    return Math.floor(num).toLocaleString();
  };

  const filteredStudents = data?.students?.filter((student) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      student.full_name?.toLowerCase().includes(query) ||
      student.phone?.toLowerCase().includes(query) ||
      student.group_name?.toLowerCase().includes(query)
    );
  }) || [];

  return {
    loading,
    data,
    error,
    fetchSpecialStudents,
    formatNumber,
    summary: data?.summary,
    students: filteredStudents,
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    goPrevMonth,
    goCurrentMonth,
    formatMonthLabel,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    b_id,
  };
};
