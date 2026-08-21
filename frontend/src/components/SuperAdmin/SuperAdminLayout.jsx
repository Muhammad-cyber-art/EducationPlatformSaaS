import { Outlet } from"react-router-dom";
import SuperAdminBottomNav from"../Navigation/SuperAdminBottomNav";
import SuperAdminSidebar from"./SuperAdminSidebar";

export default function SuperAdminLayout() {
 return (
 <div className="w-full h-screen bg-[var(--bg-void)] flex flex-row overflow-hidden animate-lux-fade">
 {/* Sidebar - Visible on Desktop */}
 <div className="hidden md:block w-52 h-full shrink-0 border-r border-[var(--border-glass)] shadow-[20px_0_40px_rgba(0,0,0,0.2)] relative z-20">
 <SuperAdminSidebar />
 </div>

 {/* Main Content Area */}
 <div className="flex-1 flex flex-col h-full min-w-0 relative z-10">
 {/* Scrollable Container */}
 <div className="flex-1 overflow-y-auto overflow-x-hidden pb-16 md:pb-0 scrollbar-thin scrollbar-thumb-[var(--gold)]/20 scrollbar-track-transparent">
 <div className="w-full min-h-full">
 <Outlet />
 </div>
 </div>
 </div>

 {/* Mobile Bottom Navigation */}
 <SuperAdminBottomNav />
 </div>
 );
}