import { useNavigate } from "react-router-dom";
import {
  User,
  BookOpen,
  Users,
  Clock,
  Calendar,
  ChevronRight,
  CircleDot
} from "lucide-react";

export default function EachGroup({ data }) {
  const navigate = useNavigate();

  // Kunlarni chiroyli formatlash uchun yordamchi
  const getDayLabel = () => {
    if (data?.dars_kunlari) return data.dars_kunlari;
    if (data?.days === 'odd') return 'Toq';
    if (data?.days === 'even') return 'Juft';
    return 'Har kuni';
  };

  return (
    <tr
      onClick={() => navigate(`${data.id}`)}
      className="group border-b border-[var(--border-glass)] hover:bg-[var(--bg-void)] cursor-pointer"
    >
      {/* Guruh nomi va boshlanish sanasi */}
      <td className="px-6 py-3.5">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {data.name}
            </span>
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter border ${
              data.group_type === 'advanced' 
              ? 'bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/30' 
              : 'bg-white/5 text-white/40 border-white/10'
            }`}>
              {data.group_type === 'advanced' ? 'Advanced' : 'Standart'}
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-secondary)] font-bold flex items-center gap-1 capitalize tracking-widest opacity-60">
            <Calendar size={10} /> {data.start_date || "---"}
          </span>
        </div>
      </td>

      {/* Mentor */}
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <User size={12} className="text-blue-500" />
          <span className="truncate max-w-[120px] font-bold">
            {data.mentor ? `${data.mentor.first_name} ${data.mentor.last_name}` : "Biriktirilmagan"}
          </span>
        </div>
      </td>

      {/* Fan */}
      <td className="px-6 py-3.5 text-xs text-[var(--text-secondary)] font-medium">
        <div className="flex items-center gap-2">
          <BookOpen size={12} className="text-purple-500/50" />
          {data.subject}
        </div>
      </td>

      {/* O'quvchilar soni */}
      <td className="px-6 py-3.5 text-center">
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-[var(--border-glass)] rounded">
          <Users size={12} className="text-indigo-500" />
          <span className="text-xs font-bold text-[var(--text-primary)]">{data.students_count}</span>
        </div>
      </td>

      {/* Vaqt */}
      <td className="px-6 py-3.5 text-center">
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Clock size={12} className="text-amber-500/70" /> {data.dars_vaqti || "--:--"}
          </span>
        </div>
      </td>

      {/* Kunlar (Badge ko'rinishida) */}
      <td className="px-6 py-3.5 text-center">
        <span className={`text-[10px] font-black capitalize tracking-widest px-2 py-0.5 rounded border ${data?.days === 'odd' ? 'bg-blue-500/5 border-blue-500/20 text-blue-400' :
          data?.days === 'even' ? 'bg-purple-500/5 border-purple-500/20 text-purple-400' :
            'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
          }`}>
          {getDayLabel()}
        </span>
      </td>

      {/* Status */}
      <td className="px-6 py-3.5 text-center">
        <div className="flex items-center justify-center gap-1.5">
          {data.computed_status === 'active' && (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <span className="text-[10px] font-bold text-emerald-500 capitalize tracking-widest">Faol</span>
            </>
          )}
          {data.computed_status === 'waiting' && (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
              <span className="text-[10px] font-bold text-amber-500 capitalize tracking-widest">Kutilayotgan</span>
            </>
          )}
          {data.computed_status === 'activating_soon' && (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
              <span className="text-[10px] font-bold text-blue-500 capitalize tracking-widest">Yaqinda faol</span>
            </>
          )}
          {data.computed_status === 'inactive' && (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 opacity-50"></div>
              <span className="text-[10px] font-bold text-red-500/50 capitalize tracking-widest">Faol emas</span>
            </>
          )}
        </div>
      </td>

      {/* Action */}
      <td className="px-6 py-3.5 text-right">
        <div className="flex justify-end pr-4">
          <ChevronRight size={16} className="text-[var(--text-secondary)]" />
        </div>
      </td>
    </tr>
  );
}