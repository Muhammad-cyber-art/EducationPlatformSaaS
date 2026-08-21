import { Route } from"react-router-dom";

// Components
import AdminPanel from"../components/adminComponents/adminpanel";
import AdminPageFirst from"../components/adminComponents/adPage";
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
import MentorFinance from"../components/mentorsComponent/MentorFinance";
import AdminProfile from"../components/adminComponents/adminProfile";
import ArchivePage from"../components/adminComponents/ArchivePage";
import AdminExpenses from"../components/adminComponents/Expenses/AdminExpenses";


export const AdminRoutes = (
 <Route path="/admin" element={<AdminPanel />}>
 <Route index element={<AdminPageFirst />} />

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
