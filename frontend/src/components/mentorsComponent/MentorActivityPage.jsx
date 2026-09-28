import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BookOpen,
  Users,
  Award,
  TrendingUp,
  BarChart3,
  Layers,
  Building2,
  Loader2,
  RefreshCw,
  PieChart as PieIcon,
  CalendarCheck
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart
} from "recharts";
import api from "../../tokenUpdater/updater";
import { useCurrentBranch } from "../Authorized/useBranchId";

export default function MentorActivityPage() {
  const { currentBranchId, currentBranchName } = useCurrentBranch();
  const [selectedGroupId, setSelectedGroupId] = useState("all");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["mentor-activity-stats", currentBranchId],
    queryFn: async () => {
      const url = currentBranchId
        ? `/homework_attends/homeworks/activity-stats/?branch_id=${currentBranchId}`
        : `/homework_attends/homeworks/activity-stats/`;
      const res = await api.get(url);
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const summary = data?.summary || {
    total_homeworks: 0,
    total_submissions: 0,
    full_submissions: 0,
    half_submissions: 0,
    not_submitted: 0,
    checked_submissions: 0,
    check_rate: 0,
    full_rate: 0,
    total_groups: 0,
    total_students: 0,
  };

  const groups = data?.groups_breakdown || [];
  const rawTimeline = data?.timeline || [];
  const attendance = data?.attendance_summary || {
    total_records: 0,
    present_records: 0,
    attendance_rate: 0,
    total_days: 0,
  };

  // Faqat ma'lumoti bor yoki har 2-3 kunda qisqartirilgan vaqt chizig'i
  const timelineData = rawTimeline.filter((t, idx) => {
    // Agar vazifa bo'lsa yoki haftada 2 martalik nuqtalar
    return t.total > 0 || t.homeworks_created > 0 || idx % 3 === 0;
  });

  // Donut chart uchun ma'lumotlar
  const pieData = [
    { name: "To'liq tekshirilgan", value: summary.full_submissions, color: "#10b981" },
    { name: "Yarim topshirilgan", value: summary.half_submissions, color: "#f59e0b" },
    { name: "Topshirilmagan", value: summary.not_submitted, color: "#ef4444" },
  ].filter(item => item.value > 0);

  // Guruhlar filtrlangan bo'lsa
  const filteredGroups = selectedGroupId === "all"
    ? groups
    : groups.filter(g => String(g.id) === String(selectedGroupId));

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <Loader2 size={40} className="animate-spin text-[var(--gold)]" />
        <p className="text-xs font-black tracking-widest text-[var(--text-muted)] uppercase">
          Dars va vazifalar faolligi yuklanmoqda...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center p-6">
        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
          <AlertTriangle size={36} />
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Statistikani yuklashda xatolik yuz berdi</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-sm">
          Tarmoq aloqasini tekshiring yoki sahifani qayta yangilang.
        </p>
        <button
          onClick={() => refetch()}
          className="lux-btn lux-btn-primary px-6 py-2.5 text-xs mt-2"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 space-y-8 animate-lux-fade">
      {/* ─── 1. HEADER SECTION ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-glass)]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--gold-dim)] border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] shadow-[var(--gold-glow)]">
              <Activity size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight capitalize">
                Dars Faolligi va Tahlili
              </h1>
              <p className="text-[10px] text-[var(--gold)] font-black uppercase tracking-[0.25em] mt-0.5">
                Uyga vazifalar berilishi, tekshirilishi va dars ko'rsatkichlari
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {currentBranchName && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[11px] font-bold text-[var(--text-secondary)]">
              <Building2 size={13} className="text-[var(--gold)]" />
              <span>{currentBranchName}</span>
            </div>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-panel)] hover:bg-[var(--gold-dim)] border border-[var(--border-glass)] hover:border-[var(--gold)]/30 text-[11px] font-bold text-[var(--text-primary)] transition-all"
            title="Yangilash"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin text-[var(--gold)]" : "text-[var(--gold)]"} />
            <span className="hidden sm:inline">Yangilash</span>
          </button>
        </div>
      </div>

      {/* ─── 2. TOP KPI CARDS MATRIX ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {/* Card 1: Jami vazifalar */}
        <div className="lux-card relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              Berilgan Vazifalar
            </span>
            <div className="p-2 rounded-xl bg-[var(--gold-dim)] text-[var(--gold)]">
              <BookOpen size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[var(--text-primary)]">
            {summary.total_homeworks}
          </div>
          <div className="mt-2 text-[10px] font-bold text-[var(--gold)] flex items-center gap-1">
            <Layers size={11} /> {summary.total_groups} ta faol guruhda
          </div>
        </div>

        {/* Card 2: Tekshirish ko'rsatkichi (Check Rate) */}
        <div className="lux-card relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              Tekshirish Darajasi
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {summary.check_rate}%
          </div>
          <div className="mt-2 text-[10px] font-bold text-[var(--text-secondary)]">
            {summary.checked_submissions} / {summary.total_submissions} ta topshiriq ko'rib chiqilgan
          </div>
        </div>

        {/* Card 3: To'liq topshirilganlar */}
        <div className="lux-card relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              To'liq Bajarilgan
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Award size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-400">
            {summary.full_submissions}
          </div>
          <div className="mt-2 text-[10px] font-bold text-[var(--text-muted)]">
            Umumiy topshiriqlarning {summary.full_rate}% qismi
          </div>
        </div>

        {/* Card 4: Davomat / Dars qatnashuvi */}
        <div className="lux-card relative overflow-hidden group">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              Dars Davomati
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <CalendarCheck size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400">
            {attendance.attendance_rate}%
          </div>
          <div className="mt-2 text-[10px] font-bold text-[var(--text-muted)]">
            Oxirgi 30 kunda {attendance.total_days} kunlik darslar
          </div>
        </div>
      </div>

      {/* ─── 3. CHARTS ROW: DYNAMICS & STATUS DISTRIBUTION ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Main Chart: 30-Day Activity Trends (8 Cols) */}
        <div className="lg:col-span-8 lux-card flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] m-0">
                Topshiriqlar tekshirilishi va faollik dinamikasi
              </h2>
              <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold mt-1">
                Oxirgi 30 kun ichida berilgan vazifalar va o'quvchilar natijalari
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>To'liq</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Yarim</span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Topshirmagan</span>
              </div>
            </div>
          </div>

          <div className="w-full h-[320px] sm:h-[350px]">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFull" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorHalf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" opacity={0.5} />
                  <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-panel)",
                      border: "1px solid var(--border-glass)",
                      borderRadius: "12px",
                      color: "var(--text-primary)",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="homeworks_created" name="Vazifalar soni" fill="var(--gold)" radius={[4, 4, 0, 0]} barSize={12} />
                  <Area type="monotone" dataKey="full" name="To'liq topshirgan" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorFull)" />
                  <Area type="monotone" dataKey="half" name="Yarim topshirgan" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorHalf)" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-60">
                <BarChart3 size={32} className="mb-2" />
                <p className="text-xs font-bold">Vaqt chizig'i bo'yicha ma'lumotlar mavjud emas</p>
              </div>
            )}
          </div>
        </div>

        {/* Donut Chart: Submission Status Breakdown (4 Cols) */}
        <div className="lg:col-span-4 lux-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] m-0">
                Topshiriqlar holati ulushi
              </h2>
              <PieIcon size={16} className="text-[var(--gold)]" />
            </div>
            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold mb-4">
              Jami topshiriqlarning holati taqsimoti
            </p>
          </div>

          <div className="w-full h-[230px] flex items-center justify-center relative">
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--bg-panel)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-panel)",
                        border: "1px solid var(--border-glass)",
                        borderRadius: "12px",
                        color: "var(--text-primary)",
                        fontSize: "11px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Percentage Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-[var(--text-primary)]">
                    {summary.check_rate}%
                  </span>
                  <span className="text-[8px] font-bold text-[var(--gold)] uppercase tracking-widest">
                    Tekshirildi
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center text-[var(--text-muted)] opacity-60">
                <p className="text-xs font-bold">Topshiriqlar yo'q</p>
              </div>
            )}
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-[var(--border-glass)]">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> To'liq
              </span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{summary.full_submissions} ta</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-amber-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Yarim
              </span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{summary.half_submissions} ta</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-rose-500 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Topshirmagan
              </span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{summary.not_submitted} ta</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. GROUPS BREAKDOWN & PERFORMANCE TABLE ─────────────────────── */}
      <div className="lux-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-glass)]">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] m-0">
              Guruhlar kesimidagi uyga vazifa va faollik monitoringi
            </h2>
            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold mt-1">
              Har bir guruhdagi vazifalar soni, topshirish foizi va o'quvchilar ishtiroki
            </p>
          </div>

          {/* Group Filter Dropdown */}
          {groups.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                Guruh:
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="lux-input !py-1.5 !px-3 !w-auto text-xs font-bold rounded-xl"
              >
                <option value="all">Barcha guruhlar ({groups.length})</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.subject})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Groups List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => {
            return (
              <div
                key={group.id}
                className="p-5 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] hover:border-[var(--gold)]/40 transition-all flex flex-col justify-between gap-4 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)] capitalize">
                        {group.name}
                      </h3>
                      <p className="text-[9px] font-black text-[var(--gold)] uppercase tracking-wider mt-0.5">
                        {group.subject}
                      </p>
                    </div>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      {group.checked_rate}% faol
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-3">
                    <span className="flex items-center gap-1 font-bold">
                      <Users size={12} className="text-[var(--text-muted)]" />
                      {group.student_count} o'quvchi
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-bold">
                      <BookOpen size={12} className="text-[var(--gold)]" />
                      {group.homework_count} ta vazifa
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[9px] font-black uppercase text-[var(--text-muted)] mb-1.5">
                    <span>Tekshirilgan topshiriqlar</span>
                    <span className="text-[var(--text-primary)] font-mono">
                      {group.full_submissions + group.half_submissions} / {group.total_submissions}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--bg-panel)] overflow-hidden border border-[var(--border-glass)]">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--gold)] to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(group.checked_rate, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Submissions Mini Matrix */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--border-glass)] text-center">
                  <div className="p-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                    <p className="text-[8px] font-black text-emerald-400 uppercase">To'liq</p>
                    <p className="text-xs font-black text-[var(--text-primary)] mt-0.5">{group.full_submissions}</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                    <p className="text-[8px] font-black text-amber-400 uppercase">Yarim</p>
                    <p className="text-xs font-black text-[var(--text-primary)] mt-0.5">{group.half_submissions}</p>
                  </div>
                  <div className="p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/15">
                    <p className="text-[8px] font-black text-rose-400 uppercase">Kutilmoqda</p>
                    <p className="text-xs font-black text-[var(--text-primary)] mt-0.5">{group.not_submitted}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
