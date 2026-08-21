import React, { useState } from "react";
import { X, LogOut, Trash2, GraduationCap, AlertTriangle, AlertCircle, Check, ArrowRight, FileText } from "lucide-react";

export default function UnenrollSelectModal({
    isOpen,
    onClose,
    studentData,
    onUnenroll,
    onArchive
}) {
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [archiveReason, setArchiveReason] = useState("");
    const [isConfirmingArchive, setIsConfirmingArchive] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const groups = studentData?.groups || [];

    const handleClose = () => {
        setSelectedGroup(null);
        setArchiveReason("");
        setIsConfirmingArchive(false);
        setError("");
        onClose();
    };

    const handleUnenrollClick = (group) => {
        setSelectedGroup(group);
        setIsConfirmingArchive(false);
        setError("");
    };

    const handleConfirmUnenroll = () => {
        if (selectedGroup) {
            onUnenroll(selectedGroup.id);
            handleClose();
        }
    };

    const handleArchiveClick = () => {
        if (!archiveReason.trim()) {
            setError("Iltimos, o'chirish sababini batafsil yozing.");
            return;
        }
        setError("");
        setIsConfirmingArchive(true);
        setSelectedGroup(null);
    };

    const handleConfirmArchive = () => {
        if (archiveReason.trim()) {
            onArchive(archiveReason);
            handleClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-300"
                onClick={handleClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-[var(--border-glass)] bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-[var(--text-primary)] capitalize tracking-tight">O'chirish Tanlov Oynasi</h2>
                            <p className="text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest mt-0.5">Faol o'quvchi ma'lumotlarini boshqarish</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-white/5 rounded-xl transition-all"
                    >
                        <X size={18} className="text-[var(--text-muted)] hover:text-white" />
                    </button>
                </div>

                {/* Body Container */}
                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                    
                    {/* IN-MODAL CONFIRMATION: UNENROLL FROM GROUP */}
                    {selectedGroup && (
                        <div className="space-y-5 animate-in slide-in-from-bottom-3 duration-200">
                            <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5 animate-pulse" size={24} />
                                <div className="space-y-1">
                                    <h4 className="text-xs font-black text-amber-500 uppercase tracking-wider">Guruhdan chiqarishni tasdiqlang!</h4>
                                    <p className="text-[11px] text-[var(--text-secondary)] font-bold leading-relaxed">
                                        Rostdan ham <span className="text-[var(--text-primary)] font-black">{studentData?.full_name}</span>ni <span className="text-[var(--text-primary)] font-black">"{selectedGroup.name}"</span> guruhidan chiqarib yubormoqchimisiz?
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSelectedGroup(null)}
                                    className="flex-1 p-3.5 bg-[var(--bg-void)]/60 hover:bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                                >
                                    Orqaga qaytish
                                </button>
                                <button
                                    onClick={handleConfirmUnenroll}
                                    className="flex-1 p-3.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Check size={14} /> Ha, Chiqarish
                                </button>
                            </div>
                        </div>
                    )}

                    {/* IN-MODAL CONFIRMATION: ARCHIVE FROM SYSTEM */}
                    {isConfirmingArchive && (
                        <div className="space-y-5 animate-in slide-in-from-bottom-3 duration-200">
                            <div className="flex items-start gap-4 p-5 rounded-2xl bg-red-500/10 border border-red-500/20">
                                <AlertCircle className="text-red-500 shrink-0 mt-0.5 animate-pulse" size={24} />
                                <div className="space-y-1">
                                    <h4 className="text-xs font-black text-red-500 uppercase tracking-wider">Tizimdan butkul o'chirishni tasdiqlang!</h4>
                                    <p className="text-[11px] text-[var(--text-secondary)] font-bold leading-relaxed">
                                        Foydalanuvchi <span className="text-[var(--text-primary)] font-black">{studentData?.full_name}</span> tizimdan butunlay arxivlanadi. Uning barcha guruhlardagi darslari to'xtatiladi.
                                    </p>
                                    <div className="mt-2.5 p-3 rounded-lg bg-black/40 border border-[var(--border-glass)] text-[10px] font-bold text-[var(--text-muted)] italic">
                                        Sababi: "{archiveReason}"
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsConfirmingArchive(false)}
                                    className="flex-1 p-3.5 bg-[var(--bg-void)]/60 hover:bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                                >
                                    Orqaga qaytish
                                </button>
                                <button
                                    onClick={handleConfirmArchive}
                                    className="flex-1 p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Check size={14} /> Tasdiqlayman
                                </button>
                            </div>
                        </div>
                    )}

                    {/* INITIAL STATE: SELECT ACTION OR GROUP */}
                    {!selectedGroup && !isConfirmingArchive && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            
                            {/* Alert Card */}
                            <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                                <div className="space-y-1">
                                    <p className="text-[11px] text-[var(--text-secondary)] font-bold leading-relaxed">
                                        E'tibor bering! <span className="text-[var(--text-primary)] font-black">{studentData?.full_name}</span> hozirda <span className="text-amber-500 font-black tracking-tight">{groups.length} ta guruhda</span> faol o'qimoqda.
                                    </p>
                                    <p className="text-[9px] text-[var(--text-muted)] font-medium">Quyidagi amallardan birini ushbu oyna ichida tanlang:</p>
                                </div>
                            </div>

                            {/* Section 1: Choose Group to Unenroll */}
                            <div className="space-y-3">
                                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.15em] px-1 flex items-center gap-1.5">
                                    <GraduationCap size={12} className="text-[var(--gold)]" /> 1. Guruhlardan biridan chiqarish
                                </p>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {groups.map(group => (
                                        <button
                                            key={group.id}
                                            onClick={() => handleUnenrollClick(group)}
                                            className="flex items-center justify-between p-4 bg-[var(--bg-void)]/30 hover:bg-[var(--gold)] hover:text-black border border-[var(--border-glass)] hover:border-[var(--gold)]/30 rounded-2xl transition-all group/btn text-left"
                                        >
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className="w-9 h-9 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] group-hover/btn:bg-black/10 group-hover/btn:text-black shrink-0">
                                                    <GraduationCap size={18} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black truncate">{group.name}</p>
                                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mt-0.5">{group.subject || "Kurs"}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-500 group-hover/btn:bg-black/15 group-hover/btn:border-black/20 group-hover/btn:text-black px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all">
                                                Chiqarish <LogOut size={10} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Section 2: Complete Deletion / Archive */}
                            <div className="pt-5 border-t border-[var(--border-glass)] space-y-4">
                                <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.15em] px-1 flex items-center gap-1.5">
                                    <Trash2 size={12} className="text-red-500" /> 2. Tizimdan butunlay o'chirish (Arxiv)
                                </p>

                                <div className="space-y-3">
                                    <div className="relative">
                                        <div className="absolute top-3 left-3 text-[var(--text-muted)] pointer-events-none">
                                            <FileText size={16} />
                                        </div>
                                        <textarea
                                            rows={2}
                                            value={archiveReason}
                                            onChange={(e) => {
                                                setArchiveReason(e.target.value);
                                                setError("");
                                            }}
                                            placeholder="O'chirish va arxivlash sababini batafsil kiriting..."
                                            className="w-full bg-black/40 border border-[var(--border-glass)] focus:border-red-500/50 rounded-2xl pl-10 pr-4 py-3 text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all resize-none shadow-inner"
                                        />
                                    </div>

                                    {error && (
                                        <p className="text-[10px] font-bold text-red-500 flex items-center gap-1.5 px-1 animate-pulse">
                                            <AlertCircle size={12} /> {error}
                                        </p>
                                    )}

                                    <button
                                        onClick={handleArchiveClick}
                                        className="w-full flex items-center justify-center gap-2.5 p-4 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-transparent text-red-500 hover:text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-red-500/20 transition-all active:scale-95 group/delBtn"
                                    >
                                        <Trash2 size={14} className="group-hover/delBtn:scale-110 transition-transform" />
                                        Tizimdan butunlay o'chirish (Arxivlash)
                                    </button>
                                </div>
                            </div>

                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
