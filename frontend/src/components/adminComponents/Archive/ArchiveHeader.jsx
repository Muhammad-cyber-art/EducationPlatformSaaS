import React from "react";
import GoBackButton from "../../sendback";
import { Hash, Search } from "lucide-react";

const ArchiveHeader = ({ searchTerm, setSearchTerm }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[var(--border-glass)]">
            <div className="flex items-center gap-6">
                <GoBackButton />
                <div>
                    <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter capitalize mb-2">Arxivlar Tarixi</h1>
                    <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-[0.3em] flex items-center gap-3">
                        <Hash size={12} className="text-[var(--gold)]" /> O'chirilgan Va Tasdiqlangan Ma'lumotlar
                    </p>
                </div>
            </div>

            <div className="flex-1 max-w-md relative group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gold)]" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Arxivdan qidirish..."
                    className="lux-input !pl-12 !py-4 w-full"
                />
            </div>
        </div>
    );
};

export default ArchiveHeader;
