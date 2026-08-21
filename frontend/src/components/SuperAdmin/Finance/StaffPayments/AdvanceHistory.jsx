import React from "react";
import { Coins, XCircle } from "lucide-react";

const AdvanceHistory = ({ data, formatCurrency, isSuperAdmin, handleDeleteAdvance }) => {
    if (!data.advances_history || data.advances_history.length === 0) return null;

    return (
        <div className="bg-[var(--bg-panel)] border border-rose-500/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center gap-2 bg-rose-500/5">
                <Coins size={14} className="text-rose-400" />
                <span className="text-[10px] font-black text-rose-400 capitalize tracking-widest">Berilgan Avanslar</span>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
                <table className="w-full text-left">
                    <tbody className="divide-y divide-[#2a2a2a]">
                        {data.advances_history.map((adv) => (
                            <tr key={adv.id} className="hover:bg-rose-500/5 transition-colors group">
                                <td className="px-5 py-3">
                                    <p className="text-[10px] font-black text-[var(--text-secondary)]">{new Date(adv.date).toLocaleDateString()}</p>
                                    <p className="text-[8px] text-[var(--text-muted)] font-bold truncate max-w-[250px]">{adv.description || "Izohsiz"}</p>
                                </td>
                                <td className="px-5 py-3 text-[11px] font-black text-rose-400 tabular-nums text-right flex items-center justify-end gap-3">
                                    <span>-{formatCurrency(adv.amount)}</span>
                                    {isSuperAdmin && (
                                        <button onClick={() => handleDeleteAdvance(adv.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                            <XCircle size={10} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdvanceHistory;
