import React from 'react';
import { Users, UserCircle, Layers, GraduationCap } from 'lucide-react';

const BranchStatCard = ({ label, value, icon, color, nom }) => (
  <div className="lux-card !p-3.5 hover:border-[var(--gold)]/30 transition-colors">
    <div className="flex justify-between items-start mb-3">
      <div className={`p-2 bg-[var(--bg-void)]/60 rounded-lg border border-[#2a2a2a] ${color}`}>
        {icon}
      </div>
      <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </span>
    </div>
    <p className="text-[9px] font-bold text-[var(--text-muted)] capitalize mb-0.5">{nom}</p>
    <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight tabular-nums">
      {value ?? 0}
    </h3>
  </div>
);

export const BranchStatsGrid = ({ stats = {} }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <BranchStatCard
      nom="Mentorlar"
      label="O'qituvchilar"
      value={stats.mentors}
      icon={<Users size={18} />}
      color="text-[var(--gold)]"
    />
    <BranchStatCard
      nom="Adminlar"
      label="Administratorlar"
      value={stats.admins}
      icon={<UserCircle size={18} />}
      color="text-emerald-400"
    />
    <BranchStatCard
      nom="Guruhlar"
      label="Faol Guruhlar"
      value={stats.groups}
      icon={<Layers size={18} />}
      color="text-amber-400"
    />
    <BranchStatCard
      nom="O'quvchilar"
      label="Jami Ta'lim Oluvchilar"
      value={stats.students}
      icon={<GraduationCap size={18} />}
      color="text-blue-400"
    />
  </div>
);

export default BranchStatsGrid;
