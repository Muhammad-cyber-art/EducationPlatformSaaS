import React from"react";
import { Clock, UserPlus } from"lucide-react";

const GlobalStudentsHeader = ({ navigate, user_info, branchId, isExtraBranch, canCreateStudent }) => {
 return (
 <div style={{ marginBottom:'40px', display:'flex', justifyContent:'space-between', alignItems:'center' }} className="flex-col md:flex-row gap-6">
 <div>
 <h1 className="gold-text text-2xl md:text-3xl font-black capitalize tracking-tighter">O'quvchilar Boshqarmasi</h1>
 <p style={{ color:'var(--text-secondary)', marginTop:'8px', fontSize:'14px' }} className="font-bold capitalize tracking-widest opacity-60">
 Filialdagi o'quvchilarni ko'rish va boshqarish.
 </p>
 </div>
 <div style={{ display:'flex', gap:'12px' }} className="w-full md:w-auto">
 <button
 className="lux-btn flex-1 md:flex-none"
 onClick={() => navigate(user_info?.role ==="super_admin" ? `/super_admin/branch/${branchId}/waiting-hall` :"/admin/waiting-hall")}
 style={{ padding:'12px 24px', background:'var(--bg-panel)', border:'1px solid var(--border-glass)', color:'var(--text-primary)', display:'flex', alignItems:'center', gap:'8px', justifyContent:'center' }}
 >
 <Clock size={16} /> <span className="text-[10px] font-black capitalize tracking-widest">Kutishlar Zali</span>
 </button>
 {!isExtraBranch && canCreateStudent && (
 <button
 className="lux-btn lux-btn-primary flex-1 md:flex-none"
 onClick={() => navigate("add_to_global")}
 style={{ padding:'12px 32px', display:'flex', alignItems:'center', gap:'8px', justifyContent:'center' }}
 >
 <UserPlus size={16} /> <span className="text-[10px] font-black capitalize tracking-widest">Yangi O'quvchi</span>
 </button>
 )}
 </div>
 </div>
 );
};

export default GlobalStudentsHeader;
