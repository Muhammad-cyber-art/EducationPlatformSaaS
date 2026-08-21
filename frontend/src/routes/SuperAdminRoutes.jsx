import { Route } from"react-router-dom";

// Components
import SuperAdminLayout from"../components/SuperAdmin/SuperAdminLayout";
import SuperAdminDashboard from"../components/SuperAdmin/SuperAdminPage";
import AdminList from"../components/SuperAdmin/AdminsList";
import SuperAdminProfile from"../components/SuperAdmin/SuperAdminProfile";
import BranchLayout from"../components/SuperAdmin/branches/BrnchLayout";
import BranchPattern from"../components/SuperAdmin/branches/BranchPattern";
import BranchCreate from"../components/SuperAdmin/branches/AddBranch";
import AdminLayout from"../components/adminComponents/AdminListLayout";
import AdminRegisterView from"../components/RegisterUser/RegisterAdmin";
import ArchivePage from"../components/adminComponents/ArchivePage";
import MentorsLayout from"../components/mentorsComponent/MentorsLayout";
import MentorsPage from"../components/mentorsComponent/MentorsPage";
import MentorProfilePage from"../components/mentorsComponent/MentorProfile";
import MentorRegister from"../components/RegisterUser/RegisterMentor";
import GroupsLayout from"../components/GroupsComponent/GroupLayout";
import GroupsListPage from"../components/GroupsComponent/GroupsPage";
import AddGroup from"../components/GroupsComponent/AddGroup";
import GroupDetailLayout from"../components/GroupsComponent/GroupDetailLayout";
import GroupDetailPage from"../components/GroupsComponent/GroupDetails";
import StudentAdd from"../components/StudentComponents/AddStudent";
import StudentLayout from"../components/StudentComponents/StudentLayout";
import GroupsStudent from"../components/GroupsComponent/GrupsStudent";
import StudentProfilePage from"../components/StudentComponents/Student";
import HomeworkSubmission from"../components/homework/HomeworkSubmsission";
import MockTestDetails from"../components/mockTests/MockTestDetails";
import GlobalStudentLayout from"../components/StudentComponents/GlobalStudentLayout";
import GlobalStudentComponent from"../components/StudentComponents/GlobalStudents";
import GlobalSpecialStudents from "../components/StudentComponents/GlobalSpecialStudents/GlobalSpecialStudents";
import WaitingHall from"../components/StudentComponents/WaitingHall";
import AdminProfile from"../components/adminComponents/adminProfile";

// Finance Components
import AllPaymentsLayout from"../components/SuperAdmin/Finance/AllPaymentsLayout";
import AllPayments from"../components/SuperAdmin/Finance/AllPayments";
import PaymentHistory from"../components/SuperAdmin/Finance/PaymentsStory";
import StaffPaymentsLayout from"../components/SuperAdmin/Finance/StaffPaymentsLayout";
import StaffPayments from"../components/SuperAdmin/Finance/StaffPayments";
import StaffPaymentDetails from"../components/SuperAdmin/Finance/StaffPaymentDetails";
import BranchFinance from"../components/SuperAdmin/Finance/BranchDetails";
import UtilityPayments from "../components/SuperAdmin/Finance/UtilityPayments";
import Kassa from "../components/SuperAdmin/Finance/Kassa/index.jsx";

import SpecialStudentsDashboard from"../components/SuperAdmin/Finance/SpecialStudents/SpecialStudentsDashboard";

export const SuperAdminRoutes = (
 <Route path="/super_admin" element={<SuperAdminLayout />}>
 
 {/* Finance Section */}
 <Route path="all-payments" element={<AllPaymentsLayout />}>
 <Route index element={<AllPayments />} />
 <Route path="payments-history" element={<PaymentHistory />} />
 <Route path="staff-payments" element={<StaffPaymentsLayout />} >
 <Route index element={<StaffPayments />} />
 <Route path="staff/:staff_id" element={<StaffPaymentDetails />} />
 </Route>
 <Route path="utility-payments" element={<UtilityPayments />} />
 <Route path="kassa" element={<Kassa />} />
 <Route path="branch-details/:b_id" element={<BranchFinance />} />
 <Route path="branch-details/:b_id/special-students" element={<SpecialStudentsDashboard />} />
 </Route>

 {/* Branches Management Section */}
 <Route element={<BranchPattern />}>
 <Route path="profile" element={<SuperAdminProfile />} />
 <Route index element={<div className="w-full h-screen flex justify-center items-center m-auto text-[var(--text-secondary)]"><h1 className="-mt-84 text-5xl font-black capitalize opacity-20">Filialni tanlang</h1> </div>} />
 <Route path="add-branch" element={<BranchCreate />} />
 
 {/* Specific Branch Scope */}
 <Route path="branch/:branch_id" element={<BranchLayout />}>
 <Route index element={<SuperAdminDashboard />} />
 <Route path="archive" element={<ArchivePage />} />

 <Route path="admins" element={<AdminLayout />}>
 <Route index element={<AdminList />} />
 <Route path="admin_add" element={<AdminRegisterView />} />
 <Route path=":admin_id" element={<AdminProfile />} />
 </Route>

 <Route path="mentors" element={<MentorsLayout />}>
 <Route index element={<MentorsPage />} />
 <Route path=":mentor_id" element={<MentorProfilePage />} />
 <Route path="add-mentor" element={<MentorRegister />} />
 </Route>

 <Route path="groups" element={<GroupsLayout />}>
 <Route index element={<GroupsListPage />} />
 <Route path="addgroup" element={<AddGroup />} />
 <Route path=":group_id" element={<GroupDetailLayout />}>
 <Route index element={<GroupDetailPage />} />
 <Route path="add_student" element={<StudentAdd />} />
 <Route path="students" element={<StudentLayout />}>
 <Route index element={<GroupsStudent />} />
 <Route path=":student_id" element={<StudentProfilePage />} />
 </Route>
 <Route path="homeworks/:mission_id" element={<HomeworkSubmission />} />
 <Route path="mock-tests/:test_id" element={<MockTestDetails />} />
 </Route>
 </Route>

 <Route path="all_students" element={<GlobalStudentLayout />}>
 <Route index element={<GlobalStudentComponent />} />
 <Route path="special-students" element={<GlobalSpecialStudents />} />
 <Route path=":student_id" element={<StudentProfilePage />} />
 <Route path="add_to_global" element={<StudentAdd />} />
 </Route>

 <Route path="waiting-hall" element={<WaitingHall />} />
 </Route>
 </Route>
 </Route>
);
