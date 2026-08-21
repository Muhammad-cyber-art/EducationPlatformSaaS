import React from "react";
import { User, Camera, ShieldCheck, Activity, Send, Phone, Clock, Unplug } from "lucide-react";
import { getPaymentStatus } from "./paymentStatus";

const StudentProfileHeader = ({
  studentData,
  isEditing,
  editData,
  previewImage,
  primaryPayment,
  student_id,
  dispatch,
  handleImageChange,
  disconnectBotMutation
}) => {
  const payStatus = getPaymentStatus(primaryPayment);
  
  // Choose ring color based on payment status
  const ringColor = payStatus.key === 'paid' ? 'ring-emerald-500/50' : payStatus.key === 'partial' ? 'ring-amber-500/50' : 'ring-rose-500/50';

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 pb-6 border-b border-[var(--border-glass)] relative">
      
      {/* Avatar Container */}
      <div className="relative group/avatar shrink-0 mt-2 sm:mt-0">
        <div
          className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-[var(--bg-panel)] p-1 ring-2 ring-offset-4 ring-offset-[var(--bg-void)] ${ringColor} transition-all duration-300 shadow-xl`}
        >
          <div className="w-full h-full rounded-full overflow-hidden bg-[var(--bg-void)] flex items-center justify-center relative">
            {previewImage ? (
              <img src={previewImage} className="w-full h-full object-cover" alt="" />
            ) : studentData?.image ? (
              <img src={studentData.image} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full bg-[var(--bg-panel)]">
                <span className="text-3xl sm:text-4xl font-black text-[var(--text-secondary)] uppercase tracking-widest">
                  {studentData?.full_name?.[0] || <User size={32} className="opacity-50" />}
                </span>
              </div>
            )}

            {isEditing && (
              <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300">
                <Camera size={20} className="text-white mb-1" />
                <span className="text-[9px] font-bold text-white uppercase tracking-wider">O'zgartirish</span>
                <input type="file" className="hidden" onChange={handleImageChange} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Info Container */}
      <div className="flex-1 text-center sm:text-left flex flex-col justify-center sm:pt-2 w-full">
        
        {/* Name and Edit Input */}
        <div className="mb-1.5">
          {isEditing ? (
            <input
              className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] capitalize bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl px-4 py-2 w-full max-w-md outline-none focus:border-[var(--text-primary)]/50 focus:ring-4 focus:ring-[var(--text-primary)]/10 transition-all shadow-inner"
              value={editData.full_name || ""}
              onChange={e => dispatch({ type: 'UPDATE_EDIT_FIELD', payload: { full_name: e.target.value } })}
              placeholder="O'quvchi ism-sharifi..."
            />
          ) : (
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight capitalize">
              {studentData?.full_name || "Noma'lum o'quvchi"}
            </h1>
          )}
        </div>

        {/* Subtext: ID and Date */}
        {!isEditing && (
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm font-medium text-[var(--text-muted)] mb-4">
            <span className="font-mono bg-[var(--bg-panel)] px-2 py-0.5 rounded border border-[var(--border-glass)]">ID: #{student_id}</span>
            <span className="opacity-50">•</span>
            <span>Qo'shilgan: {studentData?.joined_at ? new Date(studentData.joined_at).toLocaleDateString() : 'Noma\'lum'}</span>
          </div>
        )}

        {/* Contact Group */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
          {!isEditing && studentData?.phone && (
            <a 
              href={`tel:${studentData.phone}`}
              className="flex items-center gap-2 text-[var(--text-secondary)] text-xs sm:text-sm font-bold bg-[var(--bg-panel)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-panel)] transition-colors px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-[var(--border-glass)] shadow-sm group"
            >
              <Phone size={14} className="opacity-70 group-hover:opacity-100" />
              <span className="tracking-wide">{studentData.phone}</span>
            </a>
          )}

          {!isEditing && studentData?.telegram_id && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0088cc]/10 border border-[#0088cc]/20 text-[#0088cc] shadow-sm">
                <Send size={14} className="fill-current" />
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest">Bot Ulangan</span>
              </div>
              
              {/* Disconnect Button (Ghost) */}
              <button
                onClick={() => {
                  if (window.confirm("Rostdan ham o'quvchini Telegram botdan uzmoqchimisiz? U qayta start bosib kirishi kerak bo'ladi.")) {
                    disconnectBotMutation?.mutate();
                  }
                }}
                disabled={disconnectBotMutation?.isPending}
                className="p-1.5 sm:p-2 rounded-xl text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                title="Botdan uzish"
              >
                <Unplug size={16} />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default StudentProfileHeader;
