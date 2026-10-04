import { lazy } from "react";
import { Route } from "react-router-dom";

// Lazy Loaded Components
const MentorProfileLayout = lazy(() => import("../components/mentorsComponent/MentorProfLayout"));
const MentorProfilePage = lazy(() => import("../components/mentorsComponent/MentorProfile"));
const MentorFinance = lazy(() => import("../components/mentorsComponent/MentorFinance"));
const GroupDetailLayout = lazy(() => import("../components/GroupsComponent/GroupDetailLayout"));
const GroupDetailPage = lazy(() => import("../components/GroupsComponent/GroupDetails"));
const StudentAdd = lazy(() => import("../components/StudentComponents/AddStudent"));
const StudentProfilePage = lazy(() => import("../components/StudentComponents/Student"));
const HomeworkSubmission = lazy(() => import("../components/homework/HomeworkSubmsission"));
const MockTestDetails = lazy(() => import("../components/mockTests/MockTestDetails"));
const TimetablePage = lazy(() => import("../components/GroupsComponent/TimetablePage"));
const MentorActivityPage = lazy(() => import("../components/mentorsComponent/MentorActivityPage"));
const GroupAssignmentsPage = lazy(() =>
  import("../components/GroupsComponent/GroupAssignments/GroupAssignmentsPage")
);

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
