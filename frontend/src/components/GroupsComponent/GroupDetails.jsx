import { useEffect, useRef, useReducer, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";

// Hooks
import { useCurrentBranch } from "../Authorized/useBranchId";
import { useGroupDetails } from "./GroupDetails/useGroupDetails";
import { useAttendance } from "./GroupDetails/useAttendance";

// Sub-components
import GroupHeader from "./GroupDetails/GroupHeader";
import GroupSidebar from "./GroupDetails/GroupSidebar";
import GroupEditForm from "./GroupDetails/GroupEditForm";
import ResourcesModal from "./GroupDetails/ResourcesModal";
import AttendanceSection from "./GroupDetails/AttendanceSection";

// Modals
import HomeworkModal from "../homework/AddHomeworkModal";
import AddMockTestModal from "../mockTests/AddMockTestModal";
import AddMentorModal from "./assextramentor";
import SendMessageModal from "../Common/SendMessageModal";
import HomeworkStorageModal from "../homework/HomeworkStorageModal";
import GroupTransferModal from "./GroupDetails/GroupTransferModal";

const initialUIState = {
  error: "",
  isHomeworkModalOpen: false,
  isMockTestModalOpen: false,
  isAddMentorModalOpen: false,
  isMessageModalOpen: false,
  isStorageOpen: false,
  isEditing: false,
  editData: {},
  showMenu: false,
  isViewAllModalOpen: false,
  isGroupTransferModalOpen: false,
  activeAddMentor: null,
  selectedDate: new Date().toLocaleDateString('sv-SE'),
  markedStudents: JSON.parse(localStorage.getItem('marked_students') || '{}'),
  studentSearch: ""
};

function uiReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "START_EDITING":
      return { ...state, isEditing: true, editData: action.payload, showMenu: false };
    case "UPDATE_EDIT_DATA":
      return { ...state, editData: { ...state.editData, ...action.payload } };
    case "TOGGLE_MARK":
      const newMarked = { ...state.markedStudents };
      if (newMarked[action.payload]) delete newMarked[action.payload];
      else newMarked[action.payload] = true;
      localStorage.setItem('marked_students', JSON.stringify(newMarked));
      return { ...state, markedStudents: newMarked };
    case "CLEAR_MARKS":
      localStorage.removeItem('marked_students');
      return { ...state, markedStudents: {} };
    case "SELECT_ALL_MARKS":
      const allMarked = {};
      action.payload.forEach(s => { allMarked[s.id] = true; });
      localStorage.setItem('marked_students', JSON.stringify(allMarked));
      return { ...state, markedStudents: allMarked };
    default:
      return state;
  }
}

