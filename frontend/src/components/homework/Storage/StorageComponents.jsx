import React from"react";
import { 
 Archive, Trash, X, Search, Loader2, Trophy, BookOpen, 
 Users, CheckCircle, Info, Clock, Trash2 
} from"lucide-react";

export const StorageHeader = ({ onClearAll, onClose }) => (
 <div className="px-5 py-4 md:px-10 md:py-8 border-b border-white/5 flex items-center justify-between shrink-0">
 <div className="flex items-center gap-3 md:gap-5">
 <div className="w-10 h-10 md:w-14 md:h-14 bg-[var(--gold)]/10 border border-[var(--gold)]/20 rounded-xl md:rounded-2xl flex items-center justify-center text-[var(--gold)]">
 <Archive className="w-5 h-5 md:w-7 md:h-7" />
 </div>
 <div>
 <h3 className="text-sm md:text-2xl font-black text-white capitalize tracking-tighter">Storage</h3>
 <p className="text-[7px] md:text-[10px] font-black text-[var(--gold)] capitalize tracking-[0.2em] md:tracking-[0.3em] mt-1">Arxiv</p>
 </div>
 </div>
 <div className="flex items-center gap-2 md:gap-4">
 <button onClick={onClearAll} className="px-3 py-1.5 md:px-6 md:py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 rounded-lg md:rounded-2xl text-[8px] md:text-[10px] font-black capitalize tracking-widest transition-all flex items-center gap-1 md:gap-2">
 <Trash size={12} className="md:w-3.5 md:h-3.5" />
 <span className="hidden sm:inline">Tozalash</span>
 </button>
 <button onClick={onClose} className="p-2 md:p-3 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg md:rounded-2xl transition-all">
 <X className="w-5 h-5 md:w-6 md:h-6" />
 </button>
 </div>
 </div>
);

export const StorageSidebar = ({ searchTerm, setSearchTerm, isLoading, filteredItems, selectedHomework, onSelect }) => (
 <div className={`w-full md:w-80 border-r border-white/5 bg-black/20 flex flex-col shrink-0 ${selectedHomework ?'hidden md:flex' :'flex'}`}>
 <div className="p-4 md:p-5 border-b border-white/5">
 <div className="relative group">
 <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[var(--gold)] transition-colors" />
 <input
 type="text"
 placeholder="Qidiruv..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full bg-white/5 border border-white/10 rounded-lg md:rounded-xl py-2 md:py-3 pl-10 pr-4 text-[9px] md:text-[10px] font-black capitalize tracking-widest text-white outline-none focus:border-[var(--gold)]/50 transition-all"
 />
 </div>
 </div>
 <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3 custom-scrollbar">
 {isLoading ? (
 <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-[var(--gold)]/20" /></div>
 ) : filteredItems.length === 0 ? (
 <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3 text-center p-8">
 <Archive size={40} /><p className="text-[9px] font-black capitalize tracking-widest leading-relaxed">Hozircha arxivda ma'lumot yo'q</p>
 </div>
 ) : (
 filteredItems.map((item) => (
 <button
 key={item.id}
 onClick={() => onSelect(item)}
 className={`w-full p-4 rounded-2xl border text-left transition-all group relative overflow-hidden ${selectedHomework?.id === item.id ?'bg-[var(--gold)]/10 border-[var(--gold)]/40 shadow-lg' :'bg-white/5 border-white/5 hover:border-white/20'}`}
 >
 <div className="flex items-center justify-between mb-2">
 <span className="flex items-center gap-1.5 text-[8px] font-black text-white/40 capitalize tracking-widest">
 {item.item_type ==='mock_test' ? <Trophy size={10} className="text-amber-500" /> : <BookOpen size={10} className="text-blue-400" />}
 {item.item_type ==='mock_test' ?'Mock Test' :'Homework'}
 </span>
 <span className="text-[8px] font-black text-[var(--gold)] capitalize tracking-widest">{new Date(item.archived_at).toLocaleDateString()}</span>
 </div>
 <p className={`text-xs font-black capitalize tracking-tight truncate ${selectedHomework?.id === item.id ?'text-[var(--gold)]' :'text-white'}`}>{item.full_name}</p>
 <div className="flex items-center gap-3 mt-3">
 <div className="flex items-center gap-1 text-[8px] font-black text-white/40 capitalize"><Users size={10} /> {item.submission_stats.total_students}</div>
 <div className="flex items-center gap-1 text-[8px] font-black text-emerald-400 capitalize"><CheckCircle size={10} /> {item.item_type ==='mock_test' ? `${item.submission_stats.participation_rate}%` : `${item.submission_stats.submission_rate}%`}</div>
 </div>
 </button>
 ))
 )}
 </div>
 </div>
);

