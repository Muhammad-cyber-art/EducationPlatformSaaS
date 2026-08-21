import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Palette, Clock, CalendarDays, Check, X, Loader2, ChevronRight } from "lucide-react";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";

const GroupCard = React.memo(({ group, readOnly, currentBranchId }) => {
  const navigate = useNavigate();
  const [colorCh, setColorCh] = useState(false);
  const [selectedColor, setSelectedColor] = useState(group.color || '#b8860b');
  const [loading, setLoading] = useState(false);

  const saveNewColor = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await api.patch(`/groups/groups/${group.id}/`, { color: selectedColor });
      toast.success("Rangi o'zgartirildi.");
      setColorCh(false);
    } catch (error) {
      toast.error("Xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={() => !colorCh && navigate(`${group.id}?branch=${currentBranchId}`)}
      className="lux-card-static !p-0 overflow-hidden cursor-pointer relative"
    >

      {/* Premium Color Flag */}
      <div
        className="absolute top-0 left-6 w-8 h-12 z-10 shadow-lg"
        style={{
          background: selectedColor,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 85%, 0% 100%)',
          boxShadow: `0 4px 15px ${selectedColor}40`
        }}
      />
      {/* Modern Type Badge (Advanced/Standard) */}
      <div className="absolute top-4 left-16 z-10">
        <span className={`text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${group.group_type === 'advanced'
          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5'
          : 'text-sky-400 border-sky-500/30 bg-sky-500/5'
          }`}>
          {group.group_type === 'advanced' ? 'Advanced' : 'Standard'}
        </span>
      </div>

      {group.today_attendance_confirmed ? (
        <div className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 shadow-sm flex items-center gap-1" title="Bugungi davomat tasdiqlangan">
          <Check size={10} className="text-emerald-500" strokeWidth={3} />
          <span className="text-[8px] font-black text-emerald-500 capitalize tracking-widest">Qilindi</span>
        </div>
      ) : (
        <div className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 shadow-sm flex items-center gap-1" title="Bugungi davomat olinmagan">
          <X size={10} className="text-red-500" strokeWidth={3} />
          <span className="text-[8px] font-black text-red-500 capitalize tracking-widest">Olinmagan</span>
        </div>
      )}
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start mb-4 sm:mb-6">
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center border bg-[var(--bg-void)]/40 ${group.group_type === 'advanced'
              ? 'border-green-700/50 shadow-[0_0_20px_rgba(22,163,74,0.35)] text-green-400'
              : 'border-sky-400/40 shadow-[0_0_15px_rgba(56,189,248,0.25)] text-sky-400'
              }`}
            style={{ boxShadow: group.group_type === 'advanced' ? '0 8px 30px rgba(22,163,74,0.3)' : '0 8px 25px rgba(56,189,248,0.2)' }}
          >
            <Users size={20} className="sm:w-6 sm:h-6" />
          </div>
          {!readOnly && (
            <button
              onClick={(e) => { e.stopPropagation(); setColorCh(!colorCh); }}
              className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all border ${colorCh ? 'bg-[var(--gold)] text-black border-transparent shadow-lg' : 'bg-[var(--bg-panel)]/50 text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--gold)]'}`}
            >
              <Palette size={14} className="sm:w-4 sm:h-4" />
            </button>
          )}
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] capitalize tracking-tight transition-colors line-clamp-1">
              {group.name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <p className="text-[9px] sm:text-[10px] font-black text-[var(--text-gold)] capitalize tracking-[0.2em] opacity-70">
                {group.subject_name || group.subject || 'Kurs nomi'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 py-4 sm:py-5 border-y border-[var(--border-glass)]">
            <div>
              <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1 sm:mb-1.5">O'qituvchi</p>
              <p className="text-[11px] sm:text-[12px] font-bold text-[var(--text-primary)] truncate">{group.mentor?.full_name || 'Tayinlanmagan'}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] sm:text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1 sm:mb-1.5">O'quvchilar</p>
              <div className="flex items-center justify-end gap-1.5">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                <p className="text-[11px] sm:text-[12px] font-bold text-[var(--text-primary)]">{group.students_count || 0} ta</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="p-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] shrink-0">
                  <Clock size={10} className="sm:w-3 sm:h-3 text-[var(--gold)]" />
                </div>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] truncate">{group.dars_vaqti || '--:--'}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="p-1 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] shrink-0">
                  <CalendarDays size={10} className="sm:w-3 sm:h-3 text-[var(--gold)]" />
                </div>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] truncate">{group.days === 'even' ? "Juft" : group.days === 'everyday' ? 'Har kun' : 'Toq'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col items-end gap-1">
                {group.computed_status === 'active' && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/10">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div>
                    <span className="text-[7px] font-black text-emerald-500/80 uppercase tracking-widest">Faol</span>
                  </div>
                )}
                {group.computed_status === 'waiting' && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/5 border border-amber-500/10">
                    <div className="w-1 h-1 rounded-full bg-amber-500"></div>
                    <span className="text-[7px] font-black text-amber-500/80 uppercase tracking-widest">Kutilmoqda</span>
                  </div>
                )}
                {group.computed_status === 'activating_soon' && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/5 border border-blue-500/10">
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-[7px] font-black text-blue-500/80 uppercase tracking-widest">Yaqinda</span>
                  </div>
                )}
                {group.computed_status === 'inactive' && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                    <div className="w-1 h-1 rounded-full bg-white/20"></div>
                    <span className="text-[7px] font-black text-white/30 uppercase tracking-widest">Nofaol</span>
                  </div>
                )}
              </div>
              <div className="w-6 h-6 rounded-full bg-[var(--bg-panel)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] opacity-30 group-hover:opacity-100 transition-all">
                <ChevronRight size={12} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Color Picker Slide-up */}
      {colorCh && (
        <div
          className="absolute inset-0 z-20 bg-[var(--bg-panel)] p-8 flex flex-col items-center justify-center gap-6 animate-in slide-in-from-bottom duration-500"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <h4 className="text-[11px] font-black text-[var(--gold)] capitalize tracking-[0.3em] mb-1">Vizual ko'rinish</h4>
            <p className="text-[9px] text-[var(--text-muted)] font-bold capitalize tracking-widest">Guruh rangini tanlang</p>
          </div>
          <div className="relative group/picker">
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-20 h-20 rounded-[30px] bg-transparent border-none cursor-pointer p-0 shadow-2xl"
            />
            <div className="absolute inset-0 rounded-[30px] border-2 border-[var(--gold)] pointer-events-none opacity-30 group-hover/picker:opacity-100 transition-opacity" />
          </div>
          <div className="flex gap-3 w-full max-w-[180px]">
            <button onClick={saveNewColor} disabled={loading} className="lux-btn lux-btn-primary flex-1 !h-11 !text-[10px] !rounded-xl">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Tasdiqlash"}
            </button>
            <button onClick={() => { setColorCh(false); setSelectedColor(group.color); }} className="w-11 h-11 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all">
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default GroupCard;
