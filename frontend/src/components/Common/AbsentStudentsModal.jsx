import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { UserX, X, Search, Loader2, Download, CheckCircle, PhoneCall, PhoneOff, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../tokenUpdater/updater';
import toast from 'react-hot-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

// --- Local Storage Helpers ---
const getStorageKey = (branchId) => `absent_checked_${branchId || 'default'}`;

const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const loadCheckedStudents = (branchId) => {
  try {
    const stored = localStorage.getItem(getStorageKey(branchId));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === getTodayDateStr()) {
        return new Set(parsed.ids);
      } else {
        localStorage.removeItem(getStorageKey(branchId)); // O'tgan kungi bo'lsa o'chiradi
      }
    }
  } catch (e) {
    console.error("Error reading local storage", e);
  }
  return new Set();
};

const saveCheckedStudents = (branchId, idsSet) => {
  try {
    const data = {
      date: getTodayDateStr(),
      ids: Array.from(idsSet)
    };
    localStorage.setItem(getStorageKey(branchId), JSON.stringify(data));
  } catch (e) {
    console.error("Error writing local storage", e);
  }
};

// --- New Skeleton Card Component ---
const SkeletonCard = () => (
  <div className="p-3 sm:p-4 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl flex items-center justify-between gap-3 animate-pulse">
    <div className="flex items-center gap-3 sm:gap-4 w-full pl-2">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--border-glass)] shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-[var(--border-glass)] rounded w-3/4" />
        <div className="h-3 bg-[var(--border-glass)] rounded w-1/2" />
      </div>
    </div>
    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--border-glass)] shrink-0 ml-2" />
  </div>
);
// -----------------------------------

