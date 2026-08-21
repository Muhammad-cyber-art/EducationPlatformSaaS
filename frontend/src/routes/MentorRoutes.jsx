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

export const MentorRoutes = (
 <Route path="/mentor" element={<MentorProfileLayout />}>
 <Route index element={<MentorProfilePage viewMode="groups" />} />
 <Route path="profile" element={<MentorProfilePage viewMode="profile" />} />
 <Route path="finance" element={<MentorFinance />} />
 <Route path="groups/:group_id" element={<GroupDetailLayout />}>
 <Route index element={<GroupDetailPage />} />
 <Route path="add_student" element={<StudentAdd />} />
 <Route path="students/:student_id" element={<StudentProfilePage />} />
 <Route path="homeworks/:mission_id" element={<HomeworkSubmission />} />
 <Route path="mock-tests/:test_id" element={<MockTestDetails />} />
 </Route>
 </Route>
);
