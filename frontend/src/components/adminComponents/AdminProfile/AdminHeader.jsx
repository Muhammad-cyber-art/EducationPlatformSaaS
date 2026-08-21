import React from "react";
import GoBackButton from "../../sendback";
import { LogOut as LogOutIcon } from "lucide-react";

const AdminHeader = ({
    admin_id,
    LogOut
}) => {
    return (
        <div className="sticky -mt-10 z-40 bg-[var(--bg-void)]/80 backdrop-blur-md border-b border-[var(--border-glass)] px-4 py-3 md:px-8 transition-all">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <GoBackButton />
                    <span className="hidden md:block text-[10px] font-black text-[var(--text-muted)] capitalize tracking-[0.3em]">Xodim Profili</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    {!admin_id && (
                        <button onClick={LogOut} className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-[10px] font-black capitalize tracking-widest transition-all shadow-lg shadow-red-500/10 active:scale-95 flex items-center gap-1.5">
                            Chiqish <LogOutIcon size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminHeader;
