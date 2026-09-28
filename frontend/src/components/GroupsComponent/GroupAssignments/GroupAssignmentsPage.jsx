import React, { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, useOutletContext } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../tokenUpdater/updater";
import toast from "react-hot-toast";
import {
  BookOpen,
  Target,
  History,
  Plus,
  Search,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  X,
  Trash2,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  RefreshCw,
  Sparkles,
  Send,
  Award,
  Download,
  FolderKanban,
  Check,
  Calendar,
  Layers,
  ChevronDown
} from "lucide-react";
import GoBackButton from "../../sendback";

const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "pdf", "doc", "docx", "xls", "xlsx"];

const getFileIcon = (filename) => {
  if (!filename) return <File size={18} className="text-[var(--gold)]" />;
  const ext = filename.split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg"].includes(ext)) {
    return <ImageIcon size={18} className="text-emerald-400" />;
  }
  if (["pdf", "doc", "docx"].includes(ext)) {
    return <FileText size={18} className="text-blue-400" />;
  }
  if (["xls", "xlsx"].includes(ext)) {
    return <FileSpreadsheet size={18} className="text-amber-400" />;
  }
  return <File size={18} className="text-[var(--gold)]" />;
};

const formatFileSize = (bytes) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

export default function GroupAssignmentsPage() {
  const { group_id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const outletCtx = useOutletContext() || {};
  const branchId = searchParams.get("branch") || outletCtx.branchId || "";
  const queryClient = useQueryClient();

  // Active Tab: 'homeworks' | 'mocktests' | 'history'
  const [activeTab, setActiveTab] = useState("homeworks");

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");

  // Create Mode toggles
  const [isCreatingHomework, setIsCreatingHomework] = useState(false);
  const [isCreatingMock, setIsCreatingMock] = useState(false);

  // Homework Form State
  const [hwTitle, setHwTitle] = useState("");
  const [hwDescription, setHwDescription] = useState("");
  const [hwFile, setHwFile] = useState(null);
  const [hwDragActive, setHwDragActive] = useState(false);

  // Mock Test Form State
  const [mockSubject, setMockSubject] = useState("");
  const [mockType, setMockType] = useState("Oylik nazorat");
  const [mockCustomType, setMockCustomType] = useState("");
  const [mockDate, setMockDate] = useState(() => new Date().toISOString().split("T")[0]);

  // --- QUERIES ---
  // 1. Group info
  const { data: groupInfo } = useQuery({
    queryKey: ["group-details-header", group_id],
    queryFn: () => api.get(`/groups/groups/${group_id}/`).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    enabled: !!group_id,
  });

  // 2. Homeworks list
  const {
    data: homeworksData,
    isLoading: isHwLoading,
    refetch: refetchHw,
    isFetching: isHwFetching,
  } = useQuery({
    queryKey: ["group-homeworks", group_id],
    queryFn: () => api.get(`/homework_attends/homeworks/?group_id=${group_id}`).then((r) => r.data),
    staleTime: 1000 * 60 * 2,
    enabled: !!group_id,
  });
  const homeworks = useMemo(() => {
    return Array.isArray(homeworksData) ? homeworksData : (homeworksData?.results || []);
  }, [homeworksData]);

  // 3. Mock Tests list
  const {
    data: mockTestsData,
    isLoading: isMockLoading,
    refetch: refetchMock,
    isFetching: isMockFetching,
  } = useQuery({
    queryKey: ["group-mock-tests", group_id],
    queryFn: () => api.get(`/homework_attends/mock-tests/?group_id=${group_id}`).then((r) => r.data),
    staleTime: 1000 * 60 * 2,
    enabled: !!group_id,
  });
  const mockTests = useMemo(() => {
    return Array.isArray(mockTestsData) ? mockTestsData : (mockTestsData?.results || []);
  }, [mockTestsData]);

  // 4. History / Archive list
  const {
    data: archiveData,
    isLoading: isArchiveLoading,
    refetch: refetchArchive,
  } = useQuery({
    queryKey: ["group-archive-storage", group_id],
    queryFn: () => api.get(`/archive/homework-storage/?group_id=${group_id}`).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    enabled: activeTab === "history" && !!group_id,
  });
  const archivedItems = useMemo(() => {
    return Array.isArray(archiveData) ? archiveData : (archiveData?.results || []);
  }, [archiveData]);

  // --- MUTATIONS ---
  // Create Homework
  const createHomeworkMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await api.post("/homework_attends/homeworks/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Vazifa muvaffaqiyatli yaratildi va Telegram orqali o'quvchilarga yuborildi!");
      queryClient.invalidateQueries({ queryKey: ["group-homeworks", group_id] });
      setHwTitle("");
      setHwDescription("");
      setHwFile(null);
      setIsCreatingHomework(false);
    },
    onError: (err) => {
      console.error("Vazifa yaratishda xato:", err);
      const msg = err.response?.data?.file?.[0] || err.response?.data?.detail || "Vazifa yaratishda xatolik yuz berdi.";
      toast.error(msg);
    },
  });

  // Delete Homework
  const deleteHomeworkMutation = useMutation({
    mutationFn: (id) => api.delete(`/homework_attends/homeworks/${id}/`),
    onSuccess: () => {
      toast.success("Vazifa o'chirildi va arxivlandi.");
      queryClient.invalidateQueries({ queryKey: ["group-homeworks", group_id] });
      queryClient.invalidateQueries({ queryKey: ["group-archive-storage", group_id] });
    },
    onError: () => toast.error("Vazifani o'chirishda xatolik."),
  });

  // Create Mock Test
  const createMockMutation = useMutation({
    mutationFn: (data) => api.post("/homework_attends/mock-tests/", data),
    onSuccess: () => {
      toast.success("Mock test muvaffaqiyatli yaratildi!");
      queryClient.invalidateQueries({ queryKey: ["group-mock-tests", group_id] });
      setMockSubject("");
      setMockCustomType("");
      setIsCreatingMock(false);
    },
    onError: () => toast.error("Mock test yaratishda xatolik yuz berdi."),
  });

  // Delete Mock Test
  const deleteMockMutation = useMutation({
    mutationFn: (id) => api.delete(`/homework_attends/mock-tests/${id}/`),
    onSuccess: () => {
      toast.success("Mock test o'chirildi.");
      queryClient.invalidateQueries({ queryKey: ["group-mock-tests", group_id] });
    },
    onError: () => toast.error("Testni o'chirishda xatolik."),
  });

  // Clear Archive
  const clearArchiveMutation = useMutation({
    mutationFn: () => api.delete(`/archive/homework-storage/clear_all/?group_id=${group_id}`),
    onSuccess: () => {
      toast.success("Guruh arxivi tozalandi.");
      queryClient.invalidateQueries({ queryKey: ["group-archive-storage", group_id] });
    },
    onError: () => toast.error("Arxivni tozalashda xatolik yuz berdi."),
  });

  // --- FILE HANDLING ---
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`Faqat quyidagi formatlar qabul qilinadi: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Fayl hajmi 25 MB dan oshmasligi kerak.");
      return;
    }

    setHwFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setHwDragActive(true);
  };

  const handleDragLeave = () => setHwDragActive(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setHwDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`Faqat ruxsat etilgan formatlar: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }
    setHwFile(file);
  };

  // Submit Homework
  const handleSubmitHomework = (e) => {
    e.preventDefault();
    if (!hwTitle.trim()) {
      toast.error("Iltimos, vazifa mavzusini kiriting.");
      return;
    }
    const formData = new FormData();
    formData.append("title", hwTitle.trim());
    formData.append("description", hwDescription.trim());
    formData.append("group", group_id);
    if (hwFile) {
      formData.append("file", hwFile);
    }
    createHomeworkMutation.mutate(formData);
  };

  // Submit Mock Test
  const handleSubmitMock = (e) => {
    e.preventDefault();
    if (!mockSubject.trim()) {
      toast.error("Iltimos, test mavzusini kiriting.");
      return;
    }
    const finalType = mockType === "Boshqa" ? mockCustomType.trim() : mockType;
    createMockMutation.mutate({
      subject: mockSubject.trim(),
      type: finalType || "Umumiy test",
      group: group_id,
      date: mockDate,
    });
  };

  // Filtered lists
  const filteredHomeworks = useMemo(() => {
    if (!searchTerm.trim()) return homeworks;
    const term = searchTerm.toLowerCase();
    return homeworks.filter(
      (h) =>
        h.title?.toLowerCase().includes(term) ||
        h.description?.toLowerCase().includes(term)
    );
  }, [homeworks, searchTerm]);

  const filteredMockTests = useMemo(() => {
    if (!searchTerm.trim()) return mockTests;
    const term = searchTerm.toLowerCase();
    return mockTests.filter(
      (m) =>
        m.subject?.toLowerCase().includes(term) ||
        m.type?.toLowerCase().includes(term)
    );
  }, [mockTests, searchTerm]);

  const filteredArchived = useMemo(() => {
    if (!searchTerm.trim()) return archivedItems;
    const term = searchTerm.toLowerCase();
    return archivedItems.filter(
      (a) =>
        a.full_name?.toLowerCase().includes(term) ||
        a.snapshot_data?.title?.toLowerCase().includes(term)
    );
  }, [archivedItems, searchTerm]);

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)] font-sans p-4 sm:p-6 md:p-8 animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* --- TOP HEADER BAR --- */}
        <div className="lux-card !p-5 sm:!p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-[var(--border-glass)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--gold)]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="flex items-center gap-4 z-10">
            <GoBackButton />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  Topshiriqlar Markazi
                </h1>
                {groupInfo?.name && (
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/30">
                    {groupInfo.name}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] font-bold text-[var(--text-muted)] tracking-wider mt-1 flex items-center gap-2">
                <span>Vazifalar, testlar va o'zlashtirish jurnali</span>
                {groupInfo?.mentor && (
                  <>
                    <span>•</span>
                    <span className="text-[var(--text-secondary)]">
                      Ustoz: {groupInfo.mentor.first_name} {groupInfo.mentor.last_name || ""}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-2.5 z-10 self-start md:self-auto">
            <div className="px-3.5 py-2 rounded-xl bg-[var(--bg-void)]/60 border border-[var(--border-glass)] flex items-center gap-2 shadow-inner">
              <BookOpen size={14} className="text-[var(--gold)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">Vazifalar:</span>
              <span className="text-xs font-black text-[var(--gold)]">{homeworks.length}</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-[var(--bg-void)]/60 border border-[var(--border-glass)] flex items-center gap-2 shadow-inner">
              <Target size={14} className="text-rose-400" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">Mock:</span>
              <span className="text-xs font-black text-rose-400">{mockTests.length}</span>
            </div>
          </div>
        </div>

        {/* --- NAVIGATION TABS --- */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[var(--border-glass)] pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
            {/* Homeworks Tab */}
            <button
              onClick={() => {
                setActiveTab("homeworks");
                setSearchTerm("");
              }}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap ${
                activeTab === "homeworks"
                  ? "bg-[var(--gold)] text-black shadow-lg shadow-[var(--gold-glow)]"
                  : "bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-glass)]"
              }`}
            >
              <BookOpen size={16} />
              <span>Uyga Vazifalar</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                  activeTab === "homeworks"
                    ? "bg-black/20 text-black"
                    : "bg-white/5 text-[var(--text-muted)]"
                }`}
              >
                {homeworks.length}
              </span>
            </button>

            {/* Mock Tests Tab */}
            <button
              onClick={() => {
                setActiveTab("mocktests");
                setSearchTerm("");
              }}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap ${
                activeTab === "mocktests"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                  : "bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-glass)]"
              }`}
            >
              <Target size={16} />
              <span>Mock Testlar</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                  activeTab === "mocktests"
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-[var(--text-muted)]"
                }`}
              >
                {mockTests.length}
              </span>
            </button>

            {/* History / Archive Tab */}
            <button
              onClick={() => {
                setActiveTab("history");
                setSearchTerm("");
              }}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap ${
                activeTab === "history"
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                  : "bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-glass)]"
              }`}
            >
              <History size={16} />
              <span>Tarix va Arxiv</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                  activeTab === "history"
                    ? "bg-black/20 text-black"
                    : "bg-white/5 text-[var(--text-muted)]"
                }`}
              >
                {archivedItems.length}
              </span>
            </button>
          </div>

          {/* Search Toolbar */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                placeholder={
                  activeTab === "homeworks"
                    ? "Vazifalarni qidirish..."
                    : activeTab === "mocktests"
                    ? "Mock testlarni qidirish..."
                    : "Arxivdan qidirish..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)]/60 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={() => {
                if (activeTab === "homeworks") refetchHw();
                else if (activeTab === "mocktests") refetchMock();
                else refetchArchive();
              }}
              title="Yangilash"
              className="p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 transition-all"
            >
              <RefreshCw
                size={16}
                className={isHwFetching || isMockFetching ? "animate-spin text-[var(--gold)]" : ""}
              />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: UYGA VAZIFALAR (HOMEWORKS) */}
        {/* ========================================================================= */}
        {activeTab === "homeworks" && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                  Uyga vazifalar ro'yxati
                </h2>
                <p className="text-[10px] text-[var(--text-muted)] font-medium">
                  Guruhga berilgan barcha topshiriqlar va o'quvchilar javoblari
                </p>
              </div>

              {!isCreatingHomework && (
                <button
                  onClick={() => setIsCreatingHomework(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-black tracking-wide uppercase hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--gold-glow)]"
                >
                  <Plus size={16} />
                  <span>+ Yangi Vazifa</span>
                </button>
              )}
            </div>

            {/* In-page Creation Card */}
            {isCreatingHomework && (
              <form
                onSubmit={handleSubmitHomework}
                className="lux-card !p-6 sm:!p-8 border-[var(--gold)]/40 bg-[var(--bg-panel)]/90 shadow-2xl relative overflow-hidden animate-in slide-in-from-top-4 duration-300"
              >
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-glass)] mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center border border-[var(--gold)]/30">
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                        Yangi Uyga Vazifa Qo'shish
                      </h3>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Topshiriq va fayl Telegram Bot orqali barcha guruh a'zolariga yuboriladi
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingHomework(false);
                      setHwFile(null);
                    }}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Title & Description */}
                  <div className="lg:col-span-7 space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                        Vazifa Mavzusi / Sarlavhasi <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Masalan: JavaScript Array Methods va amaliy mashqlar"
                        value={hwTitle}
                        onChange={(e) => setHwTitle(e.target.value)}
                        className="lux-input focus:!border-[var(--gold)]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                        Batafsil Tavsif / Topshiriq Sharti
                      </label>
                      <textarea
                        rows={5}
                        placeholder="O'quvchilar nima qilishi kerakligi, topshirish muddati va qo'shimcha ko'rsatmalar..."
                        value={hwDescription}
                        onChange={(e) => setHwDescription(e.target.value)}
                        className="lux-input !h-auto !min-h-[110px] focus:!border-[var(--gold)] resize-none leading-relaxed p-3.5"
                      />
                    </div>
                  </div>

                  {/* Right Column: File Upload Zone */}
                  <div className="lg:col-span-5 space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                      Topshiriq Fayli (Ixtiyoriy)
                    </label>

                    {/* Drag & Drop Zone */}
                    {!hwFile ? (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                          hwDragActive
                            ? "border-[var(--gold)] bg-[var(--gold-dim)]/30"
                            : "border-[var(--border-glass)] bg-[var(--bg-void)]/30 hover:border-[var(--gold)]/40 hover:bg-[var(--bg-void)]/60"
                        }`}
                        onClick={() => document.getElementById("hw-file-input")?.click()}
                      >
                        <input
                          id="hw-file-input"
                          type="file"
                          accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <div className="w-12 h-12 rounded-2xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center mb-3">
                          <UploadCloud size={24} />
                        </div>
                        <p className="text-xs font-bold text-[var(--text-primary)] mb-1">
                          Faylni bu yerga tashlang yoki tanlang
                        </p>
                        <p className="text-[9px] text-[var(--text-muted)] max-w-xs leading-normal">
                          PNG, JPG, PDF, DOC, DOCX, XLS, XLSX (Maks. 25MB)
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-[var(--bg-void)]/80 border border-[var(--gold)]/40 flex items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[var(--gold-dim)] flex items-center justify-center shrink-0">
                            {getFileIcon(hwFile.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                              {hwFile.name}
                            </p>
                            <p className="text-[9px] text-[var(--text-muted)] mt-0.5">
                              {formatFileSize(hwFile.size)}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setHwFile(null)}
                          className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all shrink-0"
                          title="Faylni o'chirish"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    {/* Telegram Notification Info Banner */}
                    <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5">
                      <Send size={16} className="text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-blue-200/90 leading-relaxed font-medium">
                        <span className="font-bold text-blue-300">Telegram Bot:</span> Ushbu vazifa
                        saqlangach, fayl va tavsifi bilan birga guruhning barcha o'quvchilariga
                        avtomatik jo'natiladi.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-[var(--border-glass)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingHomework(false);
                      setHwFile(null);
                    }}
                    className="px-5 py-2.5 rounded-xl border border-[var(--border-glass)] text-xs font-bold text-[var(--text-muted)] hover:text-white transition-all"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={createHomeworkMutation.isPending}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--gold-glow)] disabled:opacity-50"
                  >
                    {createHomeworkMutation.isPending ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Yuborilmoqda...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Vazifani Yuborish</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Homeworks Grid */}
            {isHwLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <RefreshCw size={32} className="animate-spin text-[var(--gold)]" />
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  Vazifalar yuklanmoqda...
                </p>
              </div>
            ) : filteredHomeworks.length === 0 ? (
              <div className="lux-card !p-12 text-center border-dashed border-[var(--border-glass)] flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-[var(--gold-dim)] text-[var(--gold)] flex items-center justify-center">
                  <BookOpen size={28} />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mt-2">
                  {searchTerm ? "Qidiruv bo'yicha vazifa topilmadi" : "Hozircha vazifalar mavjud emas"}
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] max-w-sm">
                  {searchTerm
                    ? "Boshqa so'z bilan qidirib ko'ring yoki qidiruv filtrini tozalang."
                    : "Guruh o'quvchilariga yangi uyga vazifa berish uchun yuqoridagi tugmani bosing."}
                </p>
                {!searchTerm && !isCreatingHomework && (
                  <button
                    onClick={() => setIsCreatingHomework(true)}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-black tracking-wider uppercase hover:opacity-90 transition-all"
                  >
                    + Birinchi vazifani qo'shish
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredHomeworks.map((hw) => {
                  const total = hw.stats?.total || 0;
                  const completed = hw.stats?.completed || 0;
                  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const dateStr = new Date(hw.created_at).toLocaleDateString("uz-UZ", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const timeStr = new Date(hw.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={hw.id}
                      className="lux-card !p-5 flex flex-col justify-between border-[var(--border-glass)] hover:border-[var(--gold)]/40 hover:shadow-2xl transition-all duration-300 group relative bg-[var(--bg-panel)]/80"
                    >
                      {/* Top Bar */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[var(--gold-dim)] text-[var(--gold)] border border-[var(--gold)]/20">
                            Vazifa #{hw.id}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                            <Clock size={12} />
                            <span>{dateStr} • {timeStr}</span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors line-clamp-2 mb-2">
                          {hw.title}
                        </h4>
                        {hw.description && (
                          <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed mb-4">
                            {hw.description}
                          </p>
                        )}

                        {/* Attached File Badge */}
                        {hw.file && (
                          <div className="mb-4">
                            <a
                              href={hw.file}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] hover:border-[var(--gold)]/40 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--gold)] transition-all max-w-full"
                            >
                              {getFileIcon(hw.file)}
                              <span className="truncate max-w-[180px]">
                                {hw.file.split("/").pop()}
                              </span>
                              <Download size={12} className="shrink-0 opacity-60" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Bottom Section: Progress & Action */}
                      <div className="pt-4 border-t border-[var(--border-glass)] space-y-3">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-[var(--text-muted)]">O'zlashtirish:</span>
                          <span className="font-black text-[var(--text-primary)]">
                            {completed} / {total} topshirgan ({percent}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-[var(--bg-void)] overflow-hidden border border-[var(--border-glass)]">
                          <div
                            className="h-full bg-gradient-to-r from-[var(--gold)] to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            onClick={() => {
                              if (confirm("Ushbu vazifani o'chirib, arxivlamoqchimisiz?")) {
                                deleteHomeworkMutation.mutate(hw.id);
                              }
                            }}
                            className="p-2 rounded-xl text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                            title="Vazifani o'chirish"
                          >
                            <Trash2 size={16} />
                          </button>

                          <button
                            onClick={() => navigate(`../homeworks/${hw.id}?branch=${branchId}`)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)] hover:bg-[var(--gold)] hover:text-black text-xs font-black uppercase tracking-wider transition-all"
                          >
                            <span>Tekshirish</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MOCK TESTLAR (MOCK TESTS) */}
        {/* ========================================================================= */}
        {activeTab === "mocktests" && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                  Mock Testlar va Imtihonlar
                </h2>
                <p className="text-[10px] text-[var(--text-muted)] font-medium">
                  Guruhda o'tkazilgan sinov imtihonlari va ballarni kiritish
                </p>
              </div>

              {!isCreatingMock && (
                <button
                  onClick={() => setIsCreatingMock(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-black tracking-wide uppercase hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-rose-500/30"
                >
                  <Plus size={16} />
                  <span>+ Yangi Mock Test</span>
                </button>
              )}
            </div>

            {/* In-page Creation Card */}
            {isCreatingMock && (
              <form
                onSubmit={handleSubmitMock}
                className="lux-card !p-6 sm:!p-8 border-rose-500/40 bg-[var(--bg-panel)]/90 shadow-2xl relative overflow-hidden animate-in slide-in-from-top-4 duration-300"
              >
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-glass)] mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/30">
                      <Target size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                        Yangi Mock Test Yaratish
                      </h3>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Test yaratilgach, o'quvchilar ro'yxati bo'yicha ballarni qo'yib chiqishingiz mumkin
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCreatingMock(false)}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Subject */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                      Test Mavzusi / Nomi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Masalan: Full Mock Exam #12"
                      value={mockSubject}
                      onChange={(e) => setMockSubject(e.target.value)}
                      className="lux-input focus:!border-rose-500"
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                      Imtihon Turi
                    </label>
                    <select
                      value={mockType}
                      onChange={(e) => setMockType(e.target.value)}
                      className="lux-input focus:!border-rose-500"
                    >
                      <option value="Oylik nazorat">Oylik nazorat</option>
                      <option value="Haftalik test">Haftalik test</option>
                      <option value="Oraliq imtihon">Oraliq imtihon</option>
                      <option value="Yakuniy sinov">Yakuniy sinov</option>
                      <option value="Boshqa">Boshqa (qo'lda yozish)...</option>
                    </select>

                    {mockType === "Boshqa" && (
                      <input
                        type="text"
                        placeholder="Imtihon turini yozing..."
                        value={mockCustomType}
                        onChange={(e) => setMockCustomType(e.target.value)}
                        className="lux-input focus:!border-rose-500 mt-2"
                        required
                      />
                    )}
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                      O'tkazilish Sanasi
                    </label>
                    <input
                      type="date"
                      value={mockDate}
                      onChange={(e) => setMockDate(e.target.value)}
                      className="lux-input focus:!border-rose-500"
                      required
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-[var(--border-glass)]">
                  <button
                    type="button"
                    onClick={() => setIsCreatingMock(false)}
                    className="px-5 py-2.5 rounded-xl border border-[var(--border-glass)] text-xs font-bold text-[var(--text-muted)] hover:text-white transition-all"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={createMockMutation.isPending}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-rose-500/30 disabled:opacity-50"
                  >
                    {createMockMutation.isPending ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Yaratilmoqda...</span>
                      </>
                    ) : (
                      <>
                        <Target size={14} />
                        <span>Testni Yaratish</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Mock Tests Grid */}
            {isMockLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <RefreshCw size={32} className="animate-spin text-rose-500" />
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  Mock testlar yuklanmoqda...
                </p>
              </div>
            ) : filteredMockTests.length === 0 ? (
              <div className="lux-card !p-12 text-center border-dashed border-[var(--border-glass)] flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <Target size={28} />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mt-2">
                  {searchTerm ? "Qidiruv bo'yicha test topilmadi" : "Hozircha mock testlar mavjud emas"}
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] max-w-sm">
                  {searchTerm
                    ? "Boshqa so'z bilan qidirib ko'ring."
                    : "Guruh o'quvchilari uchun sinov imtihoni yaratish uchun yuqoridagi tugmani bosing."}
                </p>
                {!searchTerm && !isCreatingMock && (
                  <button
                    onClick={() => setIsCreatingMock(true)}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-black tracking-wider uppercase hover:opacity-90 transition-all"
                  >
                    + Birinchi testni yaratish
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMockTests.map((test) => {
                  const total = test.stats?.total || 0;
                  const graded = test.stats?.graded || 0;
                  const percent = total > 0 ? Math.round((graded / total) * 100) : 0;

                  return (
                    <div
                      key={test.id}
                      className="lux-card !p-5 flex flex-col justify-between border-[var(--border-glass)] hover:border-rose-500/40 hover:shadow-2xl transition-all duration-300 group relative bg-[var(--bg-panel)]/80"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {test.type || "Mock Test"}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                            <Calendar size={12} />
                            <span>{test.date || new Date(test.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-rose-400 transition-colors line-clamp-2 mb-2">
                          {test.subject}
                        </h4>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          Guruh: <span className="text-[var(--text-secondary)]">{test.group_name || groupInfo?.name}</span>
                        </p>
                      </div>

                      {/* Grading Status */}
                      <div className="pt-4 border-t border-[var(--border-glass)] space-y-3 mt-4">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-[var(--text-muted)]">Baholangan:</span>
                          <span className="font-black text-[var(--text-primary)]">
                            {graded} / {total} o'quvchi ({percent}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-[var(--bg-void)] overflow-hidden border border-[var(--border-glass)]">
                          <div
                            className="h-full bg-gradient-to-r from-rose-500 to-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            onClick={() => {
                              if (confirm("Ushbu mock testni o'chirmoqchimisiz?")) {
                                deleteMockMutation.mutate(test.id);
                              }
                            }}
                            className="p-2 rounded-xl text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                            title="Testni o'chirish"
                          >
                            <Trash2 size={16} />
                          </button>

                          <button
                            onClick={() => navigate(`../mock-tests/${test.id}?branch=${branchId}`)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white text-xs font-black uppercase tracking-wider transition-all"
                          >
                            <span>Baholash jurnali</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TARIX VA ARXIV (HISTORY & ARCHIVE) */}
        {/* ========================================================================= */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                  Topshiriqlar Tarixi va Arxiv
                </h2>
                <p className="text-[10px] text-[var(--text-muted)] font-medium">
                  Guruh bo'yicha oldingi barcha o'chirilgan yoki arxivlangan vazifalar hisoboti
                </p>
              </div>

              {archivedItems.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("Diqqat! Ushbu guruhning butun arxivini tozalab tashlamoqchimisiz?")) {
                      clearArchiveMutation.mutate();
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500 hover:text-white transition-all"
                >
                  <Trash2 size={14} />
                  <span>Arxivni tozalash</span>
                </button>
              )}
            </div>

            {isArchiveLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <RefreshCw size={32} className="animate-spin text-emerald-500" />
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  Arxiv ma'lumotlari yuklanmoqda...
                </p>
              </div>
            ) : filteredArchived.length === 0 ? (
              <div className="lux-card !p-12 text-center border-dashed border-[var(--border-glass)] flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <History size={28} />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mt-2">
                  Arxiv hozircha bo'sh
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] max-w-sm">
                  Vazifalar o'chirilganda ularning to'liq hisoboti va talabalar natijalari avtomatik
                  ushbu arxivga saqlanadi.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredArchived.map((item) => {
                  const stats = item.snapshot_data?.stats || {};
                  return (
                    <div
                      key={item.id}
                      className="lux-card !p-6 border-[var(--border-glass)] hover:border-emerald-500/40 transition-all bg-[var(--bg-panel)]/80"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-glass)]">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Arxiv #{item.id}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] font-medium">
                              {new Date(item.archived_at || item.created_at).toLocaleString()}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-[var(--text-primary)] mt-1.5">
                            {item.full_name || item.snapshot_data?.title || "Nomsiz vazifa"}
                          </h4>
                        </div>

                        {/* Summary Badges */}
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] text-center">
                            <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                              O'zlashtirish
                            </p>
                            <p className="text-sm font-black text-emerald-400">
                              {stats.submission_rate ?? 0}%
                            </p>
                          </div>
                          <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] text-center">
                            <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                              To'liq
                            </p>
                            <p className="text-sm font-black text-[var(--gold)]">
                              {stats.full_submissions ?? 0}
                            </p>
                          </div>
                          <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] text-center">
                            <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                              Topshirmagan
                            </p>
                            <p className="text-sm font-black text-rose-400">
                              {stats.not_submitted ?? 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Students Snapshot Preview if available */}
                      {item.snapshot_data?.students_data?.length > 0 && (
                        <div className="pt-4">
                          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">
                            Talabalar natijalari (Snapshot):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.snapshot_data.students_data.slice(0, 10).map((st, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] text-[10px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
                              >
                                <span>{st.name}</span>
                                <span
                                  className={`text-[8px] font-bold ${
                                    st.status?.includes("To‘liq")
                                      ? "text-emerald-400"
                                      : st.status?.includes("Yarim")
                                      ? "text-amber-400"
                                      : "text-rose-400"
                                  }`}
                                >
                                  ({st.status})
                                </span>
                              </span>
                            ))}
                            {item.snapshot_data.students_data.length > 10 && (
                              <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-void)] text-[10px] font-bold text-[var(--text-muted)]">
                                +{item.snapshot_data.students_data.length - 10} ta yana...
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
