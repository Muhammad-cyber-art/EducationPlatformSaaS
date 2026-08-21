import React, { useState } from "react";
import { Receipt, Users, TrendingUp, PlusCircle, MinusCircle, CalendarDays, CheckCircle2, UserCheck } from "lucide-react";

const PaymentStats = ({
    data,
    isPercentageType,
    isStudentCountType,
    formatCurrency,
    studentCountSummary,
    finalTotalAmount,
    isSuperAdmin,
    kpiLoading
}) => {

    // KPI kartalar uchun skeleton
    const KpiSkeleton = () => (
        <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[#2a2a2a] shadow-lg animate-pulse">
            <div className="h-3 w-20 bg-[#2a2a2a] rounded mb-3" />
            <div className="h-7 w-32 bg-[#2a2a2a] rounded mb-2" />
            <div className="h-2 w-24 bg-[#2a2a2a] rounded" />
        </div>
    );

    return (
        <div className={`grid gap-4 ${isPercentageType || isStudentCountType ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
            {isPercentageType ? (
                <>
                    {/* Asl Tushum va Komissiya */}
                    {kpiLoading ? <KpiSkeleton /> : (
                    <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border shadow-lg border-emerald-500/20 shadow-emerald-500/5">
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-black text-emerald-500 capitalize tracking-widest flex items-center gap-2">
                                <Receipt size={12} /> Asl KPI
                            </p>
                        </div>
                        <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums mb-1">
                            {formatCurrency(data.calculated_commission || 0)}
                        </h3>
                        <div className="flex items-center justify-between">
                            <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-widest">Hisoblandi</p>
                            <p className="text-[8px] font-bold text-emerald-500 capitalize tabular-nums">{formatCurrency(data.groups_income)} tushum</p>
                        </div>
                        <p className="text-[7px] font-medium text-[var(--text-muted)]/80 mt-1.5 leading-snug">
                            To'lov − refund + qo'shimcha; o'quvchi qoldirishlari hisobga olinmaydi
                        </p>
                    </div>
                    )}

                    {kpiLoading ? <KpiSkeleton /> : (
                    <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-amber-500/20 shadow-lg shadow-amber-500/5">
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-black text-amber-400 capitalize tracking-widest flex items-center gap-2">
                                <TrendingUp size={12} /> Kutilayotgan KPI
                            </p>
                        </div>
                        <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums mb-1">
                            {formatCurrency(data.calculated_commission_expected || 0)}
                        </h3>
                        <div className="flex items-center justify-between">
                            <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-widest">Barcha statuslar</p>
                            <p className="text-[8px] font-bold text-amber-400 capitalize tabular-nums">{formatCurrency(data.groups_income_expected || 0)} tushum</p>
                        </div>
                        <p className="text-[7px] font-medium text-[var(--text-muted)]/80 mt-1.5 leading-snug">
                            Barcha o'quvchilarning shartnoma summasidan hisoblangan taxminiy komissiya
                        </p>
                    </div>
                    )}
                </>
            ) : isStudentCountType ? (
                kpiLoading ? <KpiSkeleton /> : (
                <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-blue-500/20 shadow-lg shadow-blue-500/5">
                    <p className="text-[10px] font-black text-blue-400 capitalize tracking-widest mb-1.5 flex items-center gap-2">
                        <Users size={12} /> KPI Maosh
                    </p>
                    <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums mb-1">
                        {formatCurrency(data.calculated_per_student || data.salary_base || 0)}
                    </h3>
                    <div className="flex items-center justify-between">
                        <p className="text-[8px] font-bold text-blue-400/60 capitalize tracking-widest">{studentCountSummary.paidStudents} / {studentCountSummary.totalStudents} st.</p>
                        <p className="text-[8px] font-black text-blue-500 capitalize tabular-nums">-{formatCurrency(studentCountSummary.mentorShareExpected)} max</p>
                    </div>
                </div>
                )
            ) : (
                <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[#2a2a2a] shadow-lg">
                    <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5">
                        Asosiy Maosh
                    </p>
                    <h3 className="text-xl font-black text-[var(--text-primary)] tabular-nums">
                        {formatCurrency(data.salary_base)}
                    </h3>
                </div>
            )}

            {/* 2. POTENTIAL REVENUE */}
            {isStudentCountType ? (
                <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[#2a2a2a] shadow-lg">
                    <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 flex items-center gap-2">
                        <TrendingUp size={12} className="text-amber-500" /> Tahminiy Tushum
                    </p>
                    <h3 className="text-xl font-black text-amber-500 tabular-nums mb-1">
                        {formatCurrency(studentCountSummary.expectedIncome)}
                    </h3>
                    <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-widest">Real: {formatCurrency(studentCountSummary.paidIncome)}</p>
                </div>
            ) : (
                (data.bonus > 0 || data.deductions > 0) && (
                    <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[#2a2a2a]">
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest">Qo'shimcha</p>
                            <div className="flex gap-1">
                                <PlusCircle size={10} className="text-emerald-500" />
                                <MinusCircle size={10} className="text-rose-500" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            {data.bonus > 0 && <span className="text-emerald-500 text-[11px] font-black">+{formatCurrency(data.bonus)}</span>}
                            {data.deductions > 0 && <span className="text-rose-500 text-[11px] font-black">-{formatCurrency(data.deductions)}</span>}
                        </div>
                    </div>
                )
            )}

            {/* 3. AVANS KARTASI */}
            {data.total_advances > 0 ? (
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 shadow-lg shadow-rose-900/5">
                    <p className="text-[10px] font-black text-rose-500 capitalize tracking-widest mb-1.5">
                        Avanslar
                    </p>
                    <h3 className="text-xl font-black text-rose-400 tabular-nums">
                        -{formatCurrency(data.total_advances)}
                    </h3>
                </div>
            ) : (
                isStudentCountType && (data.bonus > 0 || data.deductions > 0) ? (
                    <div className="p-4 rounded-2xl bg-[var(--bg-panel)] border border-[#2a2a2a]">
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest">Qo'shimcha</p>
                            <div className="flex gap-1">
                                <PlusCircle size={10} className="text-emerald-500" />
                                <MinusCircle size={10} className="text-rose-500" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            {data.bonus > 0 && <span className="text-emerald-500 text-[11px] font-black">+{formatCurrency(data.bonus)}</span>}
                            {data.deductions > 0 && <span className="text-rose-500 text-[11px] font-black">-{formatCurrency(data.deductions)}</span>}
                        </div>
                    </div>
                ) : <div className="hidden md:block" />
            )}

            {/* 4. YAKUNIY TO'LOV */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[var(--gold)]/20 to-[var(--bg-panel)] border-2 border-[var(--gold)]/30 shadow-2xl shadow-[var(--gold)]/10 flex flex-col justify-center">
                <div className="text-[10px] font-black text-[var(--gold)] capitalize tracking-[0.2em] mb-1 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse shadow-[0_0_8px_var(--gold)]" />
                    Yakuniy To'lov
                </div>
                {kpiLoading && (isPercentageType || isStudentCountType) ? (
                    <div className="h-8 w-36 bg-[var(--gold)]/20 rounded animate-pulse" />
                ) : (
                    <h3 className="text-2xl font-black text-[var(--text-primary)] tabular-nums tracking-tighter">
                        {formatCurrency(finalTotalAmount)}
                    </h3>
                )}
            </div>
        </div>
    );
};

export default PaymentStats;
