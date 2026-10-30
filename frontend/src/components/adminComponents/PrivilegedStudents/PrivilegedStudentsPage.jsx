import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../tokenUpdater/updater';
import notify from '../../../utils/toastNotify';
import toast from 'react-hot-toast';
import { db } from '../../../db/db';
import { get_user_info } from '../../Authorized/getRole';
import {
  Award,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle,
  CheckCircle2,
  CheckCheck,
  XCircle,
  Clock,
  Edit3,
  History,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  UserCheck,
  ShieldAlert,
  X,
  Plus,
  Minus,
  Info,
  CalendarDays,
  Sparkles,
  ArrowLeft,
  SlidersHorizontal,
  Save,
} from 'lucide-react';

const formatMoney = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0 UZS';
  return `${Math.round(val).toLocaleString('uz-UZ')} UZS`;
};

const getCurrentMonthStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function PrivilegedStudentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { branch_id, b_id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlBranchId = branch_id || b_id || searchParams.get('branch_id') || '';

  const userInfo = get_user_info();
  const isSuperAdmin = userInfo?.role === 'super_admin';

  const [selectedBranch, setSelectedBranch] = useState(urlBranchId);
  const activeBranchId = isSuperAdmin ? selectedBranch : (userInfo?.branch_id || '');

  useEffect(() => {
    if (urlBranchId) {
      setSelectedBranch(urlBranchId);
    }
  }, [urlBranchId]);

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Selected student for edit modal
  const [editingStudent, setEditingStudent] = useState(null);
  // Selected student for status quick edit modal
  const [statusEditingStudent, setStatusEditingStudent] = useState(null);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(
      `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    );
    setPage(1);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(
      `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`
    );
    setPage(1);
  };

  // 1. Fetch Privileged Students Summary & List
  const {
    data: privilegedData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['privileged-students', selectedMonth, selectedGroup, selectedStatus, debouncedSearch, page, activeBranchId],
    queryFn: async () => {
      const params = new URLSearchParams({
        month: selectedMonth,
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (activeBranchId) params.append('branch_id', activeBranchId);
      if (selectedGroup) params.append('group_id', selectedGroup);
      if (selectedStatus) params.append('status', selectedStatus);
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());

      const res = await api.get(`/finance/privileged-students/?${params.toString()}`);
      return res.data;
    },
    keepPreviousData: true,
  });

  // 2. Fetch Groups for filter dropdown
  const { data: groupsList = [] } = useQuery({
    queryKey: ['groups-for-filter', activeBranchId],
    queryFn: async () => {
      const res = await api.get(activeBranchId ? `/groups/groups/?branch_id=${activeBranchId}` : '/groups/groups/');
      return res.data?.results || res.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // 3. Fetch Branches for Super Admin filter dropdown
  const { data: branchesList = [] } = useQuery({
    queryKey: ['branches-for-privileged'],
    queryFn: async () => {
      const res = await api.get('/add_branch/branches/');
      return res.data?.results || res.data || [];
    },
    enabled: isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const summary = privilegedData?.summary || {
    total_students: 0,
    total_state_receivable: 0,
    total_teacher_earned: 0,
    total_center_margin: 0,
    total_lessons_planned: 0,
    total_lessons_attended: 0,
    overall_attendance_rate: 0,
  };

  const studentsList = privilegedData?.results || [];
  const meta = privilegedData?.meta || { total_count: 0, total_pages: 1 };

  return (
    <div className="space-y-4 pb-12">
      {/* ── HEADER SECTION ──────────────────────────────────────────────── */}
      {/* ── HEADER SECTION ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--card-bg)] p-4 sm:p-5 rounded-2xl border border-[var(--border-color)] dark:border-transparent shadow-sm">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] dark:border-transparent text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-amber-500/30 transition w-fit cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Orqaga qaytish</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 dark:border-transparent">
              <Award size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                Maxsus O'quvchilar (Kelajak.uz)
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                {isSuperAdmin
                  ? "Davlat puli bo'yicha Face ID / qo'lda tasdiqlangan davomat va o'qituvchi ulushini hisoblash moduli"
                  : "Davlat puli bo'yicha imtiyozli o'quvchilar davomati va audit nazorati"}
              </p>
            </div>
          </div>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2 bg-[var(--bg-primary)] p-1.5 rounded-xl border border-[var(--border-color)] dark:border-transparent">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-[var(--card-bg)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            title="Oldingi oy"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-2 px-2.5 py-1 font-semibold text-xs text-[var(--text-primary)]">
            <Calendar size={14} className="text-amber-500" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedMonth(e.target.value);
                  setPage(1);
                }
              }}
              className="bg-transparent border-none text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-[var(--card-bg)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            title="Keyingi oy"
          >
            <ChevronRight size={16} />
          </button>

          <button
            onClick={() => {
              setSelectedMonth(getCurrentMonthStr());
              setPage(1);
            }}
            className="text-xs font-semibold px-2.5 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
          >
            Joriy oy
          </button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS (4 cards compact in 1 single row) ──────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 w-full">
        {/* 1. Total Students */}
        <div className="bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)] dark:border-transparent shadow-sm flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] xl:text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] truncate">
              Maxsus O'quvchilar
            </p>
            <h3 className="text-base xl:text-lg font-black text-[var(--text-primary)] mt-0.5 truncate">
              {summary.total_students}
            </h3>
            <p className="text-[9px] xl:text-[10px] text-[var(--text-secondary)] truncate mt-0.5">Faol grant oluvchilar</p>
          </div>
          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg shrink-0 ml-1.5">
            <Users size={16} />
          </div>
        </div>

        {isSuperAdmin ? (
          <>
            {/* 2. Earned Teacher Share (Super Admin Only) */}
            <div className="bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)] dark:border-transparent shadow-sm flex items-center justify-between min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] xl:text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] truncate">
                  O'qituvchi Ulushi
                </p>
                <h3 className="text-base xl:text-lg font-black text-indigo-500 dark:text-indigo-400 mt-0.5 truncate">
                  {formatMoney(summary.total_teacher_earned)}
                </h3>
                <p className="text-[9px] xl:text-[10px] text-[var(--text-secondary)] truncate mt-0.5">Hisoblangan maosh</p>
              </div>
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg shrink-0 ml-1.5">
                <UserCheck size={16} />
              </div>
            </div>

            {/* 3. Center Gross Margin (Super Admin Only) */}
            <div className="bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)] dark:border-transparent shadow-sm flex items-center justify-between min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] xl:text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] truncate">
                  Markaz Marjasi
                </p>
                <h3 className="text-base xl:text-lg font-black text-amber-500 dark:text-amber-400 mt-0.5 truncate">
                  {formatMoney(summary.total_center_margin)}
                </h3>
                <p className="text-[9px] xl:text-[10px] text-[var(--text-secondary)] truncate mt-0.5">Tushum - O'qituvchi</p>
              </div>
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg shrink-0 ml-1.5">
                <TrendingUp size={16} />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 2. Planned Lessons (Regular Admin) */}
            <div className="bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)] dark:border-transparent shadow-sm flex items-center justify-between min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] xl:text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] truncate">
                  Rejadagi Darslar
                </p>
                <h3 className="text-base xl:text-lg font-black text-blue-500 dark:text-blue-400 mt-0.5 truncate">
                  {summary.total_lessons_planned} dars
                </h3>
                <p className="text-[9px] xl:text-[10px] text-[var(--text-secondary)] truncate mt-0.5">Oy bo'yicha jami reja</p>
              </div>
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg shrink-0 ml-1.5">
                <BookOpen size={16} />
              </div>
            </div>

            {/* 3. Attended Lessons (Regular Admin) */}
            <div className="bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)] dark:border-transparent shadow-sm flex items-center justify-between min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] xl:text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] truncate">
                  Qatnashilgan Darslar
                </p>
                <h3 className="text-base xl:text-lg font-black text-emerald-500 dark:text-emerald-400 mt-0.5 truncate">
                  {summary.total_lessons_attended} dars
                </h3>
                <p className="text-[9px] xl:text-[10px] text-[var(--text-secondary)] truncate mt-0.5">Tasdiqlangan qatnashuv</p>
              </div>
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0 ml-1.5">
                <CheckCircle size={16} />
              </div>
            </div>
          </>
        )}

        {/* 4. Overall Attendance Rate */}
        <div className="bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)] dark:border-transparent shadow-sm flex items-center justify-between min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] xl:text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] truncate">
              O'rtacha Davomat
            </p>
            <h3 className="text-base xl:text-lg font-black text-[var(--text-primary)] mt-0.5 truncate">
              {summary.overall_attendance_rate}%
            </h3>
            <div className="w-full bg-[var(--bg-primary)] rounded-full h-1 mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, summary.overall_attendance_rate)}%` }}
              />
            </div>
          </div>
          <div className="p-2 bg-teal-500/10 text-teal-500 rounded-lg shrink-0 ml-1.5">
            <Percent size={16} />
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)] dark:border-transparent shadow-sm">
        <div className="flex flex-1 items-center gap-3 w-full">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
            />
            <input
              type="text"
              placeholder="O'quvchi ismi, telefon yoki guruh bo'yicha qidirish..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] dark:border-transparent rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
            />
          </div>

          {/* Super Admin Branch Filter Dropdown */}
          {isSuperAdmin && (
            <div className="w-56 hidden sm:block">
              <select
                value={selectedBranch}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedBranch(val);
                  setSelectedGroup('');
                  setPage(1);
                  if (val) {
                    setSearchParams({ branch_id: val });
                  } else {
                    setSearchParams({});
                  }
                }}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] dark:border-transparent rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500 transition cursor-pointer"
              >
                <option value="">Barcha filiallar</option>
                {branchesList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Group Filter Dropdown */}
          <div className="w-56 hidden sm:block">
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] dark:border-transparent rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500 transition cursor-pointer"
            >
              <option value="">Barcha guruhlar</option>
              {groupsList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Dropdown */}
          <div className="w-52 hidden sm:block">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] dark:border-transparent rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500 transition cursor-pointer"
            >
              <option value="">Barcha maxsus (Hammasi)</option>
              <option value="discount">Imtiyozli (Grant / Kelajak.uz)</option>
              <option value="negotiated">Kelishilgan narx</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-primary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold rounded-xl border border-[var(--border-color)] dark:border-transparent transition"
        >
          <RotateCcw size={15} className={isFetching ? 'animate-spin' : ''} />
          <span>Yangilash</span>
        </button>
      </div>

      {/* ── DATA GRID TABLE ─────────────────────────────────────────────── */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] dark:border-transparent shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)] dark:border-b-white/[0.04] bg-[var(--bg-primary)]/50 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                <th className="py-3 px-4">O'quvchi</th>
                <th className="py-3 px-4">Guruh & O'qituvchi</th>
                <th className="py-3 px-4 text-right">Kurs Narxi</th>
                <th className="py-3 px-4 text-center">Reja </th>
                <th className="py-3 px-4 text-center">Davomat </th>
                {isSuperAdmin && <th className="py-3 px-4">O'qituvchi Stavka</th>}
                {isSuperAdmin && <th className="py-3 px-4 text-right">O'qituvchi Ulushi</th>}
                <th className="py-3 px-4 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] dark:divide-white/[0.04] text-xs sm:text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 8 : 6} className="py-12 text-center text-[var(--text-secondary)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span>Ma'lumotlar yuklanmoqda...</span>
                    </div>
                  </td>
                </tr>
              ) : studentsList.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 8 : 6} className="py-12 text-center text-[var(--text-secondary)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Award size={36} className="text-gray-400" />
                      <p className="font-semibold">Tanlangan oyda birorta ham maxsus (imtiyozli yoki kelishilgan narx) o'quvchi topilmadi.</p>
                      <p className="text-xs">Qidiruv parametrlarini o'zgartirib ko'ring.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                studentsList.map((row) => (
                  <tr
                    key={`${row.student_id}-${row.group_id}`}
                    className="hover:bg-[var(--bg-primary)]/40 transition group"
                  >
                    {/* Student Full Name, Status & ID */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[var(--text-primary)]">
                          {row.student_name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            row.student_status === 'discount'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : row.student_status === 'negotiated'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {row.student_status_label || (row.student_status === 'discount' ? 'Imtiyozli' : 'Kelishilgan')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-secondary)] flex-wrap">
                        <span className="font-mono bg-[var(--bg-primary)] px-1.5 py-0.5 rounded border border-[var(--border-color)] dark:border-transparent">
                          ID: #{row.student_id}
                        </span>
                        {row.student_phone && <span>{row.student_phone}</span>}
                        {row.custom_fee && (
                          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            (Kelishilgan: {formatMoney(row.custom_fee)})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Group & Mentor */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                        <BookOpen size={14} className="text-amber-500" />
                        <span>{row.group_name}</span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Ustoz: <span className="text-[var(--text-primary)]">{row.mentor_name}</span>
                      </div>
                    </td>

                    {/* Total Group Course Fee */}
                    <td className="py-3.5 px-4 text-right font-medium text-[var(--text-primary)]">
                      {formatMoney(row.course_fee)}
                    </td>

                    {/* Total Planned Lessons */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-1 bg-[var(--bg-primary)] border border-[var(--border-color)] dark:border-transparent rounded-lg font-bold text-xs">
                        {row.n_total} dars
                      </span>
                    </td>

                    {/* Attendance Count */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs ${row.n_attended >= row.n_total
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-transparent'
                            : row.n_attended > 0
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-transparent'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 dark:border-transparent'
                            }`}
                        >
                          <CheckCircle size={13} />
                          {row.n_attended} / {row.n_total} ({row.attendance_rate}%)
                        </span>

                        {row.has_manual_adjustment && (
                          <span className="mt-1 text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 dark:border-transparent">
                            Qo'lda kiritilgan
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Teacher Share Structure (Super Admin Only) */}
                    {isSuperAdmin && (
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-transparent rounded text-xs font-semibold">
                          {row.teacher_rate_display}
                        </span>
                        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          {row.teacher_salary_type_label}
                        </div>
                      </td>
                    )}

                    {/* Earned Teacher Share (Super Admin Only) */}
                    {isSuperAdmin && (
                      <td className="py-3.5 px-4 text-right font-bold text-indigo-500 dark:text-indigo-400">
                        {formatMoney(row.earned_teacher_share)}
                      </td>
                    )}

                    {/* Action: Edit Status & Edit Attendance */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setStatusEditingStudent(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold transition shadow-xs"
                          title="Status va individual narxni tahrirlash"
                        >
                          <SlidersHorizontal size={13} />
                          <span>Status</span>
                        </button>
                        <button
                          onClick={() => setEditingStudent(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition"
                          title="Davomat darslarini to'g'rilash va audit ko'rish"
                        >
                          <Edit3 size={13} />
                          <span>Davomat & Audit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION CONTROLS ────────────────────────────────────────── */}
        {meta.total_pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color)] dark:border-t-white/[0.04] bg-[var(--bg-primary)]/30 text-xs text-[var(--text-secondary)]">
            <div>
              Jami <span className="font-bold text-[var(--text-primary)]">{meta.total_count}</span> ta o'quvchi,{' '}
              <span className="font-bold text-[var(--text-primary)]">{meta.page}</span> / {meta.total_pages} sahifa
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] dark:border-transparent bg-[var(--card-bg)] text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-primary)] transition"
              >
                Oldingi
              </button>
              <button
                disabled={page >= meta.total_pages}
                onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] dark:border-transparent bg-[var(--card-bg)] text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--bg-primary)] transition"
              >
                Keyingi
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── EDIT ATTENDANCE & AUDIT MODAL ──────────────────────────────── */}
      {editingStudent && (
        <EditAttendanceModal
          student={editingStudent}
          month={selectedMonth}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setEditingStudent(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['privileged-students'] });
            setEditingStudent(null);
          }}
        />
      )}

      {/* ── EDIT STUDENT STATUS & CUSTOM FEE MODAL ─────────────────────── */}
      {statusEditingStudent && (
        <EditStudentStatusModal
          student={statusEditingStudent}
          onClose={() => setStatusEditingStudent(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['privileged-students'] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['cashier-desk'] });
            setStatusEditingStudent(null);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT STUDENT STATUS & INDIVIDUAL FEE MODAL (SAFE INLINE STATUS UPDATE)
// ─────────────────────────────────────────────────────────────────────────────
function EditStudentStatusModal({ student, onClose, onSuccess }) {
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const scrollContainer = document.querySelector('.lux-scroll');
    const originalScrollOverflow = scrollContainer ? scrollContainer.style.overflow : '';

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (scrollContainer) {
      scrollContainer.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      if (scrollContainer) {
        scrollContainer.style.overflow = originalScrollOverflow;
      }
    };
  }, []);
  const [newStatus, setNewStatus] = useState(student.student_status || 'discount');
  const [customFee, setCustomFee] = useState(
    student.custom_fee !== null && student.custom_fee !== undefined ? String(student.custom_fee) : ''
  );
  const [includeMentorSalary, setIncludeMentorSalary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        status: newStatus,
        include_in_mentor_salary: includeMentorSalary,
      };

      if (['low_income', 'negotiated', 'teacher_negotiated'].includes(newStatus)) {
        payload.custom_fee = customFee === '' ? 0 : Number(customFee);
      } else {
        payload.custom_fee = null;
      }

      await api.patch(`/groups/students/${student.student_id}/`, payload);
      toast.success(`${student.student_name} statusi muvaffaqiyatli yangilandi`);
      onSuccess();
    } catch (err) {
      console.error('Status edit error:', err);
      toast.error(err.response?.data?.detail || "Statusni o'zgartirishda xatolik yuz berdi");
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        className="bg-[var(--card-bg)] w-full max-w-lg rounded-2xl border border-[var(--border-color)] dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] dark:border-white/10 bg-[var(--bg-primary)]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)] text-sm sm:text-base">
                O'quvchi Statusi & Narxini Tahrirlash
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {student.student_name} • ID: #{student.student_id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Info Banner */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2.5">
            <Info size={16} className="shrink-0 mt-0.5" />
            <span>
              Status o'zgartirilganda o'quvchining joriy oydagi barcha to'lovlari, dars narxlari va o'qituvchi ulushlari avtomatik qayta hisoblanadi.
            </span>
          </div>

          {/* Group & Current Info */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--bg-primary)] rounded-xl text-xs">
            <div>
              <span className="text-[var(--text-secondary)] block">Guruh:</span>
              <span className="font-semibold text-[var(--text-primary)]">{student.group_name}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)] block">Guruh Oylik Narxi:</span>
              <span className="font-semibold text-[var(--text-primary)]">{formatMoney(student.course_fee)}</span>
            </div>
          </div>

          {/* Status Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-primary)]">
              O'quvchi Moliyaviy Statusi <span className="text-rose-500">*</span>
            </label>
            <select
              value={newStatus}
              onChange={(e) => {
                const s = e.target.value;
                setNewStatus(s);
                if (s === 'discount' || s === 'regular') {
                  setCustomFee('');
                }
              }}
              className="w-full px-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] dark:border-white/10 rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer font-medium"
            >
              <option value="discount">Imtiyozli (Davlat granti / Kelajak.uz)</option>
              <option value="negotiated">Kelishilgan narx (Individual chegirma)</option>
              <option value="regular">Oddiy (Standart to'lov)</option>
              <option value="low_income">Kam ta'minlangan</option>
              <option value="teacher_negotiated">O'qituvchi kelishgan</option>
            </select>
          </div>

          {/* Individual Fee Input (for negotiated / low_income / teacher_negotiated) */}
          {['negotiated', 'low_income', 'teacher_negotiated'].includes(newStatus) && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between">
                <span>Individual To'lov Summasi (UZS)</span>
                <span className="text-[11px] font-normal text-[var(--text-secondary)]">
                  Guruh narxi: {formatMoney(student.course_fee)}
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Masalan: 350000"
                  value={customFee}
                  onChange={(e) => setCustomFee(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] dark:border-white/10 rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-mono"
                  required={newStatus === 'negotiated'}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)] pointer-events-none font-semibold">
                  UZS
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Agar o'quvchi guruh narxidan kam yoki ko'p to'laydigan bo'lsa, oylik to'lov summasini kiriting.
              </p>
            </div>
          )}

          {/* Teacher negotiated checkbox */}
          {newStatus === 'teacher_negotiated' && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] dark:border-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMentorSalary}
                onChange={(e) => setIncludeMentorSalary(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-[var(--text-primary)]">
                Mentor oyligiga ushbu o'quvchi bo'yicha to'lov hisoblansinmi?
              </span>
            </label>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-color)] dark:border-white/10">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--border-color)] dark:border-transparent text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Save size={14} className={isSaving ? 'animate-spin' : ''} />
              <span>{isSaving ? 'Saqlanmoqda...' : 'Statusni Saqlash'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & MONTH / WEEKDAY LOCALIZATION (UZBEK)
// ─────────────────────────────────────────────────────────────────────────────
const WEEKDAYS_UZ = [
  { short: 'Du', full: 'Dushanba' },
  { short: 'Se', full: 'Seshanba' },
  { short: 'Chor', full: 'Chorshanba' },
  { short: 'Pay', full: 'Payshanba' },
  { short: 'Ju', full: 'Juma' },
  { short: 'Shan', full: 'Shanba' },
  { short: 'Yak', full: 'Yakshanba' },
];

const MONTH_NAMES_UZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];

// ─────────────────────────────────────────────────────────────────────────────
// EDIT ATTENDANCE MODAL: 100% CALENDAR-BASED AUDIT SYNCED WITH REAL ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────
function EditAttendanceModal({ student, month, isSuperAdmin, onClose, onSuccess }) {
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const scrollContainer = document.querySelector('.lux-scroll');
    const originalScrollOverflow = scrollContainer ? scrollContainer.style.overflow : '';

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (scrollContainer) {
      scrollContainer.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      if (scrollContainer) {
        scrollContainer.style.overflow = originalScrollOverflow;
      }
    };
  }, []);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'audit'
  const [reason, setReason] = useState('');
  const [sessionsOverride, setSessionsOverride] = useState(null);
  const [initialSessions, setInitialSessions] = useState(null);

  // Fetch detailed real attendance history & audit logs for this student
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['privileged-history', student.student_id, student.group_id, month],
    queryFn: async () => {
      const res = await api.get(
        `/finance/privileged-students/${student.student_id}/attendance-history/?month=${month}&group_id=${student.group_id}`
      );
      return res.data;
    },
  });

  // TanStack Query v5 da onSuccess ishlamaydi, shuning uchun useEffect orqali sinxronlaymiz
  useEffect(() => {
    if (historyData?.sessions && historyData.sessions.length > 0) {
      setSessionsOverride(historyData.sessions);
      setInitialSessions(historyData.sessions);
    }
  }, [historyData?.sessions]);

  // Faol dars sessiyalari: tahrirlangan bo'lsa sessionsOverride, aks holda historyData.sessions
  const activeSessions = useMemo(() => {
    if (sessionsOverride && sessionsOverride.length > 0) {
      return sessionsOverride;
    }
    if (historyData?.sessions && historyData.sessions.length > 0) {
      return historyData.sessions;
    }
    return [];
  }, [sessionsOverride, historyData?.sessions]);

  const nTotal = historyData?.metrics?.n_total || student.n_total || 1;
  const courseFee = student.course_fee || 0;
  const teacherSalaryType = student.teacher_salary_type;
  const teacherBaseRate = student.teacher_base_rate;

  // Real-time attended count purely computed from selected calendar sessions
  const attendedCount = useMemo(() => {
    if (activeSessions && activeSessions.length > 0) {
      return activeSessions.filter((s) => s.is_present).length;
    }
    return historyData?.metrics?.n_attended ?? student.n_attended ?? 0;
  }, [activeSessions, historyData, student]);

  // Attendance percentage
  const attendanceRate = nTotal > 0 ? ((attendedCount / nTotal) * 100).toFixed(1) : 0;

  // Session Map lookup by 'YYYY-MM-DD'
  const sessionMap = useMemo(() => {
    const map = new Map();
    activeSessions.forEach((sess, idx) => {
      map.set(sess.date, { ...sess, idx });
    });
    return map;
  }, [activeSessions]);

  // Toggle single session by date
  const handleToggleDate = (dateStr) => {
    const current = activeSessions;
    if (!current || current.length === 0) return;
    const updated = current.map((s) => {
      if (s.date === dateStr) {
        return { ...s, is_present: !s.is_present };
      }
      return s;
    });
    setSessionsOverride(updated);
  };

  // Quick action: Mark all scheduled lesson days as present
  const handleSelectAll = () => {
    const current = activeSessions;
    if (!current || current.length === 0) return;
    const updated = current.map((s) => ({ ...s, is_present: true }));
    setSessionsOverride(updated);
  };

  // Quick action: Mark all scheduled lesson days as absent
  const handleDeselectAll = () => {
    const current = activeSessions;
    if (!current || current.length === 0) return;
    const updated = current.map((s) => ({ ...s, is_present: false }));
    setSessionsOverride(updated);
  };

  // Quick action: Reset to the initial real database state when opened
  const handleResetToInitial = () => {
    const initial = initialSessions || historyData?.sessions;
    if (initial) {
      setSessionsOverride(initial);
    }
  };

  // Check if anything has been modified compared to initial state
  const isModified = useMemo(() => {
    const base = initialSessions || historyData?.sessions;
    if (!sessionsOverride || !base) return false;
    return sessionsOverride.some((sess, idx) => sess.is_present !== base[idx]?.is_present);
  }, [sessionsOverride, initialSessions, historyData?.sessions]);

  // Calendar Grid Cells Computation (7 columns: Monday..Sunday)
  const { year, monthNum, monthName, calendarCells } = useMemo(() => {
    const [yStr, mStr] = (month || '').split('-');
    const y = parseInt(yStr, 10) || new Date().getFullYear();
    const m = parseInt(mStr, 10) || new Date().getMonth() + 1;
    const mName = MONTH_NAMES_UZ[m - 1] || '';

    const totalDays = new Date(y, m, 0).getDate();
    const firstDay = new Date(y, m - 1, 1).getDay();
    // Monday is index 0 in Uzbekistan calendar
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    const cells = [];
    // Leading empty cells
    for (let i = 0; i < startOffset; i++) {
      cells.push({
        type: 'empty',
        key: `leading-${i}`,
      });
    }

    // Days in month
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const session = sessionMap.get(dateStr);
      cells.push({
        type: 'day',
        key: dateStr,
        dayNumber: day,
        date: dateStr,
        isLessonDay: Boolean(session),
        session: session || null,
      });
    }

    // Trailing empty cells to fill the last row
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const trailingCount = 7 - remainder;
      for (let i = 0; i < trailingCount; i++) {
        cells.push({
          type: 'empty',
          key: `trailing-${i}`,
        });
      }
    }

    return {
      year: y,
      monthNum: m,
      monthName: mName,
      calendarCells: cells,
    };
  }, [month, sessionMap]);

  // Live real-time financial impact preview calculation
  const livePreview = useMemo(() => {
    const prevAttended = student.n_attended;
    const prevDaily = nTotal > 0 ? courseFee / nTotal : 0;
    const prevStateReceivable = Math.floor(prevDaily * prevAttended);

    let prevTeacherShare = 0;
    if (teacherSalaryType === 'PERCENTAGE') {
      prevTeacherShare = Math.floor(prevStateReceivable * (teacherBaseRate / 100));
    } else if (teacherSalaryType === 'FIXED_PER_STUDENT') {
      const perLesson = nTotal > 0 ? teacherBaseRate / nTotal : 0;
      prevTeacherShare = Math.min(teacherBaseRate, Math.floor(perLesson * prevAttended));
    }

    const newAttended = attendedCount;
    const newDaily = nTotal > 0 ? courseFee / nTotal : 0;
    const newStateReceivable = Math.floor(newDaily * newAttended);

    let newTeacherShare = 0;
    if (teacherSalaryType === 'PERCENTAGE') {
      newTeacherShare = Math.floor(newStateReceivable * (teacherBaseRate / 100));
    } else if (teacherSalaryType === 'FIXED_PER_STUDENT') {
      const perLesson = nTotal > 0 ? teacherBaseRate / nTotal : 0;
      newTeacherShare = Math.min(teacherBaseRate, Math.floor(perLesson * newAttended));
    }

    const newCenterMargin = Math.max(0, newStateReceivable - newTeacherShare);
    const prevCenterMargin = Math.max(0, prevStateReceivable - prevTeacherShare);

    return {
      before: {
        attended: prevAttended,
        stateReceivable: prevStateReceivable,
        teacherShare: prevTeacherShare,
        centerMargin: prevCenterMargin,
      },
      after: {
        attended: newAttended,
        stateReceivable: newStateReceivable,
        teacherShare: newTeacherShare,
        centerMargin: newCenterMargin,
      },
      delta: {
        attended: newAttended - prevAttended,
        stateReceivable: newStateReceivable - prevStateReceivable,
        teacherShare: newTeacherShare - prevTeacherShare,
        centerMargin: newCenterMargin - prevCenterMargin,
      },
    };
  }, [student, attendedCount, nTotal, courseFee, teacherSalaryType, teacherBaseRate]);

  // Mutation to submit attendance override directly to PostgreSQL Attendance table
  const overrideMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        month: month,
        group_id: student.group_id,
        reason_for_change: reason.trim() || "Davomat audit orqali yangilandi",
        session_overrides: activeSessions.map((s) => ({
          date: s.date,
          is_present: s.is_present,
        })),
      };

      const res = await api.patch(
        `/finance/privileged-students/${student.student_id}/attendance-override/`,
        payload
      );
      return res.data;
    },
    onSuccess: async (data) => {
      toast.success(data.message || 'Davomat va moliyaviy hisob-kitoblar muvaffaqiyatli yangilandi!');
      // Invalidate all related queries across the CRM so student profile, heatmap, and tables immediately match
      queryClient.invalidateQueries({ queryKey: ['privileged-students'] });
      queryClient.invalidateQueries({ queryKey: ['privileged-history'] });
      queryClient.invalidateQueries({ queryKey: ['student-monthly-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['group-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });

      // Clean Dexie client query cache for this student
      try {
        await db.query_cache.where('query_key').startsWith(`student-monthly_${student.student_id}`).delete();
      } catch (e) {
        // non-blocking
      }

      onSuccess();
    },
    onError: (err) => {
      notify.apiError(err, 'Davomatni yangilashda xatolik yuz berdi.');
    },
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        className="relative w-full max-w-4xl bg-[var(--card-bg)] border border-[var(--border-color)] dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Pinned at top) */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] dark:border-white/10 bg-[var(--card-bg)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-xs">
              <Award size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                  {student.student_name}
                </h3>
                <span className="font-mono text-[11px] bg-[var(--bg-primary)] px-2 py-0.5 rounded-md border border-[var(--border-color)] dark:border-white/10 text-[var(--text-secondary)] font-semibold">
                  ID: #{student.student_id}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  student.student_status === 'discount'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                }`}>
                  {student.student_status_label || (student.student_status === 'discount' ? 'Imtiyozli' : 'Kelishilgan')}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Guruh: <strong className="text-[var(--text-primary)]">{student.group_name}</strong></span>
                <span>•</span>
                <span>Ustoz: <strong className="text-[var(--text-primary)]">{student.mentor_name}</strong></span>
                <span>•</span>
                <span>Kurs narxi: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatMoney(courseFee)}</strong></span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-primary)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition shrink-0 ml-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Navigation Tabs (Pinned) */}
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border-color)] dark:border-white/10 px-5 bg-[var(--bg-primary)]/40">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('edit')}
              className={`py-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition ${
                activeTab === 'edit'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <CalendarDays size={16} />
              <span>Davomat Kalendari</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition ${
                activeTab === 'audit'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <History size={16} />
              <span>Audit Tarixi ({historyData?.audit_logs?.length || 0})</span>
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
            <Calendar size={14} className="text-amber-500" />
            <span>{monthName} {year}</span>
          </div>
        </div>

        {/* Modal Body (Scrollable with min-h-0 so it doesn't push the header/footer out) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isLoading ? (
            <div className="py-20 text-center text-[var(--text-secondary)] flex flex-col items-center justify-center gap-3">
              <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold">O'quvchi ma'lumotlari va haqiqiy davomat sessiyalari yuklanmoqda...</span>
            </div>
          ) : activeTab === 'edit' ? (
            <>
              {/* Calendar Top Stats & Actions Bar */}
              <div className="bg-[var(--bg-primary)] p-3.5 sm:p-4 rounded-2xl border border-[var(--border-color)] dark:border-white/5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Left: KPI metrics */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-3 py-1.5 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] dark:border-white/5 text-center shadow-2xs">
                      <span className="block text-[9px] uppercase font-bold text-[var(--text-secondary)]">Rejadagi Dars</span>
                      <span className="text-xs sm:text-sm font-black text-[var(--text-primary)]">{nTotal} dars</span>
                    </div>
                    <div className="px-3 py-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-center shadow-2xs">
                      <span className="block text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Tasdiqlangan</span>
                      <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">{attendedCount} ta</span>
                    </div>
                    <div className="px-3 py-1.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-center shadow-2xs">
                      <span className="block text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400">Davomat Ulushi</span>
                      <span className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400">{attendanceRate}%</span>
                    </div>
                  </div>

                  {/* Right: Quick Bulk Action Buttons & Reset */}
                  <div className="flex items-center gap-2 flex-wrap ml-auto">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-semibold transition"
                    >
                      <CheckCheck size={14} />
                      <span>Barchasini "Keldi"</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition"
                    >
                      <XCircle size={14} />
                      <span>Barchasini "Kelmadi"</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToInitial}
                      disabled={!isModified}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--card-bg)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] dark:border-white/10 rounded-xl text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Dastlabki holatga qaytarish"
                    >
                      <RotateCcw size={13} />
                      <span className="hidden sm:inline">Qaytarish</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 7-COLUMN MONTHLY CALENDAR GRID ──────────────────────────────── */}
              <div className="space-y-2">
                {/* Weekday Column Headers */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {WEEKDAYS_UZ.map((wd) => (
                    <div
                      key={wd.short}
                      title={wd.full}
                      className="py-1.5 sm:py-2 text-center rounded-lg sm:rounded-xl bg-[var(--bg-primary)] text-[11px] sm:text-xs font-bold text-[var(--text-secondary)] border border-[var(--border-color)] dark:border-white/5"
                    >
                      <span className="hidden sm:inline">{wd.full}</span>
                      <span className="sm:hidden">{wd.short}</span>
                    </div>
                  ))}
                </div>

                {/* Days Grid (Optimized cell height so full calendar fits comfortably) */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {calendarCells.map((cell) => {
                    if (cell.type === 'empty') {
                      return (
                        <div
                          key={cell.key}
                          className="min-h-[50px] sm:min-h-[60px] md:min-h-[68px] rounded-lg sm:rounded-xl bg-transparent opacity-20 pointer-events-none"
                        />
                      );
                    }

                    const { dayNumber, date, isLessonDay, session } = cell;

                    if (!isLessonDay) {
                      return (
                        <div
                          key={cell.key}
                          onClick={() => toast('Ushbu kunda dars jadvalida dars yo\'q.', { icon: 'ℹ️' })}
                          className="min-h-[50px] sm:min-h-[60px] md:min-h-[68px] p-1.5 rounded-lg sm:rounded-xl bg-slate-50/40 dark:bg-white/[0.01] border border-dashed border-slate-200 dark:border-white/5 opacity-40 select-none flex flex-col justify-between cursor-not-allowed hover:opacity-60 transition"
                          title="Guruh jadvalida ushbu sanada dars yo'q"
                        >
                          <span className="text-[11px] sm:text-xs font-semibold text-slate-400">
                            {dayNumber}
                          </span>
                          <span className="text-[9px] text-slate-400 text-center hidden xs:inline sm:inline">
                            —
                          </span>
                          <div className="h-2" />
                        </div>
                      );
                    }

                    const isPresent = session.is_present;
                    const isManual = session.is_manually_adjusted;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleDate(date);
                        }}
                        title={`${date}: Dars #${session.lesson_number} (${isPresent ? "Keldi" : "Kelmadi"}). Bosib o'zgartiring.`}
                        className={`min-h-[50px] sm:min-h-[60px] md:min-h-[68px] p-1.5 sm:p-2 rounded-lg sm:rounded-xl border text-left transition-all duration-150 flex flex-col justify-between group active:scale-95 cursor-pointer relative select-none shadow-2xs ${
                          isPresent
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100/80 dark:hover:bg-emerald-500/25 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100/80 dark:hover:bg-rose-500/25 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {/* Top: Lesson Number Badge & Day Number */}
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.2 rounded ${
                              isPresent
                                ? 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                                : 'bg-rose-500/20 text-rose-900 dark:text-rose-200'
                            }`}
                          >
                            #{session.lesson_number}
                          </span>
                          <span className="text-xs sm:text-sm font-black text-[var(--text-primary)]">
                            {dayNumber}
                          </span>
                        </div>

                        {/* Center: Status Icon & Label */}
                        <div className="flex items-center justify-center gap-1 py-0.5">
                          {isPresent ? (
                            <>
                              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="text-[10px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                Keldi
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle size={13} className="text-rose-600 dark:text-rose-400 shrink-0" />
                              <span className="text-[10px] sm:text-xs font-bold text-rose-700 dark:text-rose-300">
                                Kelmadi
                              </span>
                            </>
                          )}
                        </div>

                        {/* Bottom: Subtitle or Manual Indicator */}
                        <div className="text-[9px] text-center w-full truncate">
                          {isManual ? (
                            <span className="inline-flex items-center gap-0.5 text-purple-600 dark:text-purple-400 font-semibold bg-purple-500/10 px-1 py-0.2 rounded text-[8px]">
                              <Sparkles size={8} /> Qo'lda
                            </span>
                          ) : session.marked_by ? (
                            <span className="text-[var(--text-secondary)] text-[8px] truncate">
                              {session.marked_by}
                            </span>
                          ) : (
                            <span className="text-[var(--text-secondary)] text-[8px]">
                              {isPresent ? 'Dars' : "Yo'qlama"}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Calendar Legend */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1 px-1">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Kelgan dars
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      Kelmagan dars
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                      Qo'lda kiritilgan
                    </span>
                  </div>
                  <span className="text-[10px] italic text-[var(--text-secondary)]">
                    * Sanani bosish orqali "Keldi" va "Kelmadi" o'rtasida almashtiring
                  </span>
                </div>
              </div>

              {/* ── REAL-TIME LIVE FINANCIAL PREVIEW DIFF ─────────────────── */}
              <div className="bg-gradient-to-br from-amber-500/5 via-blue-500/5 to-emerald-500/5 p-3.5 sm:p-4 rounded-xl border border-amber-500/20 dark:border-white/5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-500">
                  <TrendingUp size={15} />
                  <span>Real Vaqtda {isSuperAdmin ? "Moliyaviy Qayta Hisob (Live Preview)" : "Davomat Ta'siri"}</span>
                </div>

                <div className={`grid grid-cols-1 ${isSuperAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-3`}>
                  {/* Attendance Count */}
                  <div className="bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)] dark:border-white/5">
                    <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                      Davomat (Darslar)
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-through">
                      Oldin: {livePreview.before.attended} / {nTotal} dars
                    </div>
                    <div className="text-sm font-black text-amber-500 dark:text-amber-400 mt-0.5">
                      Yangi: {livePreview.after.attended} / {nTotal} dars
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${livePreview.delta.attended >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      Farq: {livePreview.delta.attended >= 0 ? '+' : ''}{livePreview.delta.attended} dars
                    </div>
                  </div>

                  {/* Teacher Share - Super Admin Only */}
                  {isSuperAdmin && (
                    <div className="bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)] dark:border-white/5">
                      <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                        O'qituvchi Maoshi
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-through">
                        Oldin: {formatMoney(livePreview.before.teacherShare)}
                      </div>
                      <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                        Yangi: {formatMoney(livePreview.after.teacherShare)}
                      </div>
                      <div className={`text-[10px] font-bold mt-1 ${livePreview.delta.teacherShare >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        Farq: {livePreview.delta.teacherShare >= 0 ? '+' : ''}{formatMoney(livePreview.delta.teacherShare)}
                      </div>
                    </div>
                  )}

                  {/* Center Margin - Super Admin Only */}
                  {isSuperAdmin && (
                    <div className="bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--border-color)] dark:border-white/5">
                      <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                        Markaz Marjasi
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-through">
                        Oldin: {formatMoney(livePreview.before.centerMargin)}
                      </div>
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Yangi: {formatMoney(livePreview.after.centerMargin)}
                      </div>
                      <div className={`text-[10px] font-bold mt-1 ${livePreview.delta.centerMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        Farq: {livePreview.delta.centerMargin >= 0 ? '+' : ''}{formatMoney(livePreview.delta.centerMargin)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Reason for Change (Audit Trail) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  O'zgarish Sababi / Izoh <span className="text-[var(--text-secondary)] font-normal text-[11px] lowercase">(ixtiyoriy)</span>
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Izoh kiritish ixtiyoriy... Masalan: Face ID tizimi kelajak.uz platformasida kechikkan, monitoring tasdiqladi..."
                  className="w-full p-2.5 bg-[var(--bg-primary)] border border-[var(--border-color)] dark:border-white/10 rounded-xl text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                />
                <p className="text-[11px] text-[var(--text-secondary)] mt-1 flex items-center gap-1">
                  <ShieldAlert size={13} className="text-amber-500 shrink-0" />
                  Har bir qo'lda kiritilgan o'zgarish tizimda mas'ul xodim IDsi va vaqti bilan audit jurnaliga muhrlanadi.
                </p>
              </div>
            </>
          ) : (
            /* Audit Log History Tab */
            <div className="space-y-3">
              {historyData?.audit_logs?.length === 0 ? (
                <div className="py-12 text-center text-[var(--text-secondary)]">
                  <History size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="font-semibold text-sm">Ushbu oyda hech qanday qo'lda tahrirlash qayd etilmagan.</p>
                </div>
              ) : (
                historyData?.audit_logs?.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] dark:border-white/5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-primary)]">
                        Mas'ul: {log.modified_by}
                      </span>
                      <span className="text-[var(--text-secondary)] font-mono text-[11px]">
                        {log.created_at}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-[var(--card-bg)] p-2.5 rounded-lg border border-[var(--border-color)] dark:border-white/5">
                      <div>
                        <span className="text-[var(--text-secondary)]">Davomat: </span>
                        <span className="font-bold text-[var(--text-primary)]">
                          {log.previous_count} dars &rarr; {log.new_count} dars
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-secondary)]">O'qituvchi: </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {formatMoney(log.previous_teacher_share)} &rarr; {formatMoney(log.new_teacher_share)}
                        </span>
                      </div>
                    </div>

                    {log.reason && (
                      <div className="text-[var(--text-secondary)] italic">
                        Sabab: "{log.reason}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer (Pinned at bottom) */}
        {activeTab === 'edit' && (
          <div className="shrink-0 flex items-center justify-between p-3.5 sm:p-4 border-t border-[var(--border-color)] dark:border-white/10 bg-[var(--card-bg)]">
            <div className="text-xs text-[var(--text-secondary)]">
              {isModified ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                  <AlertTriangle size={14} /> O'zgarishlar kiritildi, saqlash talab etiladi
                </span>
              ) : (
                <span className="text-[var(--text-secondary)]">O'quvchi profilidagi haqiqiy davomat bilan bir xil</span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[var(--border-color)] dark:border-white/10 text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                disabled={overrideMutation.isPending || overrideMutation.isLoading}
                onClick={() => overrideMutation.mutate()}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition cursor-pointer"
              >
                {overrideMutation.isPending || overrideMutation.isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                <span>Saqlash va Moliyani Qayta Hisoblash</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
