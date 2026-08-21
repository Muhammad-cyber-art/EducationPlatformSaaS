import React from"react";
import { Search, Loader2, Filter } from"lucide-react";
import { useNavigate } from "react-router-dom";

const GlobalStudentsSearch = ({ searchTerm, setSearchTerm, loading }) => {
 const navigate = useNavigate();
 return (
 <div className="lux-card" style={{ marginBottom:'32px', padding:'12px 24px' }}>
 <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
 <div style={{ position:'relative', flex: 1 }}>
 {loading ? (
 <Loader2 size={18} className="animate-spin" style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color:'var(--gold)' }} />
 ) : (
 <Search size={18} style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color:'var(--text-secondary)' }} />
 )}
 <input
 className="lux-input w-full"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Ism yoki tel orqali qidiruv..."
 style={{ paddingLeft:'48px', border:'none', background:'transparent' }}
 />
 </div>
 <div style={{ height: '30px', width: '1px', background: 'var(--border-glass)' }}></div>
 {!window.location.pathname.includes('special-students') && (
   <button 
     className="lux-nav-item flex items-center gap-2 !border-[var(--gold)]/30 !text-[var(--gold)] hover:!bg-[var(--gold)]/10" 
     style={{ margin: 0, padding: '8px 16px' }}
     onClick={() => navigate('special-students')}
   >
     <span className="text-[10px] font-black capitalize tracking-widest">Maxsus O'quvchilar</span>
   </button>
 )}
 <button className="lux-nav-item flex items-center gap-2" style={{ border: 'none', margin: 0, padding: '8px 16px' }}>
 <Filter size={16} /> <span className="text-[10px] font-black capitalize tracking-widest">Filtr</span>
 </button>
 </div>
 </div>
 );
};

export default GlobalStudentsSearch;
