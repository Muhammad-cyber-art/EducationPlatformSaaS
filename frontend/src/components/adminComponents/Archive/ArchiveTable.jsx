import React from "react";
import { User, Users, Layers, RotateCcw, Trash2, Loader2 } from "lucide-react";

const formatDate = (dateString) => {
  if (!dateString) return "---";
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  }).toUpperCase();
};

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-40">
    <Loader2 className="animate-spin text-[var(--gold)] mb-6" size={40} />
    <p className="text-[10px] font-black capitalize tracking-[0.4em] opacity-40">Ma'lumotlar yuklanmoqda...</p>
  </div>
);

const EmptyState = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-40 text-[var(--text-muted)]">
    <Layers size={48} className="mb-6 opacity-20" />
    <p className="text-[10px] font-black capitalize tracking-[0.4em] mb-2">Arxiv bo'sh</p>
    <p className="text-[9px] font-bold capitalize tracking-widest opacity-40">Arxivlangan {label} topilmadi.</p>
  </div>
);

const ArchiveTable = ({
  type,
  data,
  isLoading,
  onRestore,
  onDelete,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  markedItems = {},
  onToggleMark,
  onSelectAll,
  onClearAll
}) => {
  if (isLoading) return <LoadingState />;
  if (data.length === 0) return <EmptyState label={type === 'students' ? 'membership' : type === 'lids' ? 'leads' : type === 'staff' ? 'delegates' : 'units'} />;

  const markedCount = Object.keys(markedItems).length;

  return (
    <div className="lux-card !p-0 overflow-hidden group">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--border-glass)] text-[9px] font-black capitalize tracking-[0.4em] text-[var(--text-muted)]">
              <th className="px-8 py-6 w-16 text-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-[var(--border-glass)] bg-transparent checked:bg-[var(--gold)] transition-all cursor-pointer"
                  checked={markedCount === data.length && data.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) onSelectAll(data);
                    else onClearAll();
                  }}
                />
              </th>
              <th className="px-8 py-6">
                {type === 'students' ? "O'quvchi ma'lumotlari" : type === 'lids' ? "Lid ma'lumotlari" : type === 'staff' ? "Xodim ma'lumotlari" : "Guruh nomi"}
              </th>
              <th className="px-8 py-6 hidden md:table-cell">
                {type === 'students' ? "Oxirgi faol guruhi" : type === 'lids' ? "Qiziqqan fani" : type === 'staff' ? "Vazifasi" : "Yo'nalish"}
              </th>
              <th className="px-8 py-6 hidden lg:table-cell">O'chirilgan sana</th>
              <th className="px-8 py-6 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-glass)]">
            {data.map((item, i) => (
              <tr key={item.id} className={`group/row hover:bg-[var(--gold-dim)] transition-colors ${markedItems[item.id] ? 'bg-[var(--gold-dim)]/50' : ''}`}>
                <td className="px-8 py-5 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[var(--border-glass)] bg-transparent checked:bg-[var(--gold)] transition-all cursor-pointer"
                    checked={!!markedItems[item.id]}
                    onChange={() => onToggleMark(item.id)}
                  />
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center ${type === 'staff' ? 'text-indigo-400' : type === 'lids' ? 'text-teal-400' : type === 'groups' ? 'text-orange-400' : 'text-[var(--gold)]'}`}>
                      {type === 'students' ? <User size={18} /> : type === 'lids' ? <User size={18} /> : type === 'staff' ? <Users size={18} /> : <Layers size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white capitalize tracking-tight">{item.full_name}</p>
                      {(type === 'staff' || type === 'lids') && <p className="text-[8px] font-black text-[var(--gold)] capitalize tracking-[0.2em]">{item.phone}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5 text-[10px] font-bold text-[var(--text-secondary)] hidden md:table-cell capitalize tracking-widest">
                  {type === 'students' ? (item.last_group_name || "GURUHSZ") : type === 'lids' ? (item.subject || "FAN TANLANMAGAN") : type === 'staff' ? item.role : (item.subject || "UMUMIY")}
                </td>
                <td className="px-8 py-5 hidden lg:table-cell">
                  <p className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest">{formatDate(item.archived_at)}</p>
                  {item.archived_by_name && (
                    <p className="text-[8px] font-bold text-[var(--gold)]/70 capitalize tracking-widest mt-1">
                      Kim tomonidan: {item.archived_by_name}
                    </p>
                  )}
                </td>
                <td className="px-8 py-5 text-right space-x-3">
                  <button onClick={() => onRestore(item.id)} className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[9px] font-black capitalize tracking-widest hover:bg-emerald-500 hover:text-black transition-all border border-emerald-500/20">
                    <RotateCcw size={12} className="inline mr-2" /> Tiklash
                  </button>
                  <button onClick={() => onDelete(item.id)} className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <div className="p-6 flex justify-center border-t border-[var(--border-glass)]">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-8 py-3 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] text-[10px] font-black capitalize tracking-widest hover:bg-[var(--gold)] hover:text-black transition-all border border-[var(--gold)]/20 disabled:opacity-50"
          >
            {isFetchingNextPage ? <Loader2 className="animate-spin inline mr-2" size={12} /> : "Yana yuklash"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ArchiveTable;
