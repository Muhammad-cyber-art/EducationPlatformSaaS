import React from"react";
import StaffProfileForm from"./StaffProfileForm";
import { useStaffPaymentsMain } from"./StaffPayments/useStaffPaymentsMain";

// Components
import StaffHeader from"./StaffPayments/StaffHeader";
import StaffSidebar from"./StaffPayments/StaffSidebar";
import StaffList from"./StaffPayments/StaffList";

const StaffManagementPro = () => {
 const {
 activeBranch,
 activeTab,
 addStaffModal,
 branches,
 staffData,
 staffSearchQuery,
 staffRefreshing,
 staffLoading,
 filteredStaffData,
 fetchStaffData,
 handleRefreshPayments,
 setAddStaffModal,
 setActiveBranch,
 setActiveTab,
 setStaffSearchQuery,
 } = useStaffPaymentsMain();

 return (
 <div className="space-y-10 pb-20">
 {/* Atmosphere Background */}
 <div className="fixed inset-0 pointer-events-none -z-10">
 <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[var(--gold)]/5 rounded-full blur-[140px]"></div>
 <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-indigo-500/[0.04] rounded-full blur-[120px]"></div>
 </div>

 {addStaffModal && (
 <StaffProfileForm
 role={activeTab}
 branch={Number(activeBranch)}
 isOpen={addStaffModal}
 onClose={() => setAddStaffModal(false)}
 onSuccess={fetchStaffData}
 />
 )}

 <StaffHeader 
 branches={branches} 
 activeBranch={activeBranch} 
 setActiveBranch={setActiveBranch} 
 />

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
 <StaffSidebar 
 activeTab={activeTab} 
 setActiveTab={setActiveTab} 
 staffData={staffData} 
 onAddStaff={() => setAddStaffModal(true)} 
 />

 <StaffList 
 staffSearchQuery={staffSearchQuery}
 setStaffSearchQuery={setStaffSearchQuery}
 handleRefreshPayments={handleRefreshPayments}
 staffRefreshing={staffRefreshing}
 staffLoading={staffLoading}
 filteredStaffData={filteredStaffData}
 />
 </div>
 </div>
 );
};

export default StaffManagementPro;