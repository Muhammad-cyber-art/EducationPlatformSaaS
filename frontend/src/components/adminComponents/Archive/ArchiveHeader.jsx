import React from "react";
import GoBackButton from "../../sendback";
import { Hash } from "lucide-react";

const ArchiveHeader = () => {
    return (
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--border-glass)]">
            <div className="flex items-center gap-3">
                <GoBackButton />
                <div>
                    <p className="text-xs text-[var(--text-secondary)] font-medium capitalize flex items-center gap-2">
                        <Hash size={13} className="text-[var(--gold)]" />
                        <span>O'chirilgan Va Tasdiqlangan Ma'lumotlar</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ArchiveHeader;
