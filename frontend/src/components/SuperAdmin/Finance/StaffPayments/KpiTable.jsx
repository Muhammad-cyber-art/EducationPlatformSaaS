import React from "react";
import { Users, CheckCircle2 } from "lucide-react";

const KpiTable = ({
  data,
  isPercentageType,
  isStudentCountType,
  formatCurrency,
  setSelectedGroupForDebtors,
  groupConfigs = [],
  kpiLoading
}) => {
  // Find group config for a group
  const getGroupConfig = (groupId) => {
    return groupConfigs.find(config => {
      const configGroupId = typeof config.group === 'object' && config.group !== null
        ? config.group.id
        : Number(config.group);
      return configGroupId === groupId;
    });
  };

  // KPI yuklanayotganda skeleton jadval ko'rsatish
  if (kpiLoading) {
    return (
      <div className="bg-[var(--bg-panel)] border border-emerald-500/10 rounded-2xl overflow-hidden shadow-xl mt-4 animate-pulse">
        <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#2a2a2a] rounded" />
            <div className="h-3 w-28 bg-[#2a2a2a] rounded" />
          </div>
          <div className="h-5 w-32 bg-[#2a2a2a] rounded-full" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="space-y-1.5">
                <div className="h-3 w-28 bg-[#2a2a2a] rounded" />
                <div className="h-2 w-16 bg-[#2a2a2a] rounded" />
              </div>
              <div className="h-3 w-12 bg-[#2a2a2a] rounded" />
              <div className="h-3 w-20 bg-[#2a2a2a] rounded" />
              <div className="h-3 w-16 bg-[#2a2a2a] rounded" />
              <div className="h-6 w-20 bg-[#2a2a2a] rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }


  // Agar guruhlar bo'lsa, jadvalni ko'rsatamiz (salary_type dan qat'i nazar)
  if (data.mentor_groups && data.mentor_groups.length > 0) {
    const isSCT = isStudentCountType;
    
    return (
      <div className={`bg-[var(--bg-panel)] border ${isSCT ? 'border-blue-500/10' : 'border-emerald-500/10'} rounded-2xl overflow-hidden shadow-xl mt-4`}>
        <div className={`px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between ${isSCT ? 'bg-blue-500/5' : 'bg-emerald-500/5'}`}>
          <div className={`flex items-center gap-2 ${isSCT ? 'text-blue-400' : 'text-emerald-400'}`}>
            <Users size={16} />
            <span className="text-[11px] font-black capitalize tracking-widest">{isSCT ? "O'quvchilar tahlili" : "Guruhlar tahlili"}</span>
          </div>
          <div className={`px-3 py-1 rounded-full ${isSCT ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'} border`}>
            <span className={`text-[8px] font-black ${isSCT ? 'text-blue-400' : 'text-emerald-400'} capitalize tracking-widest`}>
              Real Tushum: {formatCurrency(data.groups_income)}
            </span>
          </div>
        </div>
        <div className="p-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest">Guruh & Narx</th>
                <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest text-center">Talaba</th>
                <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest text-right">Tushum (Real/Max)</th>
                {(isPercentageType || isStudentCountType) && (
                  <th className={`px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest text-right ${isSCT ? 'text-blue-400' : 'text-emerald-400'}`}>Ulush</th>
                )}
                <th className="px-4 py-3 text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest text-center">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a2a]">
              {data.mentor_groups?.map((group) => {
                const config = getGroupConfig(group.id);
                
                return (
                  <tr key={group.id} className={`hover:${isSCT ? 'bg-blue-500/[0.02]' : 'bg-emerald-500/[0.02]'} transition-colors group`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-black text-[var(--text-primary)] leading-tight capitalize">{group.name}</p>
                        {config && (
                          <span className={`px-2 py-0.5 rounded text-[7px] font-black tracking-wider ${
                            config.salary_type === 'percentage' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
                          }`}>
                            {config.salary_type === 'percentage' 
                              ? `${config.commission_percentage}%` 
                              : `${Number(config.per_student_amount).toLocaleString('uz-UZ')}`}
                          </span>
                        )}
                      </div>
                      <p className={`text-[8px] font-black capitalize tracking-widest ${isSCT ? 'text-blue-400' : 'text-emerald-400'}`}>{formatCurrency(group.monthly_price)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center font-black text-[10px] text-[var(--text-primary)] tabular-nums">
                      {group.paid_students_count || 0} / {group.students_count || 0}
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-[10px] tabular-nums whitespace-nowrap">
                      <span className="text-emerald-500">{formatCurrency(group.real_income || group.monthly_income)}</span>
                      <span className="text-[var(--text-muted)] mx-1">/</span>
                      <span className="text-[var(--text-muted)]">{formatCurrency(group.expected_income)}</span>
                    </td>
                    {(isPercentageType || isStudentCountType) && (
                      <td className={`px-4 py-3.5 text-right font-black text-[10px] tabular-nums ${isSCT ? 'text-blue-400' : 'text-emerald-400'}`}>
                        {formatCurrency(group.mentor_share_paid || 0)}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-center">
                      {group.unpaid_students && group.unpaid_students.length > 0 ? (
                        <button
                          onClick={() => setSelectedGroupForDebtors(group)}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20 rounded-lg text-[8px] font-black capitalize tracking-widest transition-all flex items-center gap-1.5 mx-auto shadow-sm"
                        >
                          <Users size={10} />
                          Qarzdorlar ({group.unpaid_students.length})
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedGroupForDebtors(group)}
                          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-lg text-[8px] font-black capitalize tracking-widest transition-all flex items-center gap-1.5 mx-auto shadow-sm"
                        >
                          <CheckCircle2 size={10} />
                          Ok ({group.paid_students_count || group.students_count})
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};

export default KpiTable;
