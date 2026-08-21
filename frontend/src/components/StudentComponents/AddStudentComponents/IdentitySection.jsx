import React from 'react';
import { ArrowLeft, Camera, X, FileText } from 'lucide-react';

const IdentitySection = ({ navigate, hasGroupId, paramGroupId, preview, handleImageChange, removeImage, notes, handleChange }) => (
  <div className="lg:col-span-4 space-y-6">
    <div className="lux-card">
      <div className="flex items-center gap-4 mb-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-3 bg-[var(--gold-dim)] text-[var(--gold)] rounded-xl border border-[var(--gold)]/20 hover:scale-105 active:scale-95 transition-all outline-none"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="h-0.5 w-12 bg-[var(--gold)] opacity-30"></div>
      </div>
      <h1 className="gold-text !text-4xl">Yangi <br /> O'quvchi</h1>
      <p className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.4em] mt-3">
        {hasGroupId ? `Guruh ID: #${paramGroupId}` : "Guruh tanlanmagan"}
      </p>
    </div>

    <div className="lux-card flex flex-col items-center py-10">
      <div className="relative group">
        <div className="w-48 h-48 bg-[var(--bg-void)] border-2 border-dashed border-[var(--border-glass)] rounded-3xl flex items-center justify-center overflow-hidden transition-all group-hover:border-[var(--gold)]/50 group-hover:shadow-[0_0_40px_rgba(184,134,11,0.15)]">
          {preview ? (
            <img src={preview} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="text-center opacity-40">
              <Camera size={48} className="mx-auto mb-4" />
              <span className="text-[10px] font-black capitalize tracking-widest">Rasm yuklash</span>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
        </div>
        {preview && (
          <button type="button" onClick={removeImage} className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all">
            <X size={18} className="text-white" />
          </button>
        )}
      </div>
      <p className="mt-6 text-[11px] font-bold text-[var(--text-secondary)] capitalize tracking-[0.2em]">O'quvchi rasmi</p>
    </div>

    <div className="lux-card lg:mt-6">
      <div className="flex items-center gap-3 mb-5 border-b border-[var(--border-glass)] pb-4">
        <FileText size={18} className="text-[var(--gold)]" />
        <h2 className="!text-white capitalize tracking-widest text-sm">Qo'shimcha ma'lumotlar</h2>
      </div>
      <textarea
        name="notes"
        value={notes}
        onChange={handleChange}
        placeholder="O'quvchi haqida qo'shimcha izohlar..."
        className="lux-input !h-32 !bg-[#0a0a0a] !resize-none !text-xs !leading-relaxed"
      ></textarea>
    </div>
  </div>
);

export default IdentitySection;
