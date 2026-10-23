import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowUpRight, ShieldCheck, Wallet, Sparkles, AlertCircle } from 'lucide-react';

export const SpecialStudentsTab = ({ b_id, branchName }) => {
  return (
    <div className="space-y-6">
      {/* Asosiy banner karta */}
      <div className="lux-card !p-8 border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-[var(--bg-void)]/80 to-transparent relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 shadow-lg shadow-purple-500/10">
              <Users size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                  Maxsus O'quvchilar Dushbordi
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 tracking-wider">
                  Eksklyuziv
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] max-w-xl leading-relaxed">
                {branchName} filialidagi imtiyozli, maxsus kelishilgan to'lovdagi va ehtiyojmand o'quvchilar uchun
                chuqur moliyaviy tahlil, balanslar va wallet hisoboti.
              </p>
            </div>
          </div>

          <Link
            to={`/super_admin/all-payments/branch-details/${b_id}/special-students`}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-purple-600/30 shrink-0 cursor-pointer"
          >
            <span>Dushbordni Ochish</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      {/* Imkoniyatlar va ko'rsatkichlar kartalari */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="lux-card !p-5 border border-[#2a2a2a] hover:border-purple-500/30 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
            <Sparkles size={20} />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">
            Imtiyozli To'lovlar
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Har bir o'quvchiga belgilangan shaxsiy chegirmalar va grantlar hisobi.
          </p>
        </div>

        <div className="lux-card !p-5 border border-[#2a2a2a] hover:border-purple-500/30 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
            <Wallet size={20} />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">
            Wallet Balanslari
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            O'quvchilarning oldindan to'langan qoldiq mablag'lari va xarajatlar monitoringi.
          </p>
        </div>

        <div className="lux-card !p-5 border border-[#2a2a2a] hover:border-purple-500/30 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
            <ShieldCheck size={20} />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">
            Shaffof Nazorat
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Adminlar tomonidan kiritilgan chegirma asoslari va tasdiqlovchi hujjatlar tahlili.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SpecialStudentsTab;
