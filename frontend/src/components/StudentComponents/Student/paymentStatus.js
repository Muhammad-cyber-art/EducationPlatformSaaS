/** To'lov holati bo'yicha UI klasslari */
export function getPaymentStatus(payment) {
    if (!payment) {
        return {
            key: 'unpaid',
            label: "Qarzdorlik",
            iconTone: 'red',
            badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20',
            textClass: 'text-red-500',
            barClass: 'bg-red-500 w-1/12',
            ringClass: 'bg-red-500',
            shadowColor: '#ef444415',
        };
    }
    if (payment.is_paid) {
        return {
            key: 'paid',
            label: "To'langan",
            iconTone: 'emerald',
            badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
            textClass: 'text-emerald-500',
            barClass: 'bg-emerald-500 w-full',
            ringClass: 'bg-emerald-500',
            shadowColor: '#10b98115',
        };
    }
    if (payment.is_partial) {
        const remaining = payment.remaining_amount ?? Math.max(
            0,
            Number(payment.amount || 0) - Number(payment.paid_amount || 0)
        );
        return {
            key: 'partial',
            label: "Bo'lib to'langan",
            iconTone: 'amber',
            badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
            textClass: 'text-amber-400',
            barClass: 'bg-amber-500',
            ringClass: 'bg-amber-500',
            shadowColor: '#f59e0b15',
            paidAmount: Number(payment.paid_amount || 0),
            remainingAmount: remaining,
        };
    }
    return {
        key: 'unpaid',
        label: "Qarzdorlik",
        iconTone: 'red',
        badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20',
        textClass: 'text-red-500',
        barClass: 'bg-red-500 w-1/12',
        ringClass: 'bg-red-500',
        shadowColor: '#ef444415',
    };
}

/**
 * Berilgan to'lov yoki sana joriy oyga tegishli ekanligini
 * brauzerning vaqt mintaqasi (timezone offset) dan qat'i nazar
 * 100% ishonchli aniqlash.
 * 
 * Django DateField qiymati "YYYY-MM-DD" (masalan "2026-10-01") formatida keladi.
 * JS new Date("2026-10-01") esa UTC midnight sifatida o'qilib, manfiy timezonelarda
 * (masalan GMT-3, GMT-5) oldingi oyning oxirgi kuniga aylanib qoladi.
 * Shu sababli string regex orqali solishtirish barcha timezonelarda xatosiz ishlaydi.
 */
export function isCurrentMonthPayment(paymentOrDateStr) {
    if (!paymentOrDateStr) return false;
    
    const monthVal = typeof paymentOrDateStr === 'object' 
        ? (paymentOrDateStr.month || paymentOrDateStr.date) 
        : paymentOrDateStr;

    if (!monthVal) return false;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1 - 12

    if (typeof monthVal === 'string') {
        const match = monthVal.match(/^(\d{4})-(\d{2})/);
        if (match) {
            const y = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            return y === currentYear && m === currentMonth;
        }
    }

    if (monthVal instanceof Date) {
        return monthVal.getFullYear() === currentYear && (monthVal.getMonth() + 1) === currentMonth;
    }

    return false;
}

