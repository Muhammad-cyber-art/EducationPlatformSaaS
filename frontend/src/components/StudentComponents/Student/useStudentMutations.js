import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";

export const useStudentMutations = (student_id, dispatch, navigate) => {
  const queryClient = useQueryClient();

  const editMutation = useMutation({
    mutationFn: async (data) => {
      const formData = new FormData();
      // Nullable string fieldlar — bo'sh qilinganda backendga "" yuboriladi,
      // backend ularni null ga aylantiradi
      const nullableFields = ["phone", "parent_phone", "parent_name", "address", "notes", "telegram_id", "parent_telegram_id"];
      Object.keys(data).forEach((key) => {
        if (key === "image") {
          if (data[key] instanceof File) formData.append("image", data[key]);
        } else if (nullableFields.includes(key)) {
          // Bo'sh string → backendga "" yuboriladi (backend null ga aylantiradi)
          formData.append(key, data[key] ?? "");
        } else if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
          formData.append(key, data[key]);
        }
      });
      return await api.patch(`/groups/students/${student_id}/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student"] });
      dispatch({ type: "SET_EDITING", payload: false });
      toast.success("Profil tahrirlandi.");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async ({
      id,
      amount,
      ignore_refund,
      payment_method,
      receipt_image,
      notes,
      is_receiptless,
      pay_full_month,
      is_partial_payment,
      is_full_amount,
      is_custom_amount,
    }) => {
      const paymentPayload = {
        student_id,
        payment_id: id,
        amount,
        payment_method,
        is_receiptless: receipt_image ? false : is_receiptless,
        notes,
        pay_full_month,
        is_partial_payment,
        is_full_amount,
        ignore_refund,
      };

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const { queueCashierPayment } = await import('../../../db/db');
        return await queueCashierPayment(paymentPayload, queryClient);
      }

      const formData = new FormData();
      if (amount !== undefined && amount !== null && String(amount) !== "") {
        formData.append("amount", String(amount));
      }
      if (ignore_refund !== undefined)
        formData.append("ignore_refund", String(ignore_refund));
      if (payment_method) formData.append("payment_method", payment_method);
      if (receipt_image instanceof File)
        formData.append("receipt_image", receipt_image);
      if (notes !== undefined && notes !== null)
        formData.append("notes", notes);
      if (is_receiptless !== undefined)
        formData.append("is_receiptless", String(is_receiptless));
      if (pay_full_month !== undefined)
        formData.append("pay_full_month", String(pay_full_month));
      if (is_partial_payment !== undefined)
        formData.append("is_partial_payment", String(is_partial_payment));
      formData.append("is_full_amount", String(is_full_amount === true));
      formData.append("is_custom_amount", String(is_custom_amount === true));

      try {
        return await api.post(
          `/finance/student-payments/${id}/confirm/`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
      } catch (err) {
        const isNetworkErr = !err.response || err.code === 'ERR_NETWORK' || err.isOffline;
        if (isNetworkErr) {
          const { queueCashierPayment } = await import('../../../db/db');
          return await queueCashierPayment(paymentPayload, queryClient);
        }
        throw err;
      }
    },
    onSuccess: async (res) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments-all"] }),
        queryClient.invalidateQueries({ queryKey: ["student"] }),
        queryClient.invalidateQueries({ queryKey: ["student-history", student_id] }),
      ]);
      dispatch({ type: "TOGGLE_CONFIRM_PAYMENT", payload: false });
      if (res?.queued) {
        toast.success("To'lov oflayn saqlandi! Internet tiklanganda serverga yuboriladi.", { icon: '💾' });
      } else {
        toast.success(res?.data?.message || "To'lov tasdiqlandi.");
      }
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "To'lovni qabul qilishda xatolik yuz berdi";
      toast.error(msg);
    },
  });

  const editPaymentMutation = useMutation({
    mutationFn: async ({ id, amount, month }) => {
      return await api.patch(`/finance/student-payments/${id}/`, {
        amount,
        month,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments-all"] }),
        queryClient.invalidateQueries({ queryKey: ["student-history", student_id] }),
      ]);
      dispatch({ type: "TOGGLE_EDIT_PAYMENT", payload: false });
      toast.success("To'lov tahrirlandi.");
    },
  });

  const customPaymentMutation = useMutation({
    mutationFn: async (data) => {
      return await api.post(`/finance/student-payments/custom-payment/`, {
        student: student_id,
        ...data,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments-all"] }),
        queryClient.invalidateQueries({ queryKey: ["student-history", student_id] }),
      ]);
      dispatch({ type: "TOGGLE_CUSTOM_PAYMENT", payload: false });
      toast.success("To'lov qabul qilindi.");
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          "To'lovni qabul qilishda xatolik yuz berdi",
      );
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: async (groupId) =>
      await api.post(`/groups/groups/${groupId}/unenroll-student/`, {
        student_id,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["student"] });
      toast.success(res.data.status || "O'quvchi guruhdan chiqarildi.");
      if (
        res.data.status?.includes("oxirgi guruh") ||
        res.data.status?.includes("kutish zaliga")
      ) {
        navigate(-1);
      }
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (reason) =>
      await api.delete(`/groups/students/${student_id}/`, { data: { reason } }),
    onSuccess: () => {
      toast.success("O'quvchi tizimdan butkul o'chirildi.");
      navigate(-1);
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async (duplicateId) =>
      await api.post(`/groups/students/${student_id}/merge/`, {
        duplicate_id: duplicateId,
      }),
    onSuccess: async (res) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["student"] }),
        queryClient.invalidateQueries({ queryKey: ["payments-all"] }),
        queryClient.invalidateQueries({ queryKey: ["student-history", student_id] }),
      ]);
      dispatch({ type: "TOGGLE_MERGE_MODAL", payload: false });
      toast.success(res.data.message || "Muvaffaqiyatli birlashtirildi.");
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.error || "Birlashtirishda xatolik yuz berdi",
      );
    },
  });

  const disconnectBotMutation = useMutation({
    mutationFn: async () => await api.post(`/groups/students/${student_id}/disconnect-bot/`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["student"] });
      toast.success(res.data.message || "Botdan muvaffaqiyatli uzildi.");
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.error || "Botdan uzishda xatolik yuz berdi",
      );
    },
  });

  const generatePaymentMutation = useMutation({
    mutationFn: async (groupId) => {
      const payload = { student_id };
      if (groupId) payload.group_id = groupId;
      const response = await api.post("/finance/generate-student-payment/", payload);
      return response.data;
    },
    onSuccess: async (data) => {
      toast.success(data?.message || "Joriy oy to'lov ma'lumoti muvaffaqiyatli yaratildi");
      
      // 1. Agar backend yangilangan payments ro'yxatini qaytargan bo'lsa, keshni darhol yangilaymiz (0-kechikish)
      if (Array.isArray(data?.payments)) {
        queryClient.setQueryData(["payments-all", student_id], data.payments);
      }

      // 2. React Query v5 formati orqali keshni bekor qilib, to'liq qayta yuklaymiz
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments-all"] }),
        queryClient.invalidateQueries({ queryKey: ["student-history"] }),
        queryClient.invalidateQueries({ queryKey: ["student"] }),
      ]);

      // 3. Faol querylarni darhol refetch qilish
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["payments-all", student_id] }),
        queryClient.refetchQueries({ queryKey: ["student-history", student_id] }),
      ]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || err.response?.data?.detail || "To'lov ma'lumotini yaratishda xatolik yuz berdi");
    },
  });

  return {
    editMutation,
    paymentMutation,
    editPaymentMutation,
    customPaymentMutation,
    unenrollMutation,
    archiveMutation,
    mergeMutation,
    disconnectBotMutation,
    generatePaymentMutation,
  };
};
