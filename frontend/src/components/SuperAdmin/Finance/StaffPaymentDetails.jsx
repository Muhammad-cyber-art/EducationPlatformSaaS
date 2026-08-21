import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from 'react-redux';
import toast from "react-hot-toast";
import api from "../../../tokenUpdater/updater";
import { get_user_info } from "../../Authorized/getRole";

// Store actions
import {
  setPayModal,
  setSelectedHistoryItem,
  setEditModal,
  updateEditForm,
  resetFinanceState,
  setGroupConfigModal,
  setGroupConfigs,
  setGroupConfigsLoading
} from '../../../store/slices/financeSlice';

// Hooks
import { useStaffPayments } from "./StaffPayments/useStaffPayments";

// Components
import PaymentHeader from "./StaffPayments/PaymentHeader";
import PaymentSidebar from "./StaffPayments/PaymentSidebar";
import PaymentStats from "./StaffPayments/PaymentStats";
import PaymentHistory from "./StaffPayments/PaymentHistory";
import KpiTable from "./StaffPayments/KpiTable";
import AdvanceHistory from "./StaffPayments/AdvanceHistory";
import DebtorsModal from "./StaffPayments/DebtorsModal";
import EditProfileModal from "./StaffPayments/EditProfileModal";
import StaffPaymentModal from "./StaffPaymentModal";
import StaffAdvanceModal from "./StaffAdvanceModal";
import GroupConfigModal from "./StaffPayments/GroupConfigModal";

