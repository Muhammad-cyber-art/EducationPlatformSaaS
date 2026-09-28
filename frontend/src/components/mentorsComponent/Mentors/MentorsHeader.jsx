import React from "react";
import GoBackButton from "../../sendback";
import { UserPlus, LayoutGrid, List } from "lucide-react";

const MentorsHeader = ({
  currentBranchName,
  mentorsCount,
  canCreateMentor,
  navigate,
  effectiveBranchId,
  viewMode,
  setViewMode
}) => {
  return (
    <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--border-glass)]">
      <div className="flex items-center gap-3">
        <GoBackButton />
        <div>
          <p className="text-xs text-[var(--text-secondary)] font-medium capitalize">
            {currentBranchName || "Boshqaruv bo'limi"} • {mentorsCount} nafar o'qituvchilar
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* View Toggle Buttons */}
        <div className="flex items-center h-9 p-0.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-sm">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-[var(--gold)] text-black shadow-sm font-bold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Grid View"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-[var(--gold)] text-black shadow-sm font-bold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="List View"
          >
            <List size={14} />
          </button>
        </div>

        {canCreateMentor && (
          <button
            onClick={() => navigate(`add-mentor?branch=${effectiveBranchId}`)}
            className="lux-btn lux-btn-primary flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-semibold shadow-sm shrink-0"
          >
            <UserPlus size={15} />
            <span>Qo'shish</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default MentorsHeader;
