import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useSelector } from "react-redux";
import { UserPlus, Loader2, LayoutGrid } from "lucide-react";
import { get_user_info } from "../Authorized/getRole";

// Hooks
import { useWaitingHall } from "./WaitingHall/useWaitingHall";

// Components
import WaitingStudentCard from "./WaitingHall/WaitingStudentCard";
import AddStudentModal from "./WaitingHall/AddStudentModal";
import AssignGroupModal from "./WaitingHall/AssignGroupModal";

export default function WaitingHall() {
  const outletContext = useOutletContext();
  const branchIdFromOutlet = outletContext?.branchId;
  const userInfo = get_user_info();

  const globalSearch = useSelector((state) => state.mentor?.searchQuery || "");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(null);

  const activeBranchId = userInfo?.role === "super_admin" ? branchIdFromOutlet : userInfo?.branch_id;

  const {
    students,
    loading,
    groups,
    loadingGroups,
    fetchGroups,
    handleDelete,
    handleAssignToGroup,
    handleAddStudent
  } = useWaitingHall(activeBranchId);

  const searchFilter = globalSearch.toLowerCase().trim();
  const filteredStudents = students.filter(s =>
    !searchFilter ||
    (s.full_name && s.full_name.toLowerCase().includes(searchFilter)) ||
    (s.phone && s.phone.includes(searchFilter)) ||
    (s.subject && s.subject.toLowerCase().includes(searchFilter))
  );

  const onAssignClick = (student) => {
    setShowAssignModal(student);
    fetchGroups();
  };

  const handleAssign = async (studentId, groupId) => {
    const success = await handleAssignToGroup(studentId, groupId);
    if (success) setShowAssignModal(null);
  };

  return (
    <div className="animate-lux-fade px-3 sm:px-6 pt-3 pb-6">
      {/* BACKGROUND DECOR */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-[var(--gold)]/5 rounded-full blur-[100px] animate-pulse"></div>
      </div>

      {/* HEADER SECTION */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--border-glass)] mb-4">
        <div>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            Guruhga qo'shilishi rejalashtirilgan o'quvchilar tahlili va boshqaruvi.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="lux-btn lux-btn-primary flex items-center justify-center gap-2 h-9 px-4 rounded-xl text-xs font-semibold shadow-sm shrink-0"
        >
          <UserPlus size={15} />
          <span>Yangi Reja</span>
        </button>
      </div>

      {/* STUDENTS LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 size={40} className="animate-spin text-[var(--gold)]" />
          <p className="text-[10px] font-black capitalize tracking-[0.2em] text-[var(--text-muted)]">O'quvchilar yuklanmoqda...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="lux-card p-24 text-center border-dashed border-2 border-[var(--border-glass)] bg-transparent opacity-60">
          <div className="w-16 h-16 bg-[var(--bg-panel)] rounded-2xl flex items-center justify-center mx-auto mb-6 text-[var(--text-muted)]">
            <LayoutGrid size={32} />
          </div>
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Hozircha hech kim yo'q</h3>
          <p className="text-xs text-[var(--text-secondary)]">Kutishlar zalida birorta ham o'quvchi topilmadi.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* List Header */}
          <div className="hidden md:flex items-center gap-4 px-4 py-2 text-[10px] font-black tracking-wider text-[var(--text-muted)] uppercase border-b border-[var(--border-glass)]/50 mb-2 mx-1">
            <div className="w-10 shrink-0"></div>
            <div className="flex-[2]">O'quvchi</div>
            <div className="flex-1 min-w-[150px]">Izoh</div>
            <div className="w-28 text-right shrink-0">Sana</div>
            <div className="w-[76px] shrink-0"></div>
          </div>

          {/* List Items */}
          {filteredStudents.map((student) => (
            <WaitingStudentCard
              key={student.id}
              student={student}
              onDelete={handleDelete}
              onAssignClick={onAssignClick}
            />
          ))}
        </div>
      )}

      <AddStudentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddStudent}
      />

      <AssignGroupModal
        student={showAssignModal}
        isOpen={!!showAssignModal}
        onClose={() => setShowAssignModal(null)}
        groups={groups}
        loadingGroups={loadingGroups}
        onAssign={handleAssign}
      />
    </div>
  );
}
