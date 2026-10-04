import { lazy } from "react";
import { Route } from "react-router-dom";

// Lazy Loaded Components
const SuperAdminLayout = lazy(() => import("../components/SuperAdmin/SuperAdminLayout"));
const SuperAdminDashboard = lazy(() => import("../components/SuperAdmin/SuperAdminPage"));
const AdminList = lazy(() => import("../components/SuperAdmin/AdminsList"));
const SuperAdminProfile = lazy(() => import("../components/SuperAdmin/SuperAdminProfile"));
const BranchLayout = lazy(() => import("../components/SuperAdmin/branches/BrnchLayout"));
const BranchPattern = lazy(() => import("../components/SuperAdmin/branches/BranchPattern"));
const BranchCreate = lazy(() => import("../components/SuperAdmin/branches/AddBranch"));
const AdminLayout = lazy(() => import("../components/adminComponents/AdminListLayout"));
const AdminRegisterView = lazy(() => import("../components/RegisterUser/RegisterAdmin"));
const ArchivePage = lazy(() => import("../components/adminComponents/ArchivePage"));
const MentorsLayout = lazy(() => import("../components/mentorsComponent/MentorsLayout"));
const MentorsPage = lazy(() => import("../components/mentorsComponent/MentorsPage"));
const MentorProfilePage = lazy(() => import("../components/mentorsComponent/MentorProfile"));
const MentorRegister = lazy(() => import("../components/RegisterUser/RegisterMentor"));
const GroupsLayout = lazy(() => import("../components/GroupsComponent/GroupLayout"));
const GroupsListPage = lazy(() => import("../components/GroupsComponent/GroupsPage"));
const AddGroup = lazy(() => import("../components/GroupsComponent/AddGroup"));
const GroupDetailLayout = lazy(() => import("../components/GroupsComponent/GroupDetailLayout"));
const GroupDetailPage = lazy(() => import("../components/GroupsComponent/GroupDetails"));
const GroupAssignmentsPage = lazy(() =>
  import("../components/GroupsComponent/GroupAssignments/GroupAssignmentsPage")
);
const StudentAdd = lazy(() => import("../components/StudentComponents/AddStudent"));
const StudentLayout = lazy(() => import("../components/StudentComponents/StudentLayout"));
const GroupsStudent = lazy(() => import("../components/GroupsComponent/GrupsStudent"));
const StudentProfilePage = lazy(() => import("../components/StudentComponents/Student"));
const HomeworkSubmission = lazy(() => import("../components/homework/HomeworkSubmsission"));
const MockTestDetails = lazy(() => import("../components/mockTests/MockTestDetails"));
const GlobalStudentLayout = lazy(() => import("../components/StudentComponents/GlobalStudentLayout"));
const GlobalStudentComponent = lazy(() => import("../components/StudentComponents/GlobalStudents"));
const GlobalSpecialStudents = lazy(() =>
  import("../components/StudentComponents/GlobalSpecialStudents/GlobalSpecialStudents")
);
const WaitingHall = lazy(() => import("../components/StudentComponents/WaitingHall"));
const AdminProfile = lazy(() => import("../components/adminComponents/adminProfile"));

// Finance Components (Lazy)
const AllPaymentsLayout = lazy(() => import("../components/SuperAdmin/Finance/AllPaymentsLayout"));
const AllPayments = lazy(() => import("../components/SuperAdmin/Finance/AllPayments"));
const PaymentHistory = lazy(() => import("../components/SuperAdmin/Finance/PaymentsStory"));
const StaffPaymentsLayout = lazy(() => import("../components/SuperAdmin/Finance/StaffPaymentsLayout"));
const StaffPayments = lazy(() => import("../components/SuperAdmin/Finance/StaffPayments"));
const StaffPaymentDetails = lazy(() => import("../components/SuperAdmin/Finance/StaffPaymentDetails"));
const BranchFinance = lazy(() => import("../components/SuperAdmin/Finance/BranchDetails"));
const UtilityPayments = lazy(() => import("../components/SuperAdmin/Finance/UtilityPayments"));
const Kassa = lazy(() => import("../components/SuperAdmin/Finance/Kassa/index.jsx"));
const SpecialStudentsDashboard = lazy(() =>
  import("../components/SuperAdmin/Finance/SpecialStudents/SpecialStudentsDashboard")
);

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
 <Route path="assignments" element={<GroupAssignmentsPage />} />
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
