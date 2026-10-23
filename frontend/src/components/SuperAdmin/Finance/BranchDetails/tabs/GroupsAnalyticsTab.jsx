import React, { useState, useMemo } from 'react';
import { Layers, Users, DollarSign, Activity, Target, CheckCircle, Search, UserCircle } from 'lucide-react';

const UnitMetric = ({ label, value, icon, gold, emerald, color }) => (
  <div>
    <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize mb-1 flex items-center gap-1">
      <span className="opacity-40">{icon}</span> {label}
    </p>
    <p
      className={`text-xs font-black tabular-nums tracking-tight ${
        color
          ? color
          : gold
          ? 'text-[var(--gold)]'
          : emerald
          ? 'text-emerald-400'
          : 'text-[var(--text-primary)]'
      }`}
    >
      {value}
    </p>
  </div>
);

export const GroupsAnalyticsTab = ({ groups = [], formatNumber }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    const term = searchTerm.toLowerCase();
    return groups.filter(
      (g) =>
        (g.name && g.name.toLowerCase().includes(term)) ||
        (g.mentor && g.mentor.toLowerCase().includes(term))
    );
  }, [groups, searchTerm]);

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 lux-card border-amber-500/20 bg-amber-500/[0.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                Guruhlar Tahlili
              </h2>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {groups.length} ta guruh
              </span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] font-bold mt-0.5">
              Har bir guruhning narxi, kutilayotgan va tushgan to'lovlari hamda samaradorligi
            </p>
          </div>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Guruh yoki mentor nomi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[var(--bg-void)]/60 border border-[#2a2a2a] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--gold)] transition-colors w-48 sm:w-64"
          />
        </div>
      </div>

      {/* Guruhlar ro'yxati */}
      {filteredGroups.length === 0 ? (
        <div className="lux-card !p-12 text-center border-dashed border-[#2a2a2a]">
          <Layers size={40} className="mx-auto text-[var(--text-muted)] opacity-30 mb-3" />
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">
            {searchTerm ? "Qidiruv bo'yicha guruh topilmadi" : "Ushbu filialda guruhlar mavjud emas"}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {searchTerm
              ? "Boshqa so'z bilan qidirib ko'ring yoki qidiruvni tozalang"
              : "Filialda faol guruhlar ro'yxati bo'sh."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredGroups.map((group) => {
            const groupProgress =
              group.expected_income > 0
                ? ((group.received_income / group.expected_income) * 100).toFixed(1)
                : 0;

            return (
              <div
                key={group.id}
                className="lux-card !p-5 hover:border-[var(--gold)]/40 transition-all duration-300 group"
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  {/* Guruh info */}
                  <div className="flex items-center gap-4 w-full lg:w-64 shrink-0">
                    <div className="w-11 h-11 rounded-xl bg-[var(--bg-void)] border border-[#2a2a2a] flex items-center justify-center text-[var(--gold)] shrink-0 group-hover:border-[var(--gold)]/40 transition-colors">
                      <Layers size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-tight truncate">
                        {group.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <UserCircle size={12} className="text-[var(--text-muted)] opacity-60" />
                        <p className="text-[10px] font-bold text-[var(--text-muted)] capitalize truncate">
                          {group.mentor || 'Biriktirilmagan'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Ko'rsatkichlar */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 flex-1 w-full">
                    <UnitMetric
                      label="A'zolar"
                      value={`${group.student_count ?? 0} nafar`}
                      icon={<Users size={12} />}
                    />
                    <UnitMetric
                      label="Oylik Narx"
                      value={formatNumber(group.monthly_price)}
                      icon={<DollarSign size={12} />}
                    />
                    <UnitMetric
                      label="Kunlik"
                      value={`${formatNumber(group.daily_price)}`}
                      icon={<Activity size={12} />}
                      color="text-blue-400"
                    />
                    <UnitMetric
                      label="Reja"
                      value={formatNumber(group.expected_income)}
                      icon={<Target size={12} />}
                      gold
                    />
                    <UnitMetric
                      label="Tushum"
                      value={formatNumber(group.received_income)}
                      icon={<CheckCircle size={12} />}
                      emerald
                    />
                    {group.refund_amount > 0 ? (
                      <UnitMetric
                        label="Refund"
                        value={`-${formatNumber(group.refund_amount)}`}
                        icon={<DollarSign size={12} />}
                        color="text-rose-400"
                      />
                    ) : (
                      <div className="flex flex-col justify-center">
                        <span className="text-[8px] font-bold text-[var(--text-muted)] mb-1">
                          Samaradorlik
                        </span>
                        <div
                          className={`px-2 py-1 rounded-md text-center text-[10px] font-black tabular-nums border ${
                            groupProgress >= 80
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : groupProgress >= 50
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {groupProgress}% Ef.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupsAnalyticsTab;
