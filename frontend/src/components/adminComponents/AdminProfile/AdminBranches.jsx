import React from"react";
import { MapPin, Building2, X } from"lucide-react";

const AdminBranches = ({
 admin,
 staffBranches,
 removeBranchMutation
}) => {
    return (
        <div className="space-y-4">
            {/* Main Branch */}
            <div className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <Building2 size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-black text-[var(--text-primary)] capitalize tracking-tight">{admin.branch?.name || "Asosiy filial"}</h4>
                        <p className="text-[9px] text-[var(--text-muted)] font-bold capitalize tracking-widest mt-1">{admin.branch?.address || "Manzil ko'rsatilmadi"}</p>
                    </div>
                </div>
            </div>

            {/* Additional Branches */}
            {staffBranches.length > 0 && (
                <div className="grid gap-3 pt-2">
                    {staffBranches.filter(b => b.branch && b.branch.id !== admin.branch?.id).map(branchAccess => (
                        <div key={branchAccess.id} className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl p-4 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[var(--bg-void)] text-blue-400 flex items-center justify-center border border-[var(--border-glass)]">
                                    <MapPin size={14} />
                                </div>
                                <span className="text-xs font-bold text-[var(--text-primary)] capitalize">{branchAccess.branch.name}</span>
                            </div>
                            <button onClick={() => removeBranchMutation.mutate(branchAccess.id)} className="p-2 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100" title="O'chirish">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminBranches;
