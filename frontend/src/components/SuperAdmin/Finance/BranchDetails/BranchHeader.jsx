import React from 'react';
import { Building2, Activity } from 'lucide-react';
import GoBackButton from '../../../sendback';
import ThemeToggle from '../../../ThemeToggle';

export const BranchHeader = ({ branchName, periodControls }) => (
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#2a2a2a] mt-3">
    <div className="flex items-center gap-6">
      <GoBackButton />
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight capitalize">
          Filial Ko'rsatkichlari
        </h1>
        <p className="text-[10px] text-[var(--text-muted)] font-bold capitalize flex items-center gap-2 mt-0.5">
          <Building2 size={12} className="text-[var(--gold)]" />
          <span className="text-[var(--text-primary)]">{branchName}</span>
        </p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3 justify-start lg:justify-end">
      {periodControls}
      <div className="flex items-center h-9 px-3 bg-[var(--bg-void)]/40 border border-[#2a2a2a] rounded-lg">
        <span className="text-[9px] font-bold text-[var(--text-primary)] capitalize tracking-widest flex items-center gap-2">
          <Activity size={12} className="text-[var(--gold)]" />
          Jonli Tahlil
        </span>
      </div>
      <ThemeToggle />
    </div>
  </div>
);

export default BranchHeader;
