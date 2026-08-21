import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { Palette, ChevronRight, Shield, Phone, Loader2, X, Clock } from "lucide-react";

const AdminCard = React.memo(({ data, viewMode = 'grid' }) => {
  const navigate = useNavigate();
  const [colorCh, setColorCh] = useState(false);
  const [selectedColor, setSelectedColor] = useState(data.color || '#b8860b');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedColor(data.color || '#b8860b');
  }, [data.color]);

  const saveNewColor = async (e) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await api.patch(`/register/users/${data.id}/`, { color: selectedColor });
      toast.success("Rangi o'zgartirildi.");
      setColorCh(false);
    } catch (error) {
      toast.error("Xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const initials = `${data.first_name?.[0] || ''}${data.last_name?.[0] || ''}`.toUpperCase();

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => !colorCh && navigate(`${data.id}`)}
        className="lux-card group !p-3 sm:!p-4 flex items-center justify-between gap-4 overflow-hidden cursor-pointer relative bg-[var(--bg-panel)] border border-[var(--border-glass)] hover:border-[var(--gold)]/40 shadow-lg hover:shadow-xl hover:shadow-[var(--gold)]/10 transition-all duration-300 use-dynamic-border-left"
        style={{ 
          borderLeftWidth: '4px', 
          borderLeftColor: selectedColor,
          '--card-color': selectedColor,
          '--card-color-dim': `${selectedColor}30`
        }}
      >
        <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-glass)] p-0.5 shadow-lg"
              style={{ boxShadow: `0 8px 24px ${selectedColor}10` }}
            >
              <div className="w-full h-full rounded-[10px] sm:rounded-xl overflow-hidden bg-[var(--bg-void)] flex items-center justify-center">
                {data.image ? (
                  <img src={data.image} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="text-xs sm:text-sm font-black use-dynamic-color" style={{ color: selectedColor }}>{initials}</span>
                )}
              </div>
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bg-panel)] bg-emerald-500"
            />
          </div>

          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-[var(--text-primary)] capitalize tracking-tight truncate">
              {data.first_name} {data.last_name}
            </h3>
            <p className="text-[8px] sm:text-[9px] font-black capitalize tracking-[0.2em] mt-0.5 opacity-80 use-dynamic-color" style={{ color: selectedColor }}>
              {data.role?.replace('_', ' ') || "Administrator"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-10 shrink-0">
          <div className="hidden sm:flex items-center gap-6">
            <div className="flex items-center gap-2 bg-[var(--bg-void)] px-3 py-1.5 rounded border border-[var(--border-glass)]">
              <Phone size={12} className="text-[var(--text-muted)]" />
              <p className="text-[10px] sm:text-[11px] font-bold text-[var(--text-primary)] tracking-widest">{data.phone_number || "ALOQA YO'Q"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setColorCh(!colorCh); }}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--gold)] transition-all z-10"
              title="Rangni o'zgartirish"
            >
              <Palette size={14} className="sm:w-5 sm:h-5" />
            </button>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] group-hover:bg-[var(--gold)] group-hover:text-black transition-all">
              <ChevronRight size={14} className="sm:w-5 sm:h-5" />
            </div>
          </div>
        </div>

        {colorCh && (
          <div className="absolute inset-0 z-30 bg-black/95 backdrop-blur-xl flex items-center justify-center p-2 gap-4 animate-in fade-in" onClick={e => e.stopPropagation()}>
            <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-none" />
            <div className="flex gap-2">
              <button onClick={saveNewColor} className="px-3 py-1 bg-[var(--gold)] text-black text-[9px] font-black rounded-lg">OK</button>
              <button onClick={() => setColorCh(false)} className="px-3 py-1 bg-white/10 text-white text-[9px] font-black rounded-lg">X</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => !colorCh && navigate(`${data.id}`)}
      className="lux-card group !p-0 overflow-hidden cursor-pointer relative hover:border-[var(--gold)]/30 transition-all duration-500 use-dynamic-border"
      style={{
        borderColor: `${selectedColor}25`,
        boxShadow: window.innerWidth > 1024 ? `0 10px 40px ${selectedColor}08` : 'none',
        '--card-color': selectedColor,
        '--card-color-dim': `${selectedColor}25`
      }}
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--gold)]/5 blur-[80px] opacity-10 pointer-events-none" />

      {/* Subtle Color Bar Accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-40 transition-opacity use-dynamic-bg"
        style={{ background: selectedColor }}
      />

      {/* Premium Color Flag */}
      <div
        className="absolute top-0 left-8 w-7 h-11 z-10 shadow-lg origin-top use-dynamic-bg"
        style={{
          background: selectedColor,
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 85%, 0% 100%)',
          boxShadow: `0 4px 15px ${selectedColor}40`
        }}
      />

      <div className="p-4 sm:p-7">
        <div className="flex justify-between items-start mb-4 sm:mb-8">
          <div className="relative">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-[22px] sm:rounded-[28px] overflow-hidden bg-[var(--bg-void)] border border-[var(--border-glass)] p-1 shadow-xl group-hover:rotate-3 transition-transform duration-500"
              style={{ boxShadow: `0 15px 40px ${selectedColor}15` }}
            >
              <div className="w-full h-full rounded-[18px] sm:rounded-[22px] overflow-hidden bg-[var(--bg-panel)] flex items-center justify-center relative">
                {data.image ? (
                  <img src={data.image} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="text-xl sm:text-2xl font-bold tracking-tighter use-dynamic-color" style={{ color: selectedColor }}>{initials}</span>
                )}
              </div>
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-[2.5px] sm:border-[3px] border-[var(--bg-panel)] shadow-lg bg-emerald-500"
            />
          </div>

          <div className="flex flex-col items-end gap-3">
            <div
              className="px-3 py-1 rounded-full border text-[8px] font-black capitalize tracking-[0.2em] bg-[var(--bg-void)]/40 flex items-center gap-1.5 use-dynamic-color use-dynamic-border"
              style={{ color: selectedColor, borderColor: `${selectedColor}30` }}
            >
              <Shield size={10} />
              <span>Admin</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setColorCh(!colorCh); }}
              className="p-2.5 rounded-xl bg-[var(--bg-panel)]/50 border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--gold)] sm:opacity-0 sm:group-hover:opacity-100 transition-all flex items-center justify-center relative z-10 active:scale-95"
            >
              <Palette size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] capitalize tracking-tight transition-colors leading-tight">
              {data.first_name} <br className="hidden sm:block" /> {data.last_name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
              <Shield size={10} className="use-dynamic-color" style={{ color: selectedColor }} />
              <p className="text-[9px] sm:text-[10px] font-black capitalize tracking-[0.2em] opacity-80 use-dynamic-color" style={{ color: selectedColor }}>
                {data.role?.replace('_', ' ') || "Administrator"}
              </p>
            </div>
          </div>

          <div className="py-4 sm:py-5 border-y border-[var(--border-glass)]">
            <div className="flex items-center justify-between opacity-80">
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-[var(--gold)]" />
                <span className="text-[10px] sm:text-[11px] font-black capitalize tracking-widest text-[var(--text-primary)]">Telefon</span>
              </div>
              <p className="text-xs font-bold tracking-widest text-[var(--text-primary)]">{data.phone_number || "ALOQA YO'Q"}</p>
            </div>
          </div>

          <div className="flex items-center justify-between group/action">
            <div className="flex items-center gap-2 text-[var(--text-muted)] font-bold text-[9px] sm:text-[10px] capitalize tracking-widest">
              <Shield size={12} className="opacity-50" />
              <span>Profilni ko'rish</span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] group-hover:bg-[var(--gold)] group-hover:text-black transition-all">
              <ChevronRight size={14} className="sm:w-4 sm:h-4" />
            </div>
          </div>
        </div>
      </div>

      {colorCh && (
        <div
          className="absolute inset-0 z-20 bg-[var(--bg-panel)]/98 backdrop-blur-2xl p-8 flex flex-col items-center justify-center gap-6 animate-in slide-in-from-bottom duration-500"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <h4 className="text-[11px] font-black text-[var(--gold)] capitalize tracking-[0.3em] mb-1">Vizual ko'rinish</h4>
            <p className="text-[9px] text-[var(--text-muted)] font-bold capitalize tracking-widest">Admin rangini tanlang</p>
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
          <div className="flex gap-2 sm:gap-3 w-full max-w-[180px]">
            <button onClick={saveNewColor} disabled={loading} className="lux-btn lux-btn-primary flex-1 !h-10 sm:!h-11 !text-[9px] sm:!text-[10px] !rounded-xl">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Tasdiqlash"}
            </button>
            <button onClick={() => { setColorCh(false); setSelectedColor(data.color); }} className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all">
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default AdminCard;