import React from "react";
import { AlignLeft, DollarSign, Calendar, UserCheck, ChevronRight } from "lucide-react";
import AmountInput from "../../Common/AmountInput";
import WeekdaySelector from "../WeekdaySelector";
import { formatDaysDisplay, normalizeCustomDays } from "../../../utils/scheduleUtils";

const GroupEditForm = ({
  editData,
  mentors,
  uiDispatch,
  handleUpdate
}) => {
  const customDays = normalizeCustomDays(editData.custom_days, editData.days);
  const timeParts = (editData.dars_vaqti || "").split("-").map((t) => t.trim());
  const startTime = timeParts[0] || "";
  const endTime = timeParts[1] || "";

  return (
    <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center gap-2 mb-4">
        <span className="text-[10px] font-black text-[var(--gold)] capitalize tracking-[0.5em]">Tahrirlash rejimi</span>
        <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)] capitalize tracking-widest">Guruh parametrlarini sozlash</h3>
        <div className="w-16 h-0.5 bg-[var(--gold)]/40 rounded-full mt-2" />
      </div>

      <div className="lux-card !p-5 sm:!p-10 border-[var(--gold)]/10 shadow-[0_30px_60px_-15px_rgba(184,134,11,0.08)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">

          {/* General Info Group */}
          <div className="space-y-6">
            <h4 className="text-[11px] font-black text-[var(--gold)] capitalize tracking-[0.3em] pb-3 border-b border-[var(--border-glass)] flex items-center gap-2">
              <AlignLeft size={14} /> Umumiy ma'lumotlar
            </h4>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Guruh nomi</label>
                <input
                  className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full"
                  value={editData.name || ""}
                  onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { name: e.target.value } })}
                  placeholder="Masalan: IELTS Group #1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Fan / Kurs nomi</label>
                <input
                  className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full"
                  value={editData.subject || ""}
                  onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { subject: e.target.value } })}
                  placeholder="Masalan: General English"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Guruh toifasi</label>
                <div className="relative">
                  <select
                    className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full appearance-none"
                    value={editData.group_type || "standard"}
                    onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { group_type: e.target.value } })}
                  >
                    <option value="standard">Standart</option>
                    <option value="advanced">Advanced</option>
                  </select>
                  <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] rotate-90 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Oylik to'lov (UZS)</label>
                  <div className="relative">
                    <AmountInput
                      className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12 !pr-5 w-full"
                      value={editData.monthly_price || ""}
                      onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { monthly_price: e.target.value } })}
                      placeholder="0.00"
                    />
                    <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Guruh rangi (HEX)</label>
                  <div className="flex gap-3">
                    <input
                      className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 flex-1"
                      value={editData.color || ""}
                      onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { color: e.target.value } })}
                      placeholder="#b8860b"
                    />
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl border border-[var(--border-glass)] shrink-0 shadow-lg" style={{ background: editData.color || '#b8860b' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Logistics & Schedule */}
          <div className="space-y-6">
            <h4 className="text-[11px] font-black text-[var(--gold)] capitalize tracking-[0.3em] pb-3 border-b border-[var(--border-glass)] flex items-center gap-2">
              <Calendar size={14} /> Logistika va Jadval
            </h4>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Mas'ul O'qituvchi</label>
                <div className="relative">
                  <select
                    className="lux-input !bg-[var(--bg-void)]/50 !py-4 !pl-12 !pr-8 w-full appearance-none"
                    value={editData.mentor_id || ""}
                    onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { mentor_id: e.target.value } })}
                  >
                    <option value="">O'qituvchini tanlang</option>
                    {Array.isArray(mentors) && mentors.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.username || `ID: ${m.id}`}
                      </option>
                    ))}
                  </select>
                  <UserCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] rotate-90" />
                </div>
              </div>
              {/* Weekday Selector Component */}
              <div className="pt-2">
                <WeekdaySelector
                  value={customDays}
                  onChange={(newDays) => {
                    uiDispatch({
                      type: "UPDATE_EDIT_DATA",
                      payload: {
                        custom_days: newDays,
                        dars_kunlari: formatDaysDisplay(newDays, false),
                      },
                    });
                  }}
                  startTime={startTime}
                  endTime={endTime}
                  onTimeChange={({ timeString }) => {
                    uiDispatch({
                      type: "UPDATE_EDIT_DATA",
                      payload: { dars_vaqti: timeString },
                    });
                  }}
                  monthlyPrice={editData.monthly_price}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Boshlanish sanasi</label>
                  <input
                    type="date"
                    className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full"
                    value={editData.start_date || ""}
                    onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { start_date: e.target.value } })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Dars vaqti (matn)</label>
                  <input
                    className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-5 w-full"
                    value={editData.dars_vaqti || ""}
                    onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { dars_vaqti: e.target.value } })}
                    placeholder="14:00 - 16:00"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-2">
          <label className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest ml-1">Guruh tavsifi (Description)</label>
          <textarea
            className="lux-input !bg-[var(--bg-void)]/50 !py-4 !px-6 w-full min-h-[120px] resize-none"
            value={editData.description || ""}
            onChange={(e) => uiDispatch({ type: "UPDATE_EDIT_DATA", payload: { description: e.target.value } })}
            placeholder="Guruh haqida batafsil ma'lumot..."
          />
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--border-glass)] flex items-center justify-end gap-4">
          <button
            onClick={() => uiDispatch({ type: "SET_FIELD", field: "isEditing", value: false })}
            className="px-8 py-3.5 rounded-xl border border-[var(--border-glass)] text-[10px] font-black capitalize tracking-widest hover:bg-white/5 transition-all text-[var(--text-secondary)]"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleUpdate}
            className="px-12 py-3.5 bg-[var(--gold)] text-black rounded-xl text-[10px] font-black capitalize tracking-widest shadow-lg transition-opacity hover:opacity-90 active:scale-95"
          >
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupEditForm;