const AbsentStudentsModal = ({ isOpen, onClose, branchId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [checkedStudents, setCheckedStudents] = useState(new Set());

  const handleDownloadExcel = async () => {
    if (!branchId) return;
    try {
      setDownloading(true);
      const response = await api.get(`/finance/statistics/absent-students/${branchId}/`, {
        params: { export: 'excel', search: searchTerm },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `kelmaganlar_${today}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Excel yuklandi.");
    } catch (err) {
      console.error("Excel download error:", err);
      toast.error("Excel yuklashda xatolik.");
    } finally {
      setDownloading(false);
    }
  };

  const fetchStudents = useCallback(async (pageNum, searchStr, isNewSearch = false) => {
    if (!branchId) return;
    try {
      setLoading(true);
      const res = await api.get(`/finance/statistics/absent-students/${branchId}/`, {
        params: {
          page: pageNum,
          search: searchStr
        }
      });

      const newResults = res.data.results || [];
      if (isNewSearch) {
        setData(newResults);
      } else {
        setData(prev => [...prev, ...newResults]);
      }

      setHasMore(res.data.next !== null);
    } catch (err) {
      console.error("Error fetching absent students:", err);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      setData([]);
      setHasMore(true);
      setSearchTerm('');
      setCheckedStudents(loadCheckedStudents(branchId));
      fetchStudents(1, '', true);
    }
  }, [isOpen, fetchStudents, branchId]);

  const handleToggleCheck = (studentId) => {
    setCheckedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      saveCheckedStudents(branchId, newSet);
      return newSet;
    });
  };

  // Handle search with debounce
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchStudents(1, searchTerm, true);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, fetchStudents]);

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    // Load more when reaching bottom
    if (scrollHeight - scrollTop <= clientHeight * 1.2 && !loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchStudents(nextPage, searchTerm, false);
    }
  };

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="bg-[var(--bg-panel)] border border-[var(--border-glass)] shadow-2xl rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col relative z-[99999] overflow-hidden"
      >
        {/* Header - Changed from gold to rose/red theme for absent context */}
        <div className="p-4 sm:px-6 sm:py-5 border-b border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-panel)] relative overflow-hidden">
          {/* Decorative background gradient */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-500">
              <UserX size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black capitalize tracking-tight text-[var(--text-primary)]">Kelmagan O'quvchilar</h3>
              <p className="text-xs font-bold text-rose-500/80 uppercase tracking-widest mt-0.5">Nazorat • Bugun</p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={handleDownloadExcel}
              disabled={downloading || data.length === 0}
              title="Excel yuklab olish"
              className="px-4 py-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 group"
            >
              {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} className="group-hover:-translate-y-0.5 transition-transform" />}
              <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">Excel</span>
            </button>

            <button
              onClick={onClose}
              className="p-2.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all duration-300 active:scale-95 border border-transparent hover:border-rose-500/20"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-4 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/30 relative z-10">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)] group-focus-within:text-rose-500 transition-colors">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="O'quvchi ismi, familiyasi yoki guruh nomi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/10 rounded-xl py-3 pl-10 pr-10 text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all shadow-sm"
            />
            
            <AnimatePresence>
              {searchTerm && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500 transition-colors"
                >
                  <div className="p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors">
                    <X size={16} />
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* List Content */}
        <div
          className="p-4 sm:px-6 sm:py-5 flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-void)]/20 relative"
          onScroll={handleScroll}
        >
          {loading && data.length === 0 ? (
            /* Initial Loading Skeletons */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : data.length > 0 ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 lg:grid-cols-2 gap-3"
            >
              {data.map((student, idx) => {
                const isChecked = checkedStudents.has(student.id);

                const cardBorderClass = isChecked ? "border-emerald-500/50 hover:border-emerald-500/80" : "border-[var(--border-glass)] hover:border-rose-500/30";
                const cardBgClass = isChecked ? "bg-emerald-500/5" : "bg-[var(--bg-panel)] hover:bg-rose-500/5";
                const accentLineClass = isChecked ? "bg-emerald-500" : "bg-rose-500/30 group-hover:bg-rose-500";
                const avatarBgClass = isChecked ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-rose-500/10 text-rose-500 border-rose-500/20";
                const groupDotClass = isChecked ? "bg-emerald-500/50" : "bg-rose-500/50";

                return (
                <motion.div
                  key={`${student.id}-${idx}`}
                  variants={itemVariants}
                  className={`p-3 sm:p-4 transition-all duration-300 border rounded-2xl flex items-center justify-between group relative overflow-hidden ${cardBgClass} ${cardBorderClass}`}
                >
                  {/* Subtle left border accent indicating absence */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${accentLineClass}`} />

                  <div className="flex items-center gap-3 sm:gap-4 pl-2 flex-1 min-w-0">
                    {/* Checkbox */}
                    <button 
                        onClick={() => handleToggleCheck(student.id)}
                        className={`shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all duration-200 border-2 ${
                            isChecked 
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                                : 'bg-[var(--bg-panel)] border-[var(--text-muted)]/30 group-hover:border-[var(--text-muted)]/60 hover:!border-emerald-400 hover:bg-emerald-500/10 text-transparent shadow-inner'
                        }`}
                    >
                        <Check size={14} strokeWidth={3} className={isChecked ? 'opacity-100' : 'opacity-0'} />
                    </button>

                    {/* Avatar */}
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center shrink-0 font-bold text-sm sm:text-base shadow-inner transition-colors ${avatarBgClass}`}>
                      {getInitials(student.name)}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h4 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate" title={student.name}>
                        {student.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] text-xs text-[var(--text-muted)] font-medium truncate max-w-[180px]" title={student.group}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${groupDotClass}`} />
                          <span className="truncate">{student.group}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Contact */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                    {student.phone ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${student.phone}`}
                          className="shrink-0 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm"
                          title="Qo'ng'iroq qilish"
                        >
                          <PhoneCall size={18} />
                        </a>
                      </div>
                    ) : (
                      <div 
                        className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)]/40"
                        title="Raqam kiritilmagan"
                      >
                        <PhoneOff size={16} />
                      </div>
                    )}
                    
                    {student.phone && (
                      <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-wide text-[var(--text-secondary)]">
                        {student.phone}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
              })}

              {/* Load More Skeletons */}
              {loading && hasMore && (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col items-center justify-center text-center py-10"
            >
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-5 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                <CheckCircle size={36} strokeWidth={2.5} className="relative z-10" />
              </div>
              <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">Barchasi joyida!</h3>
              <p className="text-sm text-[var(--text-muted)] font-medium max-w-[280px] mx-auto leading-relaxed">
                {searchTerm
                  ? "Qidiruvingiz bo'yicha hech qanday kelmagan o'quvchi topilmadi."
                  : "Bugungi barcha darslarda davomat to'liq. Barcha o'quvchilar ishtirok etmoqda."}
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-[var(--border-glass)] flex justify-between items-center bg-[var(--bg-panel)] z-10">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Jami: <span className="text-rose-500 text-sm ml-1">{data.length}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[var(--bg-void)] border border-[var(--border-glass)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-panel)] rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 active:scale-95 shadow-sm"
          >
            Yopish
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default AbsentStudentsModal;
