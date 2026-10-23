import toast from 'react-hot-toast';

/**
 * Smart Toast Notification Helper
 * Foydalanuvchilarga qizil qo'rqinchli error toasterni faqat o'ta jiddiy xatoliklarda chiqaradi.
 * Kutish kerak bo'lgan, tarmoq yangilanishi, token yangilanishi yoki oddiy ogohlantirishlarda
 * 'warn' (⚠️), 'wait' (⏳), yoki 'info' (ℹ️) xabarlari orqali ishonchli va xotirjam tajriba taqdim etadi.
 */

const baseToastStyle = {
  background: '#121212',
  color: '#f3f4f6',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '14px',
  padding: '12px 18px',
  fontSize: '13px',
  fontWeight: '600',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(10px)',
  maxWidth: '420px',
};

export const notify = {
  /**
   * Ogohlantirish (Warning - sariq/oltin rangda)
   * Ma'lumot to'liq emasligi, validatsiya yoki oddiy eslatmalar uchun
   */
  warn: (message, options = {}) => {
    return toast(message, {
      icon: '⚠️',
      duration: options.duration || 3500,
      style: {
        ...baseToastStyle,
        border: '1px solid rgba(245, 158, 11, 0.35)',
        color: '#fbbf24',
        ...options.style,
      },
      ...options,
    });
  },

  /**
   * Kutish holati (Wait / Pending - soat belgisi bilan)
   * Server biroz band bo'lganda, token refresh, rate limit yoki sekin tarmoqda
   */
  wait: (message, options = {}) => {
    return toast(message || "Iltimos, biroz kuting...", {
      icon: '⏳',
      duration: options.duration || 3000,
      style: {
        ...baseToastStyle,
        border: '1px solid rgba(184, 134, 11, 0.35)',
        color: '#fef08a',
        ...options.style,
      },
      ...options,
    });
  },

  /**
   * Ma'lumot (Info - ko'k/kulrang)
   */
  info: (message, options = {}) => {
    return toast(message, {
      icon: 'ℹ️',
      duration: options.duration || 3000,
      style: {
        ...baseToastStyle,
        border: '1px solid rgba(59, 130, 246, 0.3)',
        color: '#93c5fd',
        ...options.style,
      },
      ...options,
    });
  },

  /**
   * Muvaffaqiyat (Success)
   */
  success: (message, options = {}) => {
    return toast.success(message, {
      duration: options.duration || 3000,
      style: {
        ...baseToastStyle,
        border: '1px solid rgba(16, 185, 129, 0.3)',
        ...options.style,
      },
      ...options,
    });
  },

  /**
   * Qattiq xatolik (Faqat jiddiy server nosozligi yoki tranzaksiya uzilishida)
   */
  error: (message, options = {}) => {
    return toast.error(message, {
      duration: options.duration || 4500,
      style: {
        ...baseToastStyle,
        border: '1px solid rgba(239, 68, 68, 0.4)',
        ...options.style,
      },
      ...options,
    });
  },

  /**
   * Aqlli API xatolik tahlilchisi (Axios / TanStack Query xatolarini saralaydi)
   */
  apiError: (error, fallbackMessage) => {
    // 0. Agar so'rov bekor qilingan bo'lsa (masalan, sahifadan chiqib ketilganda) — hech narsa ko'rsatmaslik
    if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
      return null;
    }

    // 1. Tarmoq yoki oflayn holatlar (Harsh qizil xato emas, xotirjam kutish xabari)
    if (!error?.response || error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED' || error?.isOffline) {
      return notify.wait("Internet bilan aloqa vaqtincha uzildi. Qayta ulanish kutilmoqda...", {
        id: 'network-wait-toast',
      });
    }

    const status = error.response?.status;
    const data = error.response?.data;

    // Xabar matnini toza ajratib olish (string, detail, message yoki birinchi validatsiya xatosi)
    let extractedMsg = '';
    if (typeof data === 'string') {
      extractedMsg = data;
    } else if (data?.detail) {
      extractedMsg = data.detail;
    } else if (data?.message) {
      extractedMsg = data.message;
    } else if (data?.error) {
      extractedMsg = data.error;
    } else if (typeof data === 'object') {
      // Masalan: { title: ["Bu maydon majburiy"] } yoki { non_field_errors: [...] }
      const firstKey = Object.keys(data)[0];
      if (firstKey && Array.isArray(data[firstKey])) {
        extractedMsg = `${data[firstKey][0]}`;
      } else if (firstKey && typeof data[firstKey] === 'string') {
        extractedMsg = data[firstKey];
      }
    }

    // 2. 401 Unauthorized (Token eskirgan yoki yangilanmoqda)
    if (status === 401) {
      return notify.wait("Sessiya yangilanmoqda. Iltimos, biroz kuting...", {
        id: 'auth-wait-toast',
      });
    }

    // 3. 429 Too Many Requests (Rate limit / tez-tez bosish)
    if (status === 429) {
      return notify.wait("Iltimos, biroz kuting. Ketma-ket so'rovlar yuborildi.", {
        id: 'rate-limit-toast',
      });
    }

    // 4. 408 Timeout / 502 Bad Gateway / 503 Service Unavailable / 504 Gateway Timeout
    if (status === 408 || status === 502 || status === 503 || status === 504) {
      return notify.wait("Server biroz band. Ma'lumotlar bir necha soniyada yuklanadi...", {
        id: 'server-wait-toast',
      });
    }

    // 5. 403 Forbidden (Huquq yetarli emas)
    if (status === 403) {
      return notify.warn(extractedMsg || "Bu amalni bajarish uchun sizda yetarli ruxsat yo'q.", {
        id: 'forbidden-warn-toast',
      });
    }

    // 6. 404 Not Found (Ma'lumot topilmadi)
    if (status === 404) {
      return notify.info(extractedMsg || "So'ralgan ma'lumot topilmadi.", {
        id: 'not-found-toast',
      });
    }

    // 7. 400 Bad Request / Validation (User kiritgan ma'lumot xatoligi)
    if (status === 400) {
      return notify.warn(extractedMsg || fallbackMessage || "Iltimos, kiritilgan ma'lumotlarni tekshiring.", {
        id: 'validation-warn-toast',
      });
    }

    // 8. 500 Internal Server Error (Faqat haqiqiy server xatolarida qizil error)
    if (status >= 500) {
      return notify.error("Serverda vaqtinchalik xatolik yuz berdi. Birozdan so'ng qayta urining.", {
        id: 'server-error-toast',
      });
    }

    // Boshqa holatlarda
    return notify.warn(extractedMsg || fallbackMessage || "Amalni bajarishda noaniqlik yuz berdi.", {
      id: 'general-api-toast',
    });
  },

  dismiss: (id) => toast.dismiss(id),
};

export default notify;
