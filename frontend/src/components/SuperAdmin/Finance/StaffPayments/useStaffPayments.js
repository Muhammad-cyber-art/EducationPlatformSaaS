import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../../../tokenUpdater/updater";
import {
 setData,
 setSelfData,
 setLoading,
 setRecalculating,
 setPayModal,
 setSelectedHistoryItem,
 setEditModal,
 setEditLoading,
 setEditForm,
 resetFinanceState,
 setKpiLoading,
 setKpiData,
} from '../../../../store/slices/financeSlice';

export const useStaffPayments = (staff_id) => {
 const dispatch = useDispatch();
 const navigate = useNavigate();
 const financeState = useSelector((state) => state.finance);

 // =====================================================
 // BOSQICH 2: Og'ir KPI ma'lumotlari (fon rejimida)
 // =====================================================
 const fetchKpiData = useCallback(async () => {
  try {
   dispatch(setKpiLoading(true));
   const res = await api.get(`/finance/employee-payments/${staff_id}/kpi/`);
   dispatch(setKpiData(res.data));
  } catch (error) {
   console.error("KPI ma'lumotlarini yuklashda xato:", error);
   // KPI xatosi sahifani bloklamaydi
  } finally {
   dispatch(setKpiLoading(false));
  }
 }, [staff_id, dispatch]);

 // =====================================================
 // BOSQICH 1: Asosiy ma'lumotlar (tez, lite mode)
 // =====================================================
 const fetchAllData = useCallback(async () => {
  try {
   dispatch(setLoading(true));
   dispatch(setKpiData(null)); // Oldingi KPI'ni tozalash

   // Lite mode: Faqat asosiy fieldlar, og'ir hisob-kitobsiz (~1 sekund)
   const res = await api.get(`/finance/employee-payments/${staff_id}/?lite=true`);
   const paymentInfo = res.data;
   dispatch(setData(paymentInfo));

   dispatch(setEditForm({
    fixed_salary: paymentInfo.fixed_salary || "0.00",
    commission_percentage: paymentInfo.commission_percentage || "0.00",
    per_student_amount: paymentInfo.per_student_amount || "0.00",
    salary_type: paymentInfo.salary_type || "fixed",
    karta: paymentInfo.karta || ""
   }));

   // User profilini parallel so'rash (bloklamaydi)
   if (paymentInfo.employee_id) {
    const userUrl = paymentInfo.employee_role === 'admin'
     ? `/groups/admins/${paymentInfo.employee_id}/`
     : `/register/users/${paymentInfo.employee_id}/`;
    api.get(userUrl).then(userRes => {
     dispatch(setSelfData(userRes.data));
    }).catch(() => {
     console.warn("User ma'lumotlari olinmadi");
    });
   }

  } catch (error) {
   console.error("Ma'lumotlarni yuklashda xato:", error);
   if (error.response?.status === 404) {
    toast.error("Ma'lumot topilmadi yoki o'chirib yuborilgan");
    navigate(-1);
   } else {
    toast.error("Xatolik yuz berdi");
   }
  } finally {
   dispatch(setLoading(false));
  }

  // Bosqich 2: KPI ma'lumotlarini fon rejimida yuklash (sahifani bloklamaydi)
  fetchKpiData();
 }, [staff_id, dispatch, navigate, fetchKpiData]);

 const handleRecalculate = async () => {
  if (!financeState.data || financeState.data.is_paid) return;
  try {
   dispatch(setRecalculating(true));
   await api.post(`/finance/employee-payments/${staff_id}/recalculate/`, {});
   toast.success("Maosh qayta hisoblandi.");
   // Ikkala bosqichni ham yangilash
   await fetchAllData();
  } catch (error) {
   toast.error(error.response?.data?.error || "Qayta hisoblashda xatolik");
  } finally {
   dispatch(setRecalculating(false));
  }
 };

 const handleUpdate = async (editForm) => {
  if (!financeState.data?.employee_id) return;
  try {
   dispatch(setEditLoading(true));
   await api.patch(`/finance/staff-profiles/by-user/${financeState.data.employee_id}/`, editForm);
   dispatch(setEditModal(false));
   toast.success("Profil yangilandi");
   await fetchAllData();
  } catch (error) {
   toast.error("Tahrirlashda xatolik");
  } finally {
   dispatch(setEditLoading(false));
  }
 };

 const handleDelete = async () => {
  if (!financeState.data?.employee_id) return;
  if (!window.confirm("DIQQAT! Ushbu xodimning barcha moliyaviy ma'lumotlarini o'chirib tashlamoqchimisiz?")) return;
  try {
   await api.delete(`/finance/staff-profiles/by-user/${financeState.data.employee_id}/`);
   toast.success(`Xodim profili o'chirildi!`);
   navigate(-1);
  } catch (err) {
   toast.error("Profilni o'chirishda xatolik yuz berdi");
  }
 };

 const handleDeleteHistory = async (historyId) => {
  if (!window.confirm("Maosh tarixini o'chirmoqchimisiz?")) return;
  try {
   await api.delete(`/finance/employee-payments/${historyId}/`);
   toast.success("Maosh tarixi o'chirildi");
   if (parseInt(historyId) === parseInt(staff_id)) {
    navigate(-1);
   } else {
    await fetchAllData();
   }
  } catch (error) {
   toast.error("Tarixni o'chirishda xatolik");
  }
 };

 const handleDeleteAdvance = async (advanceId) => {
  if (!window.confirm("Avansni o'chirmoqchimisiz?")) return;
  try {
   await api.delete(`/finance/employee-advances/${advanceId}/`);
   toast.success("Avans o'chirildi");
   await fetchAllData();
  } catch (error) {
   toast.error("O'chirishda xatolik");
  }
 };

 return {
  financeState,
  fetchAllData,
  fetchKpiData,
  handleRecalculate,
  handleUpdate,
  handleDelete,
  handleDeleteHistory,
  handleDeleteAdvance
 };
};
