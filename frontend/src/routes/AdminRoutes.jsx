import { lazy } from "react";
import { Route } from "react-router-dom";

// Lazy Loaded Components
const AdminPanel = lazy(() => import("../components/adminComponents/adminpanel"));
const AdminPageFirst = lazy(() => import("../components/adminComponents/adPage"));
const MentorsLayout = lazy(() => import("../components/mentorsComponent/MentorsLayout"));
const MentorsPage = lazy(() => import("../components/mentorsComponent/MentorsPage"));
const MentorProfilePage = lazy(() => import("../components/mentorsComponent/MentorProfile"));
const MentorRegister = lazy(() => import("../components/RegisterUser/RegisterMentor"));
const GroupsLayout = lazy(() => import("../components/GroupsComponent/GroupLayout"));
const GroupsListPage = lazy(() => import("../components/GroupsComponent/GroupsPage"));
const AddGroup = lazy(() => import("../components/GroupsComponent/AddGroup"));
const GroupDetailLayout = lazy(() => import("../components/GroupsComponent/GroupDetailLayout"));
const GroupDetailPage = lazy(() => import("../components/GroupsComponent/GroupDetails"));
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
const MentorFinance = lazy(() => import("../components/mentorsComponent/MentorFinance"));
const AdminProfile = lazy(() => import("../components/adminComponents/adminProfile"));
const ArchivePage = lazy(() => import("../components/adminComponents/ArchivePage"));
const AdminExpenses = lazy(() => import("../components/adminComponents/Expenses/AdminExpenses"));
const TimetablePage = lazy(() => import("../components/GroupsComponent/TimetablePage"));
const GroupAssignmentsPage = lazy(() =>
  import("../components/GroupsComponent/GroupAssignments/GroupAssignmentsPage")
);


export const AdminRoutes = (
 <Route path="/admin" element={<AdminPanel />}>
 <Route index element={<AdminPageFirst />} />

 {/* Timetable Section */}
 <Route path="timetable" element={<TimetablePage />} />

 {/* Mentors Section */}
 <Route path="mentors" element={<MentorsLayout />}>
 <Route index element={<MentorsPage />} />
 <Route path=":mentor_id" element={<MentorProfilePage />} />
 <Route path="add-mentor" element={<MentorRegister />} />
 </Route>

 {/* Groups Section */}
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

 {/* Global Students Section */}
 <Route path="all_students" element={<GlobalStudentLayout />}>
 <Route index element={<GlobalStudentComponent />} />
 <Route path="special-students" element={<GlobalSpecialStudents />} />
 <Route path=":student_id" element={<StudentProfilePage />} />
 <Route path="add_to_global" element={<StudentAdd />} />
 </Route>

 <Route path="waiting-hall" element={<WaitingHall />} />
 <Route path="finance" element={<MentorFinance />} />
 <Route path="profile" element={<AdminProfile />} />
 <Route path="archive" element={<ArchivePage />} />
 <Route path="expenses" element={<AdminExpenses />} />

 </Route>
);
