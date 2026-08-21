import { Activity, ShieldCheck, ArrowUpRight } from 'lucide-react';

export const AttendanceCard = ({ absentCount, totalCount, onClick }) => {
    const absenceRatio = totalCount > 0 ? (absentCount / totalCount) * 100 : 0;

    return (
        <div
            className="lux-card p-4 flex flex-col justify-between border-emerald-500/20 cursor-pointer hover:border-red-500/50 hover:scale-[1.02] transition-all"
            onClick={onClick}
            title="Kelmaganlar ro'yxatini ko'rish"
        >
            <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-500">
                    <Activity size={16} />
                </div>
                <div className="px-2 py-0.5 rounded-full text-[6px] font-black tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 capitalize">
                    Bugun
                </div>
            </div>
            <div>
                <p className="text-[6px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em] mb-1.5">Davomat Ko'rsatkichi</p>
                <div className="flex items-end justify-between">
                    <div>
                        <h3 className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">Bugungi Kelmaganlar</h3>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black text-red-500 font-mono drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                            {absentCount}
                        </p>
                        <p className="text-[5px] font-black text-red-500/60 capitalize tracking-widest mt-0.5">Kelmaganlar soni</p>
                    </div>
                </div>
                <div className="w-full h-1 bg-[var(--bg-void)] rounded-full mt-3 overflow-hidden border border-[var(--border-glass)]">
                    <div
                        className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] transition-all duration-1000"
                        style={{ width: `${absenceRatio}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export const BroadcastSection = ({ message, setMessage, isGlobal, setIsGlobal, onSend, loading }) => {
    return (
        <div className="lux-card !p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[var(--gold)]/5 blur-[50px] -translate-y-1/2 translate-x-1/2 rounded-full" />

            <div className="flex flex-col gap-3 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shadow-inner group-hover:scale-110 transition-transform duration-500">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-[var(--text-primary)] capitalize tracking-tight">Tezkor xabar</h3>
                            <p className="text-[6px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em]">Telegram bot orqali yuborish</p>
                        </div>
                    </div>

                    <div
                        onClick={() => setIsGlobal(!isGlobal)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all cursor-pointer select-none active:scale-95
 ${isGlobal ? "bg-[var(--gold-dim)] border-[var(--gold)]/30 text-[var(--gold)]" : "bg-[var(--bg-void)]/60 border-[var(--border-glass)] text-[var(--text-secondary)]"}`}
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isGlobal ? "animate-spin-slow" : "opacity-40"}><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
                        <span className="text-[7px] font-black capitalize tracking-wider">{isGlobal ? "Barchaga" : "Filial"}</span>
                    </div>
                </div>

                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={isGlobal ? "BARCHAGA XABAR..." : "FILIALGA XABAR..."}
                    className="w-full bg-black/40 border border-[var(--border-glass)] focus:border-[var(--gold)]/50 rounded-lg p-3 text-[10px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all min-h-[80px] resize-none shadow-inner capitalize tracking-wide"
                />
                <div className="flex justify-end">
                    <button
                        onClick={onSend}
                        disabled={loading || !message.trim()}
                        className="lux-btn !h-8 !px-4 !bg-[var(--gold)] !text-black !border-none !rounded-md shadow-[0_0_20px_rgba(184,134,11,0.3)] hover:shadow-[0_0_30px_rgba(184,134,11,0.5)] transition-all flex items-center gap-1.5 relative overflow-hidden group/btn"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                        {loading ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>}
                        <span className="text-[8px] font-black capitalize tracking-[0.15em] relative z-10">{loading ? "Yuborilmoqda..." : "Yuborish"}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const StatCard = ({ onClick, title, value, icon, trend, delay, variant = "default", actionButton }) => {
    return (
        <div
            onClick={onClick}
            style={{ animationDelay: `${delay}ms` }}
            className={`lux-card group relative p-4 cursor-pointer hover:border-[var(--gold)]/40 animate-in slide-in-from-bottom-4 duration-700 overflow-hidden ${variant === "gold" ? "border-[var(--gold)]/20" : ""}`}
        >
            <div className={`absolute top-0 left-0 w-1 h-full bg-[var(--gold)] transition-opacity ${variant === "gold" ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2 bg-[var(--bg-void)]/60 rounded-lg border border-[var(--border-glass)] shadow-inner group-hover:scale-110 transition-transform duration-500 ${variant === "gold" ? "text-[var(--gold)] border-[var(--gold)]/20" : "text-[var(--gold)]"}`}>
                    {icon}
                </div>
                <div className="flex items-center gap-2">
                    {actionButton}
                    <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[6px] font-black tracking-widest border ${variant === "gold" ? "bg-[var(--gold-dim)] text-[var(--gold)] border-[var(--gold)]/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"}`}>
                        <ArrowUpRight size={7} /> {trend}{!isNaN(trend) ? "%" : ""}
                    </div>
                </div>
            </div>
            <div>
                <p className="text-[6px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em] mb-1.5 group-hover:translate-x-1 transition-transform">{variant === "gold" ? "Bot Statistikasi" : "Statistika"}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-widest">{title}</h3>
                    {value !== undefined && <span className="text-base font-black text-[var(--gold)]">{value}</span>}
                </div>
            </div>
        </div>
    );
};
