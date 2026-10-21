import React from "react";
import { X, FileText, CheckCircle2, Image as ImageIcon, BookOpen, Calendar, Clock, AlertCircle, Award } from "lucide-react";
import { formatCurrency } from "./useKassa";

const formatMonthName = (monthStr) => {
    if (!monthStr) return "";
    const parts = monthStr.split("-");
    if (parts.length < 2) return monthStr;
    const year = parts[0];
    const month = parts[1];
    const monthNames = [
        "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
        "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"
    ];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
        return `${monthNames[mIdx]} ${year}`;
    }
    return monthStr;
};

const parsePaymentDetails = (payment) => {
    const rawNote = (payment.notes || payment.payment_details?.notes || payment.description || "").trim();
    const details = payment.payment_details || {};
    const attInfo = details.attendance_info;

    // 1. Guruh nomi
    let groupName = details.group_name || attInfo?.group_name || payment.group_name;
    if (!groupName || groupName === "Guruhsiz") {
        const groupMatch = rawNote.match(/guruh:\s*([^|\n]+)/i);
        if (groupMatch) {
            groupName = groupMatch[1].trim();
        }
    }
    if (!groupName) groupName = "Guruhsiz";

    // 2. O'quv davri (Oy)
    let month = details.month || attInfo?.month;
    if (!month) {
        const monthMatch = rawNote.match(/(?:davr|oy):\s*(\d{4}-\d{2})/i) || rawNote.match(/\b(20\d{2}-(?:0[1-9]|1[0-2]))\b/);
        month = monthMatch ? monthMatch[1] : null;
    }

    // 3. Aniq davomat ko'rsatkichi
    let presentCount = attInfo?.present_count;
    let totalLessons = attInfo?.total_lessons ?? attInfo?.group_total_lessons;
    let groupTotalLessons = attInfo?.group_total_lessons;
    let attendanceStr = attInfo?.attendance_str;

    if (attendanceStr === undefined || attendanceStr === null) {
        const match = rawNote.match(/davomat:\s*(\d+)\s*\/\s*(\d+)(?:\s*dars)?/i);
        if (match) {
            presentCount = parseInt(match[1], 10);
            totalLessons = parseInt(match[2], 10);
            attendanceStr = `${presentCount}/${totalLessons} dars`;
        }
    }

    // 4. Admin kiritgan maxsus izoh
    let customNote = rawNote
        .replace(/guruh:\s*[^|\n]+(?:\||$)/gi, '')
        .replace(/(?:davr|oy):\s*\d{4}-\d{2}(?:\||$)/gi, '')
        .replace(/davomat:\s*\d+\s*\/\s*\d+(?:\s*dars)?(?:\s*\([^)]*\))?(?:\||$)/gi, '')
        .replace(/bo'lib to'lov(?:\||$)/gi, '')
        .replace(/custom to'lov(?:\||$)/gi, '')
        .replace(/cheksiz(?:\s*to'lov)?(?:\||$)/gi, '')
        .replace(/\|+/g, ' ')
        .trim();

    if (customNote.startsWith(groupName) || customNote.includes("UZS. Usul:") || customNote === groupName) {
        customNote = "";
    }

    return {
        groupName,
        month,
        attendanceStr,
        presentCount,
        totalLessons,
        groupTotalLessons,
        customNote: customNote.length > 0 ? customNote : null
    };
};

const DetailModal = ({ show, payment, onClose, onVerify, isSuperAdmin }) => {
    const [showReceiptPreview, setShowReceiptPreview] = React.useState(false);
    if (!show || !payment) return null;

    const receiptUrl = payment.payment_details?.receipt_image;
    const parsed = parsePaymentDetails(payment);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-xl bg-[var(--bg-panel)] border border-[var(--gold)]/20 rounded-2xl shadow-2xl overflow-hidden animate-lux-pop">
                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-[var(--gold)]/10 flex items-center justify-between bg-gradient-to-r from-[var(--gold)]/10 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[var(--gold-dim)] flex items-center justify-center text-[var(--gold)] border border-[var(--gold)]/20 shadow-inner">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-[var(--text-color)] tracking-tight">To'lov Tafsilotlari</h2>
                            <p className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.3em]">ID: STP-{payment.id}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 flex items-center justify-center bg-[var(--bg-void)] border border-[var(--gold)]/20 text-[var(--text-muted)] hover:text-[var(--text-color)] hover:border-[var(--gold)] rounded-xl transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 sm:p-8 space-y-5 text-[var(--text-color)] max-h-[75vh] overflow-y-auto">
                    {/* Basic Grid Info */}
                    <div className="grid grid-cols-2 gap-4 sm:gap-6 font-bold text-sm bg-[var(--bg-void)]/40 p-4 rounded-xl border border-white/5">
                        <div>
                            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">O'quvchi</p>
                            <span className={payment.status === 'cancelled' ? 'line-through text-red-400' : payment.student_name?.includes("O'chirilgan") ? 'text-red-500 font-black' : ''}>
                                {payment.student_name}
                            </span>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Guruh</p>
                            <span className="text-[var(--gold)] font-black">{parsed.groupName}</span>
                        </div>
                        <div>
                            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">To'lov Oyi (Davr)</p>
                            <span className="text-[var(--text-color)] font-extrabold flex items-center gap-1.5">
                                <Calendar size={13} className="text-[var(--gold)]" />
                                {formatMonthName(parsed.month) || parsed.month || "Joriy oy"}
                            </span>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">To'langan Summa</p>
                            <span className={`text-emerald-400 font-black ${payment.status === 'cancelled' ? 'line-through text-red-400' : ''}`}>
                                {formatCurrency(payment.amount)}
                            </span>
                        </div>
                        <div>
                            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Metod</p>
                            <span className={payment.student_name?.includes("O'chirilgan") && payment.status !== 'cancelled' ? 'bg-red-500/10 text-red-500 border border-red-500/30 px-2 py-1 rounded-lg text-xs uppercase' : ''}>
                                {payment.payment_details?.payment_method_display || payment.payment_details?.payment_method || (payment.payment_details ? "Click / Card" : "Noma'lum")}
                            </span>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Qabul qildi</p>
                            <span className="text-[var(--text-color)]">{payment.marked_by_name || "Tizim"}</span>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(payment.created_at || payment.date).toLocaleDateString('uz-UZ')} {new Date(payment.created_at || payment.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {payment.payment_details?.is_verified && (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <CheckCircle2 size={13} />
                                    Tasdiqlangan
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Bekor qilingan xabarnomasi */}
                    {payment.status === 'cancelled' && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <p className="text-[9px] text-red-400 uppercase tracking-widest mb-1">Bekor qilingan</p>
                            <p className="text-sm font-black text-red-400">
                                {payment.cancelled_by_name || 'Noma\'lum'} tomonidan bekor qilingan
                                {payment.cancelled_at && ` (${new Date(payment.cancelled_at).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })})`}
                            </p>
                        </div>
                    )}

                    {/* To'lov Cheki bloki */}
                    {receiptUrl && (
                        <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2.5 text-blue-400">
                                <ImageIcon size={18} />
                                <div>
                                    <span className="text-xs font-bold block">To'lov cheki mavjud</span>
                                    <span className="text-[10px] text-blue-400/70">Kvitansiya tasdiqlash uchun yuklangan</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowReceiptPreview(true)}
                                    className="px-3.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    <span>Chekni ko'rish</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.open(receiptUrl, '_blank')}
                                    className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-all"
                                    title="Yangi oynada ochish"
                                >
                                    ↗
                                </button>
                            </div>
                        </div>
                    )}

                    {payment.payment_details?.is_receiptless && !receiptUrl && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2 text-amber-400">
                                <FileText size={18} />
                                <span className="text-xs font-bold">Cheksiz to'lov (Kvitansiyasiz)</span>
                            </div>
                            <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider">Chek yuklanmagan</span>
                        </div>
                    )}

                    {/* Refund bloki */}
                    {payment.payment_details?.refund_amount > 0 && !payment.payment_details?.refund_ignored && (
                        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-[9px] text-emerald-500 uppercase tracking-widest mb-1">Refund (Qaytarilgan)</p>
                                    <p className="text-lg font-black text-emerald-500">-{formatCurrency(payment.payment_details.refund_amount)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest mb-1">Oylik to'lov</p>
                                    <p className="text-sm font-bold text-[var(--text-color)]">{formatCurrency(Number(payment.amount) + Number(payment.payment_details.refund_amount))}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {payment.payment_details?.refund_amount > 0 && payment.payment_details?.refund_ignored && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <p className="text-[9px] text-amber-400 uppercase tracking-widest mb-1">Refund Status</p>
                            <p className="text-sm font-black text-amber-400">Refund bekor qilingan (Hisoblanmadi)</p>
                        </div>
                    )}

                    {/* ================= GURUH VA ANIQ DAVOMAT BLOKI ================= */}
                    <div className="p-4 sm:p-5 bg-gradient-to-br from-[var(--gold)]/10 via-[var(--bg-void)] to-[var(--gold)]/5 border border-[var(--gold)]/30 rounded-2xl space-y-3.5 shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--gold)]/15 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/25 flex items-center justify-center shrink-0">
                                    <BookOpen size={18} />
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase font-black text-[var(--gold)] tracking-widest">Biriktirilgan Guruh va O'quv Davri</p>
                                    <p className="text-base font-black text-[var(--text-color)]">
                                        {parsed.groupName}{" "}
                                        <span className="text-xs font-bold text-[var(--gold)]">
                                            ({formatMonthName(parsed.month) || parsed.month || "Joriy oy"})
                                        </span>
                                    </p>
                                </div>
                            </div>
                            {parsed.attendanceStr && (
                                <div className="self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black tracking-wide flex items-center gap-1.5 shadow-sm">
                                    <CheckCircle2 size={14} />
                                    <span>Davomat: {parsed.attendanceStr}</span>
                                </div>
                            )}
                        </div>

                        {/* Aniq davomat ko'rsatkichlari */}
                        <div className="grid grid-cols-3 gap-2.5">
                            <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--gold)]/15 text-center">
                                <p className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] font-black">Kelgan darslar</p>
                                <p className="text-lg font-black text-emerald-400 mt-0.5">
                                    {parsed.presentCount ?? 0} ta
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--gold)]/15 text-center">
                                <p className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] font-black">Rejadagi darslar</p>
                                <p className="text-lg font-black text-[var(--gold)] mt-0.5">
                                    {parsed.totalLessons ?? 0} ta
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--gold)]/15 text-center">
                                <p className="text-[8px] uppercase tracking-wider text-[var(--text-muted)] font-black">Davomat foizi</p>
                                <p className="text-lg font-black text-white mt-0.5">
                                    {parsed.totalLessons > 0 ? `${Math.round(((parsed.presentCount || 0) / parsed.totalLessons) * 100)}%` : "0%"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ================= TO'LOV IZOHI BLOKI ================= */}
                    <div className="p-4 sm:p-5 bg-[var(--bg-panel)] border border-[var(--gold)]/20 rounded-2xl space-y-2 shadow-md">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] text-[var(--gold)] uppercase font-black tracking-widest flex items-center gap-1.5">
                                <FileText size={13} />
                                To'lov izohi
                            </p>
                            {parsed.customNote && (
                                <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                                    Admin tomonidan kiritilgan
                                </span>
                            )}
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--bg-void)]/60 border border-white/5 text-xs text-[var(--text-color)] font-medium leading-relaxed whitespace-pre-wrap">
                            {parsed.customNote ? (
                                <div className="space-y-1.5">
                                    <p className="font-semibold text-white">{parsed.customNote}</p>
                                    <p className="text-[10px] text-[var(--text-muted)] pt-1 border-t border-white/5">
                                        Guruh: <strong className="text-[var(--gold)]">{parsed.groupName}</strong> | Davr: <strong className="text-[var(--text-color)]">{formatMonthName(parsed.month) || parsed.month}</strong> | Davomat: <strong className="text-emerald-400">{parsed.attendanceStr || "Ko'rsatilmagan"}</strong>
                                    </p>
                                </div>
                            ) : (
                                <p className="text-[var(--text-muted)]">
                                    Guruh: <strong className="text-[var(--gold)] font-bold">{parsed.groupName}</strong> &bull; Davr: <strong className="text-[var(--text-color)] font-bold">{formatMonthName(parsed.month) || parsed.month}</strong> &bull; Davomat: <strong className="text-emerald-400 font-bold">{parsed.attendanceStr || "Ko'rsatilmagan"}</strong>
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-[var(--bg-void)] border-t border-[var(--gold)]/10 flex gap-3">
                    {isSuperAdmin && !payment.payment_details?.is_verified && (
                        <button 
                            onClick={() => onVerify(payment.payment_details?.original_payment_id || payment.id)} 
                            className="flex-1 h-12 bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-emerald-500 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 size={16} />
                            Tasdiqlash
                        </button>
                    )}
                    <button 
                        onClick={onClose} 
                        className="flex-1 h-12 bg-[var(--bg-panel)] text-[var(--text-color)] font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-[var(--gold-dim)] transition-all border border-[var(--gold)]/20 hover:border-[var(--gold)]"
                    >
                        Yopish
                    </button>
                </div>
            </div>

            {/* Chek preview modal */}
            {showReceiptPreview && receiptUrl && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150" onClick={() => setShowReceiptPreview(false)}>
                    <div className="relative max-w-3xl max-h-[90vh] w-full flex flex-col items-center justify-center overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="w-full flex items-center justify-between pb-3 text-white">
                            <span className="text-sm font-bold flex items-center gap-2">
                                <ImageIcon size={18} className="text-[var(--gold)]" />
                                To'lov cheki &bull; <span className="text-[var(--gold)]">{parsed.groupName}</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <a
                                    href={receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors border border-white/10 flex items-center gap-1.5"
                                >
                                    <span>Yangi oynada ochish</span>
                                </a>
                                <button
                                    onClick={() => setShowReceiptPreview(false)}
                                    className="w-8 h-8 flex items-center justify-center bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all border border-white/10"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="w-full flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-2">
                            <img
                                src={receiptUrl}
                                alt="Chek rasmi"
                                className="max-w-full max-h-[55vh] object-contain rounded-xl shadow-2xl"
                            />
                        </div>

                        {/* Guruh va Davomat ma'lumotlari chek modalida */}
                        <div className="w-full mt-3 p-4 bg-[var(--bg-panel)] border border-[var(--gold)]/20 rounded-xl text-left space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-[var(--gold)] tracking-widest flex items-center gap-1.5">
                                    <BookOpen size={13} />
                                    Guruh va Davomat:
                                </span>
                                {parsed.attendanceStr && (
                                    <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                        Davomat: {parsed.attendanceStr}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-white font-medium leading-relaxed">
                                Guruh: <strong className="text-[var(--gold)]">{parsed.groupName}</strong> &bull; Davr: <strong>{formatMonthName(parsed.month) || parsed.month}</strong>
                            </p>
                            {parsed.customNote && (
                                <p className="text-xs text-[var(--text-muted)] pt-1.5 border-t border-white/10">
                                    Izoh: <span className="text-white font-medium">{parsed.customNote}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DetailModal;
