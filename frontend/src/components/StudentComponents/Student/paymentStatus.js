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
