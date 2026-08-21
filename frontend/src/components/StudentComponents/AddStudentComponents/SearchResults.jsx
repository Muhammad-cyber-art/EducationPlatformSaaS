import React from 'react';
import { Search, User, X, CheckCircle2 } from 'lucide-react';

const SearchResults = ({ results, phone, fullName, enrollmentToggles, setEnrollmentToggles, handleEnrollExisting }) => {
  if (results.length === 0) return null;

  return (
    <div className="md:col-span-2 space-y-3 bg-[var(--bg-void)]/80 p-4 rounded-2xl border border-[var(--gold)]/20 animate-in fade-in slide-in-from-top-2">
      <p className="text-[10px] font-black text-[var(--gold)] capitalize tracking-widest flex items-center gap-2">
        <Search size={12} /> Tizimda o'xshash o'quvchilar topildi:
      </p>
      <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
        Loyiha mantiqidan kelib chiqib: Agar bu o'quvchi allaqachon mavjud bo'lsa, <b>"Biriktirish"</b> ni bosing.
        Agar ismi o'xshash boshqa inson bo'lsa, pastdagi <b>"O'quvchini saqlash"</b> tugmasi orqali yangi rekord yarating.
      </p>
      {results.map(student => {
        const cleanPhoneInput = phone.replace(/\D/g, '');
        const cleanStudentPhone = student.phone?.replace(/\D/g, '') || '';
        const isPhoneExact = cleanPhoneInput.length >= 7 && cleanStudentPhone.includes(cleanPhoneInput);
        const isNameSimilar = student.full_name?.toLowerCase().includes(fullName.toLowerCase()) ||
          fullName.toLowerCase().includes(student.full_name?.toLowerCase());

        return (
          <div key={student.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isPhoneExact ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/5 border-white/5'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPhoneExact ? 'bg-amber-500/20 text-amber-500' : 'bg-[var(--gold)]/10 text-[var(--gold)]'}`}>
                <User size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{student.full_name}</p>
                  {isPhoneExact && !isNameSimilar && fullName && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-[8px] font-black rounded capitalize flex items-center gap-1">
                      <X size={8} /> Ism farqli!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-[var(--text-muted)]">{student.phone}</p>
                  {isPhoneExact && (
                    <span className="text-[8px] text-amber-500 font-bold capitalize tracking-tighter decoration-amber-500/50 underline underline-offset-2">Telefon mos keldi</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 pr-2 border-r border-white/10 group/switch">
                <span className={`text-[8px] font-bold capitalize transition-colors ${enrollmentToggles[student.id] ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}> Billing </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={enrollmentToggles[student.id] !== false}
                    onChange={(e) => setEnrollmentToggles(prev => ({ ...prev, [student.id]: e.target.checked }))}
                  />
                  <div className="w-9 h-5 bg-white/10 rounded-full peer-checked:bg-amber-500/80 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 shadow-xl"></div>
                </label>
              </div>

              <button
                type="button"
                onClick={() => handleEnrollExisting(student.id)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black capitalize hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ${isPhoneExact ? 'bg-amber-500 text-black' : 'bg-[var(--gold)] text-black'}`}
              >
                <CheckCircle2 size={14} /> Biriktirish
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SearchResults;
