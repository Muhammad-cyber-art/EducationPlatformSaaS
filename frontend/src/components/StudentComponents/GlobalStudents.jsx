import React from"react";
import { Loader2, SearchCode, User, UserPlus } from"lucide-react";

// Hooks
import { useGlobalStudents } from"./GlobalStudents/useGlobalStudents";

// Components
import GlobalStudentsHeader from"./GlobalStudents/GlobalStudentsHeader";
import GlobalStudentsSearch from"./GlobalStudents/GlobalStudentsSearch";
import GlobalStudentCard from"./GlobalStudents/GlobalStudentCard";

export default function GlobalStudentComponent() {
 const {
 students,
 loading,
 searchTerm,
 setSearchTerm,
 navigate,
 user_info,
 branchId,
 isExtraBranch,
 canCreateStudent
 } = useGlobalStudents();

 return (
 <div className="animate-lux-fade">
 {/* BACKGROUND ATMOSPHERE */}
 <div className="fixed inset-0 pointer-events-none -z-10">
 <div className="absolute top-[20%] right-0 w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
 </div>

 <GlobalStudentsHeader 
 navigate={navigate}
 user_info={user_info}
 branchId={branchId}
 isExtraBranch={isExtraBranch}
 canCreateStudent={canCreateStudent}
 />

 <GlobalStudentsSearch 
 searchTerm={searchTerm}
 setSearchTerm={setSearchTerm}
 loading={loading}
 />

 {/* RESULT AREA */}
 <div className="min-h-[500px]">
 {!searchTerm.trim() ? (
 <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'100px 0', opacity: 0.6 }}>
 <div style={{ width:'80px', height:'80px', borderRadius:'24px', background:'var(--gold-dim)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'24px' }}>
 <SearchCode size={32} color="var(--gold)" />
 </div>
 <h2 style={{ fontSize:'18px', color:'var(--text-primary)', marginBottom:'8px' }} className="font-bold capitalize">Qidiruvni Boshlang</h2>
 <p style={{ fontSize:'12px', color:'var(--text-secondary)', maxWidth:'300px', textAlign:'center' }} className="font-medium capitalize tracking-widest opacity-60">
 Filialdagi o'quvchilarni topish uchun yuqoridagi qidiruv maydonidan foydalaning.
 </p>
 </div>
 ) : loading && students.length === 0 ? (
 <div style={{ display:'flex', justifyContent:'center', padding:'100px 0' }}>
 <Loader2 size={40} className="animate-spin" color="var(--gold)" />
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
 {students.map((s) => (
 <GlobalStudentCard 
 key={s.id} 
 student={s} 
 onClick={() => navigate(`${s.id}`)} 
 />
 ))}

 {students.length === 0 && !loading && (
 <div className="col-span-full py-24 flex flex-col items-center justify-center text-center opacity-50">
 <User size={48} color="var(--text-muted)" style={{ marginBottom:'16px' }} />
 <h3 style={{ fontSize:'16px' }} className="font-bold capitalize">O'quvchilar topilmadi</h3>
 <p style={{ fontSize:'12px' }} className="font-medium">Qidiruv so'rovini o'zgartirib ko'ring.</p>
 </div>
 )}
 </div>
 )}
 </div>

 {/* FAB FOR MOBILE */}
 {!isExtraBranch && canCreateStudent && (
 <button
 className="lg:hidden"
 onClick={() => navigate("add_to_global")}
 style={{
 position:'fixed', bottom:'100px', right:'24px',
 width:'60px', height:'60px', borderRadius:'20px',
 background:'var(--gold)', color:'black', border:'none',
 boxShadow:'0 10px 30px rgba(184, 134, 11, 0.4)',
 display:'flex', alignItems:'center', justifyContent:'center',
 zIndex: 100
 }}
 >
 <UserPlus size={24} />
 </button>
 )}
 </div>
 );
}
