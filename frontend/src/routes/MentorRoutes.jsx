import { Route } from"react-router-dom";

// Components
import MentorProfileLayout from"../components/mentorsComponent/MentorProfLayout";
import MentorProfilePage from"../components/mentorsComponent/MentorProfile";
import MentorFinance from"../components/mentorsComponent/MentorFinance";
import GroupDetailLayout from"../components/GroupsComponent/GroupDetailLayout";
import GroupDetailPage from"../components/GroupsComponent/GroupDetails";
import StudentAdd from"../components/StudentComponents/AddStudent";
import StudentProfilePage from"../components/StudentComponents/Student";
import HomeworkSubmission from"../components/homework/HomeworkSubmsission";
import MockTestDetails from"../components/mockTests/MockTestDetails";
import TimetablePage from"../components/GroupsComponent/TimetablePage";
import MentorActivityPage from"../components/mentorsComponent/MentorActivityPage";
import GroupAssignmentsPage from "../components/GroupsComponent/GroupAssignments/GroupAssignmentsPage";

export const MentorRoutes = (
 <Route path="/mentor" element={<MentorProfileLayout />}>
 <Route index element={<MentorProfilePage viewMode="groups" />} />
 <Route path="timetable" element={<TimetablePage />} />
 <Route path="activity" element={<MentorActivityPage />} />
 <Route path="profile" element={<MentorProfilePage viewMode="profile" />} />
 <Route path="finance" element={<MentorFinance />} />
 <Route path="groups/:group_id" element={<GroupDetailLayout />}>
 <Route index element={<GroupDetailPage />} />
 <Route path="assignments" element={<GroupAssignmentsPage />} />
 <Route path="add_student" element={<StudentAdd />} />
 <Route path="students/:student_id" element={<StudentProfilePage />} />
 <Route path="homeworks/:mission_id" element={<HomeworkSubmission />} />
 <Route path="mock-tests/:test_id" element={<MockTestDetails />} />
 </Route>
 </Route>
);
