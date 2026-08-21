import { Outlet } from"react-router-dom";
import MentorBottomNav from"../Navigation/MentorBottomNav";
import MentorSidebar from"./MentorSidebar";

export default function MentorProfileLayout() {
 return (
 <div className="flex w-full min-h-screen bg-[var(--bg-void)] font-sans text-[var(--text-primary)] selection:bg-[var(--gold)]/30">
 {/* Desktop Sidebar (Left) */}
 <MentorSidebar />

 <div className="flex-1 flex flex-col min-w-0 relative">
 {/* Scrollable Content Area */}
 <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
 <Outlet />
 </div>
 </div>

 {/* Mobile Bottom Navigation (Fixed) */}
 <MentorBottomNav />
 </div>
 );
}