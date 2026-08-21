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

            {/* Top Stats Grid */}
            <div className="lux-grid-4" style={{ marginBottom: '24px' }}>
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
            </div>

            {/* Bot Stats Grid */}
            <div className="lux-grid-3" style={{ marginBottom: '40px' }}>
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

            {/* Main Content - Finance Statistics */}
            <div className="lux-grid-main">
                {/* Top Performers / Group List */}
                <div className="lux-card" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {selectedGroup && (
                                <button
                                    onClick={() => setSelectedGroup(null)}
                                    style={{ background: 'transparent', border: 'none', color: '#d4af37', cursor: 'pointer', padding: 0, display: 'flex' }}
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            )}
                            <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>
                                {selectedGroup ? 'Guruh tafsilotlari' : 'Eng yaxshi ko\'rsatkichli guruhlar'}
                            </h2>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                        {!selectedGroup ? (
                            <div className="space-y-6">
                                {groups?.length > 0 ? (
                                    groups.slice(0, 8).map((group, i) => {
                                        const totalIncome = finance?.received_income || 1;
                                        const percentage = Math.min((group.received_income / totalIncome) * 100, 100);
                                        return (
                                            <div
                                                key={i}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => setSelectedGroup(group)}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                                                    <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{group.name}</span>
                                                    <span style={{ color: 'var(--gold)' }}>{(group.received_income / 1000).toLocaleString()} k</span>
                                                </div>
                                                <div style={{ width: '100%', height: '4px', background: 'var(--bg-void)', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--gold)' }}></div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-[var(--text-secondary)] text-sm">Guruhlar mavjud emas</p>
                                )}
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                <div style={{ padding: '20px', background: 'var(--gold-dim)', borderRadius: '16px', border: '1px solid rgba(184,134,11,0.2)' }}>
                                    <p style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: '800', textTransform: 'capitalize', marginBottom: '4px' }}>O'qituvchi</p>
                                    <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{selectedGroup.mentor || 'Noma\'lum'}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--bg-void)', border: '1px solid var(--border-glass)' }}>
                                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'capitalize', marginBottom: '6px' }}>O'quvchilar</p>
                                        <p style={{ fontSize: '16px', fontWeight: 'bold' }}>{selectedGroup.student_count}</p>
                                    </div>
                                    <div style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'var(--bg-void)', border: '1px solid var(--border-glass)' }}>
                                        <p style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'capitalize', marginBottom: '6px' }}>Tushum</p>
                                        <p style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--gold)' }}>{(selectedGroup.received_income / 1000).toLocaleString()} k</p>
                                    </div>
                                </div>
                                <NavLink
                                    to={`/admin/groups/${selectedGroup.id}`}
                                    className="lux-btn lux-btn-primary"
                                    style={{ width: '100%', height: '50px' }}
                                >
                                    To'liq tahlil <ChevronRight size={16} />
                                </NavLink>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '30px', borderTop: '1px solid var(--border-glass)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tizim tugunlari holati</span>
                            <span style={{ fontSize: '11px', color: 'var(--gold)' }}>● Ishlamoqda</span>
                        </div>
                    </div>
                </div>

                {/* Empty Space or placeholder if chart is removed and we want to maintain the 2-column layout look */}
                <div className="hidden lg:block">
                    {/* Optional sidebar or extra info if needed, or leave empty to keep grid balanced if lux-grid-main assumes 2 cols */}
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