const StaffPaymentDetails = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { staff_id } = useParams();
  const user_info = get_user_info();
  const isSuperAdmin = user_info?.role === "super_admin";

  const {
    financeState,
    fetchAllData,
    fetchKpiData,
    handleRecalculate,
    handleUpdate,
    handleDelete,
    handleDeleteHistory,
    handleDeleteAdvance
  } = useStaffPayments(staff_id);

  const {
    data,
    kpiData,
    kpiLoading,
    loading,
    recalculating,
    payModal,
    selectedHistoryItem,
    editModal,
    editLoading,
    editForm,
    groupConfigModal,
    groupConfigs
  } = financeState;

  const [selectedGroupForDebtors, setSelectedGroupForDebtors] = useState(null);

  // ===================================================
  // mergedData: Lite data + KPI data birlashtirish
  // KPI yuklanmagan vaqtda lite data ishlaydi,
  // KPI kelganda og'ir fieldlar yangilanadi
  // ===================================================
  const mergedData = useMemo(() => {
    if (!data) return null;
    if (!kpiData) return data;
    return { ...data, ...kpiData };
  }, [data, kpiData]);

  const isPercentageType = data?.salary_type === 'percentage';
  const isStudentCountType = data?.salary_type === 'student_count';

  // Fetch group configs when data is available
  const fetchGroupConfigs = async () => {
    if (!data?.employee_id || data?.salary_type === 'fixed') return;

    dispatch(setGroupConfigsLoading(true));
    try {
      const response = await api.get(`/finance/mentor-group-salary-configs/`, {
        params: { mentor: data.employee_id }
      });
      let processedData;
      if (response.data.results) {
        processedData = response.data.results;
      } else if (Array.isArray(response.data)) {
        processedData = response.data;
      } else {
        processedData = [];
      }
      dispatch(setGroupConfigs(processedData));
    } catch (e) {
      console.error("Failed to fetch group configs:", e);
    } finally {
      dispatch(setGroupConfigsLoading(false));
    }
  };

  const studentCountSummary = useMemo(() => {
    if (!mergedData) return {};
    const groups = mergedData?.mentor_groups || [];
    return groups.reduce((acc, group) => {
      acc.groups += 1;
      acc.totalStudents += Number(group.students_count || 0);
      acc.paidStudents += Number(group.paid_students_count || 0);
      acc.paidIncome += Number(group.mentor_share_paid || 0);
      acc.expectedIncome += Number(group.mentor_share_expected || 0);
      acc.mentorSharePaid += Number(group.mentor_share_paid || 0);
      acc.mentorShareExpected += Number(group.mentor_share_expected || 0);
      return acc;
    }, {
      groups: 0, totalStudents: 0, paidStudents: 0, paidIncome: 0, expectedIncome: 0, mentorSharePaid: 0, mentorShareExpected: 0
    });
  }, [mergedData]);

  // Joriy oyning "live" asosiy maosh qiymati
  // KPI yuklanmaguncha salary_base dan foydalaniladi
  const liveBaseSalary = useMemo(() => {
    if (!data) return 0;
    if (isPercentageType) return mergedData?.calculated_commission ?? data.salary_base ?? 0;
    if (isStudentCountType) return mergedData?.calculated_per_student ?? data.salary_base ?? 0;
    return data.salary_base || 0;
  }, [mergedData, data, isPercentageType, isStudentCountType]);

  const floorTo1000 = (val) => Math.floor(Number(val) / 1000) * 1000;

  const finalTotalAmount = useMemo(() => {
    if (!data) return 0;
    if (data.is_paid) return Number(data.total_amount || 0);
    const bonus = Number(data.bonus || 0);
    const deductions = Number(data.deductions || 0);
    const advances = Number(data.total_advances || 0);
    return floorTo1000(liveBaseSalary + bonus - deductions - advances);
  }, [data, liveBaseSalary]);

  const historyItemBaseSalary = useMemo(() => {
    if (!selectedHistoryItem || typeof selectedHistoryItem !== 'object') return 0;
    const item = selectedHistoryItem;
    if (item.is_paid) return Number(item.total_amount || 0);
    if (item.salary_type === 'percentage') return Number(item.calculated_commission || 0);
    if (item.salary_type === 'student_count') return Number(item.calculated_per_student || 0);
    return Number(item.salary_base || 0);
  }, [selectedHistoryItem]);

  const historyItemExpectedAmount = useMemo(() => {
    if (!selectedHistoryItem || typeof selectedHistoryItem !== 'object') return 0;
    const item = selectedHistoryItem;
    if (item.salary_type !== 'percentage' && item.salary_type !== 'student_count') return 0;
    return Number(item.calculated_commission_expected || item.calculated_commission || 0);
  }, [selectedHistoryItem]);

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "0 UZS";
    return new Intl.NumberFormat('uz-UZ').format(amount) + " UZS";
  };

  useEffect(() => {
    fetchAllData();
    window.scrollTo(0, 0);
    return () => { dispatch(resetFinanceState()); };
  }, [fetchAllData, staff_id, dispatch]);

  useEffect(() => {
    if (data?.employee_id) {
      fetchGroupConfigs();
    }
  }, [data?.employee_id]);

  // ===================================================
  // Loading: Faqat birinchi yuklash vaqtida to'liq spinner
  // KPI yuklanayotganda sahifa ochiq qoladi
  // ===================================================
  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[var(--gold)]"></div>
          <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest animate-pulse">
            Ma'lumotlar yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-secondary)] font-sans selection:bg-[var(--gold)]/30 overflow-x-hidden">
      <div className="relative z-10 p-3 md:p-5 max-w-[1400px] mx-auto">
        <PaymentHeader
          {...{ navigate, data: mergedData, isPercentageType, isStudentCountType, handleRecalculate, recalculating, isSuperAdmin, dispatch, setEditModal, setSelectedHistoryItem, handleDelete, setGroupConfigModal }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <PaymentSidebar {...{ data: mergedData, isPercentageType, isStudentCountType, formatCurrency }} />

          <div className="lg:col-span-9 space-y-4">
            {/* 1. Stats Cards - Asosiy statistika */}
            <PaymentStats {...{ data: mergedData, isPercentageType, isStudentCountType, formatCurrency, studentCountSummary, finalTotalAmount, isSuperAdmin, kpiLoading }} />

            {/* 2. Payment History - To'lov tarixi */}
            <PaymentHistory {...{ data, staff_id, formatCurrency, isSuperAdmin, handleDeleteHistory, dispatch, setPayModal, setSelectedHistoryItem }} />

            {/* 3. KPI Table - Guruhlar va o'quvchilar */}
            {data?.salary_type !== 'fixed' && (
              <KpiTable {...{ data: mergedData, isPercentageType, isStudentCountType, formatCurrency, setSelectedGroupForDebtors, groupConfigs, kpiLoading }} />
            )}

            {/* 4. Advance History - Avanslar */}
            <AdvanceHistory {...{ data, formatCurrency, isSuperAdmin, handleDeleteAdvance }} />

          </div>
        </div>
      </div>

      <StaffAdvanceModal
        isOpen={selectedHistoryItem === 'advance'}
        onClose={() => dispatch(setSelectedHistoryItem(null))}
        staffName={`${data.employee_first_name} ${data.employee_last_name}`}
        onConfirm={async (amount, description) => {
          try {
            await api.post(`/finance/employee-payments/${staff_id}/add-advance/`, { amount, description });
            toast.success("Avans qo'shildi!");
            dispatch(setSelectedHistoryItem(null));
            fetchAllData();
          } catch (e) { toast.error(e.response?.data?.detail || "Xatolik"); }
        }}
      />

      <StaffPaymentModal
        isOpen={payModal}
        onClose={() => { dispatch(setPayModal(false)); dispatch(setSelectedHistoryItem(null)); }}
        info={selectedHistoryItem && typeof selectedHistoryItem === 'object' ? selectedHistoryItem : data}
        amount={
          selectedHistoryItem && typeof selectedHistoryItem === 'object'
            ? historyItemBaseSalary - Number(selectedHistoryItem.total_advances || 0)
            : !data.is_paid
              ? liveBaseSalary - Number(data.total_advances || 0)
              : Number(data.total_amount || 0)
        }
        expectedAmount={
          selectedHistoryItem && typeof selectedHistoryItem === 'object'
            ? historyItemExpectedAmount - Number(selectedHistoryItem.total_advances || 0)
            : Number(mergedData?.calculated_commission_expected || 0) - Number(data.total_advances || 0)
        }
        incomeType={
          selectedHistoryItem && typeof selectedHistoryItem === 'object'
            ? selectedHistoryItem.salary_type
            : data?.salary_type
        }
        onConfirm={async (bonus, deduction, options = {}) => {
          const targetId = selectedHistoryItem && typeof selectedHistoryItem === 'object'
            ? selectedHistoryItem.id
            : staff_id;
          try {
            await api.post(`/finance/employee-payments/${targetId}/confirm/`, {
              bonus,
              deductions: deduction,
              ...(options || {}),
            });
            toast.success("To'lov tasdiqlandi!");
            dispatch(setPayModal(false));
            dispatch(setSelectedHistoryItem(null));
            fetchAllData();
          } catch (e) { toast.error("To'lovda xatolik"); }
        }}
      />

      <EditProfileModal isOpen={editModal} {...{ editLoading, editForm, dispatch, updateEditForm, handleUpdate, onClose: () => dispatch(setEditModal(false)) }} />
      <DebtorsModal group={selectedGroupForDebtors} onClose={() => setSelectedGroupForDebtors(null)} formatCurrency={formatCurrency} />
      <GroupConfigModal
        isOpen={groupConfigModal}
        onClose={() => {
          dispatch(setGroupConfigModal(false));
          fetchGroupConfigs();
        }}
        staffId={data.employee_id}
        data={mergedData}
      />
    </div>
  );
};

export default StaffPaymentDetails;