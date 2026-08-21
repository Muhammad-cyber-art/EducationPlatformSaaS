import React from 'react';
import { User, Phone, Calendar } from 'lucide-react';
import SearchResults from './SearchResults';

const PersonalDataSection = ({ hasGroupId, groups, formData, handleChange, searching, searchResults, enrollmentToggles, setEnrollmentToggles, handleEnrollExisting }) => (
  <div className="lux-card">
    <div className="flex items-center gap-4 mb-10 border-b border-[var(--border-glass)] pb-6">
      <div className="w-12 h-12 bg-[var(--gold-dim)] border border-[var(--gold)]/20 rounded-2xl flex items-center justify-center text-[var(--gold)]">
        <User size={24} />
      </div>
      <div>
        <h2 className="!text-white !text-lg capitalize font-black">Shaxsiy ma'lumotlar</h2>
        <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-widest mt-1">Asosiy ma'lumotlar</p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {!hasGroupId && (
        <div className="md:col-span-2">
          <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-3 block">Guruhni tanlang *</label>
          <select name="group" value={formData.group} onChange={handleChange} required className="lux-input !bg-[#0a0a0a]">
            <option value="">Guruhlar yuklanmoqda...</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name} — {g.subject}</option>
            ))}
          </select>
        </div>
      )}

      <div className="md:col-span-2 space-y-2">
        <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 block">To'liq ism-sharifi *</label>
        <div className="lux-input-group">
          <User size={16} />
          <input name="full_name" value={formData.full_name} onChange={handleChange} required placeholder="Alisher Navoiy" className="lux-input !bg-[#0a0a0a] capitalize font-bold" />
        </div>
      </div>

      <div className="lux-input-group relative">
        <Phone size={16} />
        <input name="phone" value={formData.phone} onChange={handleChange} required placeholder="+998 90 123 45 67" className="lux-input !py-4 !pl-12 !bg-[#0a0a0a] text-sm font-bold w-full capitalize" />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      <SearchResults
        results={searchResults}
        phone={formData.phone}
        fullName={formData.full_name}
        enrollmentToggles={enrollmentToggles}
        setEnrollmentToggles={setEnrollmentToggles}
        handleEnrollExisting={handleEnrollExisting}
      />

      <div className="space-y-2">
        <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 block">Tug'ilgan sana</label>
        <div className="lux-input-group">
          <Calendar size={16} />
          <input name="birth_date" value={formData.birth_date} onChange={handleChange} type="date" className="lux-input !bg-[#0a0a0a]" />
        </div>
      </div>
    </div>
  </div>
);

export default PersonalDataSection;
