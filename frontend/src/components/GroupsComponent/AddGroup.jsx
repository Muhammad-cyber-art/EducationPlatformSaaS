import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  ArrowLeft,
  Users,
  BookOpen,
  Calendar,
  Clock,
  CreditCard,
  CalendarDays,
  FileText,
  LayoutGrid,
  Loader2
} from "lucide-react";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { get_user_info } from "../Authorized/getRole";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useCurrentBranch } from "../Authorized/useBranchId";
import GoBackButton from "../sendback";
import AmountInput from "../Common/AmountInput";
import { safeArray } from "../../utils/safeArray";
import WeekdaySelector from "./WeekdaySelector";
import { formatDaysDisplay } from "../../utils/scheduleUtils";

const AddGroup = () => {
  const navigate = useNavigate();
  const [mentors, setMentors] = useState([]);
  const user_info = get_user_info();
  const { currentBranchId } = useCurrentBranch();
  const { branchId } = useOutletContext();
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const { data: userData = {} } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => api.get('/user/me/').then(res => res.data),
    staleTime: Infinity,
  });

  const perms = userData.permissions || {};
  const isSuperAdmin = user_info?.role === "super_admin";

  useEffect(() => {
    if (userData.id && perms.groups === false && !isSuperAdmin) {
      toast.error("Sizda guruh qo'shish ruxsati yo'q!");
      navigate(-1);
    }
  }, [userData.id, perms.groups, isSuperAdmin, navigate]);

  const [formData, setFormData] = useState({
    name: "",
    group_type: 'standard',
    branch_id: currentBranchId || branchId,
    subject: "",
    mentor_id: null,
    start_date: "",
    dars_kunlari: "Du, Chor, Ju",
    days: 'odd',
    custom_days: [0, 2, 4],
    dars_vaqti: "",
    monthly_price: "",
    description: "",
    is_faol: true,
  });

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      branch_id: currentBranchId || branchId,
    }));
  }, [currentBranchId, branchId]);

  useEffect(() => {
    const activeId = currentBranchId || branchId;
    if (!activeId) return;
    
    api
      .get(`/groups/mentors/?branch_id=${activeId}&page_size=200`)
      .then((res) => setMentors(safeArray(res.data)))
      .catch((err) => {
        console.error("Mentor fetch error:", err);
      });
  }, [currentBranchId, branchId]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.custom_days || formData.custom_days.length === 0) {
      toast.error("Kamida 1 ta hafta kunini tanlang!");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        dars_kunlari: formatDaysDisplay(formData.custom_days, false),
      };
      await api.post("/groups/groups/", payload);
      toast.success("Yangi guruh muvaffaqiyatli qo'shildi");
      navigate(-1);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Guruh qo'shishda xatolik yuz berdi.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-void)] relative">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 -right-1/4 w-[500px] h-[500px] bg-[var(--gold)]/[0.03] rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-1/4 -left-1/4 w-[400px] h-[400px] bg-[var(--gold)]/[0.03] rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 relative z-10">
        {/* HEADER */}
        <div className="flex items-center justify-between gap-6 mb-8 pb-6 border-b border-[var(--border-glass)]">
          <div className="flex items-center gap-4">
            <GoBackButton />
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] capitalize tracking-tight">Guruh ochish</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-black text-[var(--gold)] tracking-widest capitalize">Yangi tarkib</span>
                <span className="w-1 h-1 rounded-full bg-[var(--border-glass)]"></span>
                <p className="text-[9px] text-[var(--text-muted)] font-bold capitalize tracking-widest font-sans">Formalar xizmati</p>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-glass)] items-center justify-center text-[var(--gold)] shadow-lg">
            <Plus size={20} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Core Details */}
          <div className="lux-card !p-5 md:!p-8 !rounded-2xl border-l-4 border-l-[var(--gold)]/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                <BookOpen size={16} />
              </div>
              <h3 className="text-[11px] font-black text-[var(--text-primary)] capitalize tracking-[0.2em]">Asosiy Ma'lumotlar</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 w-full">
                <label className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest ml-1">Guruh Nomi</label>
                <input
                  onChange={handleChange}
                  name="name"
                  type="text"
                  placeholder="Masalan: Frontend N10"
                  required
                  className="lux-input !bg-[var(--bg-void)] w-full"
                />
              </div>

              <div className="space-y-1.5 w-full">
                <label className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest ml-1">Fan Yo'nalishi</label>
                <input
                  onChange={handleChange}
                  name="subject"
                  type="text"
                  placeholder="Yo'nalish nomi"
                  className="lux-input !bg-[var(--bg-void)] w-full"
                />
              </div>

              <div className="space-y-1.5 w-full">
                <label className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest ml-1">Guruh Toifasi</label>
                <select
                  onChange={handleChange}
                  name="group_type"
                  required
                  className="lux-input !bg-[var(--bg-void)] w-full"
                  value={formData.group_type}
                >
                  <option value="standard" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">Standart</option>
                  <option value="advanced" className="bg-[var(--bg-panel)] text-[var(--text-primary)]">Advanced</option>
                </select>
              </div>

              <div className="space-y-1.5 w-full">
                <label className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest ml-1">Mentor </label>
                <select
                  onChange={handleChange}
                  name="mentor_id"
                  required
                  className="lux-input !bg-[var(--bg-void)] w-full"
                  defaultValue=""
                >
                  <option value="" disabled className="bg-[var(--bg-panel)]">Mentorni tanlang</option>
                  {mentors
                    .filter((item) => {
                      const activeId = Number(currentBranchId || branchId);
                      if (item.branch_id === activeId) return true;
                      if (item.accessible_branches && item.accessible_branches.some(b => b.id === activeId)) return true;
                      return false;
                    })
                    .map((ment) => (
                      <option key={ment.id} value={ment.id} className="bg-[var(--bg-panel)] text-[var(--text-primary)]">
                        {ment.full_name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5 w-full">
                <label className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest ml-1">Boshlanish Sanasi</label>
                <input
                  onChange={handleChange}
                  name="start_date"
                  type="date"
                  className="lux-input !bg-[var(--bg-void)] w-full"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Scheduling & Pricing with Custom Weekday Selector */}
          <div className="lux-card !p-5 md:!p-8 !rounded-2xl border-l-4 border-l-cyan-500/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
                <Clock size={16} />
              </div>
              <h3 className="text-[11px] font-black text-[var(--text-primary)] capitalize tracking-[0.2em]">Taqvim va To'lov</h3>
            </div>

            {/* Weekday Selector Component */}
            <WeekdaySelector
              value={formData.custom_days}
              onChange={(newDays) => {
                setFormData((prev) => ({
                  ...prev,
                  custom_days: newDays,
                  dars_kunlari: formatDaysDisplay(newDays, false),
                }));
              }}
              startTime={startTime}
              endTime={endTime}
              onTimeChange={({ startTime: st, endTime: et, timeString }) => {
                setStartTime(st);
                setEndTime(et);
                setFormData((prev) => ({
                  ...prev,
                  dars_vaqti: timeString,
                }));
              }}
              monthlyPrice={formData.monthly_price}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6 pt-6 border-t border-[var(--border-glass)]">
              <div className="space-y-1.5 w-full">
                <label className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest ml-1">Oylik To'lov Summasi</label>
                <div className="w-full">
                  <AmountInput
                    name="monthly_price"
                    value={formData.monthly_price}
                    onChange={handleChange}
                    placeholder="350,000"
                    required
                    className="lux-input !bg-[var(--bg-void)] pr-12 w-full"
                  />
                </div>
              </div>

              <div className="space-y-1.5 w-full">
                <label className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest ml-1">Mashg'ulot Vaqti (matn)</label>
                <input
                  onChange={handleChange}
                  name="dars_vaqti"
                  value={formData.dars_vaqti}
                  type="text"
                  placeholder="08:00 - 10:00"
                  className="lux-input !bg-[var(--bg-void)] w-full"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Extra Info */}
          <div className="lux-card !p-5 md:!p-8 !rounded-2xl border-l-4 border-l-emerald-500/30">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                <FileText size={16} />
              </div>
              <h3 className="text-[11px] font-black text-[var(--text-primary)] capitalize tracking-[0.2em]">Qo'shimcha Izoh</h3>
            </div>
            <textarea
              onChange={handleChange}
              name="description"
              rows="3"
              placeholder="Guruh haqida qo'shimcha ma'lumot..."
              className="w-full bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl p-4 text-sm text-[var(--text-primary)] focus:border-[var(--gold)]/40 transition-all outline-none resize-none min-h-[90px]"
            ></textarea>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-4 pt-4 pb-10">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 rounded-xl border border-[var(--border-glass)] bg-[var(--bg-panel)]/40 hover:bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/40 text-[11px] font-bold capitalize tracking-wider transition-all"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={loading}
              className="lux-btn lux-btn-primary !px-8 !h-12 !rounded-xl shadow-xl relative group overflow-hidden"
            >
              <span className="relative flex items-center gap-2 text-[11px] capitalize font-black">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? "Saqlanmoqda..." : "Tasdiqlash"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGroup;