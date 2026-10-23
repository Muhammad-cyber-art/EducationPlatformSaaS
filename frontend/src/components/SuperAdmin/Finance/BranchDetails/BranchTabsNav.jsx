import React from 'react';
import { DollarSign, TrendingDown, Layers, Users } from 'lucide-react';

export const BranchTabsNav = ({
  activeTab,
  onTabChange,
  expensesCount = 0,
  groupsCount = 0,
  progressPercentage = 0,
}) => {
  const tabs = [
    {
      id: 'finance',
      label: 'Moliya & Tushumlar',
      icon: <DollarSign size={15} />,
      badge: `${progressPercentage}% natija`,
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    {
      id: 'expenses',
      label: 'Filial Chiqimlari',
      icon: <TrendingDown size={15} />,
      badge: `${expensesCount} ta`,
      badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
    {
      id: 'groups',
      label: 'Guruhlar Tahlili',
      icon: <Layers size={15} />,
      badge: `${groupsCount} ta`,
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    {
      id: 'special',
      label: "Maxsus O'quvchilar",
      icon: <Users size={15} />,
      badge: 'Wallet',
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
  ];

  return (
    <div className="border-b border-[#2a2a2a] pb-1">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/40 shadow-sm shadow-[var(--gold)]/5'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-void)]/40 border border-transparent'
              }`}
            >
              <span className={isActive ? 'text-[var(--gold)]' : 'opacity-60'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border tracking-wider tabular-nums ${tab.badgeColor}`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BranchTabsNav;
