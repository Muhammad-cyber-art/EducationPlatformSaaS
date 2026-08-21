import React from "react";
import { UserCheck, Trash2, Phone, Info, Calendar } from "lucide-react";

const WaitingStudentCard = ({ student, onDelete, onAssignClick }) => {
    return (
        <div className="lux-card group hover:bg-[var(--bg-panel)]/80 transition-all duration-200 px-3 py-2 flex items-center justify-between gap-3 border border-[var(--border-glass)]/50 rounded-lg">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Avatar */}
                <div className="w-8 h-8 shrink-0 rounded-md bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-xs font-black text-[var(--gold)] capitalize shadow-sm">
                    {student.full_name.charAt(0)}
                </div>
                
                {/* Info */}
                <div className="flex flex-col min-w-0 flex-[2] justify-center">
                    <h4 className="text-xs font-bold text-[var(--text-primary)] truncate leading-tight">{student.full_name}</h4>
                    <div className="flex items-center gap-2 text-[9px] text-[var(--text-muted)] mt-0.5">
                        <span className="text-[var(--gold)]/80 font-semibold truncate px-1.5 py-0.5 bg-[var(--gold-dim)] rounded">{student.subject || "Umumiy yo'nalish"}</span>
                        <div className="flex items-center gap-1 shrink-0 opacity-80">
                            <Phone size={9} />
                            <span>{student.phone}</span>
                        </div>
                    </div>
                </div>
                
                {/* Notes (Optional) */}
                <div className="hidden md:flex flex-1 items-center min-w-[150px]">
                    {student.notes ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-void)]/30 border border-[var(--border-glass)]/30 w-full">
                            <Info size={10} className="text-[var(--gold)] shrink-0" />
                            <p className="text-[9px] text-[var(--text-secondary)] truncate">
                                {student.notes}
                            </p>
                        </div>
                    ) : (
                        <span className="text-[9px] text-[var(--text-muted)] italic opacity-50 px-2">-</span>
                    )}
                </div>
                
                {/* Date */}
                <div className="hidden sm:flex items-center justify-end gap-1 text-[9px] text-[var(--text-muted)] w-24 shrink-0">
                    <Calendar size={10} className="opacity-50" />
                    <span>{new Date(student.created_at).toLocaleDateString()}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                    onClick={() => onAssignClick(student)}
                    className="w-7 h-7 rounded-md bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center hover:bg-[var(--gold)] hover:text-black transition-all"
                    title="Guruhga biriktirish"
                >
                    <UserCheck size={12} />
                </button>
                <button
                    onClick={() => onDelete(student.id)}
                    className="w-7 h-7 rounded-md text-[var(--text-muted)] flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-all"
                    title="O'chirish"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
};

export default WaitingStudentCard;
