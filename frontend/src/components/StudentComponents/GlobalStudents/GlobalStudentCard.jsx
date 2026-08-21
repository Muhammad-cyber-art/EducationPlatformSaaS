import React from"react";
import { Phone, ArrowUpRight } from"lucide-react";

const getInitials = (name) => {
 if (!name) return"?";
 return name.split("").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
};

const GlobalStudentCard = ({ student, onClick }) => {
 return (
 <div
 className="lux-card group relative"
 onClick={onClick}
 style={{
 cursor:'pointer', display:'flex', flexDirection:'column',
 padding:'24px', transition:'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
 }}
 >
 {/* Card Header */}
 <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'24px' }}>
 <div style={{
 width:'56px', height:'56px', borderRadius:'16px',
 background:'var(--bg-void)', border:'1px solid var(--border-highlight)',
 display:'flex', alignItems:'center', justifyContent:'center',
 fontSize:'18px', fontWeight:'800', color:'var(--gold)',
 boxShadow:'var(--gold-glow)', overflow:'hidden'
 }}>
 {student.image ? (
 <img src={student.image} alt={student.full_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
 ) : getInitials(student.full_name)}
 </div>
 <div className="lux-nav-item active" style={{ padding:'4px 12px', fontSize:'10px', height:'fit-content', borderRadius:'8px' }}>
 ID #{student.id}
 </div>
 </div>

 {/* Card Body */}
 <div style={{ flex: 1, marginBottom:'24px' }}>
 <h3 style={{ fontSize:'17px', color:'var(--text-primary)', fontWeight:'600', marginBottom:'4px' }} className="truncate">{student.full_name}</h3>
 <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'var(--text-secondary)', fontSize:'13px' }}>
 <Phone size={14} style={{ opacity: 0.5 }} />
 <span>{student.phone}</span>
 </div>
 </div>

 {/* Card Footer */}
 <div style={{ display:'flex', flexDirection:'column', gap:'12px', paddingTop:'16px', borderTop: '1px solid var(--border-glass)' }}>
 <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
 <span style={{ fontSize:'10px', color:'var(--text-secondary)', textTransform:'capitalize', fontWeight:'800', letterSpacing:'1px' }}>Guruh</span>
 <span style={{ fontSize:'12px', color:'var(--gold)', fontWeight:'700' }} className="truncate max-w-[150px]">{student.group?.name ||"Yakkaxon"}</span>
 </div>
 <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
 <span style={{ fontSize:'10px', color:'var(--text-secondary)', textTransform:'capitalize', fontWeight:'800', letterSpacing:'1px' }}>Holat</span>
 <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
 <div style={{
 width:'6px', height:'6px', borderRadius:'50%',
 background: student.status ==='regular' ?'#10b981' :'var(--gold)',
 boxShadow: student.status ==='regular' ?'0 0 10px #10b981' :'0 0 10px var(--gold)'
 }}></div>
 <span style={{
 fontSize:'11px',
 color: student.status ==='regular' ?'#10b981' :'var(--gold)',
 fontWeight:'700'
 }}>
 {student.status ==='low_income' ?"Kam Ta'minlangan" :
 student.status ==='discount' ?'Imtiyozli' :
 student.status ==='negotiated' ?'Kelishilgan' :
 student.status ==='teacher_negotiated' ?'O\'qit. kelishgan' :'Faol'}
 </span>
 </div>
 </div>
 </div>

 <div style={{ position:'absolute', bottom:'24px', right:'24px', opacity: 0 }} className="group-hover:opacity-100 transition-opacity">
 <ArrowUpRight size={20} color="var(--gold)" />
 </div>
 </div>
 );
};

export default GlobalStudentCard;
