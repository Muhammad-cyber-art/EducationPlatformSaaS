import React from"react";
import { createPortal } from"react-dom";
import { Layers, X, Activity, Target, ChevronRight } from"lucide-react";

const ResourcesModal = ({
 isOpen,
 onClose,
 homework,
 mockTests,
 navigate,
 branchID,
 uiDispatch
}) => {
 if (!isOpen) return null;

 return createPortal(
 <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6">
 <div
 className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
 onClick={onClose}
 />
 <div className="relative bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-[24px] md:rounded-[32px] shadow-[0_40px_100px_-15px_rgba(0,0,0,0.3)] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
 {/* Modal Header */}
 <div className="px-6 md:px-10 py-6 md:py-8 border-b border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-panel)] shrink-0">
 <div className="flex items-center gap-4 md:gap-5">
 <div className="p-3 md:p-4 bg-[var(--gold)] rounded-2xl text-black shadow-lg shadow-[var(--gold-glow)]">
 <Layers size={20} className="md:size-[24px]" strokeWidth={2.5} />
 </div>
 <div className="min-w-0">
 <h3 className="text-lg md:text-2xl font-black text-[var(--text-primary)] tracking-tight leading-none capitalize truncate">Guruh Resurslari</h3>
 <p className="text-[9px] md:text-[10px] font-black text-[var(--gold)] mt-2 capitalize tracking-[0.2em] md:tracking-[0.3em]">Barcha vazifalar va imtihonlar</p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="p-2 md:p-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 rounded-full transition-all active:scale-90"
 >
 <X size={24} className="md:size-[28px]" />
 </button>
 </div>

 {/* Modal Content - Scrollable Area */}
 <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
 {/* Homeworks List */}
 <div className="space-y-6">
 <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-glass)] sticky top-0 bg-[var(--bg-panel)] z-10">
 <Activity size={18} className="text-[var(--gold)]" />
 <h4 className="text-[12px] font-black text-[var(--text-primary)] capitalize tracking-[0.2em]">Uy Vazifalari</h4>
 <span className="ml-auto px-2 py-0.5 rounded-md bg-[var(--text-primary)]/5 text-[10px] font-black text-[var(--text-muted)]">{homework.length}</span>
 </div>
 <div className="space-y-3">
 {homework.length === 0 ? (
 <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-40">
 <Activity size={32} />
 <p className="text-[10px] font-black capitalize tracking-widest">Hozircha vazifalar yo'q</p>
 </div>
 ) : (
 [...homework].reverse().map((hw) => (
 <div
 key={hw.id}
 onClick={() => {
 onClose();
 navigate(`homeworks/${hw.id}?branch=${branchID}`);
 }}
 className="lux-card !p-4 sm:!p-6 group cursor-pointer hover:border-[var(--gold)]/30 transition-all relative bg-[var(--bg-void)]/30"
 >
 <div className="min-w-0 pr-4">
 <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors truncate">{hw.title}</p>
 <p className="text-[8px] font-medium text-[var(--text-muted)] capitalize mt-1 tracking-wider">ID: #{hw.id} • {new Date(hw.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</p>
 </div>
 <div className="flex flex-col items-end gap-1 shrink-0">
 <p className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-tighter">{new Date(hw.created_at).toLocaleDateString()}</p>
 <ChevronRight size={14} className="text-[var(--gold)] translate-x-1 opacity-0 group-hover:opacity-100 transition-all" />
 </div>
 </div>
 ))
 )}
 </div>
 </div>

 {/* Mock Tests List */}
 <div className="space-y-6">
 <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-glass)] sticky top-0 bg-[var(--bg-panel)] z-10">
 <Target size={18} className="text-[var(--gold)]" />
 <h4 className="text-[12px] font-black text-[var(--text-primary)] capitalize tracking-[0.2em]">Mock Testlar</h4>
 <span className="ml-auto px-2 py-0.5 rounded-md bg-[var(--text-primary)]/5 text-[10px] font-black text-[var(--text-muted)]">{mockTests.length}</span>
 </div>
 <div className="space-y-3">
 {mockTests.length === 0 ? (
 <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-40">
 <Target size={32} />
 <p className="text-[10px] font-black capitalize tracking-widest">Hozircha testlar yo'q</p>
 </div>
 ) : (
 [...mockTests].reverse().map((test) => (
 <div
 key={test.id}
 onClick={() => {
 onClose();
 navigate(`mock-tests/${test.id}?branch=${branchID}`);
 }}
 className="lux-card !p-5 flex items-center justify-between group cursor-pointer hover:border-[var(--gold)]/40 hover:bg-[var(--gold)]/5 transition-all bg-[var(--bg-void)]/30"
 >
 <div className="min-w-0 pr-4">
 <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors truncate">{test.subject}</p>
 <p className="text-[8px] font-medium text-[var(--text-muted)] capitalize mt-1 tracking-wider">ID: #{test.id} • {new Date(test.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</p>
 </div>
 <div className="flex flex-col items-end gap-1 shrink-0">
 <p className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-tighter">{new Date(test.created_at).toLocaleDateString()}</p>
 <ChevronRight size={14} className="text-[var(--gold)] translate-x-1 opacity-0 group-hover:opacity-100 transition-all" />
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Modal Footer */}
 <div className="px-6 md:px-10 py-6 border-t border-[var(--border-glass)] bg-[var(--bg-panel)] flex justify-end shrink-0">
 <button
 onClick={onClose}
 className="w-full md:w-auto px-10 py-3 rounded-xl border border-[var(--border-glass)] text-[10px] font-black capitalize tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/5 transition-all"
 >
 Yopish
 </button>
 </div>
 </div>
 </div>,
 document.body
 );
};

export default ResourcesModal;
