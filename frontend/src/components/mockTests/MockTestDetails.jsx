import React, { useEffect, useReducer, useCallback, useMemo, memo } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import GoBackButton from "../sendback";
import {
  Users,
  CalendarDays,
  Hash,
  Loader2,
  Trash2,
  Save,
  Award,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  BookOpen
} from "lucide-react";
import api from '../../tokenUpdater/updater';

// --- Reducer Logic ---
const initialState = {
  loading: true,
  saving: false,
  testData: null,
  students: [],
  maxScoreInput: '',
  maxScore: ''
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_SAVING':
      return { ...state, saving: action.payload };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        testData: action.payload.testData,
        students: action.payload.students,
        loading: false
      };
    case 'UPDATE_STUDENT_SCORE':
      return {
        ...state,
        students: state.students.map(s =>
          s.id === action.payload.id ? { ...s, score: action.payload.value } : s
        )
      };
    case 'SET_MAX_SCORE_INPUT':
      return { ...state, maxScoreInput: action.payload };
    case 'SET_MAX_SCORE':
      return { ...state, maxScore: action.payload };
    default:
      return state;
  }
}

// --- Sub-components (Memoized) ---
const StudentRow = memo(({ student, maxScore, onScoreChange }) => {
  const initials = useMemo(() =>
    student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    [student.name]);

  const scoreValue = parseFloat(student.score);
  const isHigh = maxScore && scoreValue >= (maxScore * 0.85);

  return (
    <tr className="hover:bg-[var(--gold-dim)]/10 transition-all group/row">
      <td className="px-8 py-4">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-500 border
            ${isHigh ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' : 'bg-[var(--bg-void)] text-[var(--gold)] border-[var(--border-glass)] group-hover/row:border-[var(--gold)]/30'}`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[var(--text-primary)] capitalize group-hover/row:text-[var(--gold)] transition-colors truncate">
              {student.name.toLowerCase()}
            </p>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mt-0.5">ID: {student.id}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-4">
        <div className="flex justify-center">
          <div className="relative group/input max-w-[160px] w-full">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within/input:text-[var(--gold)] transition-colors pointer-events-none">
              <Award size={14} />
            </div>
            <div className="flex items-center lux-input !py-0 !px-0 !h-11 overflow-hidden focus-within:ring-2 focus-within:ring-[var(--gold)]/20 transition-all bg-[var(--bg-void)]/40 border-[var(--border-glass)]">
              <input
                type="text"
                value={student.score}
                onChange={(e) => onScoreChange(student.id, e.target.value)}
                placeholder="---"
                className={`bg-transparent border-none outline-none font-black text-sm h-full min-w-0 pr-1 ${maxScore ? 'w-2/3 text-right' : 'w-full text-center'}`}
              />
              {maxScore && (
                <div className="text-[var(--text-muted)] font-black text-[10px] pl-1 w-1/3 text-left opacity-60 pointer-events-none">
                  / {maxScore}
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
});

const StudentCardMobile = memo(({ student, maxScore, onScoreChange }) => {
  const initials = useMemo(() =>
    student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    [student.name]);

  return (
    <div className="lux-card !p-4 flex items-center justify-between gap-4 border border-[var(--border-glass)]/30 hover:border-[var(--gold)]/30 transition-all bg-[var(--bg-panel)]/40">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 shrink-0 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-xs font-black text-[var(--gold)]">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-black text-[var(--text-primary)] truncate capitalize tracking-tight leading-tight">
            {student.name.toLowerCase()}
          </p>
          <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">O'quvchi</p>
        </div>
      </div>

      <div className="w-[120px] flex-shrink-0">
        <div className="flex items-center lux-input !py-0 !px-0 !h-11 !rounded-2xl overflow-hidden bg-[var(--bg-void)]/60">
          <input
            type="text"
            value={student.score}
            onChange={(e) => onScoreChange(student.id, e.target.value)}
            placeholder="---"
            className={`bg-transparent border-none outline-none font-black text-xs h-full min-w-0 pr-1 ${maxScore ? 'w-2/3 text-right' : 'w-full text-center'}`}
          />
          {maxScore && (
            <div className="text-[var(--text-muted)] font-black text-[9px] pl-1 w-1/3 text-left opacity-60">
              / {maxScore}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// --- Main Component ---
const MockTestDetails = () => {
  const { test_id } = useParams();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);

  const { loading, saving, testData, students, maxScoreInput, maxScore } = state;

  useEffect(() => {
    const fetchTestDetails = async () => {
      try {
        const res = await api.get(`/homework_attends/mock-tests/${test_id}/`);
        const formattedTestData = {
          id: res.data.id,
          subject: res.data.subject,
          type: res.data.type,
          date: res.data.date,
          group_name: res.data.group_name
        };

        let detectedMaxScore = '';
        const formattedStudents = (res.data.students_status || []).map(s => {
          let displayScore = s.score || '';
          if (displayScore.includes('/')) {
            const parts = displayScore.split('/');
            displayScore = parts[0].trim();
            if (!detectedMaxScore) detectedMaxScore = parts[1].trim();
          }
          return {
            id: s.id,
            name: s.student_name,
            score: displayScore
          };
        });

        dispatch({
          type: 'FETCH_SUCCESS',
          payload: { testData: formattedTestData, students: formattedStudents }
        });

        if (detectedMaxScore) {
          dispatch({ type: 'SET_MAX_SCORE', payload: detectedMaxScore });
          dispatch({ type: 'SET_MAX_SCORE_INPUT', payload: detectedMaxScore });
        }
      } catch (err) {
        console.error("Failed to fetch test details", err);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    if (test_id) {
      fetchTestDetails();
    }
  }, [test_id]);

  const handleScoreChange = useCallback((id, value) => {
    dispatch({ type: 'UPDATE_STUDENT_SCORE', payload: { id, value } });
  }, []);

  const handleSave = useCallback(async () => {
    dispatch({ type: 'SET_SAVING', payload: true });
    let successCount = 0;
    let failCount = 0;

    try {
      for (const s of students) {
        if (s.score === "" || s.score === null) continue;

        try {
          const finalScore = maxScore ? `${s.score} / ${maxScore}` : String(s.score);
          await api.patch(`/homework_attends/mock-tests/${Number(test_id)}/update_student_score/`, {
            result_id: Number(s.id),
            score: finalScore
          });
          successCount++;
        } catch (e) {
          failCount++;
        }
      }

      if (failCount === 0) {
        toast.success("Natijalar muvaffaqiyatli saqlandi!");
      } else if (successCount > 0) {
        toast.error(`${failCount} ta o'quvchida xatolik yuz berdi.`);
      } else {
        toast.error("Hech bir natija saqlanmadi.");
      }
    } catch (err) {
      toast.error("Tizimda kutilmagan xatolik");
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, [students, maxScore, test_id]);

  const handleDeleteTest = useCallback(async () => {
    if (window.confirm("Bu testni o'chirib tashlamoqchimisiz?")) {
      try {
        await api.delete(`/homework_attends/mock-tests/${test_id}/`);
        toast.success("Test o'chirildi");
        navigate(-1);
      } catch (err) {
        console.error("Error deleting test:", err);
      }
    }
  }, [test_id, navigate]);

  const handleSetMaxScore = useCallback(() => {
    if (maxScoreInput) {
      dispatch({ type: 'SET_MAX_SCORE', payload: maxScoreInput });
      toast.success(`Maksimal ball: ${maxScoreInput}`);
    }
  }, [maxScoreInput]);

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-void)] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <Loader2 className="animate-spin text-[var(--gold)]" size={48} />
        <div className="absolute inset-0 blur-lg bg-[var(--gold)]/20 animate-pulse"></div>
      </div>
      <p className="text-[10px] font-black text-[var(--gold)] uppercase tracking-[0.5em] animate-pulse">Ma'lumotlar yuklanmoqda</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-void)] p-4 md:p-10 text-[var(--text-primary)] selection:bg-[var(--gold)]/40 animate-lux-fade">
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] rounded-full blur-[150px] bg-[var(--gold)]/5"></div>
        <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] rounded-full blur-[120px] bg-[var(--gold)]/5"></div>
      </div>

      <div className="max-w-[1200px] mx-auto space-y-8">
        {/* HEADER SECTION - STREAMLINED & ORGANIZED */}
        <div className="lux-card !p-6 md:!p-8 border border-[var(--border-glass)] bg-[var(--bg-panel)]/40 shadow-2xl relative overflow-hidden group">
          {/* Subtle accent line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)]/50 to-transparent"></div>
          
          <div className="space-y-6">
            {/* Top Row: Navigation, Title, Date & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              
              {/* Left: Nav + Identity */}
              <div className="flex items-center gap-5">
                <GoBackButton className="!w-12 !h-12 !rounded-xl !bg-[var(--bg-void)] !border-[var(--border-glass)] hover:!border-[var(--gold)]/50 transition-all active:scale-90" />
                <div className="h-8 w-[1px] bg-[var(--border-glass)] opacity-50"></div>
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-white uppercase italic">
                    {testData.subject}
                  </h1>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-500 tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    FAOL
                  </div>
                </div>
              </div>

              {/* Right: Date + Delete Action */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 px-5 py-2.5 bg-[var(--bg-void)]/60 border border-[var(--border-glass)] rounded-2xl group/date">
                  <CalendarDays size={16} className="text-[var(--gold)]" />
                  <span className="text-[12px] font-black text-[var(--gold)] tracking-widest">{testData.date}</span>
                </div>
                
                <button
                  onClick={handleDeleteTest}
                  className="w-11 h-11 flex items-center justify-center rounded-2xl bg-red-500/5 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all active:scale-95 shadow-lg group/del"
                >
                  <Trash2 size={18} className="group-hover/del:scale-110 transition-transform" />
                </button>
              </div>
            </div>

            {/* Bottom Row: Additional Meta Info */}
            <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-[var(--border-glass)]/30">
              <div className="flex items-center gap-2 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">
                <BookOpen size={14} className="text-[var(--gold)]" />
                <span>Tur: <span className="text-[var(--text-primary)]">{testData.type}</span></span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">
                <Users size={14} className="text-indigo-400" />
                <span>Guruh: <span className="text-indigo-400">{testData.group_name}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* ANALYTICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: "Jami O'quvchilar", value: `${students.length} ta`, icon: Users, color: "text-[var(--gold)]" },
            { label: "Maksimal Ball", value: maxScore || "O'rnatilmagan", icon: Award, color: "text-blue-400" },
            { label: "Imtihon ID", value: `#${test_id}`, icon: Hash, color: "text-purple-400" }
          ].map((stat, i) => (
            <div key={i} className="lux-card !p-6 flex items-center gap-5 group hover:border-[var(--gold)]/30 transition-all">
              <div className={`w-14 h-14 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center ${stat.color} shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                <stat.icon size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                <p className="text-xl font-black tracking-tight">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* MAIN RESULTS TABLE */}
        <div className="lux-card !p-0 overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)] border border-[var(--border-glass)] bg-[var(--bg-panel)]/40">
          <div className="px-6 py-6 md:px-10 md:py-8 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/30 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]">
                <TrendingUp size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">O'quvchilar Natijalari</h3>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Ballarni kiritish va tahrirlash</p>
              </div>
            </div>

            <div className="flex items-center flex-wrap justify-center md:justify-end gap-4 w-full md:w-auto">
              {/* Max Score Input */}
              <div className="flex items-center p-1.5 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl focus-within:border-[var(--gold)]/50 transition-all shadow-inner">
                <input
                  type="number"
                  value={maxScoreInput}
                  onChange={(e) => dispatch({ type: 'SET_MAX_SCORE_INPUT', payload: e.target.value })}
                  placeholder="Max ball..."
                  className="bg-transparent border-none outline-none text-[11px] font-black px-4 w-28 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50"
                />
                <button
                  onClick={handleSetMaxScore}
                  className="h-10 px-6 bg-[var(--gold)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-lg"
                >
                  OK
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="lux-btn !bg-emerald-500 hover:!bg-emerald-600 !text-black !h-12 !px-8 !rounded-2xl !text-[11px] !font-black !uppercase !tracking-widest shadow-[0_10px_20px_rgba(16,185,129,0.2)] active:scale-95 disabled:opacity-50 flex items-center gap-3 transition-all"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Saqlash
              </button>
            </div>
          </div>

          {/* TABLE / CARDS CONTENT */}
          <div className="p-3 md:p-0">
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {students.map((student) => (
                <StudentCardMobile
                  key={student.id}
                  student={student}
                  maxScore={maxScore}
                  onScoreChange={handleScoreChange}
                />
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[var(--text-muted)] text-[9px] font-black uppercase tracking-[0.4em] border-b border-[var(--border-glass)]/50 bg-[var(--bg-void)]/10">
                    <th className="px-10 py-6">O'quvchi</th>
                    <th className="px-10 py-6 text-center">Natija / Ball</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-glass)]/30">
                  {students.map((student) => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      maxScore={maxScore}
                      onScoreChange={handleScoreChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {students.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-[var(--text-muted)] gap-4">
                <AlertCircle size={48} className="opacity-20" />
                <p className="text-[12px] font-black uppercase tracking-[0.3em]">O'quvchilar ro'yxati bo'sh</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER SPACING */}
      <div className="h-20"></div>
    </div>
  );
};

export default MockTestDetails;
