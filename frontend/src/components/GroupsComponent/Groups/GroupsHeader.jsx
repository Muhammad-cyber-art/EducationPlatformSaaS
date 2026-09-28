import React from "react";
import { Plus } from "lucide-react";

const GroupsHeader = ({
  currentBranchName,
  groupsCount,
  canCreateGroup,
  navigate,
  currentBranchId
}) => {
  return (
    <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--border-glass)]">
      <div>
        <p className="text-xs text-[var(--text-secondary)] font-medium capitalize">
          {currentBranchName || 'Asosiy Boshqarma'} • {groupsCount} ta guruh
        </p>
      </div>

      {canCreateGroup && (
        <button
          onClick={() => navigate(`addgroup?branch=${currentBranchId}`)}
          className="lux-btn lux-btn-primary flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-semibold shadow-sm shrink-0"
        >
          <Plus size={15} />
          <span>Guruh yaratish</span>
        </button>
      )}
    </div>
  );
};

export default GroupsHeader;
