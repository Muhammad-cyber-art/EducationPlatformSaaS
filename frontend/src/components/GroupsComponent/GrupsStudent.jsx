import { useNavigate } from "react-router-dom";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { Smartphone, Check, X as XIcon, User, Send, ShieldCheck, ArrowRightLeft, Trash2, MoreVertical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import StudentTransferModal from "./GroupDetails/StudentTransferModal";
import { useState, useRef, useEffect } from "react";

// 3 nuqta dropdown menu komponenti
function StudentActionMenu({ item, onColor, onTransfer, onDelete, menuOpenId, setMenuOpenId }) {
  const menuRef = useRef(null);
  const colorInputRef = useRef(null);
  const desktopColorInputRef = useRef(null);
  const isOpen = menuOpenId === item.id;

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, setMenuOpenId]);

  return (
    <div className="flex items-center justify-center gap-2">
      {/* 1. Kompyuter va Planshet uchun ochiq tugmalar */}
      <div className="hidden md:flex items-center gap-2">
        <div className="relative" title="Rang tanlash">
          <input
            ref={desktopColorInputRef}
            type="color"
            defaultValue={item.color && item.color !== '#ffffff' ? item.color : '#000000'}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
            onChange={(e) => {
              onColor(item.id, e.target.value);
            }}
          />
          <div
            className="w-9 h-9 bg-[var(--bg-void)] text-[var(--text-secondary)] rounded-xl border border-[var(--border-glass)] flex items-center justify-center hover:text-[var(--gold)] hover:border-[var(--gold)]/50 transition-all cursor-pointer"
            onClick={(e) => { e.stopPropagation(); desktopColorInputRef.current?.click(); }}
          >
            <div
              className="w-5 h-5 rounded-full border-2 border-[var(--border-glass)] shadow-md"
              style={{ backgroundColor: item.color && item.color !== '#ffffff' ? item.color : '#555' }}
            />
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onTransfer(item); }}
          className="w-9 h-9 bg-[var(--gold-dim)] text-[var(--gold)] rounded-xl border border-[var(--gold)]/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          title="Guruhga ko'chirish"
        >
          <ArrowRightLeft size={14} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item); }}
          className="w-9 h-9 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          title="O'chirish / Arxiv"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* 2. Mobil qurilmalar uchun 3 nuqta (Dropdown) */}
      <div className="relative md:hidden" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpenId(isOpen ? null : item.id); }}
          className="w-9 h-9 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-all active:scale-90"
          title="Amallar"
        >
          <MoreVertical size={15} />
        </button>

        {isOpen && (
          <div
            className="absolute right-0 top-full mt-1.5 w-52 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-right"
            style={{ zIndex: 99999 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Rang berish */}
            <div
              className="relative flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold)]/5 transition-colors cursor-pointer border-b border-[var(--border-glass)]/40"
              onClick={() => colorInputRef.current?.click()}
            >
              <div
                className="w-5 h-5 rounded-full border-2 border-[var(--border-glass)] shrink-0 shadow-md"
                style={{ backgroundColor: item.color && item.color !== '#ffffff' ? item.color : '#555' }}
              />
              <span className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-wider">Rang berish</span>
              <input
                ref={colorInputRef}
                type="color"
                defaultValue={item.color && item.color !== '#ffffff' ? item.color : '#000000'}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={(e) => {
                  onColor(item.id, e.target.value);
                  setMenuOpenId(null);
                }}
              />
            </div>

            {/* Ko'chirish */}
            <button
              onClick={() => { onTransfer(item); setMenuOpenId(null); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold)]/5 transition-colors text-left border-b border-[var(--border-glass)]/40"
            >
              <ArrowRightLeft size={14} className="text-[var(--gold)] shrink-0" />
              <span className="text-[10px] font-black text-[var(--text-primary)] capitalize tracking-wider">Guruhga ko'chirish</span>
            </button>

            {/* O'chirish */}
            <button
              onClick={() => { onDelete(item); setMenuOpenId(null); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-left"
            >
              <Trash2 size={14} className="text-red-500 shrink-0" />
              <span className="text-[10px] font-black text-red-500 capitalize tracking-wider">O'chirish / Arxiv</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GroupsStudent({
  students,
  canEdit,
  attendanceData,
  onAttendanceChange,
  onLocalAttendanceChange,
  localOverrides = {},
  groupId,
  selectedDate,
  isLessonDay,
  mode = 'table',
  currentBranchId,
  markedStudents = {},
  onToggleMark
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [studentToTransfer, setStudentToTransfer] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const handleOpenTransfer = (student) => {
    setStudentToTransfer(student);
    setTransferModalOpen(true);
  };

  const handleTransferSuccess = () => {
    // Guruh ma'lumotlarini yangilash
    queryClient.invalidateQueries({ queryKey: ['group-detail', String(groupId)] });
    queryClient.invalidateQueries({ queryKey: ['group-detail', Number(groupId)] });
    if (onAttendanceChange) onAttendanceChange();
  };

  const handleDeleteStudent = async (student) => {
    if (!confirm(`"${student.full_name}" ni guruhdan olib tashlamoqchimisiz?`)) return;
    try {
      await api.delete(`/groups/students/${student.id}/`);
      queryClient.invalidateQueries({ queryKey: ['group-detail', String(groupId)] });
      queryClient.invalidateQueries({ queryKey: ['group-detail', Number(groupId)] });
      toast.success("O'quvchi guruhdan olib tashlandi");
    } catch (err) {
      toast.error(err.response?.data?.detail || "O'chirishda xatolik yuz berdi");
    }
  };

  const isConfirmMode = Boolean(onLocalAttendanceChange);

  const handleColorChange = async (studentId, newColor) => {
    try {
      await api.patch(`/groups/students/${studentId}/`, { color: newColor });
      queryClient.invalidateQueries({ queryKey: ['group-detail', String(groupId)] });
      queryClient.invalidateQueries({ queryKey: ['group-detail', Number(groupId)] });
      queryClient.invalidateQueries({ queryKey: ['group-students'] });
      toast.success("Rang saqlandi", { id: 'color-success' });
    } catch (err) {
      toast.error("Rangni saqlashda xatolik");
    }
  };

  const handleToggle = async (attendanceId, currentStatus, studentId, studentName) => {
    if (!groupId) return;

    // Senior toggle logic:
    let nextStatus;
    if (isLessonDay) {
      // Dars kunlari faqat 2 holat: Keldi (true) <-> Kelmagan (false)
      nextStatus = currentStatus === false ? true : false;
    } else {
      // Dam olish kunlari 3 holat: ? (undefined) -> Keldi (true) -> Kelmagan (false) -> ?
      if (currentStatus === undefined) {
        nextStatus = true;
      } else if (currentStatus === true) {
        nextStatus = false;
      } else {
        nextStatus = undefined;
      }
    }

    if (isConfirmMode) {
      onLocalAttendanceChange(studentId, nextStatus);
      return;
    }

    try {
      const payload = {
        is_present: nextStatus,
        student_id: studentId,
        date: selectedDate
      };

      if (attendanceId) {
        payload.id = attendanceId;
      }

      // Agar status undefined bo'lsa va allaqachon rekord bo'lsa - o'chirib tashlaymiz
      if (nextStatus === undefined && attendanceId) {
        await api.delete(`/homework_attends/attendances/${attendanceId}/?group_id=${groupId}`);
      } else if (nextStatus !== undefined) {
        await api.post(`/homework_attends/attendances/?group_id=${groupId}`, payload);
      }

      if (onAttendanceChange) onAttendanceChange();

      const msg = nextStatus === true ? "Keldi" : nextStatus === false ? "Kelmagan" : "O'chirildi";
      toast.success(msg, { id: 'attend-success' });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Xatolik yuz berdi");
    }
  };

  return (
    <>
      {students.map((item, index) => {
        const attendanceArray = Array.isArray(attendanceData) ? attendanceData : [];
        const studentAttendance = attendanceArray.find(a => Number(a.student_id) === Number(item.id));

        // Senior Fix: O'quvchi guruhga qo'shilgan sanadan oldingi darslarni ko'rsatmaslik
        const joinDateStr = item.joined_at ? item.joined_at.split('T')[0] : null;
        const isJoinedLater = joinDateStr && selectedDate < joinDateStr;

        const defaultState = (isLessonDay && !isJoinedLater) ? true : undefined;

        let isPresent;
        if (item.id in localOverrides) {
          isPresent = localOverrides[item.id];
        } else if (studentAttendance) {
          // AGAR dars kuni bo'lmasa va mentor hali tasdiqlamagan bo'lsa (?) ko'rsatamiz
          if (!isLessonDay && !studentAttendance.marked_by) {
            isPresent = undefined;
          } else {
            isPresent = studentAttendance.is_present;
          }
        } else {
          isPresent = defaultState;
        }

        const attId = studentAttendance?.id;

        const renderStatusBadge = () => {
          if (!item.status || item.status === 'regular') return null;

          const configs = {
            discount: { label: "Imtiyozli", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
            low_income: { label: "Kam Ta'minlangan", color: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20" },
            negotiated: { label: "Kelishilgan Narx", color: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20" },
            teacher_negotiated: { label: "O'qituvchi kelishgan", color: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20" },
          };
          const config = configs[item.status] || { label: item.status, color: "text-[var(--gold)]", bg: "bg-[var(--gold)]/10", border: "border-[var(--gold)]/20" };

          return (
            <div className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-[9px] font-black capitalize tracking-tight shadow-sm ${config.bg} ${config.color} ${config.border}`}>
              {config.label}
            </div>
          );
        };

        if (mode === 'table') {
          return (
            <tr
              key={item.id || index}
              className="group hover:bg-[var(--bg-void)]/40 transition-all border-b border-[var(--border-glass)]/20 use-dynamic-border-left"
              style={item.color && item.color !== '#ffffff' ? { 
                borderLeft: `6px solid ${item.color}`,
                '--card-color': item.color
              } : {}}
            >
              <td className="px-4 py-3 text-center relative group/mark">
                <div
                  onClick={(e) => { e.stopPropagation(); onToggleMark(item.id); }}
                  className="flex items-center justify-center cursor-pointer w-full h-full min-h-[2rem] relative"
                >
                  <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono opacity-40 text-[9px] transition-all duration-300 ${markedStudents[item.id] || Object.keys(markedStudents || {}).length > 0 ? 'opacity-0 scale-50' : 'opacity-100 scale-100 group-hover/mark:opacity-0 group-hover/mark:scale-50'}`}>
                    {index + 1 < 10 ? `0${index + 1}` : index + 1}
                  </span>

                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 flex items-center justify-center ${markedStudents[item.id] || Object.keys(markedStudents || {}).length > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-50 group-hover/mark:opacity-100 group-hover/mark:scale-100'}`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${markedStudents[item.id] ? 'bg-[var(--gold)] border-[var(--gold)] text-black shadow-[0_0_8px_rgba(184,134,11,0.5)]' : 'border-[var(--border-glass)] border bg-[var(--bg-void)] text-transparent hover:border-[var(--gold)]/50'}`}>
                      {markedStudents[item.id] && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div
                  onClick={() => navigate(`students/${item.id}?branch=${currentBranchId}`)}
                  className="flex items-center gap-3 cursor-pointer group/user"
                >
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] group-hover/user:border-[var(--gold)]/50 flex items-center justify-center text-[var(--gold)] font-bold transition-all overflow-hidden shadow-inner">
                    {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <User size={14} />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-black text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors capitalize tracking-tight leading-tight whitespace-nowrap overflow-hidden">
                      {item.full_name}
                    </h4>
                    <p className="text-[8px] font-black text-[var(--text-muted)] capitalize tracking-widest mt-0.5 opacity-60">ID:{item.id}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[8px] font-black capitalize tracking-widest border
                ${item.current_payment_status ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>
                  {item.current_payment_status ? "To'langan" : "Qarzdor"}
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                {renderStatusBadge()}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[var(--text-primary)] text-[10px] font-bold font-mono">
                    <Smartphone size={10} className="text-[var(--gold)]" />
                    {item.phone?.slice(-9) || "---"}
                  </div>
                  <div className="flex gap-2">
                    <div className={`${item.telegram_id ? "opacity-100" : "opacity-20"}`} title="Bot">
                      <Send size={10} className="text-indigo-400" />
                    </div>
                    <div className={`${item.parent_telegram_id ? "opacity-100" : "opacity-20"}`} title="Ota-ona">
                      <ShieldCheck size={10} className="text-[var(--gold)]" />
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                {canEdit ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(attId, isPresent, item.id, item.full_name); }}
                    className={`h-9 px-6 rounded-xl text-[9px] font-black capitalize tracking-[0.2em] flex items-center gap-2 transition-all shadow-md active:scale-90 ${isPresent === true
                      ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                      : isPresent === false
                        ? 'bg-red-500 text-white shadow-red-500/20'
                        : 'bg-[var(--bg-void)]/50 text-[var(--text-muted)] border border-[var(--border-glass)]'
                      }`}
                  >
                    {isPresent === true ? <Check size={14} /> : isPresent === false ? <XIcon size={14} /> : <span className="text-[12px] font-bold">?</span>}
                    <span>{isPresent === true ? 'Keldi' : isPresent === false ? "Yo'q" : '?'}</span>
                  </button>
                ) : (
                  <div className="flex justify-center">
                    {isPresent === true ? (
                      <Check size={16} className="text-emerald-500" />
                    ) : isPresent === false ? (
                      <XIcon size={16} className="text-red-500" />
                    ) : (
                      <span className="text-[14px] font-bold text-[var(--text-muted)]">?</span>
                    )}
                  </div>
                )}
              </td>
              {/* 3 nuqta: amallar */}
              <td className="px-4 py-3 text-center">
                <StudentActionMenu
                  item={item}
                  onColor={handleColorChange}
                  onTransfer={handleOpenTransfer}
                  onDelete={handleDeleteStudent}
                  menuOpenId={menuOpenId}
                  setMenuOpenId={setMenuOpenId}
                />
              </td>
            </tr>
          );
        }

        return (
          <div key={item.id || index}
               className={`lux-card !p-2.5 mb-2 group transition-all shadow-md relative overflow-visible use-dynamic-border-left ${markedStudents[item.id] ? 'border-[var(--gold)] bg-[var(--gold)]/5' : 'border-[var(--border-glass)]/30 hover:border-[var(--gold)]/40'}`}
               style={{
                 zIndex: menuOpenId === item.id ? 9999 : 1,
                 borderLeft: item.color && item.color !== '#ffffff' ? `6px solid ${item.color}` : undefined,
                 '--card-color': item.color && item.color !== '#ffffff' ? item.color : undefined
               }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div 
                  onClick={(e) => { e.stopPropagation(); onToggleMark(item.id); }}
                  className="cursor-pointer p-2 -ml-2 flex items-center justify-center"
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${markedStudents[item.id] ? 'bg-[var(--gold)] border-transparent text-black shadow-[0_0_8px_rgba(184,134,11,0.5)]' : 'border-[var(--text-muted)]/40 border bg-[var(--bg-void)] text-transparent hover:border-[var(--gold)]/50'}`}>
                    {markedStudents[item.id] && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>

                <div
                  onClick={() => navigate(`students/${item.id}?branch=${currentBranchId}`)}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <h4 className="text-[13px] font-black text-[var(--text-primary)] capitalize tracking-tight leading-tight mb-1">{item.full_name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[var(--text-muted)] font-black capitalize tracking-wider font-mono opacity-60">{item.phone?.slice(-9) || "---"}</span>
                    {renderStatusBadge()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <div className={`transition-opacity ${item.telegram_id ? "opacity-100" : "opacity-20"}`}>
                    <Send size={10} className="text-indigo-400" />
                  </div>
                  <div className={`transition-opacity ${item.parent_telegram_id ? "opacity-100" : "opacity-20"}`}>
                    <ShieldCheck size={10} className="text-[var(--gold)]" />
                  </div>
                </div>

                {canEdit ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(attId, isPresent, item.id, item.full_name); }}
                    className={`h-9 px-5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 text-[9px] font-black capitalize tracking-widest ${isPresent === true
                      ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                      : isPresent === false
                        ? 'bg-red-500 text-white shadow-red-500/20'
                        : 'bg-[var(--bg-void)]/50 text-[var(--text-muted)] border border-[var(--border-glass)]'
                      }`}
                  >
                    {isPresent === true ? <Check size={14} /> : isPresent === false ? <XIcon size={14} /> : <span className="text-[12px] font-bold">?</span>}
                    <span>{isPresent === true ? 'Keldi' : isPresent === false ? "Yo'q" : '?'}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {isPresent === true ? (
                      <Check size={16} className="text-emerald-500" />
                    ) : isPresent === false ? (
                      <XIcon size={16} className="text-red-500" />
                    ) : (
                      <span className="text-[14px] font-bold text-[var(--text-muted)]">?</span>
                    )}
                  </div>
                )}

                {/* 3 nuqta */}
                <StudentActionMenu
                  item={item}
                  onColor={handleColorChange}
                  onTransfer={handleOpenTransfer}
                  onDelete={handleDeleteStudent}
                  menuOpenId={menuOpenId}
                  setMenuOpenId={setMenuOpenId}
                />
              </div>
            </div>
          </div>
        );
      })}

      {studentToTransfer && (
        <StudentTransferModal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          student={studentToTransfer}
          currentGroupId={groupId}
          currentBranchId={currentBranchId}
          onTransferSuccess={handleTransferSuccess}
        />
      )}
    </>
  );
}
