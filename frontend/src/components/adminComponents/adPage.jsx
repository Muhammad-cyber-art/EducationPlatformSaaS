import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import {
    Users, Briefcase,
    TrendingUp, Wallet,
    Activity, ArrowUpRight, ArrowLeft, Download, User, ChevronRight,
    ShieldCheck, Layers, MessageSquare, Heart, UserCheck as UserCheckIcon, Loader2
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useCurrentBranch } from "../Authorized/useBranchId";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Globe } from "lucide-react";
import AbsentStudentsModal from "../Common/AbsentStudentsModal";

const StatBox = ({ label, value, icon: Icon, onClick, isClickable, actionButton }) => (
    <div
        className={`lux-card ${isClickable ? 'cursor-pointer hover:border-red-500/50 transition-all' : ''}`}
        style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '120px', position: 'relative' }}
        onClick={onClick}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <Icon size={20} color={isClickable ? "var(--red-500, #ef4444)" : "var(--gold)"} strokeWidth={2} />
            {actionButton && (
                <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
                    {actionButton}
                </div>
            )}
        </div>
        <div className="flex flex-col justify-end flex-1">
            <div className="lux-value" style={{ color: isClickable ? '#ef4444' : 'var(--text-primary)', fontSize: '24px', lineHeight: '1' }}>{value}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '8px', letterSpacing: '1px', fontWeight: '800', textTransform: 'capitalize' }}>{label}</div>
        </div>
    </div>
);

