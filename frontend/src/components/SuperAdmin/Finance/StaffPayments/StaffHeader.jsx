import React from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../../../ThemeToggle";

const StaffHeader = ({ branches, activeBranch, setActiveBranch }) => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 pb-6 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-6">
                <button
                    onClick={() => navigate(-1)}
                    className="p-3 bg-[var(--bg-void)] border border-[#2a2a2a] rounded-xl text-[var(--gold)] hover:scale-110 transition-all shadow-lg"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl sm:text-4xl font-black text-[var(--text-primary)] tracking-tighter capitalize mb-2">Xodimlar Boshqaruvi</h1>
                    <p className="text-[8px] sm:text-[10px] text-[var(--text-muted)] font-black capitalize tracking-[0.2em] sm:tracking-[0.4em] flex items-center gap-2 sm:gap-3">
                        <ShieldCheck size={10} className="text-[var(--gold)] sm:w-3 sm:h-3" /> Strategik Delegatsiya va Maosh Tizimi
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* BRANCH TABS */}
                <div className="flex flex-wrap gap-2 p-1.5 bg-[var(--bg-panel)]/40 border border-[#2a2a2a] rounded-2xl shadow-inner max-w-full overflow-x-auto scrollbar-hide">
                    {branches.map((b) => (
                        <button
                            key={b.id}
                            onClick={() => setActiveBranch(b.id)}
                            className={`px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-[8px] sm:text-[10px] font-black capitalize tracking-widest transition-all whitespace-nowrap ${activeBranch == b.id
                                ? "bg-[var(--gold)] text-black shadow-[var(--gold-glow)] scale-105"
                                : "text-[var(--text-muted)] hover:bg-[var(--gold-dim)] hover:text-[var(--text-primary)]"
                                }`}
                        >
                            {b.name}
                        </button>
                    ))}
                </div>
                <ThemeToggle />
            </div>
        </div>
    );
};

export default StaffHeader;
