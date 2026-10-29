import React from "react";
import { createPortal } from "react-dom";
import { useInView } from "react-intersection-observer";
import {
    User, Banknote, Smartphone, CheckCircle2, ShieldCheck,
    FileText, Image as ImageIcon, TrendingDown, CreditCard, BookOpen
} from "lucide-react";
import { formatCurrency } from "./useKassa";

const getMethodMeta = (method, display) => {
    const normalized = (method || "").toLowerCase();
    if (normalized === "cash") {
        return {
            icon: <Banknote size={14} />,
            label: display || "Naqd (Cash)",
            badgeClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
            mobileLabel: "Naqd",
        };
    }
    if (normalized === "payme") {
        return {
            icon: <Smartphone size={14} />,
            label: display || "Payme",
            badgeClass: "bg-purple-500/10 border-purple-500/20 text-purple-400",
            mobileLabel: "Payme",
        };
    }
    if (normalized === "click") {
        return {
            icon: <Smartphone size={14} />,
            label: display || "Click / Card",
            badgeClass: "bg-blue-500/10 border-blue-500/20 text-blue-500",
            mobileLabel: "Click/Card",
        };
    }
    if (normalized === "other") {
        return {
            icon: <CreditCard size={14} />,
            label: display || "Boshqa",
            badgeClass: "bg-amber-500/10 border-amber-500/20 text-amber-400",
            mobileLabel: "Boshqa",
        };
    }
    if (!method && !display) {
        return {
            icon: <CreditCard size={14} />,
            label: "Noma'lum",
            badgeClass: "bg-gray-500/10 border-gray-500/20 text-gray-400",
            mobileLabel: "Noma'lum",
        };
    }
    return {
        icon: <Smartphone size={14} />,
        label: display || method || "Click / Card",
        badgeClass: "bg-blue-500/10 border-blue-500/20 text-blue-500",
        mobileLabel: "Click/Card",
    };
};

const formatDateBadge = (dateString) => {
    const d = new Date(dateString);
    const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
    return `${d.getDate()} - ${months[d.getMonth()]}`;
};