export default function AdminPageFirst() {
    const { data: userData = {} } = useQuery({
        queryKey: ['user-me'],
        queryFn: () => api.get('/user/me/').then(res => res.data),
        staleTime: Infinity,
    });

    const { currentBranchId } = useCurrentBranch();
    const perms = userData.permissions || {};
    const isSuperAdmin = userData.role === 'super_admin';
    const hasFinancePerm = perms.finance === true || isSuperAdmin;
    const canDownloadReports = perms.reports === true || isSuperAdmin;

    const { data: branchData, isLoading: financeLoading, isError: isFinanceError } = useQuery({
        queryKey: ['branch-finance', currentBranchId],
        queryFn: () => api.get(`/finance/statistics/branch-finance/${currentBranchId}/`).then(res => res.data),
        enabled: !!currentBranchId,
        staleTime: 1000 * 60 * 5,
    });

    const { data: botStats } = useQuery({
        queryKey: ['bot-stats', currentBranchId],
        queryFn: () => api.get(`/bot/statistics/?branch_id=${currentBranchId}`).then(res => res.data),
        enabled: !!currentBranchId,
        staleTime: 1000 * 60 * 5,
    });

    const [selectedGroup, setSelectedGroup] = useState(null);
    const [showAbsentModal, setShowAbsentModal] = useState(false);
    const [downloadingBotList, setDownloadingBotList] = useState(false);

    const handleDownloadBotUnregistered = async (e) => {
        e.stopPropagation();
        try {
            setDownloadingBotList(true);
            const response = await api.get('/bot/export-unregistered-students/', {
                params: { branch_id: currentBranchId },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'botdan_otmaganlar.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Excel yuklandi.");
        } catch (err) {
            toast.error("Xatolik yuz berdi.");
        } finally {
            setDownloadingBotList(false);
        }
    };

    useEffect(() => {
        if (isFinanceError && hasFinancePerm) {
            toast.error("Ma'lumotlarni sinxronlashda xatolik.");
        }
    }, [isFinanceError, hasFinancePerm]);

    const stats = branchData?.stats;
    const finance = branchData?.finance;
    const groups = branchData?.groups;

    return (
        <div className="animate-lux-fade">
            {/* Title Section */}
            <div style={{ marginBottom: '40px', display: 'flex', flexDirection: 'column', mdDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                <div>
                    <h1 className="gold-text">Umumiy ko'rsatkichlar</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '14px' }}>Hozirgi filial bo'yicha real vaqtdagi ma'lumotlar.</p>
                </div>

            </div>

            {/* Top Stats Grid - Unified 5-column responsive layout */}
            <div className="lux-grid-5" style={{ marginBottom: '32px' }}>
                <StatBox label="FAOAL O'QUVCHILAR" value={stats?.students || 0} icon={Users} />
                <StatBox label="STRATEGIK GURUHLAR" value={stats?.groups || 0} icon={Layers} />
                <StatBox label="ELITA O'QITUVCHILAR" value={stats?.mentors || 0} icon={Briefcase} />
                <StatBox
                    label="BUGUNGI KELMAGANLAR"
                    value={stats?.attendance_today?.absent || 0}
                    icon={Activity}
                    isClickable={true}
                    onClick={() => setShowAbsentModal(true)}
                />
                <StatBox
                    label="BOT JAMI ULANMALAR"
                    value={botStats?.total_bot_users || 0}
                    icon={MessageSquare}
                    actionButton={
                        <button
                            onClick={handleDownloadBotUnregistered}
                            disabled={downloadingBotList}
                            className="p-1 px-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                            title="Ro'yxatdan o'tmaganlarni yuklash"
                        >
                            <div className="flex items-center gap-1.5">
                                {downloadingBotList ? <Loader2 size={10} className="animate-spin" /> : <Download size={12} />}
                                <span className="text-[8px] font-black capitalize tracking-tighter">Export</span>
                            </div>
                        </button>
                    }
                />
            </div>

            {/* Main Content - Two Column Balanced Grid */}
            <div className="lux-grid-main">
                {/* Left Column: Top Performers / Group List */}
                <div className="lux-card" style={{ minHeight: '460px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {selectedGroup && (
                                <button
                                    onClick={() => setSelectedGroup(null)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--gold)', cursor: 'pointer', padding: 0, display: 'flex' }}
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            )}
                            <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>
                                {selectedGroup ? 'Guruh tafsilotlari' : 'Eng yaxshi ko\'rsatkichli guruhlar'}
                            </h2>
                        </div>
                        <span className="text-[9px] font-black text-[var(--gold)] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/20">
                            {groups?.length || 0} ta guruh
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                        {!selectedGroup ? (
                            <div className="space-y-5">
                                {groups?.length > 0 ? (
                                    groups.slice(0, 7).map((group, i) => {
                                        const totalIncome = finance?.received_income || 1;
                                        const percentage = Math.min((group.received_income / totalIncome) * 100, 100);
                                        return (
                                            <div
                                                key={i}
                                                style={{ cursor: 'pointer' }}
                                                className="group p-2 rounded-xl hover:bg-[var(--bg-panel)] transition-all"
                                                onClick={() => setSelectedGroup(group)}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }} className="group-hover:text-[var(--gold)] transition-colors">
                                                        {group.name}
                                                    </span>
                                                    <span style={{ color: 'var(--gold)', fontWeight: '700' }}>
                                                        {(group.received_income / 1000).toLocaleString()} k UZS
                                                    </span>
                                                </div>
                                                <div style={{ width: '100%', height: '5px', background: 'var(--bg-void)', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div
                                                        style={{
                                                            width: `${percentage}%`,
                                                            height: '100%',
                                                            background: 'linear-gradient(90deg, var(--gold) 0%, #eab308 100%)',
                                                            transition: 'width 0.5s ease'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-16 text-center text-[var(--text-secondary)] text-sm">
                                        Guruhlar mavjud emas
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                <div style={{ padding: '20px', background: 'var(--gold-dim)', borderRadius: '16px', border: '1px solid rgba(184,134,11,0.2)' }}>
                                    <p style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: '800', textTransform: 'capitalize', marginBottom: '4px' }}>O'qituvchi</p>
                                    <p style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{selectedGroup.mentor || 'Noma\'lum'}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--bg-void)', border: '1px solid var(--border-glass)' }}>
                                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'capitalize', marginBottom: '6px' }}>O'quvchilar</p>
                                        <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{selectedGroup.student_count}</p>
                                    </div>
                                    <div style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--bg-void)', border: '1px solid var(--border-glass)' }}>
                                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'capitalize', marginBottom: '6px' }}>Tushum</p>
                                        <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--gold)' }}>{(selectedGroup.received_income / 1000).toLocaleString()} k</p>
                                    </div>
                                </div>
                                <NavLink
                                    to={`/admin/groups/${selectedGroup.id}`}
                                    className="lux-btn lux-btn-primary"
                                    style={{ width: '100%', height: '46px' }}
                                >
                                    To'liq tahlil <ChevronRight size={16} />
                                </NavLink>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-glass)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Filial ma'lumotlar sinxronligi</span>
                            <span style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: '700' }}>● Real vaqtda</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Financial Overview & Quick Action Hub */}
                <div className="lux-card" style={{ minHeight: '460px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>
                            Filial moliyaviy salohiyati
                        </h2>
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            Joriy oy
                        </span>
                    </div>

                    {/* Collection Rate & Progress */}
                    <div className="p-4 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] mb-6">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider">Tushgan Tushum</p>
                                <p className="text-xl font-black text-[var(--text-primary)] mt-1">
                                    {Number(finance?.received_income || 0).toLocaleString()} <span className="text-xs font-bold text-[var(--gold)]">UZS</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-black text-emerald-400">
                                    {finance?.expected_income ? Math.round((Number(finance.received_income || 0) / Number(finance.expected_income)) * 100) : 0}%
                                </span>
                                <p className="text-[8px] text-[var(--text-muted)] font-bold">Yig'ilish foizi</p>
                            </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-[var(--bg-panel)] overflow-hidden border border-[var(--border-glass)]">
                            <div
                                className="h-full bg-gradient-to-r from-[var(--gold)] to-emerald-500 rounded-full transition-all duration-700"
                                style={{
                                    width: `${finance?.expected_income ? Math.min(Math.round((Number(finance.received_income || 0) / Number(finance.expected_income)) * 100), 100) : 0}%`
                                }}
                            />
                        </div>
                    </div>

                    {/* Secondary Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="p-3.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)]">
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Kutilayotgan</p>
                            <p className="text-sm font-black text-[var(--text-primary)] mt-1 truncate">
                                {Number(finance?.expected_income || 0).toLocaleString()}
                            </p>
                            <p className="text-[8px] text-[var(--gold)] font-bold mt-0.5">Jami hisoblangan</p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)]">
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Qoldiq / Qarz</p>
                            <p className="text-sm font-black text-rose-500 mt-1 truncate">
                                {Number(finance?.pending_income || 0).toLocaleString()}
                            </p>
                            <p className="text-[8px] text-rose-400/80 font-bold mt-0.5">To'lanmagan</p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)]">
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Chiqimlar</p>
                            <p className="text-sm font-black text-amber-500 mt-1 truncate">
                                {Number(finance?.expenses || 0).toLocaleString()}
                            </p>
                            <p className="text-[8px] text-amber-400/80 font-bold mt-0.5">Filial xarajatlari</p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)]">
                            <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Sof Foyda</p>
                            <p className="text-sm font-black text-emerald-400 mt-1 truncate">
                                {Number(finance?.net_profit || 0).toLocaleString()}
                            </p>
                            <p className="text-[8px] text-emerald-400/80 font-bold mt-0.5">Kassa qoldig'i</p>
                        </div>
                    </div>

                    {/* Quick Access Shortcuts */}
                    <div className="mt-auto pt-4 border-t border-[var(--border-glass)]">
                        <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-3">
                            Tezkor boshqaruv havolalari
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <NavLink
                                to="/admin/groups/addgroup"
                                className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--bg-void)] hover:bg-[var(--gold-dim)] border border-[var(--border-glass)] hover:border-[var(--gold)]/30 text-[10px] font-bold text-[var(--text-primary)] transition-all"
                            >
                                <span className="w-2 h-2 rounded-full bg-[var(--gold)] shrink-0" />
                                <span className="truncate">Yangi Guruh</span>
                            </NavLink>
                            <NavLink
                                to="/admin/mentors/add-mentor"
                                className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--bg-void)] hover:bg-[var(--gold-dim)] border border-[var(--border-glass)] hover:border-[var(--gold)]/30 text-[10px] font-bold text-[var(--text-primary)] transition-all"
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <span className="truncate">Yangi O'qituvchi</span>
                            </NavLink>
                            <NavLink
                                to="/admin/waiting-hall"
                                className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--bg-void)] hover:bg-[var(--gold-dim)] border border-[var(--border-glass)] hover:border-[var(--gold)]/30 text-[10px] font-bold text-[var(--text-primary)] transition-all"
                            >
                                <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                                <span className="truncate">Kutishlar Zali</span>
                            </NavLink>
                            <NavLink
                                to="/admin/expenses"
                                className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--bg-void)] hover:bg-[var(--gold-dim)] border border-[var(--border-glass)] hover:border-[var(--gold)]/30 text-[10px] font-bold text-[var(--text-primary)] transition-all"
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                <span className="truncate">Chiqimlar</span>
                            </NavLink>
                        </div>
                    </div>
                </div>
            </div>

            {/* ABSENT STUDENTS MODAL */}
            <AbsentStudentsModal
                isOpen={showAbsentModal}
                onClose={() => setShowAbsentModal(false)}
                branchId={currentBranchId}
            />
        </div>
    );
}
