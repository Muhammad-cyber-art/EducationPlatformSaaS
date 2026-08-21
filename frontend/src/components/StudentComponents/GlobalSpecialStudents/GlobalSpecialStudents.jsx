import React from "react";
import { Loader2, SearchCode, User, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Hooks
import { useGlobalSpecialStudents } from "./useGlobalSpecialStudents";

// Components
import GlobalStudentsSearch from "../GlobalStudents/GlobalStudentsSearch";

export default function GlobalSpecialStudents() {
  const {
    students,
    loading,
    searchTerm,
    setSearchTerm,
    navigate
  } = useGlobalSpecialStudents();

  return (
    <div className="animate-lux-fade">
      {/* BACKGROUND ATMOSPHERE */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[20%] left-0 w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
      </div>

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all duration-300"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight capitalize">
            Maxsus O'quvchilar Ro'yxati
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-bold tracking-wide mt-1">
            Imtiyozli, kam ta'minlangan va kelishilgan o'quvchilar bazasi
          </p>
        </div>
      </div>

      <GlobalStudentsSearch
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        loading={loading}
      />

      {/* RESULT AREA */}
      <div className="min-h-[500px]">
        {loading && students.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
            <Loader2 size={40} className="animate-spin" color="var(--gold)" />
          </div>
        ) : (
          <div className="lux-card overflow-hidden border border-[var(--border-glass)]">
            <div className="p-4 sm:p-5 border-b border-[var(--border-glass)] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--bg-void)]/40 gap-4">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <User size={16} className="text-[var(--gold)]" /> Maxsus Ro'yxat
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[var(--bg-void)]/80 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                    <th className="py-4 px-5 border-b border-[var(--border-glass)]">O'quvchi</th>
                    <th className="py-4 px-5 border-b border-[var(--border-glass)]">Aloqa</th>
                    <th className="py-4 px-5 border-b border-[var(--border-glass)]">Status</th>
                    <th className="py-4 px-5 border-b border-[var(--border-glass)]">Guruh</th>
                    <th className="py-4 px-5 border-b border-[var(--border-glass)] text-right">Kelishilgan Narx</th>
                  </tr>
                </thead>
                <tbody className="text-[11px] font-bold text-[var(--text-primary)] divide-y divide-[var(--border-glass)]">
                  {students.map((student) => {
                    const statusLabels = {
                      discount: "Imtiyozli",
                      low_income: "Kam ta'minlangan",
                      negotiated: "Kelishilgan",
                      teacher_negotiated: "O'qituvchi",
                      regular: "Oddiy",
                    };
                    const statusClass = student.status === 'discount' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                          student.status === 'low_income' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                          student.status === 'teacher_negotiated' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                          student.status === 'negotiated' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

                    return (
                      <tr 
                        key={student.id} 
                        className="hover:bg-[var(--bg-void)]/20 transition-colors cursor-pointer"
                        onClick={() => navigate(`../${student.id}`)}
                      >
                        <td className="py-3 px-5">
                          <div className="flex flex-col">
                            <span className="text-[12px] text-white hover:text-[var(--gold)] transition-colors">{student.full_name}</span>
                            <span className="text-[9px] text-[var(--text-muted)] mt-0.5">ID: #{student.id}</span>
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[var(--text-secondary)]">O'zi: {student.phone || "-"}</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">Ota-ona: {student.parent_phone || "-"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-[9px] border uppercase tracking-widest ${statusClass}`}>
                            {statusLabels[student.status] || "Noma'lum"}
                          </span>
                        </td>
                        <td className="py-3 px-5">
                          <span className="text-[11px] text-[var(--gold)] bg-[var(--gold)]/10 px-2 py-1 rounded border border-[var(--gold)]/20">
                            {student.group?.name || "Yakkaxon"}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right font-black text-amber-400 tabular-nums">
                          {student.custom_fee ? `${student.custom_fee.toLocaleString()} UZS` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {students.length === 0 && !loading && (
              <div className="py-24 flex flex-col items-center justify-center text-center opacity-50">
                <User size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
                <h3 className="text-[16px] font-bold capitalize text-[var(--text-primary)]">Maxsus O'quvchilar topilmadi</h3>
                <p className="text-[12px] font-medium text-[var(--text-secondary)] mt-2">Hech qanday o'quvchi mavjud emas.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
