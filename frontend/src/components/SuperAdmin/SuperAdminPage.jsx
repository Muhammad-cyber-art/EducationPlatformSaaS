import { Users, UserCheck, Building2, ShieldCheck, MessageSquare, Download, Loader2, BookOpen, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useOutletContext } from 'react-router-dom';
import api from '../../tokenUpdater/updater';
import toast from 'react-hot-toast';
import AbsentStudentsModal from '../Common/AbsentStudentsModal';
import { useState, useEffect } from 'react';
import { BotConnectionsChart, AbsenteesChart, StudentGrowthChart } from './charts/AnalyticsCharts';
import { AttendanceCard, BroadcastSection, StatCard } from './cards/DashboardCards';

const SuperAdminDashboard = () => {
    const navigate = useNavigate();
    const { branchId } = useOutletContext() || {};
    const [message, setMessage] = useState("");
    const [isGlobal, setIsGlobal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [downloadingBotList, setDownloadingBotList] = useState(false);
    const [showAbsentModal, setShowAbsentModal] = useState(false);
    const [hwPage, setHwPage] = useState(1);

    useEffect(() => {
        setHwPage(1);
    }, [branchId]);

    const handleDownloadBotUnregistered = async (e) => {
        e.stopPropagation(); // Card bosilishini to'xtatamiz
        try {
            setDownloadingBotList(true);
            const response = await api.get('/bot/export-unregistered-students/', {
                params: { branch_id: branchId },
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

    const { data: botStats, isLoading: botStatsLoading } = useQuery({
        queryKey: ['bot-stats', branchId],
        queryFn: () => api.get(`/bot/statistics/?branch_id=${branchId}`).then(res => res.data),
        enabled: !!branchId,
    });

    const { data: branchFinance, isLoading: financeLoading } = useQuery({
        queryKey: ['branch-finance', branchId],
        queryFn: () => api.get(`/finance/statistics/branch-finance/${branchId}/`).then(res => res.data),
        enabled: !!branchId,
    });



    const { data: growthData, isLoading: growthLoading } = useQuery({
        queryKey: ['growth-statistics', branchId],
        queryFn: () => api.get(`/groups/students/growth_statistics/?branch_id=${branchId}`).then(res => res.data),
        enabled: !!branchId,
    });

    const { data: weeklyHomeworks, isLoading: hwLoading } = useQuery({
        queryKey: ['weekly-homework-summary', branchId, hwPage],
        queryFn: () => api.get(`/homework_attends/homeworks/weekly_summary/?branch_id=${branchId}&page=${hwPage}`).then(res => res.data),
        enabled: !!branchId,
    });

    const stats = branchFinance?.stats;

    const homeworkList = Array.isArray(weeklyHomeworks)
        ? weeklyHomeworks
        : (weeklyHomeworks && Array.isArray(weeklyHomeworks.results) ? weeklyHomeworks.results : []);

    const handleSendMessage = async () => {
        if (!message.trim()) {
            toast.error("Xabar matnini kiriting.");
            return;
        }

        setLoading(true);
        try {
            await api.post('/bot/broadcast/', {
                message: message,
                branch_id: isGlobal ? null : branchId,
                send_to_all_branches: isGlobal
            });
            toast.success(isGlobal ? "Xabar barchaga yuborildi." : "Xabar yuborildi.");
            setMessage("");
        } catch (err) {
            toast.error("Xabarni yuborishda xatolik.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-lux-fade space-y-4 md:space-y-10">
            {/* Atmosphere Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-[var(--gold)]/5 rounded-full blur-[120px]"></div>
            </div>

            {/* HEADER ACTION AREA */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-6 pb-4 md:pb-6 border-b border-[var(--border-glass)]">
                <div>
                    <h1 className="text-2xl md:text-4xl font-black text-[var(--text-primary)] tracking-tighter capitalize mb-1">Markaziy Boshqaruv</h1>
                    <p className="text-[9px] md:text-[10px] text-[var(--text-muted)] font-black capitalize tracking-[0.3em] flex items-center gap-2">
                        <ShieldCheck size={11} className="text-[var(--gold)]" /> Tizimning asosiy boshqaruv paneli
                    </p>
                </div>
                <div className="hidden md:block px-4 py-2 rounded-full bg-[var(--gold-dim)] border border-[var(--gold)]/20 text-[9px] font-black capitalize tracking-widest text-[var(--gold)]">
                    Holat: To'liq boshqaruv
                </div>
            </div>

            {/* STATS MATRIX */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <StatCard onClick={() => navigate('admins')} title="Adminstratorlar" value={stats?.admins || 0} icon={<ShieldCheck size={16} />} trend="STAFF" delay="0" />
                <StatCard onClick={() => navigate('mentors')} title="Mentorlar" value={stats?.mentors || 0} icon={<UserCheck size={16} />} trend="STAFF" delay="100" />
                <StatCard onClick={() => navigate('all_students')} title="O'quvchilar" value={stats?.students || 0} icon={<Users size={16} />} trend="STUDENTS" delay="200" />
                <StatCard onClick={() => navigate('groups')} title="Guruhlar" value={stats?.groups || 0} icon={<Building2 size={16} />} trend="GROUPS" delay="300" />
            </div>

            {/* ATTENDANCE, BOT STATS & BROADCAST MATRIX */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
                <AttendanceCard
                    absentCount={stats?.attendance_today?.absent || 0}
                    totalCount={stats?.attendance_today?.total || 0}
                    onClick={() => setShowAbsentModal(true)}
                />
                <StatCard
                    title="Bot Ulanmalari"
                    value={botStats?.total_bot_users || 0}
                    icon={<MessageSquare size={20} />}
                    trend="BOT"
                    delay="400"
                    variant="gold"
                    actionButton={
                        <button
                            onClick={handleDownloadBotUnregistered}
                            disabled={downloadingBotList}
                            className="p-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                            title="Ro'yxatdan o'tmaganlarni yuklash"
                        >
                            {downloadingBotList ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        </button>
                    }
                />
                <BroadcastSection
                    message={message}
                    setMessage={setMessage}
                    isGlobal={isGlobal}
                    setIsGlobal={setIsGlobal}
                    onSend={handleSendMessage}
                    loading={loading}
                />
            </div>

            {/* PIE CHARTS - 2 column on mobile */}
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 md:gap-6">
                <BotConnectionsChart botStats={botStats} />
                <AbsenteesChart stats={stats} />
            </div>

            {/* HAFTALIK UY VAZIFALARI */}
            <div className="lux-card p-6 md:p-8 space-y-6">
                <style>{`
                    .homework-scroll-container::-webkit-scrollbar {
                        height: 6px;
                    }
                    .homework-scroll-container::-webkit-scrollbar-track {
                        background: rgba(255, 255, 255, 0.02);
                        border-radius: 9999px;
                    }
                    .homework-scroll-container::-webkit-scrollbar-thumb {
                        background: rgba(184, 134, 11, 0.2);
                        border-radius: 9999px;
                        transition: background 0.3s;
                    }
                    .homework-scroll-container:hover::-webkit-scrollbar-thumb {
                        background: rgba(184, 134, 11, 0.4);
                    }
                `}</style>

                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-glass)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] shadow-[var(--gold-glow)]">
                            <BookOpen size={18} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Haftalik Uy Vazifalari Analitikasi</h3>
                            <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-wider mt-0.5">So'nggi 7 kun ichida berilgan vazifalar va topshirilish holati</p>
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    {weeklyHomeworks?.count > 10 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setHwPage(prev => Math.max(prev - 1, 1))}
                                disabled={hwPage === 1}
                                className="p-1.5 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 disabled:opacity-40 disabled:pointer-events-none transition-all"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="text-[10px] font-black text-[var(--text-muted)] tracking-wider">
                                {hwPage} / {Math.ceil(weeklyHomeworks.count / 10)}
                            </span>
                            <button
                                onClick={() => setHwPage(prev => (weeklyHomeworks?.next ? prev + 1 : prev))}
                                disabled={!weeklyHomeworks?.next}
                                className="p-1.5 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 disabled:opacity-40 disabled:pointer-events-none transition-all"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {hwLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-60">
                        <Loader2 className="animate-spin text-[var(--gold)]" size={32} />
                        <span className="text-xs font-bold tracking-widest text-[var(--text-muted)] capitalize">Yuklanmoqda...</span>
                    </div>
                ) : !homeworkList || homeworkList.length === 0 ? (
                    <div className="py-16 text-center border-2 border-dashed border-[var(--border-glass)] rounded-2xl bg-[var(--bg-void)]/20 opacity-60">
                        <div className="w-14 h-14 bg-[var(--bg-panel)] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[var(--border-glass)] text-[var(--text-muted)]">
                            <BookOpen size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">Hozircha hech qanday uy vazifasi yo'q</h4>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">So'nggi bir hafta davomida ushbu filialda uy vazifasi berilmagan</p>
                    </div>
                ) : (
                    <div className="homework-scroll-container flex overflow-x-auto gap-4 md:gap-6 pb-4">
                        {homeworkList.map((hw) => {
                            const completedCount = hw.stats?.full || 0;
                            const totalCount = hw.stats?.total || 0;
                            const rate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                            
                            return (
                                <div 
                                    key={hw.id} 
                                    onClick={() => navigate(`/super_admin/branch/${branchId}/groups/${hw.group_id}/homeworks/${hw.id}`)}
                                    className="shrink-0 w-[290px] sm:w-[320px] min-h-[220px] relative group p-5 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] hover:border-[var(--gold)]/30 hover:translate-y-[-2px] transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm cursor-pointer"
                                >
                                    {/* Completion Glow Behind */}
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--gold)]/5 rounded-full blur-2xl group-hover:bg-[var(--gold)]/10 transition-all pointer-events-none"></div>

                                    <div>
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--gold)] transition-colors" title={hw.title}>
                                                    {hw.title}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="px-2 py-0.5 rounded-md bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[9px] font-black text-[var(--gold)] capitalize tracking-wider">
                                                        {hw.group_name}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-[var(--text-muted)] flex items-center gap-1">
                                                        <Calendar size={10} /> {hw.created_at}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Circular rate badge */}
                                            <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center border font-black text-xs shrink-0
                                                ${rate >= 80 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
                                                  rate >= 50 ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 
                                                  'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}
                                            >
                                                {rate}%
                                            </div>
                                        </div>

                                        {/* Submitter Stats list */}
                                        <div className="space-y-2.5 my-4 pt-3 border-t border-[var(--border-glass)]">
                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                <span className="text-[var(--text-secondary)]">O'qituvchi:</span>
                                                <span className="text-[var(--text-primary)] truncate max-w-[120px]">{hw.mentor_name}</span>
                                            </div>
                                            
                                            <div className="grid grid-cols-3 gap-2 text-center text-[9px] font-black">
                                                <div className="p-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-500">
                                                    <div className="text-xs font-black">{hw.stats?.full || 0}</div>
                                                    <div className="mt-0.5 opacity-80 uppercase tracking-widest text-[8px]">To'liq</div>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-500">
                                                    <div className="text-xs font-black">{hw.stats?.half || 0}</div>
                                                    <div className="mt-0.5 opacity-80 uppercase tracking-widest text-[8px]">Yarim</div>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-500">
                                                    <div className="text-xs font-black">{hw.stats?.not_submitted || 0}</div>
                                                    <div className="mt-0.5 opacity-80 uppercase tracking-widest text-[8px]">Kutilmoqda</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] font-bold text-[var(--text-muted)]">
                                            <span>Muvaffaqiyat ko'rsatkichi</span>
                                            <span>{hw.stats?.full || 0} / {hw.stats?.total || 0} topshirdi</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[var(--bg-panel)] rounded-full overflow-hidden border border-[var(--border-glass)]">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 
                                                    ${rate >= 80 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 
                                                      rate >= 50 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 
                                                      'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`}
                                                style={{ width: `${rate}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* GROWTH CHART */}
            <StudentGrowthChart data={growthData} />

            {/* ABSENT STUDENTS MODAL */}
            <AbsentStudentsModal
                isOpen={showAbsentModal}
                onClose={() => setShowAbsentModal(false)}
                branchId={branchId}
            />
        </div>
    );
};

export default SuperAdminDashboard;