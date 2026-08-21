import React from "react";
import GoBackButton from "../../sendback";
import { Save, X, Edit3, Layers, Trash2 } from "lucide-react";

const StudentHeader = ({
    isEditing,
    canEditStudent,
    userRole,
    handleSaveEdit,
    dispatch,
}) => {
    return (
        <div className="flex items-center justify-between gap-4 w-full mb-2">
            <div className="-ml-1 sm:-ml-2 scale-90 sm:scale-100 origin-left">
                <GoBackButton />
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {canEditStudent && (
                    <div className="flex gap-1 bg-[var(--bg-panel)] p-1 rounded-xl border border-[var(--border-glass)] shadow-sm">
                        {isEditing ? (
                            <>
                                <button 
                                    onClick={handleSaveEdit} 
                                    className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all" 
                                    title="Saqlash"
                                >
                                    <Save size={18} />
                                </button>
                                <button 
                                    onClick={() => dispatch({ type: 'SET_EDITING', payload: false })} 
                                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all" 
                                    title="Bekor qilish"
                                >
                                    <X size={18} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                    onClick={() => dispatch({ type: 'SET_EDITING', payload: true })} 
                                    className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all" 
                                    title="Tahrirlash"
                                >
                                    <Edit3 size={18} />
                                </button>
                                
                                {(userRole === 'admin' || userRole === 'super_admin') && (
                                    <button 
                                        onClick={() => dispatch({ type: 'TOGGLE_MERGE_MODAL', payload: true })} 
                                        className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all" 
                                        title="Birlashtirish"
                                    >
                                        <Layers size={18} />
                                    </button>
                                )}
                                
                                <button
                                    onClick={() => { 
                                        dispatch({ type: 'TOGGLE_UNENROLL_SELECT_MODAL', payload: true });
                                    }}
                                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                    title="O'chirish"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentHeader;