export const StorageDetails = ({ selectedHomework, onBack, getStatusColor }) => (
 <div className={`flex-1 overflow-y-auto bg-black/10 custom-scrollbar ${!selectedHomework ?'hidden md:flex' :'block'}`}>
 {!selectedHomework ? (
 <div className="h-full flex flex-col items-center justify-center gap-6 p-6 md:p-12 text-center">
 <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 rounded-full flex items-center justify-center text-white/10 animate-pulse"><Info className="w-8 h-8 md:w-12 md:h-12" /></div>
 <div className="max-w-xs">
 <h4 className="text-[10px] md:text-sm font-black text-white capitalize tracking-widest mb-2 opacity-40">Ma'lumot tanlanmagan</h4>
 <p className="text-[8px] md:text-[10px] text-white/20 font-black capitalize tracking-widest leading-relaxed">Tahlil va statistikani ko'rish uchun chap tomondan arxivni tanlang.</p>
 </div>
 </div>
 ) : (
 <div className="p-5 md:p-10 space-y-8 md:space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
 <button onClick={onBack} className="md:hidden flex items-center gap-2 text-[var(--gold)] font-black text-[9px] capitalize tracking-widest mb-4"><Archive size={14} /> Arxiv ro'yxati</button>
 <div className="flex flex-col md:flex-row justify-between gap-8">
 <div className="space-y-4">
 <div className="flex items-center gap-3">
 <span className={`px-3 py-1 border rounded-lg text-[8px] font-black capitalize tracking-widest ${selectedHomework.item_type ==='mock_test' ?'bg-amber-500/10 text-amber-500 border-amber-500/20' :'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>{selectedHomework.item_type ==='mock_test' ?'Mock Test' :'Uyga Vazifa'}</span>
 <span className="text-[10px] font-black text-white/40 capitalize tracking-widest">Ushbu topshiriq {new Date(selectedHomework.archived_at).toLocaleDateString()} da arxivlangan.</span>
 </div>
 <h2 className="text-xl md:text-4xl font-black text-white capitalize tracking-tighter leading-none">{selectedHomework.full_name}</h2>
 <div className="flex flex-wrap gap-4 pt-2">
 <Badge icon={<Clock size={12} />} label="Yaratilgan" value={selectedHomework.metadata.created_at} />
 <Badge icon={<Trash2 size={12} />} label="O'chirilgan" value={new Date(selectedHomework.archived_at).toLocaleString()} />
 <Badge icon={<Users size={12} />} label="O'qituvchi" value={selectedHomework.mentor_name} />
 </div>
 </div>
 <div className="bg-white/5 border border-white/10 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] flex flex-col items-center justify-center gap-2 min-w-[140px] md:min-w-[200px]">
 <p className="text-[8px] md:text-[10px] font-black text-[var(--gold)] capitalize tracking-widest">{selectedHomework.item_type ==='mock_test' ?'Ishtirok' :'Topshirish'}</p>
 <div className="text-2xl md:text-4xl font-black text-white tracking-tighter tabular-nums">{selectedHomework.item_type ==='mock_test' ? selectedHomework.submission_stats.participation_rate : selectedHomework.submission_stats.quality_rate}%</div>
 <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden"><div className="h-full bg-[var(--gold)]" style={{ width: `${selectedHomework.item_type ==='mock_test' ? selectedHomework.submission_stats.participation_rate : selectedHomework.submission_stats.quality_rate}%` }} /></div>
 </div>
 </div>

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {selectedHomework.item_type ==='mock_test' ? (
 <>
 <StatCard label="Jami Talabalar" value={selectedHomework.submission_stats.total_students} color="white" />
 <StatCard label="Qatnashgan" value={selectedHomework.submission_stats.participated} color="#34d399" />
 <StatCard label="Qatnashmagan" value={selectedHomework.submission_stats.not_participated} color="#fb7171" />
 <StatCard label="Ishtirok %" value={`${selectedHomework.submission_stats.participation_rate}%`} color="#fbbf24" />
 </>
 ) : (
 <>
 <StatCard label="Jami Talabalar" value={selectedHomework.submission_stats.total_students} color="white" />
 <StatCard label="To'liq topshirgan" value={selectedHomework.submission_stats.full_submissions} color="#34d399" />
 <StatCard label="Yarim topshirgan" value={selectedHomework.submission_stats.half_submissions} color="#fbbf24" />
 <StatCard label="Topshirmagan" value={selectedHomework.submission_stats.not_submitted} color="#fb7171" />
 </>
 )}
 </div>

 <div className="bg-white/5 border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden">
 <div className="px-5 py-4 md:px-8 md:py-6 border-b border-white/10 bg-white/5 flex items-center gap-3"><Users size={18} className="text-[var(--gold)]" /><h3 className="text-xs font-black text-white capitalize tracking-widest">O'quvchilar Ro'yxati & {selectedHomework.item_type ==='mock_test' ?'Natijalar' :'Status'}</h3></div>
 <div className="overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="bg-black/40">
 <th className="px-5 md:px-8 py-3 md:py-4 text-[8px] md:text-[9px] font-black text-white/40 capitalize tracking-widest">O'quvchi</th>
 <th className="px-5 md:px-8 py-3 md:py-4 text-[8px] md:text-[9px] font-black text-white/40 capitalize tracking-widest">Ball</th>
 <th className="px-5 md:px-8 py-3 md:py-4 text-[8px] md:text-[9px] font-black text-white/40 capitalize tracking-widest text-right">Vaqt</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-white/5">
 {selectedHomework.submission_stats.students_data.map((student, idx) => (
 <tr key={idx} className="hover:bg-white/5 transition-colors">
 <td className="px-5 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black text-white capitalize truncate">{student.name}</td>
 <td className={`px-5 md:px-8 py-4 md:py-5 text-[9px] md:text-[10px] font-black capitalize ${getStatusColor(student.status)}`}>{selectedHomework.item_type ==='mock_test' ? (student.score ||'---') : student.status}</td>
 <td className="px-5 md:px-8 py-4 md:py-5 text-right text-[9px] md:text-[10px] font-black text-white/40 capitalize tabular-nums">{selectedHomework.item_type ==='mock_test' ? new Date(selectedHomework.archived_at).toLocaleDateString() : (student.date ||"---")}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}
 </div>
);

const Badge = ({ icon, label, value }) => (
 <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
 <div className="text-[var(--gold)] opacity-60">{icon}</div>
 <div className="flex items-center gap-1.5">
 <span className="text-[8px] font-black text-white/30 capitalize tracking-tighter">{label}:</span>
 <span className="text-[9px] font-black text-white capitalize tracking-tight">{value}</span>
 </div>
 </div>
);

const StatCard = ({ label, value, color }) => (
 <div className="p-6 bg-white/5 border border-white/5 rounded-[2rem] hover:border-white/10 transition-all">
 <p className="text-[8px] font-black text-white/30 capitalize tracking-[0.2em] mb-1">{label}</p>
 <p className="text-2xl font-black tabular-nums tracking-tighter" style={{ color: color }}>{value}</p>
 </div>
);
