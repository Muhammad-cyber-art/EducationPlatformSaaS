import { Outlet, useNavigate, useLocation } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";
import SideBar from "./sidebarmenu";
import { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { GlobalContext } from "../../GlobalContext";
import { get_user_info } from "../Authorized/getRole";
import { Bell, FileDown, AlertTriangle, CheckCircle, Volume2, History, Download } from "lucide-react";
import MobileBottomNav from "../Navigation/MobileBottomNav";
import {
    fetchAdminMe,
    setAfterSix,
    toggleNotification,
    setNotificationOpen,
    setDownloading
} from "../../store/slices/adminSlice";

// Premium Web Audio API synthesizer for the golden alarm sound (Zero-network chimes)
const playPremiumChime = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const playTone = (freq, startTime, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, startTime);
            
            // Soft professional audio level
            gain.gain.setValueAtTime(0.12, startTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        
        const now = ctx.currentTime;
        // Scientific golden arpeggio chord (E5, G#5, B5)
        playTone(659.25, now, 1.0);
        playTone(830.61, now + 0.1, 1.2);
        playTone(987.77, now + 0.2, 1.5);
    } catch (e) {
        console.error("Audio playback error:", e);
    }
};

export default function AdminPanel() {
    const dispatch = useDispatch();
    const location = useLocation();
    const navigate = useNavigate();

    const {
        user: admin,
        hasPermission,
        isDownloading,
        isNotificationOpen,
        isAfterSix
    } = useSelector((state) => state.admin);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [lastPlayedTime, setLastPlayedTime] = useState(0);
    const [pendingNotifications, setPendingNotifications] = useState({
        pending_daily: false,
        pending_monthly: false,
        daily_message: null,
        monthly_message: null,
        uncollected_past: []
    });

    // Fetch pending report download notifications from backend
    const fetchNotifications = useCallback(async () => {
        try {
            const response = await api.get('/reports/check-pending-notifications/');
            const data = response.data;
            setPendingNotifications(data);

            const hasPending = data.pending_daily || data.pending_monthly;
            if (hasPending) {
                const now = Date.now();
                // Play sound every 2 minutes (120000ms) until downloaded
                if (now - lastPlayedTime > 120000) {
                    playPremiumChime();
                    setLastPlayedTime(now);
                    toast.custom((t) => (
                        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-[var(--bg-panel)] border-2 border-[var(--gold)] shadow-2xl rounded-2xl pointer-events-auto flex p-4`}>
                            <div className="flex-1 w-0">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0 pt-0.5">
                                        <Volume2 className="h-10 w-10 text-[var(--gold)] animate-bounce" />
                                    </div>
                                    <div className="ml-3 flex-1">
                                        <p className="text-xs font-black text-[var(--gold)] uppercase tracking-wider">Hisobot Ogohlantirishi</p>
                                        <p className="mt-1 text-[11px] text-[var(--text-secondary)] font-bold">
                                            {data.pending_daily && "Kunlik Excel hisobotini yuklab olishni unutmang!"}
                                            {data.pending_daily && data.pending_monthly && " Hamda "}
                                            {data.pending_monthly && "Oylik moliya hisobotini yuklab olishingiz shart!"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ), { duration: 5000 });
                }
            }
        } catch (error) {
            console.error("Error checking notifications:", error);
        }
    }, [lastPlayedTime]);

    useEffect(() => {
        dispatch(fetchAdminMe());

        const checkTime = () => {
            const hours = new Date().getHours();
            dispatch(setAfterSix(hours >= 18));
        };
        checkTime();

        // Check notifications on mount and then every 30 seconds
        fetchNotifications();
        const notificationTimer = setInterval(fetchNotifications, 30000);
        const timeTimer = setInterval(checkTime, 60000);

        return () => {
            clearInterval(notificationTimer);
            clearInterval(timeTimer);
        };
    }, [dispatch, fetchNotifications]);

    // Handle Daily Excel Report Download
    const handleExportExcel = async () => {
        dispatch(setDownloading(true));
        try {
            const today = new Date();
            const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
            const response = await api.get('/reports/', {
                params: { date: formattedDate },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${formattedDate}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success("Kunlik hisobot muvaffaqiyatli yuklandi.");
            
            // Re-fetch pending status immediately to clear alarm
            setTimeout(fetchNotifications, 1000);
        } catch (error) {
            toast.error("Kunlik hisobotni yuklashda xatolik yuz berdi.");
        } finally {
            dispatch(setDownloading(false));
        }
    };

    // Handle Monthly Finance Excel Report Download
    const handleExportMonthly = async () => {
        dispatch(setDownloading(true));
        try {
            const today = new Date();
            const response = await api.get('/reports/monthly-finance/', {
                params: { 
                    year: today.getFullYear(), 
                    month: today.getMonth() + 1 
                },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Moliya_Hisoboti_${today.getFullYear()}_${String(today.getMonth() + 1).padStart(2, '0')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success("Oylik moliya hisoboti muvaffaqiyatli yuklandi.");
            
            // Re-fetch pending status immediately to clear alarm
            setTimeout(fetchNotifications, 1000);
        } catch (error) {
            toast.error("Oylik moliya hisobotini yuklashda xatolik yuz berdi.");
        } finally {
            dispatch(setDownloading(false));
        }
    };

    // Handle Past Daily Report Download
    const handlePastDailyDownload = async (dateStr, label) => {
        try {
            toast.loading("Yuklanmoqda...", { id: 'past_dl' });
            const response = await api.get('/reports/', {
                params: { date: dateStr },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${dateStr}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`${label} yuklandi`, { id: 'past_dl' });
            setTimeout(fetchNotifications, 1000);
        } catch (error) {
            toast.error("Hisobotni yuklashda xatolik", { id: 'past_dl' });
        }
    };

    // Handle Past Monthly Finance Report Download
    const handlePastMonthlyDownload = async (reportDate, label) => {
        try {
            toast.loading("Yuklanmoqda...", { id: 'past_dl' });
            const d = new Date(reportDate);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const response = await api.get('/reports/monthly-finance/', {
                params: { year, month },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Moliya_Hisoboti_${year}_${String(month).padStart(2, '0')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`${label} yuklandi`, { id: 'past_dl' });
            setTimeout(fetchNotifications, 1000);
        } catch (error) {
            toast.error("Hisobotni yuklashda xatolik", { id: 'past_dl' });
        }
    };

    const getPageTitle = () => {
        const path = location.pathname;
        if (path === "/admin") return "Asosiy";
        if (path.includes("groups")) return "Guruhlar";
        if (path.includes("mentors")) return "O'qituvchilar";
        if (path.includes("all_students")) return "O'quvchilar ro'yxati";
        if (path.includes("archive")) return "Arxiv";
        if (path.includes("profile")) return "Profil sozalamalari";
        return "Boshqaruv paneli";
    };

    const hasPendingNotification = pendingNotifications.pending_daily || pendingNotifications.pending_monthly;

    return (
        <div className="layout-container">
            <SideBar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="lux-content">
                <header className="lux-header py-4 px-4 h-16 flex items-center justify-between border-b border-[var(--border-glass)] bg-[var(--bg-void)] sticky top-0 z-50" style={{ background: 'var(--bg-void)' }}>
                    <div className="flex items-center gap-4 flex-1">
                        <h2 className="m-0 text-base text-[var(--text-primary)] font-semibold tracking-tight">
                            {getPageTitle()}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Theme Toggle */}
                        <div className="flex items-center">
                            <ThemeToggle custom />
                        </div>

                        {/* Notifications Bell */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    dispatch(toggleNotification());
                                }}
                                className={`w-9 h-9 rounded-xl bg-[var(--bg-panel)] border flex items-center justify-center cursor-pointer relative text-[var(--text-secondary)] hover:text-[var(--gold)] transition-all ${
                                    hasPendingNotification ? 'border-red-500/40 text-red-500 animate-pulse' : 'border-[var(--border-glass)]'
                                }`}
                            >
                                <Bell size={16} />
                                {hasPendingNotification && (
                                    <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[var(--bg-panel)] animate-ping"></div>
                                )}
                            </button>

                            {isNotificationOpen && (
                                <div
                                    className="absolute top-12 right-0 w-80 bg-black !shadow-2xl border rounded-xl lux-card-for-grps z-[100] animate-in fade-in zoom-in-95 duration-200"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="p-4 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/50 flex justify-between items-center">
                                        <h4 className="text-[10px] font-black capitalize tracking-[0.2em] text-[var(--text-primary)]">Bildirishnomalar</h4>
                                        {hasPendingNotification && (
                                            <span className="text-[8px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-wider animate-pulse">Tezkor</span>
                                        )}
                                    </div>
                                    <div className="p-2 space-y-2">
                                        
                                        {/* DAILY EXCEL PENDING NOTIFICATION */}
                                        {pendingNotifications.pending_daily && (
                                            <button
                                                onClick={() => {
                                                    handleExportExcel();
                                                    dispatch(setNotificationOpen(false));
                                                }}
                                                className="w-full flex items-center gap-3.5 p-3 hover:bg-[var(--gold-dim)] border border-[var(--gold)]/20 rounded-xl transition-all group text-left bg-[var(--gold)]/5"
                                            >
                                                <div className="p-2.5 rounded-lg bg-[var(--gold)]/10 text-[var(--gold)] group-hover:bg-[var(--gold)] group-hover:text-black transition-colors shrink-0">
                                                    <FileDown size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-black text-[var(--text-primary)]">Kunlik Hisobot Tayyor ⏰</p>
                                                    <p className="text-[9px] text-[var(--text-muted)] font-bold mt-0.5">Yuklab olish uchun bosing</p>
                                                </div>
                                            </button>
                                        )}

                                        {/* MONTHLY FINANCE PENDING NOTIFICATION */}
                                        {pendingNotifications.pending_monthly && (
                                            <button
                                                onClick={() => {
                                                    handleExportMonthly();
                                                    dispatch(setNotificationOpen(false));
                                                }}
                                                className="w-full flex items-center gap-3.5 p-3 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-xl transition-all group text-left bg-emerald-500/5 animate-pulse"
                                            >
                                                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black transition-colors shrink-0">
                                                    <FileDown size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-black text-emerald-400">Oylik Moliya Hisoboti 📊</p>
                                                    <p className="text-[9px] text-[var(--text-muted)] font-bold mt-0.5">Yuklab olishingiz shart (Majburiy)</p>
                                                </div>
                                            </button>
                                        )}

                                        {/* NO PENDING NOTIFICATIONS */}
                                        {!hasPendingNotification && !pendingNotifications.uncollected_past?.length && (
                                            <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                                                <CheckCircle size={24} className="text-emerald-500" />
                                                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Barcha hisobotlar yuklangan</p>
                                            </div>
                                        )}

                                        {/* UNCOLLECTED PAST REPORTS */}
                                        {pendingNotifications.uncollected_past?.length > 0 && (
                                            <div className="border-t border-[var(--border-glass)] pt-2 mt-2">
                                                <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                                                    <History size={12} className="text-amber-500" />
                                                    <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">
                                                        Yuklab olinmagan hisobotlar
                                                    </p>
                                                    <span className="text-[7px] font-black bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full border border-amber-500/20">
                                                        {pendingNotifications.uncollected_past.length}
                                                    </span>
                                                </div>
                                                <div className="max-h-[200px] overflow-y-auto space-y-1 scrollbar-hide">
                                                    {pendingNotifications.uncollected_past.map((report, idx) => {
                                                        const iconColor = report.type === 'daily' ? 'text-[var(--gold)]' : report.type === 'monthly' ? 'text-emerald-400' : 'text-sky-400';
                                                        const bgColor = report.type === 'daily' ? 'bg-[var(--gold)]/10' : report.type === 'monthly' ? 'bg-emerald-500/10' : 'bg-sky-500/10';
                                                        return (
                                                            <button
                                                                key={`${report.type}-${report.date}-${idx}`}
                                                                onClick={() => {
                                                                    if (report.type === 'daily') handlePastDailyDownload(report.date, report.label);
                                                                    else if (report.type === 'monthly') handlePastMonthlyDownload(report.report_date, report.label);
                                                                    dispatch(setNotificationOpen(false));
                                                                }}
                                                                className="w-full flex items-center gap-2.5 p-2 hover:bg-[var(--bg-void)]/50 border border-[var(--border-glass)]/50 rounded-lg transition-all group text-left"
                                                            >
                                                                <div className={`p-1.5 rounded-md ${bgColor} ${iconColor} shrink-0`}>
                                                                    <Download size={12} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-[9px] font-black text-[var(--text-primary)] truncate">{report.label}</p>
                                                                    <p className="text-[7px] text-[var(--text-muted)] font-bold capitalize">
                                                                        {report.type === 'daily' ? 'Kunlik' : report.type === 'monthly' ? 'Oylik moliya' : 'Davomat'}
                                                                    </p>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {pendingNotifications.uncollected_past.length > 0 && (
                                                    <p className="text-[7px] text-[var(--text-muted)] font-bold text-center mt-2 px-2">
                                                        Davomat hisobotlarini guruh sahifasidan yuklab oling
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Top-bar Quick Download button */}
                        {hasPermission && isAfterSix && (
                            <button
                                onClick={handleExportExcel}
                                disabled={isDownloading}
                                className="lux-btn lux-btn-primary h-9 px-4 hidden sm:flex items-center gap-2"
                            >
                                <FileDown size={14} />
                                <span className="text-[10px] font-black capitalize tracking-widest">Hisobot</span>
                            </button>
                        )}
                    </div>
                </header>

                <main className="lux-scroll animate-lux-fade" onClick={() => dispatch(setNotificationOpen(false))}>
                    <GlobalContext.Provider value={{ admin }}>
                        <div className="w-full mx-auto px-0">
                            <div className="py-2 sm:py-6">
                                <Outlet />
                            </div>
                        </div>
                    </GlobalContext.Provider>
                </main>

                <MobileBottomNav />
            </div>
        </div>
    );
}
