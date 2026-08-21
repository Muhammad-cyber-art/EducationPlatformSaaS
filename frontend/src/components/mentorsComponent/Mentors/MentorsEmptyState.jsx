import React from"react";
import { GraduationCap } from"lucide-react";

const MentorsEmptyState = () => {
 return (
 <div className="py-32 flex flex-col items-center justify-center text-center">
 <div className="w-28 h-28 rounded-[40px] bg-[var(--gold-dim)] border border-[var(--gold)]/10 flex items-center justify-center mb-10 text-[var(--gold)]">
 <GraduationCap size={56} />
 </div>
 <h2 className="text-3xl font-bold text-[var(--text-primary)] capitalize tracking-tight mb-4">O'qituvchilar topilmadi</h2>
 <p className="text-[var(--text-muted)] text-[11px] max-w-xs font-bold capitalize tracking-[0.2em] leading-relaxed mx-auto">
 Siz qidirayotgan ma'lumotlar bazada topilmadi yoki sizda ruxsat yo'q.
 </p>
 </div>
 );
};

export default MentorsEmptyState;