export default function GroupDetailPage() {
  const { group_id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const branchID = useCurrentBranch();
  const todayStr = new Date().toLocaleDateString('sv-SE');
  const todayObj = new Date();

  // Oy navigatsiyasi uchun state
  const [selectedMonth, setSelectedMonth] = useState(todayObj.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(todayObj.getFullYear());

  const [uiState, uiDispatch] = useReducer(uiReducer, {
    ...initialUIState,
    selectedDate: todayStr
  });

  const {
    isHomeworkModalOpen, isMockTestModalOpen, isAddMentorModalOpen, isViewAllModalOpen,
    isStorageOpen, isEditing, editData, showMenu, selectedDate, studentSearch
  } = uiState;

  // Data & Permissions
  const { groupinfo, groupStudents, lessonDates, botStats, permissions, userData, isGroupError } = useGroupDetails(group_id, selectedMonth, selectedYear);
  const {
    attendanceData, mergedAttendanceForDate, isAttendanceConfirmed,
    handleLocalAttendanceChange, handleConfirmAttendance, refetchAttends
  } = useAttendance(group_id, selectedDate, groupStudents, userData);

  // Business Logic Handlers
  const handleUpdate = async () => {
    try {
      const mentor_id = editData.mentor_id || editData.mentor?.id;
      const payload = {
        ...editData,
        mentor_id: mentor_id ? Number(mentor_id) : null,
        branch_id: groupinfo.branch?.id || groupinfo.branch_id
      };
      await api.put(`/groups/groups/${group_id}/`, payload);
      queryClient.invalidateQueries(['group-detail', group_id]);
      uiDispatch({ type: "SET_FIELD", field: "isEditing", value: false });
      toast.success("Muvaffaqiyatli saqlandi.");
    } catch (err) { toast.error("Xatolik yuz berdi."); }
  };

  const handleRemoveMentor = async (mentorId) => {
    if (!confirm("Olib tashlamoqchimisiz?")) return;
    try {
      await api.post(`/groups/groups/${group_id}/remove-additional-mentor/`, { mentor_id: mentorId });
      queryClient.invalidateQueries(['group-detail', group_id]);
      toast.success("Mentor olib tashlandi.");
    } catch (err) { toast.error("Xatolik yuz berdi."); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/groups/groups/${group_id}/`);
      toast.success("Guruh arxivlandi.");
      navigate(-1);
    } catch (err) { toast.error("Xatolik yuz berdi."); }
  };

  const handleGroupTransferSuccess = async () => {
    queryClient.invalidateQueries(['group-detail', group_id]);
    queryClient.invalidateQueries(['groups']); // Invalidate all group list queries
    queryClient.invalidateQueries(['nested_groups']);
  };

  const handleDownloadMonthlyReport = async () => {
    try {
      toast.loading("Yuklanmoqda...", { id: 'dl' });
      const res = await api.get(`homework_attends/attendances/monthly-report/?group_id=${group_id}&month=${selectedMonth}&year=${selectedYear}&export=excel`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `davomat_${groupinfo.name}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Hisobot yuklab olindi", { id: 'dl' });
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Xatolik yuz berdi";
      toast.error(msg, { id: 'dl' });
    }
  };

  const { data: mentorsRaw } = useQuery({
    queryKey: ['mentors-list-simple', groupinfo?.branch?.id || groupinfo?.branch_id],
    queryFn: () => {
      const b_id = groupinfo?.branch?.id || groupinfo?.branch_id;
      return api.get(`/groups/mentors/${b_id ? `?branch_id=${b_id}` : ''}`).then(res => res.data);
    },
    enabled: !!groupinfo?.id,
    staleTime: 1000 * 60 * 10,
  });
  const mentors = mentorsRaw?.results || mentorsRaw || [];

  const { data: homeworkRaw } = useQuery({
    queryKey: ['homeworks', group_id],
    queryFn: () => api.get(`/homework_attends/homeworks/?group_id=${group_id}`).then(res => res.data),
    enabled: !!group_id && !!userData.id && permissions.canSeeHomework,
  });
  const homework = homeworkRaw?.results || homeworkRaw || [];

  const { data: mockTestsRaw } = useQuery({
    queryKey: ['mock-tests', group_id],
    queryFn: () => api.get(`/homework_attends/mock-tests/?group_id=${group_id}`).then(res => res.data),
    enabled: !!group_id && !!userData.id && permissions.canSeeHomework,
  });
  const mockTests = mockTestsRaw?.results || mockTestsRaw || [];

  const isCurrentMonth = selectedMonth === todayObj.getMonth() + 1 && selectedYear === todayObj.getFullYear();

  const handlePrevMonth = useCallback(() => {
    setSelectedMonth(prev => {
      if (prev === 1) {
        setSelectedYear(y => y - 1);
        return 12;
      }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    const now = new Date();
    setSelectedMonth(prev => {
      const nextMonth = prev === 12 ? 1 : prev + 1;
      const nextYear = prev === 12 ? selectedYear + 1 : selectedYear;
      // Joriy oydan keyinga o'tishni oldini olish
      if (nextYear > now.getFullYear() || (nextYear === now.getFullYear() && nextMonth > now.getMonth() + 1)) {
        return prev;
      }
      if (prev === 12) setSelectedYear(nextYear);
      return nextMonth;
    });
  }, [selectedYear]);

  const handleGoToCurrentMonth = useCallback(() => {
    const now = new Date();
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  }, []);

  const availableDates = useMemo(() => {
    if (!lessonDates) return [todayStr];
    let dates = [...lessonDates];
    // Faqat joriy oy uchun bugungi kunni qo'shamiz
    if (isCurrentMonth && !dates.includes(todayStr)) {
      dates = [todayStr, ...dates].sort((a, b) => b.localeCompare(a));
    } else if (!isCurrentMonth) {
      // O'tgan oylar uchun: eskidan yangiga tartiblash
      dates.sort((a, b) => a.localeCompare(b));
    }
    return dates;
  }, [lessonDates, todayStr, isCurrentMonth]);

  // Oy o'zgarganda selectedDate'ni moslash
  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      uiDispatch({ type: "SET_FIELD", field: "selectedDate", value: availableDates[0] });
    }
  }, [availableDates, selectedDate]);

  const filteredStudents = useMemo(() => {
    const search = studentSearch.trim().toLowerCase();
    const sorted = [...groupStudents].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
    if (!search) return sorted;
    return sorted.filter(s => (s.full_name || "").toLowerCase().includes(search) || (s.phone || "").includes(search));
  }, [groupStudents, studentSearch]);

  const isGroupLogicActive = groupinfo.computed_status === 'active';

  // User talabi: Faqat bugun uchun davomat. 
  // Senior fix: Yarim tunda ishlayotgan mentorlar uchun tungi 4 gacha kechagi kunni ham ruxsat beramiz.
  const now = new Date();
  const currentHour = now.getHours();
  const todayStr_actual = now.toLocaleDateString('sv-SE');
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('sv-SE');

  const isAdmin = userData?.role === 'super_admin' || userData?.role === 'admin';

  // BUG #4 FIX: Admin uchun ham "oxirgi 3 ta dars" cheklovi qo'llanadi.
  // lessonDates dan bugungi sanagacha bo'lgan o'tgan darslarni olib, tartibga solamiz.
  const last3EditableDates = useMemo(() => {
    if (!lessonDates || !isCurrentMonth) return [];
    const pastDates = lessonDates.filter(d => d <= todayStr_actual);
    return pastDates.sort((a, b) => b.localeCompare(a)).slice(0, 3);
  }, [lessonDates, todayStr_actual, isCurrentMonth]);

  const canEditAttendance = permissions.canTakeAttendance && isGroupLogicActive && (
    selectedDate === todayStr_actual ||
    (currentHour < 4 && selectedDate === yesterdayStr) ||
    (isAdmin && last3EditableDates.includes(selectedDate))
  );




  if (isGroupError) return <div className="p-10 text-red-500">Guruh ma'lumotlarini yuklashda xatolik!</div>;

  return (
    <div className="w-full p-3 sm:p-6 space-y-6 animate-lux-fade pb-20">
      <GroupHeader
        {...{ isEditing, editData, groupinfo, showMenu, isGroupLogicActive, navigate, uiDispatch, handleDelete }}
        branchID={branchID.currentBranchId}
        {...permissions}
      />

      {isEditing ? (
        <GroupEditForm {...{ editData, mentors, uiDispatch, handleUpdate }} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-10">
          <GroupSidebar
            {...{ groupinfo, botStats, isGroupLogicActive, uiDispatch, handleRemoveMentor, handleDownloadMonthlyReport }}
            primaryColor={groupinfo.color || '#b8860b'}
            {...permissions}
          />

          <div className="xl:col-span-10 space-y-6">
            <AttendanceSection
              {...{
                group_id, groupinfo, groupStudents, filteredStudents, selectedDate, availableDates, lessonDates,
                attendanceData, isAttendanceConfirmed, canEditAttendance, isGroupLogicActive,
                isEditing, studentSearch, markedStudents: uiState.markedStudents, mergedAttendanceForDate,
                uiDispatch, handleConfirmAttendance, handleLocalAttendanceChange, refetchAttends, queryClient,
                canTakeAttendance: permissions.canTakeAttendance,
                selectedMonth, selectedYear, isCurrentMonth,
                onPrevMonth: handlePrevMonth, onNextMonth: handleNextMonth, onGoToCurrentMonth: handleGoToCurrentMonth
              }}

              branchID={branchID.currentBranchId}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {uiState.isMessageModalOpen && !isEditing && (
        <SendMessageModal isOpen={true} onClose={() => uiDispatch({ type: "SET_FIELD", field: "isMessageModalOpen", value: false })} groupId={group_id} />
      )}
      {isHomeworkModalOpen && <HomeworkModal isOpen={true} onClose={() => uiDispatch({ type: "SET_FIELD", field: "isHomeworkModalOpen", value: false })} groupId={group_id} />}
      {isMockTestModalOpen && <AddMockTestModal isOpen={true} onClose={() => uiDispatch({ type: "SET_FIELD", field: "isMockTestModalOpen", value: false })} groupId={group_id} />}
      {isAddMentorModalOpen && (
        <AddMentorModal 
          isOpen={true} 
          onClose={() => uiDispatch({ type: "SET_FIELD", field: "isAddMentorModalOpen", value: false })} 
          groupId={group_id} 
          branchId={groupinfo?.branch?.id || groupinfo?.branch_id}
          currentMentors={groupinfo.additional_mentors || []} 
        />
      )}
      {isStorageOpen && <HomeworkStorageModal isOpen={true} onClose={() => uiDispatch({ type: "SET_FIELD", field: "isStorageOpen", value: false })} groupId={group_id} />}
      {uiState.isGroupTransferModalOpen && (
        <GroupTransferModal 
          isOpen={true} 
          onClose={() => uiDispatch({ type: "SET_FIELD", field: "isGroupTransferModalOpen", value: false })} 
          groupinfo={groupinfo}
          onSuccess={handleGroupTransferSuccess}
        />
      )}

      <ResourcesModal
        isOpen={isViewAllModalOpen}
        onClose={() => uiDispatch({ type: "SET_FIELD", field: "isViewAllModalOpen", value: false })}
        {...{ homework, mockTests, navigate, uiDispatch }}
        branchID={branchID.currentBranchId}
      />
    </div>
  );
}
