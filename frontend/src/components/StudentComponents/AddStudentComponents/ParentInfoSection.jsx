import React from 'react';
import { Users, User, Phone, MapPin } from 'lucide-react';

const ParentInfoSection = ({ formData, handleChange }) => (
  <div className="lux-card">
    <div className="flex items-center gap-4 mb-10 border-b border-[var(--border-glass)] pb-6">
      <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center text-purple-500">
        <Users size={24} />
      </div>
      <div>
        <h2 className="!text-white !text-lg capitalize font-black">Ota-ona ma'lumotlari</h2>
        <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-widest mt-1">Bog'lanish uchun</p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-2">
        <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 block">Ota-onasi (F.I.SH)</label>
        <div className="lux-input-group">
          <User size={16} />
          <input name="parent_name" value={formData.parent_name} onChange={handleChange} placeholder="Otasi yoki onasi" className="lux-input !bg-[#0a0a0a] capitalize" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 block">Qo'shimcha telefon</label>
        <div className="lux-input-group">
          <Phone size={16} />
          <input name="parent_phone" value={formData.parent_phone} onChange={handleChange} placeholder="+998 9X XXX XX XX" className="lux-input !bg-[#0a0a0a] capitalize" />
        </div>
      </div>
      <div className="md:col-span-2 space-y-2">
        <label className="text-[10px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1.5 block">Yashash manzili</label>
        <div className="lux-input-group">
          <MapPin size={16} />
          <input name="address" value={formData.address} onChange={handleChange} placeholder="Manzilni kiriting" className="lux-input !bg-[#0a0a0a] capitalize" />
        </div>
      </div>
    </div>
  </div>
);

export default ParentInfoSection;
