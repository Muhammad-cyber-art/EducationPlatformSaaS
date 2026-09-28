import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  Users,
  GraduationCap,
  Sparkles,
  Check,
  X,
  ChevronRight,
  Filter,
  Search,
  BookOpen
} from "lucide-react";
import { get_user_info } from "../../Authorized/getRole";

const WEEKDAYS = [
  { id: "mon", key: 1, name: "Dushanba", short: "Du", dayType: "odd" },
  { id: "tue", key: 2, name: "Seshanba", short: "Se", dayType: "even" },
  { id: "wed", key: 3, name: "Chorshanba", short: "Ch", dayType: "odd" },
  { id: "thu", key: 4, name: "Payshanba", short: "Pa", dayType: "even" },
  { id: "fri", key: 5, name: "Juma", short: "Ju", dayType: "odd" },
  { id: "sat", key: 6, name: "Shanba", short: "Sh", dayType: "even" },
];

export default function GroupsTimetable({ groups = [], currentBranchId, readOnly }) {
  const navigate = useNavigate();
  const userInfo = get_user_info();
  const [selectedDay, setSelectedDay] = useState("all"); // 'all' or day id ('mon', etc.)
  const [mentorFilter, setMentorFilter] = useState("");
  const [timetableSearch, setTimetableSearch] = useState("");

  // Bugungi hafta kuni (1 = Dushanba, ..., 7 = Yakshanba)
  const currentDayIndex = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const todayKey = currentDayIndex === 0 ? 7 : currentDayIndex;

  // Unikal mentorlar ro'yxati
  const mentorsList = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => {
      if (g.mentor && g.mentor.id) {
        map.set(g.mentor.id, g.mentor.full_name || g.mentor.username);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [groups]);

  // Guruhlarni kunlar bo'yicha taqsimlash
  const timetableByDay = useMemo(() => {
    const search = timetableSearch.toLowerCase().trim();

    const map = {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
    };

    groups.forEach((group) => {
      // Mentor filtri
      if (mentorFilter && String(group.mentor?.id) !== String(mentorFilter)) {
        return;
      }

      // Qidiruv filtri
      if (search) {
        const name = (group.name || "").toLowerCase();
        const subject = (group.subject_name || group.subject || "").toLowerCase();
        const mentor = (group.mentor?.full_name || group.mentor?.username || "").toLowerCase();
        if (!name.includes(search) && !subject.includes(search) && !mentor.includes(search)) {
          return;
        }
      }

      const days = group.days || "odd";

      if (days === "odd") {
        map.mon.push(group);
        map.wed.push(group);
        map.fri.push(group);
      } else if (days === "even") {
        map.tue.push(group);
        map.thu.push(group);
        map.sat.push(group);
      } else if (days === "everyday") {
        map.mon.push(group);
        map.tue.push(group);
        map.wed.push(group);
        map.thu.push(group);
        map.fri.push(group);
        map.sat.push(group);
      } else {
        // Default: toq kunlar deb qaraladi
        map.mon.push(group);
        map.wed.push(group);
        map.fri.push(group);
      }
    });

    // Har bir kundagi guruhlarni vaqt bo'yicha saralash
    Object.keys(map).forEach((dayKey) => {
      map[dayKey].sort((a, b) => {
        const timeA = a.dars_vaqti || a.start_time || "00:00";
        const timeB = b.dars_vaqti || b.start_time || "00:00";
        return timeA.localeCompare(timeB);
      });
    });

    return map;
  }, [groups, mentorFilter, timetableSearch]);

  // Ko'rsatiladigan kunlar ro'yxati
  const displayedDays = useMemo(() => {
    if (selectedDay === "all") return WEEKDAYS;
    return WEEKDAYS.filter((d) => d.id === selectedDay);
  }, [selectedDay]);

  // Statistika
  const stats = useMemo(() => {
    let oddCount = 0;
    let evenCount = 0;
    let everydayCount = 0;
    let totalStudents = 0;

    groups.forEach((g) => {
      if (g.days === "odd") oddCount++;
      else if (g.days === "even") evenCount++;
      else if (g.days === "everyday") everydayCount++;
      else oddCount++;
      totalStudents += Number(g.students_count || 0);
    });

    return { oddCount, evenCount, everydayCount, totalStudents };
  }, [groups]);

  return (
    <div className="space-y-6">
      {/* 1. TEZ KORISHLI STATISTIKA VA FILTRLAR */}
      <div className="lux-card !p-4 sm:!p-6 border border-[var(--border-glass)] space-y-4">
        {/* Yuqori qator: Ko'rsatkichlar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-[var(--bg-void)]/40 border border-[var(--border-glass)]">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-1">
              Jami darslar
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-[var(--gold)]">{groups.length}</span>
              <span className="text-[10px] text-[var(--text-secondary)]">ta guruh</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 block mb-1">
              Toq kunlar (Du-Ch-Ju)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-blue-400">{stats.oddCount}</span>
              <span className="text-[10px] text-[var(--text-secondary)]">ta guruh</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
            <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 block mb-1">
              Juft kunlar (Se-Pa-Sh)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-purple-400">{stats.evenCount}</span>
              <span className="text-[10px] text-[var(--text-secondary)]">ta guruh</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
              Jami o'quvchilar
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-emerald-400">{stats.totalStudents}</span>
              <span className="text-[10px] text-[var(--text-secondary)]">nafar</span>
            </div>
          </div>
        </div>

        {/* Filtrlar paneli */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[var(--border-glass)]">
          {/* Mobil va Desktop kun tanlagichi */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedDay("all")}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                selectedDay === "all"
                  ? "bg-[var(--gold)] text-black border-transparent shadow-sm"
                  : "bg-[var(--bg-void)]/60 text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--text-primary)]"
              }`}
            >
              Haftalik (Barchasi)
            </button>
            {WEEKDAYS.map((d) => {
              const isToday = d.key === todayKey;
              const isSelected = selectedDay === d.id;
              const count = timetableByDay[d.id]?.length || 0;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDay(d.id)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[var(--gold)] text-black border-transparent shadow-sm"
                      : isToday
                      ? "bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/40"
                      : "bg-[var(--bg-void)]/60 text-[var(--text-secondary)] border-[var(--border-glass)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span>{d.short}</span>
                  <span className={`text-[8px] px-1 py-0.2 rounded-full ${isSelected ? "bg-black/20 text-black" : "bg-[var(--border-glass)] text-[var(--text-muted)]"}`}>
                    {count}
                  </span>
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mentor va Qidiruv */}
          <div className="flex items-center gap-2">
            {mentorsList.length > 0 && (
              <select
                value={mentorFilter}
                onChange={(e) => setMentorFilter(e.target.value)}
                className="lux-input text-[11px] py-1.5 px-3 rounded-xl border border-[var(--border-glass)] bg-[var(--bg-void)]/60 text-[var(--text-primary)]"
              >
                <option value="">Barcha o'qituvchilar</option>
                {mentorsList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative min-w-[140px] sm:min-w-[180px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={timetableSearch}
                onChange={(e) => setTimetableSearch(e.target.value)}
                placeholder="Guruh / Fan..."
                className="lux-input w-full pl-8 pr-3 py-1.5 text-[11px] rounded-xl border border-[var(--border-glass)] bg-[var(--bg-void)]/60 text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. DARS JADVALI SETKASI (TIMETABLE GRID) */}
      <div className={`grid gap-4 ${displayedDays.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"}`}>
        {displayedDays.map((day) => {
          const isToday = day.key === todayKey;
          const dayGroups = timetableByDay[day.id] || [];

          return (
            <div
              key={day.id}
              className={`rounded-2xl border transition-all flex flex-col min-h-[400px] ${
                isToday
                  ? "bg-[var(--bg-panel)]/80 border-[var(--gold)]/40 shadow-[0_4px_25px_rgba(184,134,11,0.08)]"
                  : "bg-[var(--bg-panel)]/40 border-[var(--border-glass)]"
              }`}
            >
              {/* Ustun sarlavhasi (Kun) */}
              <div className={`p-3.5 border-b flex items-center justify-between rounded-t-2xl ${
                isToday
                  ? "bg-[var(--gold)]/10 border-[var(--gold)]/20"
                  : "bg-[var(--bg-void)]/30 border-[var(--border-glass)]"
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isToday ? "bg-[var(--gold)] animate-pulse" : "bg-[var(--text-muted)]"}`}></div>
                  <span className="text-[12px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                    {day.name}
                  </span>
                  {isToday && (
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--gold)] text-black">
                      Bugun
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-black text-[var(--text-muted)]">
                  {dayGroups.length} ta
                </span>
              </div>

              {/* Darslar ro'yxati */}
              <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[700px]">
                {dayGroups.length === 0 ? (
                  <div className="py-16 text-center opacity-40">
                    <CalendarDays size={28} className="mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Darslar yo'q
                    </p>
                  </div>
                ) : (
                  dayGroups.map((group) => {
                    const cardColor = group.color || "#b8860b";

                    const handleGroupClick = () => {
                      const role = userInfo?.role;
                      const bParam = currentBranchId ? `?branch=${currentBranchId}` : "";
                      if (role === "mentor") {
                        navigate(`/mentor/groups/${group.id}${bParam}`);
                      } else {
                        navigate(`/admin/groups/${group.id}${bParam}`);
                      }
                    };

                    return (
                      <div
                        key={`${day.id}-${group.id}`}
                        onClick={handleGroupClick}
                        className="group relative p-3 rounded-xl bg-[var(--bg-void)]/60 hover:bg-[var(--bg-void)] border border-[var(--border-glass)] hover:border-[var(--gold)]/40 transition-all cursor-pointer shadow-sm active:scale-[0.99] overflow-hidden"
                      >
                        {/* Guruh rangli chap chiziq */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1"
                          style={{ background: cardColor }}
                        />

                        {/* Vaqt va davomat holati */}
                        <div className="flex items-center justify-between gap-2 mb-2 pl-1.5">
                          <div className="flex items-center gap-1.5 text-[var(--gold)]">
                            <Clock size={12} />
                            <span className="text-[11px] font-black tracking-tight tabular-nums">
                              {group.dars_vaqti || group.start_time || "--:--"}
                            </span>
                          </div>

                          {group.today_attendance_confirmed ? (
                            <span
                              className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5"
                              title="Davomat olingan"
                            >
                              <Check size={8} strokeWidth={3} /> Qilindi
                            </span>
                          ) : (
                            <span
                              className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-0.5"
                              title="Davomat olinmagan"
                            >
                              <X size={8} strokeWidth={3} /> Olinmagan
                            </span>
                          )}
                        </div>

                        {/* Guruh nomi */}
                        <div className="pl-1.5 mb-2">
                          <h4 className="text-[12px] font-bold text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors line-clamp-1">
                            {group.name}
                          </h4>
                          <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-gold)] opacity-75">
                            {group.subject_name || group.subject || "Kurs"}
                          </span>
                        </div>

                        {/* O'qituvchi va O'quvchilar soni */}
                        <div className="pl-1.5 pt-2 border-t border-[var(--border-glass)] flex items-center justify-between text-[10px]">
                          <span className="text-[var(--text-secondary)] truncate flex items-center gap-1 font-medium max-w-[120px]">
                            <GraduationCap size={11} className="text-[var(--text-muted)] shrink-0" />
                            <span className="truncate">{group.mentor?.full_name || "O'qituvchi yo'q"}</span>
                          </span>

                          <span className="text-[var(--text-primary)] font-bold flex items-center gap-1 shrink-0">
                            <Users size={10} className="text-emerald-400" />
                            <span>{group.students_count || 0}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