const IncomeTable = ({ payments, loading, loadingMore, hasMorePayments, loadMore, isSuperAdmin, onVerify, onDetail, onReceipt }) => {
    const { ref, inView } = useInView({ threshold: 0 });

    React.useEffect(() => {
        if (inView) {
            loadMore();
        }
    }, [inView, loadMore]);

    return (
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-[var(--bg-panel)] border-b border-[var(--border-glass)]">
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">O'quvchi / Guruh</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">To'lov Usuli</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Summa</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Qabul Qildi</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Vaqt</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em] text-right">Amallar</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-glass)]">
                {loading && payments.length === 0 ? (
                    <tr><td colSpan="6" className="p-16 text-center text-[var(--gold)] animate-pulse uppercase font-black tracking-widest">Ma'lumotlar yuklanmoqda...</td></tr>
                ) : payments.length === 0 ? (
                    <tr><td colSpan="6" className="p-16 text-center text-[var(--text-muted)] font-black uppercase tracking-widest">Hozircha hech qanday tushum topilmadi</td></tr>
                ) : (
                    <>
                        {payments.map((p, idx) => {
                            const methodMeta = getMethodMeta(p.payment_details?.payment_method, p.payment_details?.payment_method_display);
                            const isCancelled = p.status === 'cancelled';
                            const isDeleted = p.student_name?.includes("O'chirilgan");
                            const dateBadge = formatDateBadge(p.created_at || p.date);
                            const prevDateBadge = idx > 0 ? formatDateBadge(payments[idx - 1].created_at || payments[idx - 1].date) : null;
                            const showBadge = idx === 0 || dateBadge !== prevDateBadge;

                            return (
                                <React.Fragment key={p.id}>
                                    {showBadge && (
                                        <tr>
                                            <td colSpan="6" className="py-3 bg-[var(--bg-void)]/30 border-y border-[var(--gold)]/20">
                                                <div className="flex justify-center">
                                                    <span className="px-4 py-1 rounded-full bg-[var(--bg-panel)] border border-[var(--gold)]/30 text-[var(--text-color)] text-[11px] font-black uppercase tracking-widest shadow-sm">
                                                        {dateBadge}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    <tr
                                        className={`transition-all duration-300 group/row ${isCancelled
                                            ? 'opacity-50 bg-red-500/[0.04] border-l-2 border-red-500'
                                            : 'hover:bg-[var(--gold-dim)]'
                                            }`}
                                    >
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-2xl bg-[var(--bg-void)] border flex items-center justify-center transition-colors ${isDeleted ? 'border-red-500/30 text-red-400' : 'border-[var(--border-glass)] text-[var(--text-muted)] group-hover/row:border-[var(--gold)]/30'}`}>
                                                    <User size={20} strokeWidth={1.5} />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-black capitalize ${isCancelled ? 'text-red-400 line-through' : isDeleted ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{p.student_name}</p>
                                                    <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-0.5 opacity-70">{p.payment_details?.group_name || p.group_name || 'Guruhsiz'}</p>
                                                    {isCancelled && (
                                                        <p className="text-[9px] text-red-400 font-bold mt-0.5">
                                                            ❌ Bekor qilindi: {p.cancelled_by_name || '—'}
                                                            {p.cancelled_at ? ` • ${new Date(p.cancelled_at).toLocaleDateString('uz-UZ')}` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wider ${isCancelled ? 'opacity-40 grayscale' : isDeleted ? 'bg-red-500/10 text-red-400 border-red-500/30' : methodMeta.badgeClass}`}>
                                                {methodMeta.icon}
                                                {methodMeta.label}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className={`text-[15px] font-black tabular-nums tracking-tight ${isCancelled ? 'text-red-400 line-through' : 'text-[var(--text-primary)]'}`}>{formatCurrency(p.amount)}</div>
                                            {p.payment_details?.refund_amount > 0 && !p.payment_details?.refund_ignored && (
                                                <div className="mt-0.5 text-[9px] font-bold text-emerald-400">Refund: -{formatCurrency(p.payment_details.refund_amount)}</div>
                                            )}
                                            {p.payment_details?.refund_amount > 0 && p.payment_details?.refund_ignored && (
                                                <div className="mt-0.5 text-[9px] font-bold text-amber-400">Refund bekor</div>
                                            )}
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${p.payment_details?.is_verified ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-[var(--bg-void)] text-[var(--gold)] border-[var(--border-glass)]'}`}>
                                                    {p.payment_details?.is_verified ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}
                                                </div>
                                                <span className="text-[10px] font-black uppercase text-[var(--text-secondary)]">{p.marked_by_name || "Tizim"}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="text-[10px] font-black text-[var(--text-primary)]">{new Date(p.created_at || p.date).toLocaleDateString('uz-UZ')}</div>
                                            <div className="text-[9px] text-[var(--text-muted)] font-black mt-0.5">{new Date(p.created_at || p.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            {isCancelled ? (
                                                <div className="flex justify-end">
                                                    <span className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest">Bekor qilindi</span>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-2 transition-all duration-300">
                                                    {isSuperAdmin && !p.payment_details?.is_verified && (
                                                        <button onClick={() => onVerify(p.payment_details?.original_payment_id || p.id)} className="w-9 h-9 flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-90"><CheckCircle2 size={16} /></button>
                                                    )}
                                                    {p.payment_details?.receipt_image && (
                                                        <button
                                                            onClick={() => onReceipt(p.payment_details.receipt_image, p)}
                                                            title="To'lov cheki va izohni ko'rish"
                                                            className="w-9 h-9 flex items-center justify-center bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm active:scale-90"
                                                        >
                                                            <ImageIcon size={16} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => onDetail(p)} className="w-9 h-9 flex items-center justify-center bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/20 rounded-xl hover:bg-[var(--gold)] hover:text-white transition-all shadow-sm active:scale-90"><FileText size={16} /></button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                        {hasMorePayments && (
                            <tr ref={ref}>
                                <td colSpan="6" className="py-6 text-center text-[var(--gold)] text-[10px] uppercase font-black tracking-widest animate-pulse">
                                    Keyingi ma'lumotlar yuklanmoqda...
                                </td>
                            </tr>
                        )}
                    </>
                )}
            </tbody>
        </table>
    );
};

const ExpenseTable = ({ withdrawals, loading, loadingMore, hasMoreWithdrawals, loadMore }) => {
    const { ref, inView } = useInView({ threshold: 0 });

    React.useEffect(() => {
        if (inView) {
            loadMore();
        }
    }, [inView, loadMore]);

    return (
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-[var(--bg-panel)] border-b border-[#333]">
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Operatsiya</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Toifa</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Summa</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Mas'ul</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Vaqt</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em] text-right">Status</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
                {loading && withdrawals.length === 0 ? (
                    <tr><td colSpan="6" className="p-16 text-center text-red-500 animate-pulse uppercase font-black tracking-widest">Yuklanmoqda...</td></tr>
                ) : withdrawals.length === 0 ? (
                    <tr><td colSpan="6" className="p-16 text-center text-[var(--text-muted)] font-black uppercase tracking-widest">Hozircha hech qanday chiqim topilmadi</td></tr>
                ) : (
                    <>
                        {withdrawals.map((w, idx) => {
                            const dateBadge = formatDateBadge(w.created_at || w.date);
                            const prevDateBadge = idx > 0 ? formatDateBadge(withdrawals[idx - 1].created_at || withdrawals[idx - 1].date) : null;
                            const showBadge = idx === 0 || dateBadge !== prevDateBadge;

                            return (
                                <React.Fragment key={w.id}>
                                    {showBadge && (
                                        <tr>
                                            <td colSpan="6" className="py-3 bg-[var(--bg-void)]/30 border-y border-[var(--gold)]/20">
                                                <div className="flex justify-center">
                                                    <span className="px-4 py-1 rounded-full bg-[var(--bg-panel)] border border-[var(--gold)]/30 text-[var(--text-primary)] text-[11px] font-black uppercase tracking-widest shadow-sm">
                                                        {dateBadge}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    <tr className="hover:bg-[var(--gold-dim)] transition-all duration-300 group/row">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 group-hover/row:bg-red-500 group-hover/row:text-white transition-all">
                                                    <TrendingDown size={20} strokeWidth={1.5} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-[var(--text-primary)] capitalize">{w.title}</p>
                                                    <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-0.5 opacity-70 truncate max-w-[200px]">{w.description}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-wider">
                                                <CreditCard size={12} />
                                                {w.category_display || (w.category === 'owner_withdrawal' ? 'Avans / Pul Olish' : 'Chiqim')}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-[15px] font-black text-red-500 tabular-nums tracking-tight">{formatCurrency(w.amount)}</td>
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-[var(--bg-void)] flex items-center justify-center border border-[var(--border-glass)] text-[var(--gold)]">
                                                    <User size={14} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase text-[var(--text-secondary)]">{w.marked_by_name || "Super Admin"}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="text-[10px] font-black text-[var(--text-primary)]">{w.date}</div>
                                            <div className="text-[9px] text-[var(--text-muted)] font-black mt-0.5">Chiqim operatsiyasi</div>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5 text-emerald-500 font-black text-[9px] uppercase tracking-widest">
                                                <CheckCircle2 size={12} />
                                                Bajarildi
                                            </div>
                                        </td>
                                    </tr>
                                </React.Fragment>
                            )
                        })}
                        {hasMoreWithdrawals && (
                            <tr ref={ref}>
                                <td colSpan="6" className="py-6 text-center text-[var(--gold)] text-[10px] uppercase font-black tracking-widest animate-pulse">
                                    Keyingi ma'lumotlar yuklanmoqda...
                                </td>
                            </tr>
                        )}
                    </>
                )}
            </tbody>
        </table>
    );
};

const MobileIncomeCard = ({ item, isSuperAdmin, onVerify, onDetail, onReceipt }) => {
    const isCancelled = item.status === 'cancelled';
    const isDeleted = item.student_name?.includes("O'chirilgan");
    const branchName = item.branch_name || item.payment_details?.branch_name || item.branch?.name;
    const timeStr = new Date(item.created_at || item.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
    const methodMeta = getMethodMeta(item.payment_details?.payment_method, item.payment_details?.payment_method_display);

    return (
        <div className="flex items-center justify-between gap-2 p-4 bg-[var(--bg-panel)]/30 border border-[var(--border-glass)] rounded-xl backdrop-blur-md relative overflow-hidden active:scale-[0.98] transition-all">
            <div className="flex-1 min-w-0">
                <h3 className={`text-[13px] font-black capitalize truncate ${isCancelled ? 'text-red-400 line-through' : isDeleted ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{item.student_name}</h3>
                <p className="text-[10px] text-[var(--text-muted)] font-bold truncate opacity-80">{item.payment_details?.group_name || item.group_name || 'Guruhsiz'}</p>
                <div className="flex items-center gap-2 mt-1">
                    <p className={`text-[13px] font-black tabular-nums ${isCancelled ? 'text-red-400 line-through' : 'text-[var(--gold)]'}`}>{formatCurrency(item.amount)}</p>
                    <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${isCancelled ? 'opacity-40 grayscale' : isDeleted ? 'bg-red-500/10 text-red-400 border-red-500/30' : methodMeta.badgeClass}`}>
                        {methodMeta.icon && React.cloneElement(methodMeta.icon, { size: 12, strokeWidth: 2.2 })}
                        {methodMeta.mobileLabel || methodMeta.label}
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0 px-2">
                <span className="text-[10px] text-[var(--text-primary)] font-black uppercase tracking-widest text-center max-w-[90px] truncate">
                    {branchName || 'Asosiy'}
                </span>
                <span className="text-[9px] text-[var(--gold)] font-black tracking-widest mt-1 text-center leading-tight">
                    {timeStr}
                </span>
            </div>

            <div className="flex justify-end gap-1.5 shrink-0">
                {!isCancelled && (
                    <>
                        {isSuperAdmin && !item.payment_details?.is_verified && (
                            <button
                                onClick={() => onVerify(item.payment_details?.original_payment_id || item.id)}
                                title="Tasdiqlash"
                                className="w-11 h-11 flex items-center justify-center bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 rounded-xl active:scale-90 transition-all shadow-sm"
                            >
                                <CheckCircle2 size={20} strokeWidth={2.2} />
                            </button>
                        )}
                        {item.payment_details?.is_verified && (
                            <div
                                title="Tasdiqlangan"
                                className="w-11 h-11 flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl"
                            >
                                <CheckCircle2 size={20} strokeWidth={2.2} />
                            </div>
                        )}
                        {item.payment_details?.receipt_image && (
                            <button
                                onClick={() => onReceipt(item.payment_details.receipt_image, item)}
                                title="To'lov cheki va izohni ko'rish"
                                className="w-11 h-11 flex items-center justify-center bg-blue-500/15 text-blue-500 border border-blue-500/30 rounded-xl active:scale-90 transition-all shadow-sm"
                            >
                                <ImageIcon size={20} strokeWidth={2.2} />
                            </button>
                        )}
                        <button
                            onClick={() => onDetail(item)}
                            title="Batafsil ma'lumot"
                            className="w-11 h-11 flex items-center justify-center bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30 rounded-xl active:scale-90 transition-all shadow-sm"
                        >
                            <FileText size={20} strokeWidth={2.2} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const MobileExpenseCard = ({ item }) => (
    <div className="flex items-center justify-between p-4 bg-[var(--bg-panel)]/30 border border-[var(--border-glass)] rounded-xl backdrop-blur-md relative overflow-hidden active:scale-[0.98] transition-all">
        <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500 shrink-0 shadow-sm">
                <TrendingDown size={20} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
                <h3 className="text-[13px] font-black text-[var(--text-primary)] capitalize truncate">{item.title}</h3>
                <p className="text-[13px] font-black tabular-nums mt-0.5 text-red-500">{formatCurrency(item.amount)}</p>
            </div>
        </div>
        <div className="flex gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle2 size={15} strokeWidth={2.2} />
                Bajarildi
            </div>
        </div>
    </div>
);

import api from "../../../../tokenUpdater/updater";

const KassaContent = ({ activeTab, payments, withdrawals, loading, loadingMore, hasMorePayments, hasMoreWithdrawals, loadMore, isSuperAdmin, onVerify, onDetail }) => {
    const data = activeTab === 'incomes' ? payments : withdrawals;
    const hasMoreData = activeTab === 'incomes' ? hasMorePayments : hasMoreWithdrawals;
    const [receiptViewerUrl, setReceiptViewerUrl] = React.useState(null);
    const [receiptViewerPayment, setReceiptViewerPayment] = React.useState(null);

    const { ref, inView } = useInView({ threshold: 0 });

    React.useEffect(() => {
        if (inView) {
            loadMore();
        }
    }, [inView, loadMore]);

    const onReceipt = (url, payment = null) => {
        if (!url) return;
        let finalUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            const rootUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
            finalUrl = url.startsWith('/') ? `${rootUrl}${url}` : `${rootUrl}/${url}`;
        } else {
            try {
                const parsed = new URL(url);
                if ((parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') && window.location.hostname !== '127.0.0.1' && window.location.hostname !== 'localhost') {
                    const rootUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
                    finalUrl = `${rootUrl}${parsed.pathname}`;
                }
            } catch (e) {
                // Ignore parse error
            }
        }
        setReceiptViewerUrl(finalUrl);
        setReceiptViewerPayment(payment);
    };

    return (
        <div className="relative">
            {/* Desktop Table View */}
            <div className="hidden lg:block !p-0 rounded-2xl overflow-hidden border border-[var(--border-glass)] shadow-xl bg-[var(--bg-panel)]/20 backdrop-blur-md">
                <div className="overflow-x-auto">
                    {activeTab === "incomes" ? (
                        <IncomeTable
                            payments={payments}
                            loading={loading}
                            loadingMore={loadingMore}
                            hasMorePayments={hasMorePayments}
                            loadMore={loadMore}
                            isSuperAdmin={isSuperAdmin}
                            onVerify={onVerify}
                            onDetail={onDetail}
                            onReceipt={onReceipt}
                        />
                    ) : (
                        <ExpenseTable
                            withdrawals={withdrawals}
                            loading={loading}
                            loadingMore={loadingMore}
                            hasMoreWithdrawals={hasMoreWithdrawals}
                            loadMore={loadMore}
                        />
                    )}
                </div>
            </div>

            {/* Mobile/Tablet Card View */}
            <div className="lg:hidden space-y-4">
                {loading && data.length === 0 ? (
                    <div className="p-20 text-center text-[var(--gold)] animate-pulse font-black uppercase tracking-widest">Yuklanmoqda...</div>
                ) : data.length === 0 ? (
                    <div className="p-20 text-center text-[var(--text-muted)] font-black uppercase tracking-widest">Hech qanday ma'lumot topilmadi</div>
                ) : (
                    <>
                        {data.map((item, idx) => {
                            const dateBadge = formatDateBadge(item.created_at || item.date);
                            const prevDateBadge = idx > 0 ? formatDateBadge(data[idx - 1].created_at || data[idx - 1].date) : null;
                            const showBadge = idx === 0 || dateBadge !== prevDateBadge;

                            return (
                                <React.Fragment key={item.id}>
                                    {showBadge && (
                                        <div className="flex justify-center my-6">
                                            <span className="px-4 py-1.5 rounded-full bg-[var(--bg-panel)] border border-[var(--gold)]/30 text-[var(--text-primary)] text-[11px] font-black uppercase tracking-widest shadow-sm">
                                                {dateBadge}
                                            </span>
                                        </div>
                                    )}
                                    {activeTab === 'incomes' ? (
                                        <MobileIncomeCard
                                            item={item}
                                            isSuperAdmin={isSuperAdmin}
                                            onVerify={onVerify}
                                            onDetail={onDetail}
                                            onReceipt={onReceipt}
                                        />
                                    ) : (
                                        <MobileExpenseCard item={item} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {hasMoreData && (
                            <div ref={ref} className="py-6 text-center text-[var(--gold)] text-[10px] uppercase font-black tracking-widest animate-pulse">
                                Keyingi ma'lumotlar yuklanmoqda...
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Receipt Modal */}
            {receiptViewerUrl && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
                    onClick={() => { setReceiptViewerUrl(null); setReceiptViewerPayment(null); }}
                >
                    <div className="relative max-w-4xl max-h-[92vh] w-full flex flex-col items-center justify-center overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="w-full flex items-center justify-between pb-3 text-white">
                            <span className="text-sm font-bold flex items-center gap-2">
                                <ImageIcon size={18} className="text-[var(--gold)]" />
                                To'lov cheki va tafsilotlari
                            </span>
                            <div className="flex items-center gap-2">
                                <a
                                    href={receiptViewerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 text-xs font-bold bg-[var(--bg-panel)] hover:bg-[var(--bg-void)] text-white rounded-xl transition-colors border border-[var(--border-glass)] flex items-center gap-1.5"
                                >
                                    <span>Yangi oynada ochish</span>
                                </a>
                                <button
                                    onClick={() => { setReceiptViewerUrl(null); setReceiptViewerPayment(null); }}
                                    className="w-8 h-8 flex items-center justify-center bg-[var(--bg-panel)] text-white rounded-xl hover:bg-[var(--bg-void)] transition-all border border-[var(--border-glass)] cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="w-full flex items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-glass)] bg-black/60 p-2">
                            <img
                                src={receiptViewerUrl}
                                alt="Chek rasmi"
                                className="max-w-full max-h-[58vh] object-contain rounded-xl shadow-2xl"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    const fallback = e.target.nextElementSibling;
                                    if (fallback) fallback.style.display = 'flex';
                                }}
                            />
                            <div style={{ display: 'none' }} className="p-12 flex-col items-center justify-center text-center space-y-3">
                                <p className="text-sm text-red-400 font-bold">Rasmni yuklab bo'lmadi</p>
                                <a
                                    href={receiptViewerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[var(--gold)] underline"
                                >
                                    To'g'ridan-to'g'ri havolada ochib ko'ring
                                </a>
                            </div>
                        </div>

                        {receiptViewerPayment && (
                            <div className="w-full mt-3 p-4 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-xl space-y-3 animate-in fade-in duration-150">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                        <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">O'quvchi</p>
                                        <p className="font-bold text-white truncate">{receiptViewerPayment.student_name || "Noma'lum"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Guruh</p>
                                        <p className="font-bold text-[var(--gold)] truncate">{receiptViewerPayment.payment_details?.group_name || receiptViewerPayment.group_name || "Guruhsiz"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">To'langan Summa</p>
                                        <p className="font-bold text-emerald-400">{formatCurrency(receiptViewerPayment.amount)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">Qabul qildi</p>
                                        <p className="font-bold text-white truncate">{receiptViewerPayment.marked_by_name || "Tizim"}</p>
                                    </div>
                                </div>

                                {(() => {
                                    const rawNote = (receiptViewerPayment.notes || receiptViewerPayment.payment_details?.notes || receiptViewerPayment.description || "").trim();
                                    if (!rawNote) return null;

                                    const groupName = receiptViewerPayment.payment_details?.group_name || receiptViewerPayment.group_name || "Guruhsiz";
                                    const month = receiptViewerPayment.payment_details?.month;
                                    const attMatch = rawNote.match(/davomat:\s*(\d+\s*\/\s*\d+(?:\s*dars)?(?:\s*\([^)]*\))?)/i);
                                    const attendanceStr = receiptViewerPayment.payment_details?.attendance_info?.attendance_str || (attMatch ? attMatch[1] : null);

                                    let customNote = rawNote
                                        .replace(/guruh:\s*[^|\n]+(?:\||$)/gi, '')
                                        .replace(/(?:davr|oy):\s*\d{4}-\d{2}(?:\||$)/gi, '')
                                        .replace(/davomat:\s*\d+\s*\/\s*\d+(?:\s*dars)?(?:\s*\([^)]*\))?(?:\||$)/gi, '')
                                        .replace(/bo'lib to'lov(?:\||$)/gi, '')
                                        .replace(/custom to'lov(?:\||$)/gi, '')
                                        .replace(/cheksiz(?:\s*to'lov)?(?:\||$)/gi, '')
                                        .replace(/\|+/g, ' ')
                                        .trim();

                                    customNote = customNote.replace(/^(?:izoh|izohi|comment|note):\s*/i, '').trim();

                                    if (customNote.startsWith(groupName) || customNote.includes("UZS. Usul:") || customNote === groupName) {
                                        customNote = "";
                                    }

                                    return (
                                        <div className="p-3.5 bg-[var(--bg-void)]/60 border border-[var(--border-glass)] rounded-xl space-y-2.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-[var(--gold)] tracking-widest flex items-center gap-1.5">
                                                    <FileText size={13} />
                                                    Guruh va Davomat ma'lumotlari:
                                                </span>
                                                {attendanceStr && (
                                                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                                                        <CheckCircle2 size={12} />
                                                        Davomat: {attendanceStr}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--text-color)] font-medium leading-relaxed">
                                                Guruh: <strong className="text-[var(--gold)]">{groupName}</strong> {month ? `• Davr: ${month}` : ''}
                                            </p>
                                            {customNote ? (
                                                <div className="pt-2 border-t border-[var(--border-glass)]">
                                                    <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs space-y-1">
                                                        <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider block">
                                                            Kiritilgan Izoh:
                                                        </span>
                                                        <p className="text-sm font-black text-amber-300 whitespace-pre-wrap leading-relaxed select-text">
                                                            "{customNote}"
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default KassaContent;
