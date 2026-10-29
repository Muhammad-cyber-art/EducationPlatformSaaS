import React, { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { UserPlus, Send, MoreVertical, Edit3, UserRoundPlus, Activity, Target, Trash2, Check, ArrowRightLeft, FolderKanban, RefreshCw } from "lucide-react";
import GoBackButton from "../../sendback";
import SyncStatusBadge from "../../SyncStatusBadge";
import { normalizeCustomDays } from "../../../utils/scheduleUtils";
import { useSyncProgress } from "../../../hooks/useSyncProgress";

const GroupHeader = ({
  isEditing,
  editData,
  groupinfo,
  canAddStudent,
  canSendMessage,
  canEditGroup,
  canDeleteGroup,
  canAddMentor,
  canSeeHomework,
  showMenu,
  isGroupLogicActive,
  branchID,
  navigate,
  uiDispatch,
  handleDelete,
  isSuperAdmin,
  isAdmin
}) => {
  const canTransferGroup = isSuperAdmin || isAdmin;
  const desktopMenuButtonRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const menuContentRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const { isSyncing, isOnline, triggerSync } = useSyncProgress();

  // Function to calculate menu position
  const calculateMenuPosition = useCallback(() => {
    // Determine which button is visible
    const buttonRef =
      (desktopMenuButtonRef.current && desktopMenuButtonRef.current.offsetParent !== null)
        ? desktopMenuButtonRef
        : mobileMenuButtonRef;

    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = Math.min(224, window.innerWidth - 16);
    const menuMargin = 8;

    let left = rect.left + rect.width - menuWidth;
    let top = rect.bottom + menuMargin;

    // Ensure menu doesn't go off the right edge
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - menuMargin;
    }

    // Ensure menu doesn't go off the left edge
    if (left < menuMargin) {
      left = menuMargin;
    }

    setMenuPosition({ top, left });

    // Update position once content is rendered with actual height
    requestAnimationFrame(() => {
      if (menuContentRef.current) {
        const menuHeight = menuContentRef.current.offsetHeight;
        let updatedTop = rect.bottom + menuMargin;

        // Ensure menu doesn't go off the bottom edge
        if (updatedTop + menuHeight > window.innerHeight) {
          updatedTop = rect.top - menuHeight - menuMargin;
        }

        // Ensure top doesn't go off the top edge
        if (updatedTop < menuMargin) {
          updatedTop = menuMargin;
        }

        setMenuPosition(prev => ({ ...prev, top: updatedTop }));
      }
    });
  }, []);

  // Track menu button position when menu opens
  useEffect(() => {
    if (showMenu) {
      calculateMenuPosition();
    }
  }, [showMenu, calculateMenuPosition]);

  // Reposition menu on window resize
  useEffect(() => {
    if (!showMenu) return;

    const handleResize = () => {
      calculateMenuPosition();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [showMenu, calculateMenuPosition]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedOutsideMenu = menuContentRef.current && !menuContentRef.current.contains(event.target);
      const clickedOutsideDesktopButton = !desktopMenuButtonRef.current || !desktopMenuButtonRef.current.contains(event.target);
      const clickedOutsideMobileButton = !mobileMenuButtonRef.current || !mobileMenuButtonRef.current.contains(event.target);

      if (clickedOutsideMenu && clickedOutsideDesktopButton && clickedOutsideMobileButton) {
        uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false });
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [uiDispatch]);

  return (
    <>
      <div className="sticky top-0 z-40 bg-[var(--bg-void)]/95 backdrop-blur-md border-b border-[var(--border-glass)] -mt-3 sm:-mt-6 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6 shadow-sm">
        {/* Left Section: Back button + Title & Status */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
          <GoBackButton />
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-black text-[var(--text-primary)] tracking-tight capitalize truncate min-w-0">
                {isEditing ? (editData.name || "Yangi Guruh") : groupinfo.name}
              </h1>
              {!isEditing && (
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full border text-[7px] font-black uppercase tracking-wider shrink-0 ${groupinfo.group_type === 'advanced'
                  ? 'bg-[var(--gold)]/10 border-[var(--gold)]/30 text-[var(--gold)] shadow-[0_0_10px_rgba(184,134,11,0.2)]'
                  : 'bg-white/5 border-white/10 text-white/40'
                  }`}>
                  {groupinfo.group_type === 'advanced' ? 'ADVANCED' : 'STANDART'}
                </span>
              )}
            </div>
            <div className="text-[8px] sm:text-[9px] text-[var(--text-muted)] font-black capitalize tracking-wider mt-0.5 flex items-center gap-1.5 sm:gap-2 truncate">
              <span className="hidden xs:inline">Protocol:</span> <span className="text-[var(--gold)] truncate">{isEditing ? "Tahrirlash" : "Operatsion markaz"}</span>
              {!isEditing && groupinfo.computed_status && (
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-md border text-[7px] shrink-0 ${groupinfo.computed_status === 'active' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
                  groupinfo.computed_status === 'waiting' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                    groupinfo.computed_status === 'activating_soon' ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' :
                      'bg-red-500/10 border-red-500/30 text-red-500'
                  }`}>
                  {groupinfo.computed_status === 'active' ? 'FAOL' :
                    groupinfo.computed_status === 'waiting' ? 'KUTILMOQDA' :
                      groupinfo.computed_status === 'activating_soon' ? 'YAQINDA FAOL' : 'FAOL EMAS'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Sync Badge & Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="hidden md:flex items-center">
            <SyncStatusBadge />
          </div>
          {!isEditing && (
            <>
              {/* Desktop buttons (sm and up) */}
              <div className="hidden sm:flex items-center gap-2 sm:gap-3">
                {canAddStudent && (
                  <button
                    onClick={() => navigate(`add_student/?branch=${branchID}`)}
                    className="flex items-center justify-center gap-2 h-10 px-5 bg-[var(--gold)] text-white rounded-xl font-bold text-[10px] capitalize tracking-wider transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-50 shadow-md"
                    title="O'quvchi qo'shish"
                  >
                    <UserPlus size={16} />
                    <span>O'quvchi qo'shish</span>
                  </button>
                )}
                {canSendMessage && (
                  <button
                    onClick={() => uiDispatch({ type: "SET_FIELD", field: "isMessageModalOpen", value: true })}
                    className="w-10 h-10 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--gold)] hover:border-[var(--gold)]/40 transition-all shadow-md flex items-center justify-center active:scale-95"
                    title="Xabar yuborish"
                  >
                    <Send size={18} />
                  </button>
                )}
                {(canEditGroup || canDeleteGroup || canAddMentor || canTransferGroup || canSeeHomework) && (
                  <button
                    ref={desktopMenuButtonRef}
                    onClick={(e) => { e.stopPropagation(); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: !showMenu }); }}
                    className="w-10 h-10 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] transition-all shadow-md outline-none flex items-center justify-center focus:ring-1 focus:ring-[var(--gold)]/20 active:scale-95"
                    title="Boshqa amallar"
                  >
                    <MoreVertical size={18} />
                  </button>
                )}
              </div>

              {/* Mobile buttons (under sm) */}
              <div className="flex sm:hidden items-center gap-1.5 shrink-0">
                {canAddStudent && (
                  <button
                    onClick={() => navigate(`add_student/?branch=${branchID}`)}
                    className="flex items-center justify-center w-9 h-9 bg-[var(--gold)] text-white rounded-xl font-bold text-[10px] transition-transform active:scale-95 shadow-md shrink-0"
                    title="O'quvchi qo'shish"
                  >
                    <UserPlus size={16} />
                  </button>
                )}

                {(canSendMessage || canEditGroup || canDeleteGroup || canAddMentor || canTransferGroup || canSeeHomework) && (
                  <button
                    ref={mobileMenuButtonRef}
                    onClick={(e) => { e.stopPropagation(); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: !showMenu }); }}
                    className="w-9 h-9 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] transition-all shadow-md outline-none flex items-center justify-center active:scale-95 shrink-0"
                    title="Boshqa amallar"
                  >
                    <MoreVertical size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Menu Portal */}
      {showMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuContentRef}
          className="fixed w-56 max-w-[calc(100vw-16px)] bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right z-[9999] p-2"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
        >
          {/* Desktop menu (without Send) */}
          <div className="hidden sm:block">
            {canEditGroup && (
              <button
                onClick={() =>
                  uiDispatch({
                    type: "START_EDITING",
                    payload: {
                      ...groupinfo,
                      mentor_id: groupinfo.mentor?.id || groupinfo.mentor_id || "",
                      custom_days: normalizeCustomDays(groupinfo.custom_days, groupinfo.days),
                      start_date: groupinfo.start_date || "",
                      color: groupinfo.color || "#ffffff",
                    },
                  })
                }
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all"
              >
                <Edit3 size={14} className="text-[var(--gold)]" /> Guruhni tahrirlash
              </button>
            )}
            {canAddMentor && (
              <button onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isAddMentorModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all">
                <UserRoundPlus size={14} className="text-[var(--gold)]" /> Yordamchi biriktirish
              </button>
            )}
            {canTransferGroup && (
              <button onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isGroupTransferModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all">
                <ArrowRightLeft size={14} className="text-[var(--gold)]" /> Guruhni filialga o'tkazish
              </button>
            )}
            {canSeeHomework && (
              <button
                onClick={() => {
                  uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false });
                  navigate("assignments");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--gold)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all"
              >
                <FolderKanban size={14} /> Topshiriqlar
              </button>
            )}
            <div className="h-[1px] bg-[var(--border-glass)] my-1 mx-2"></div>
            {canDeleteGroup && (
              <button onClick={() => { if (confirm("Guruhni arxivlamoqchimisiz?")) handleDelete(); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500 text-[10px] font-black capitalize tracking-widest rounded-xl transition-all">
                <Trash2 size={14} /> Guruhni arxivlash
              </button>
            )}
          </div>

          {/* Mobile menu (with Send and Offline sync) */}
          <div className="sm:hidden">
            {canSendMessage && (
              <button onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isMessageModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all">
                <Send size={14} className="text-[var(--gold)]" /> Xabar yuborish
              </button>
            )}
            {canEditGroup && (
              <button
                onClick={() =>
                  uiDispatch({
                    type: "START_EDITING",
                    payload: {
                      ...groupinfo,
                      mentor_id: groupinfo.mentor?.id || groupinfo.mentor_id || "",
                      custom_days: normalizeCustomDays(groupinfo.custom_days, groupinfo.days),
                      start_date: groupinfo.start_date || "",
                      color: groupinfo.color || "#ffffff",
                    },
                  })
                }
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all"
              >
                <Edit3 size={14} className="text-[var(--gold)]" /> Guruhni tahrirlash
              </button>
            )}
            {canAddMentor && (
              <button onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isAddMentorModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all">
                <UserRoundPlus size={14} className="text-[var(--gold)]" /> Yordamchi biriktirish
              </button>
            )}
            {canTransferGroup && (
              <button onClick={() => { uiDispatch({ type: "SET_FIELD", field: "isGroupTransferModalOpen", value: true }); uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false }); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all">
                <ArrowRightLeft size={14} className="text-[var(--gold)]" /> Guruhni filialga o'tkazish
              </button>
            )}
            {canSeeHomework && (
              <button
                onClick={() => {
                  uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false });
                  navigate("assignments");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--gold)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all"
              >
                <FolderKanban size={14} /> Topshiriqlar
              </button>
            )}
            <button
              onClick={() => {
                triggerSync();
                uiDispatch({ type: "SET_FIELD", field: "showMenu", value: false });
              }}
              disabled={isSyncing || !isOnline}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold-dim)] text-[var(--text-primary)] text-[10px] font-black capitalize tracking-widest rounded-xl transition-all disabled:opacity-40"
            >
              <RefreshCw size={14} className={`text-[var(--gold)] ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? "Nusxalanmoqda..." : "Bazani nusxalash"}
            </button>
            <div className="h-[1px] bg-[var(--border-glass)] my-1 mx-2"></div>
            {canDeleteGroup && (
              <button onClick={() => { if (confirm("Guruhni arxivlamoqchimisiz?")) handleDelete(); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500 text-[10px] font-black capitalize tracking-widest rounded-xl transition-all">
                <Trash2 size={14} /> Guruhni arxivlash
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default GroupHeader;
