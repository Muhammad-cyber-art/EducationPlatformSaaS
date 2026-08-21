import React from "react";
import { createPortal } from "react-dom";
import { useInView } from "react-intersection-observer";
import {
    User, Banknote, Smartphone, CheckCircle2, ShieldCheck,
    FileText, Image as ImageIcon, TrendingDown, CreditCard
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

    let lastDateBadge = null;

    return (
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-[var(--bg-panel)] border-b border-[#333]">
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">O'quvchi / Guruh</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">To'lov Usuli</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Summa</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Qabul Qildi</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">Vaqt</th>
                    <th className="px-8 py-4 text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em] text-right">Amallar</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
                {loading && payments.length === 0 ? (
                    <tr><td colSpan="6" className="p-16 text-center text-[var(--gold)] animate-pulse uppercase font-black tracking-widest">Ma'lumotlar yuklanmoqda...</td></tr>
                ) : payments.length === 0 ? (
                    <tr><td colSpan="6" className="p-16 text-center text-[var(--text-muted)] font-black uppercase tracking-widest">Hozircha hech qanday tushum topilmadi</td></tr>
                ) : (
                    <>
                        {payments.map((p) => {
                            const methodMeta = getMethodMeta(p.payment_details?.payment_method, p.payment_details?.payment_method_display);
                            const isCancelled = p.status === 'cancelled';
                            const isDeleted = p.student_name?.includes("O'chirilgan");
                            const dateBadge = formatDateBadge(p.created_at || p.date);
                            const showBadge = dateBadge !== lastDateBadge;
                            if (showBadge) lastDateBadge = dateBadge;

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
                                                <div className={`w-10 h-10 rounded-2xl bg-[var(--bg-void)] border flex items-center justify-center transition-colors ${isDeleted ? 'border-red-500/30 text-red-400' : 'border-[#333] text-[var(--text-muted)] group-hover/row:border-[var(--gold)]/30'}`}>
                                                    <User size={20} strokeWidth={1.5} />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-black capitalize ${isCancelled ? 'text-red-400 line-through' : isDeleted ? 'text-red-500' : 'text-white'}`}>{p.student_name}</p>
                                                    <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-0.5 opacity-70">{p.payment_details?.group_name || 'Guruhsiz'}</p>
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
                                            <div className={`text-[15px] font-black tabular-nums tracking-tight ${isCancelled ? 'text-red-400 line-through' : 'text-white'}`}>{formatCurrency(p.amount)}</div>
                                            {p.payment_details?.refund_amount > 0 && !p.payment_details?.refund_ignored && (
                                                <div className="mt-0.5 text-[9px] font-bold text-emerald-400">Refund: -{formatCurrency(p.payment_details.refund_amount)}</div>
                                            )}
                                            {p.payment_details?.refund_amount > 0 && p.payment_details?.refund_ignored && (
                                                <div className="mt-0.5 text-[9px] font-bold text-amber-400">Refund bekor</div>
                                            )}
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${p.payment_details?.is_verified ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-[var(--gold)] border-white/10'}`}>
                                                    {p.payment_details?.is_verified ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}
                                                </div>
                                                <span className="text-[10px] font-black uppercase text-[var(--text-secondary)]">{p.marked_by_name || "Tizim"}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="text-[10px] font-black text-white">{new Date(p.created_at || p.date).toLocaleDateString('uz-UZ')}</div>
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
                                                    {p.payment_details?.receipt_image && <button onClick={() => onReceipt(p.payment_details.receipt_image)} className="w-9 h-9 flex items-center justify-center bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm active:scale-90"><ImageIcon size={16} /></button>}
                                                    <button onClick={() => onDetail(p)} className="w-9 h-9 flex items-center justify-center bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/20 rounded-xl hover:bg-[var(--gold)] hover:text-black transition-all shadow-sm active:scale-90"><FileText size={16} /></button>
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

    let lastDateBadge = null;

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
                        {withdrawals.map((w) => {
                            const dateBadge = formatDateBadge(w.created_at || w.date);
                            const showBadge = dateBadge !== lastDateBadge;
                            if (showBadge) lastDateBadge = dateBadge;

                            return (
                                <React.Fragment key={w.id}>
                                    {showBadge && (
                                        <tr>
                                            <td colSpan="6" className="py-3 bg-[#0a0a0a]/50 border-y border-[#333]/50">
                                                <div className="flex justify-center">
                                                    <span className="px-4 py-1 rounded-full bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-widest shadow-lg">
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
                                                    <p className="text-sm font-black text-white capitalize">{w.title}</p>
                                                    <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-0.5 opacity-70 truncate max-w-[200px]">{w.description}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-wider">
                                                <CreditCard size={12} />
                                                {w.category === 'owner_withdrawal' ? 'Avans / Pul Olish' : 'Boshqa Chiqim'}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-[15px] font-black text-red-500 tabular-nums tracking-tight">{formatCurrency(w.amount)}</td>
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 text-[var(--gold)]">
                                                    <User size={14} />
                                                </div>
                                                <span className="text-[10px] font-black uppercase text-[var(--text-secondary)]">{w.marked_by_name || "Super Admin"}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="text-[10px] font-black text-white">{w.date}</div>
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

    return (
        <div className="flex items-center justify-between gap-2 p-4 bg-[var(--bg-panel)]/30 border border-[#333] rounded-xl backdrop-blur-md relative overflow-hidden active:scale-[0.98] transition-all">
            <div className="flex-1 min-w-0">
                <h3 className={`text-[13px] font-black capitalize truncate ${isCancelled ? 'text-red-400 line-through' : isDeleted ? 'text-red-500' : 'text-white'}`}>{item.student_name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                    <p className={`text-[13px] font-black tabular-nums ${isCancelled ? 'text-red-400 line-through' : 'text-[var(--gold)]'}`}>{formatCurrency(item.amount)}</p>
                    {item.payment_details?.payment_method_display && (
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${isDeleted ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-white/5 text-white/50 border border-white/10'}`}>
                            {item.payment_details.payment_method_display}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0 px-2">
                <span className="text-[10px] text-white font-black uppercase tracking-widest text-center max-w-[90px] truncate">
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
                            <button onClick={() => onVerify(item.payment_details?.original_payment_id || item.id)} className="w-10 h-10 flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg active:scale-90 transition-all"><CheckCircle2 size={18} /></button>
                        )}
                        {item.payment_details?.receipt_image && (
                            <button onClick={() => onReceipt(item.payment_details.receipt_image)} className="w-10 h-10 flex items-center justify-center bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg active:scale-90 transition-all"><ImageIcon size={18} /></button>
                        )}
                        <button onClick={() => onDetail(item)} className="w-10 h-10 flex items-center justify-center bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/20 rounded-lg active:scale-90 transition-all"><FileText size={18} /></button>
                    </>
                )}
            </div>
        </div>
    );
};

const MobileExpenseCard = ({ item }) => (
    <div className="flex items-center justify-between p-4 bg-[var(--bg-panel)]/30 border border-[#333] rounded-xl backdrop-blur-md relative overflow-hidden active:scale-[0.98] transition-all">
        <div>
            <h3 className="text-[13px] font-black text-white capitalize">{item.title}</h3>
            <p className="text-[13px] font-black tabular-nums mt-0.5 text-red-500">{formatCurrency(item.amount)}</p>
        </div>
        <div className="flex gap-2">
            <div className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                <CheckCircle2 size={10} />
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

    const { ref, inView } = useInView({ threshold: 0 });

    React.useEffect(() => {
        if (inView) {
            loadMore();
        }
    }, [inView, loadMore]);

    const onReceipt = (url) => {
        if (!url) return;
        if (url.startsWith('http')) {
            setReceiptViewerUrl(url);
        } else {
            const rootUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
            const finalUrl = url.startsWith('/') ? `${rootUrl}${url}` : `${rootUrl}/${url}`;
            setReceiptViewerUrl(finalUrl);
        }
    };

    let lastMobileDateBadge = null;

    return (
        <div className="relative">
            {/* Desktop Table View */}
            <div className="hidden lg:block !p-0 rounded-2xl overflow-hidden border border-[#333] shadow-xl bg-[var(--bg-panel)]/20 backdrop-blur-md">
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
                        {data.map((item) => {
                            const dateBadge = formatDateBadge(item.created_at || item.date);
                            const showBadge = dateBadge !== lastMobileDateBadge;
                            if (showBadge) lastMobileDateBadge = dateBadge;

                            return (
                                <React.Fragment key={item.id}>
                                    {showBadge && (
                                        <div className="flex justify-center my-6">
                                            <span className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-widest shadow-lg">
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
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setReceiptViewerUrl(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setReceiptViewerUrl(null)}
                            className="absolute -top-12 right-0 md:-right-12 w-10 h-10 flex items-center justify-center bg-white/10 text-white rounded-full hover:bg-white/20 transition-all border border-white/20"
                        >
                            ✕
                        </button>
                        <img
                            src={receiptViewerUrl}
                            alt="Chek rasmi"
                            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-white/10"
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default KassaContent;
