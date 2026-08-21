import React from "react";
import { History, Trash2, Bookmark, CheckCircle, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DetailRow = ({ label, value }) => (
    <div className="flex items-center justify-between py-0.5">
        <span className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest">{label}</span>
        <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-tight">{value}</span>
    </div>
);

const PaymentHistory = ({
    data,
    staff_id,
    formatCurrency,
    isSuperAdmin,
    handleDeleteHistory,
    dispatch,
    setPayModal,
    setSelectedHistoryItem
}) => {
    const navigate = useNavigate();

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-lg">
                <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center justify-between bg-[var(--bg-void)]/30">
                    <div className="flex items-center gap-2">
                        <History size={14} className="text-[var(--gold)]" />
                        <span className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">To'lov Tarixi</span>
                    </div>
                </div>

                <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <tbody className="divide-y divide-[#2a2a2a]">
                            {data.payment_history?.map((item) => {
                                const isActive = parseInt(staff_id) === item.id;
                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => !isActive && navigate(`/super_admin/all-payments/staff_payments/staff/${item.id}`)}
                                        className={`hover:bg-[var(--gold-dim)] transition-colors group cursor-pointer ${isActive ? 'bg-[var(--gold)]/5' : ''}`}
                                    >
                                        <td className="px-5 py-3">
                                            <p className="text-[10px] font-black text-[var(--text-primary)]">{item.month}</p>
                                            <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize">{item.is_paid ? "To'langan" : "Kutilmoqda"}</p>
                                        </td>
                                        <td className="px-5 py-3 text-[11px] font-black text-[var(--text-primary)] tabular-nums text-right flex items-center justify-end gap-3">
                                            <span>{formatCurrency(item.total_amount || item.amount || item.salary_base)}</span>

                                            <div className="flex items-center gap-1">
                                                {!item.is_paid && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            dispatch(setSelectedHistoryItem(item));
                                                            dispatch(setPayModal(true));
                                                        }}
                                                        className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="To'lovni amalga oshirish"
                                                    >
                                                        <DollarSign size={12} />
                                                    </button>
                                                )}

                                                {isSuperAdmin && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteHistory(item.id);
                                                        }}
                                                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="O'chirish"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-lg p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Bookmark size={14} className="text-[var(--gold)]" />
                        <span className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">Hisob Tafsiloti</span>
                    </div>
                    {isSuperAdmin && data.id && (
                        <button onClick={() => handleDeleteHistory(data.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg translate-x-2" title="Joriy oyni o'chirish">
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>

                <div className="space-y-3 mb-6">
                    <DetailRow label="Hisoblangan oy" value={data.month} />
                    <DetailRow label="Tasdiqlangan sana" value={data.paid_at ? new Date(data.paid_at).toLocaleDateString() : "---"} />
                    <DetailRow label="Tasdiqlovchi" value={data.marked_by_name || data.marked_by || "---"} />
                </div>

                {!data.is_paid ? (
                    <button onClick={() => dispatch(setPayModal(true))} className="w-full py-3.5 rounded-xl bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-black text-[10px] capitalize tracking-widest flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(184,134,11,0.2)] transition-all active:scale-[0.98]">
                        To'lovni tasdiqlash
                    </button>
                ) : (
                    <div className="w-full py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-black text-[10px] capitalize tracking-widest flex items-center justify-center gap-2">
                        <CheckCircle size={14} /> To'lov yakunlangan
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentHistory;
