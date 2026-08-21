import React from "react";
import { User, MapPin, CreditCard, Calendar } from "lucide-react";

const InfoItem = ({ icon, label, value, color = "" }) => (
    <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
            {icon}
            <span className="font-bold capitalize tracking-tighter text-[9px]">{label}</span>
        </div>
        <span className={`font-black truncate max-w-[120px] ${color || 'text-[var(--text-secondary)]'}`}>{value}</span>
    </div>
);

const PaymentSidebar = ({ data, isPercentageType, isStudentCountType, formatCurrency }) => {
    return (
        <div className="lg:col-span-3 space-y-4">
            <div className="bg-[var(--bg-panel)] border border-[#2a2a2a] p-5 rounded-2xl relative overflow-hidden text-center shadow-xl shadow-black/20">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-50" />

                <div className="w-20 h-20 bg-gradient-to-br from-[var(--bg-void)] to-[var(--bg-panel)] border border-[#2a2a2a] rounded-2xl mx-auto mb-4 flex items-center justify-center text-[var(--gold)] shadow-inner">
                    <User size={36} />
                </div>

                <h2 className="text-base font-black text-[var(--text-primary)] tracking-tight mb-1 capitalize">
                    {data.employee_first_name} {data.employee_last_name}
                </h2>
                <p className="text-[10px] font-bold text-[var(--text-muted)] capitalize tracking-[0.2em] mb-4">
                    {data.employee_role}
                </p>

                <div className="space-y-2 pt-4 border-t border-[#2a2a2a]">
                    <div className="flex justify-between items-center px-1">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black capitalize tracking-widest ${data.is_paid ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                            {data.is_paid ? "To'langan" : "Kutilmoqda"}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black capitalize tracking-widest">
                            ID: #{data.employee_id}
                        </span>
                    </div>
                </div>
            </div>

            <div className="bg-[var(--bg-panel)] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-lg p-4 space-y-4">
                <div className="pb-3 border-b border-[#2a2a2a]">
                    <h4 className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3">Tizim malumotlari</h4>
                    <div className="space-y-3">
                        <InfoItem icon={<MapPin size={12} />} label="Filial" value={`${data.employee_branch}-filial`} />
                        <InfoItem icon={<CreditCard size={12} />} label="Karta" value={data.karta || "Yo'q"} color={data.karta ? "text-[var(--gold)]" : ""} />
                        <InfoItem icon={<Calendar size={12} />} label="Davr" value={data.month} />
                    </div>
                </div>

                <div>
                    <h4 className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3">Maosh Sharti</h4>
                    <div className="p-3 rounded-xl bg-[var(--bg-void)]/40 border border-[#2a2a2a]">
                        <p className="text-[11px] font-black text-[var(--text-primary)] tabular-nums mb-1">
                            {isPercentageType
                                ? `${data.commission_percentage}% (KPI)`
                                : isStudentCountType
                                    ? `${formatCurrency(data.per_student_amount || 0)}/st`
                                    : formatCurrency(data.salary_base)}
                        </p>
                        <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-tighter">
                            {isPercentageType ? "Aylanmadan ulush" : isStudentCountType ? "O'quvchi boshiga" : "Fiksiyalangan miqdor"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentSidebar;
