import { useState, useEffect, useMemo } from 'react';
import {
  Search, Download, TrendingUp, Building2, Wallet, ArrowRight,
  Bell, MoreHorizontal, Loader2, Users, Activity, CreditCard,
  ChevronRight, MapPin, TrendingDown, ShieldCheck, Zap, Globe, ArrowUpRight, Circle, Calendar
} from 'lucide-react';
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import api from '../../../tokenUpdater/updater';
import toast from 'react-hot-toast';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import ThemeToggle from '../../ThemeToggle';

const AllPayments = () => {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [trendBranches, setTrendBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [activeMetric, setActiveMetric] = useState('income'); // income | expense

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12

  const goPrevMonth = () => {
    const d = new Date(selectedYear, selectedMonth - 1, 1);
    d.setMonth(d.getMonth() - 1);
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth() + 1);
  };

  const goCurrentMonth = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    return Math.floor(parseFloat(num)).toLocaleString();
  };

  const formatMonthLabel = (year, month) => {
    const m = String(month).padStart(2, '0');
    return `${year}-${m}`;
  };

  const formatCurrency = (val) => `${formatNumber(val)} UZS`;

  const normalizeTrendsForChart = (apiPayload, metricKey) => {
    const months = apiPayload?.months || [];
    const branchesList = apiPayload?.branches || [];

    const data = months.map((m) => {
      const row = { month: m.month };
      (m.branches || []).forEach((b) => {
        row[`b_${b.branch_id}`] = Number(b[metricKey] || 0);
      });
      return row;
    });

    return { data, branchesList };
  };

  const handleDownloadMonthlyReport = async () => {
    setIsDownloading(true);
    try {
      const currentYear = selectedYear;
      const currentMonth = selectedMonth;
      const response = await api.get('/reports/monthly-finance/', {
        params: { year: currentYear, month: currentMonth },
        responseType: 'blob',
      });
      const fileName = `Financial_Intelligence_Report_${currentYear}_${String(currentMonth).padStart(2, '0')}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Hisobot muvaffaqiyatli yuklandi.");
    } catch (error) {
      toast.error("Hisobotni yuklashda xatolik yuz berdi.");
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [branchRes, statsRes, trendsRes] = await Promise.all([
        api.get(`/add_branch/branches/`),
        api.get(`/finance/statistics/`, { params: { year: selectedYear, month: selectedMonth } }),
        api.get(`/finance/statistics/monthly-branch-trends/`, { params: { year: selectedYear, month: selectedMonth, months_back: 12 } })
      ]);

      const branchesData = branchRes.data.results || branchRes.data;
      const statsData = statsRes.data;
      const trendsData = trendsRes.data;

      const statsMap = {};
        statsData.branches?.forEach(b => {
            statsMap[Number(b.id)] = b;
        });

        const mergedBranches = branchesData.map(b => ({
            ...b,
            finance: statsMap[Number(b.id)] || { income: 0, expense: 0, profit: 0 }
        }));
      setBranches(mergedBranches);
      setStatistics(statsData);

      const normalized = normalizeTrendsForChart(trendsData, activeMetric);
      setTrendData(normalized.data);
      setTrendBranches(normalized.branchesList);
    } catch (error) {
      console.error("Fetch Data Error:", error);
      toast.error("Ma'lumotlarni yuklashda xatolik.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth, activeMetric]);

  const totalPersonnel = branches.reduce((sum, b) => sum + (b.mentors_count || 0) + (b.admins_count || 0), 0);
  
  const branchLineColors = useMemo(() => {
    const n = Math.max(trendBranches.length, 1);
    return trendBranches.map((_, idx) => {
      const h = Math.round((idx * 360) / n) % 360;
      return `hsl(${h}, 65%, 55%)`;
    });
  }, [trendBranches]);
  
  
  return (
    <div className="space-y-4 pb-6">
      {/* Background removed as per request */}

      {/* HEADER ACTION AREA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 sm:p-4 bg-[var(--bg-panel)]/40 border border-[#2a2a2a] rounded-2xl mb-8">
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="w-1.5 h-8 bg-[var(--gold)] rounded-full shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight capitalize truncate">Moliya Boshqaruvi</h1>
            <p className="text-[8px] sm:text-[9px] text-[var(--text-muted)] font-bold capitalize tracking-wider truncate">
              Oylik: <span className="text-[var(--gold)] font-black">{formatMonthLabel(selectedYear, selectedMonth)}</span>
            </p>
          </div>
        </div>
        <div className="w-full lg:w-auto min-w-0 flex flex-nowrap items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-0.5 px-0.5">
          <div
            className="flex shrink-0 items-center gap-1 h-8 pl-1.5 pr-1 bg-[var(--bg-void)] border border-[#2a2a2a] rounded-lg"
            title="Oy va yil"
          >
            <Calendar size={11} className="text-[var(--gold)] opacity-60 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent w-[2.35rem] sm:w-10 text-[8px] sm:text-[9px] font-black text-[var(--text-primary)] outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }).map((_, idx) => (
                <option key={idx + 1} value={idx + 1} className="bg-[var(--bg-panel)]">
                  {String(idx + 1).padStart(2, '0')}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent w-[3rem] sm:w-[3.25rem] text-[8px] sm:text-[9px] font-black text-[var(--text-primary)] outline-none cursor-pointer"
            >
              {Array.from({ length: 6 }).map((_, i) => {
                const y = today.getFullYear() - i;
                return <option key={y} value={y} className="bg-[var(--bg-panel)]">{y}</option>;
              })}
            </select>
          </div>
          <button
            type="button"
            onClick={goPrevMonth}
            title="O'tgan oy ma'lumotlari"
            className="shrink-0 inline-flex items-center justify-center gap-1 h-8 px-2 sm:px-2.5 bg-[var(--bg-void)] border border-red-500/20 text-red-400 rounded-lg font-black text-[8px] sm:text-[9px] uppercase tracking-wide whitespace-nowrap transition-all hover:bg-red-500/10 active:scale-95"
          >
            <span className="sm:hidden">O'tgan</span>
            <span className="hidden sm:inline">O'tgan oy</span>
          </button>
          <button
            type="button"
            onClick={goCurrentMonth}
            title="Joriy oy"
            className="shrink-0 inline-flex items-center justify-center gap-1 h-8 px-2 sm:px-2.5 bg-[var(--bg-void)] border border-emerald-500/20 text-emerald-400 rounded-lg font-black text-[8px] sm:text-[9px] uppercase tracking-wide whitespace-nowrap transition-all hover:bg-emerald-500/10 active:scale-95"
          >
            Joriy
          </button>
          <button
            type="button"
            onClick={() => navigate('kassa')}
            title="Kassa tizimi"
            className="shrink-0 inline-flex items-center justify-center gap-1 h-8 px-2 sm:px-3 bg-[var(--bg-void)] border border-[var(--gold)]/30 text-[var(--gold)] rounded-lg font-bold text-[8px] sm:text-[9px] capitalize tracking-wide whitespace-nowrap transition-all hover:bg-[var(--gold)] hover:text-black active:scale-95 shadow-[0_5px_15px_rgba(184,134,11,0.1)]"
          >
            <Wallet size={14} className="shrink-0 sm:w-4 sm:h-4" />
            <span>Kassa</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadMonthlyReport}
            disabled={isDownloading}
            title="Hisobotni yuklash"
            className="shrink-0 inline-flex items-center justify-center gap-1 h-8 px-2 sm:px-3 bg-[var(--gold)] text-black rounded-lg font-bold text-[8px] sm:text-[9px] capitalize tracking-wide whitespace-nowrap transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            {isDownloading ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Download size={14} className="shrink-0 sm:w-4 sm:h-4" />}
            <span className="max-[380px]:hidden sm:inline">Yuklash</span>
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* PRIMARY INTELLIGENCE CARD */}
      {!loading && statistics ? (
        <div className="lux-card !p-6 mb-8">
          {/* HEADER ROW */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 pb-6 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-void)] border border-[#2a2a2a] flex items-center justify-center text-[var(--gold)] shadow-inner">
                <Wallet size={28} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text-primary)] capitalize tracking-widest">Umumiy G'azna</h3>
                <p className="text-[10px] text-[var(--text-muted)] font-black capitalize tracking-[0.2em] mt-1">Barcha filiallar bo'yicha</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-widest mb-1">Xodimlar</p>
                <div className="flex items-center justify-end gap-2 text-lg font-black text-[var(--text-primary)]">
                  {totalPersonnel} <Users size={14} className="text-[var(--gold)] opacity-50" />
                </div>
              </div>

              <div className="w-px h-10 bg-[var(--border-glass)] hidden sm:block"></div>

              <div className="text-right">
                <p className="text-[9px] font-black text-[var(--gold)] capitalize tracking-widest mb-1">
                  Tasdiqlangan Tushum
                </p>
                <div className="flex items-baseline justify-end gap-2">
                  <span className="text-3xl font-black text-[var(--text-primary)] tracking-tight capitalize drop-shadow-md">
                    {formatNumber(statistics.total_income)}
                  </span>
                  <span className="text-[10px] font-black text-[var(--text-muted)] capitalize">UZS</span>
                </div>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest ${statistics.income_trend >= 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {statistics.income_trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {statistics.income_trend >= 0 ? '+' : ''}{statistics.income_trend}%
                  </div>
                  <span className="text-[8px] font-bold text-[var(--text-muted)] capitalize tracking-tight hidden sm:inline">O'tgan oyga nisbatan</span>
                </div>
                {(statistics.total_attendance_refunds_paid > 0 || statistics.total_attendance_refunds > 0) && (
                  <p className="text-[8px] font-bold text-rose-400/90 text-right mt-2 capitalize tracking-tight">
                    Davomat refundlari: -{formatNumber(statistics.total_attendance_refunds_paid || statistics.total_attendance_refunds)}
                    {statistics.refund_share_percent > 0 && (
                      <span className="text-[var(--text-muted)] ml-1">({statistics.refund_share_percent}% ulush)</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* PERFORMANCE METRICS (Horizontal grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatMetric
              label="Davomat refundlari"
              value={formatNumber(statistics.total_attendance_refunds_paid ?? statistics.total_attendance_refunds ?? 0)}
              icon={<TrendingDown size={20} />}
              color="text-rose-400"
              bg="bg-rose-500/10 border-rose-500/20"
              trend={statistics.refund_share_percent ? `${statistics.refund_share_percent}%` : '0%'}
            />
            <StatMetric
              label="Chiqimlar"
              value={formatNumber(statistics.total_expense)}
              icon={<TrendingDown size={20} />}
              color="text-red-500"
              bg="bg-red-500/10 border-red-500/20"
              trend={`${statistics.expense_trend >= 0 ? '+' : ''}${statistics.expense_trend}%`}
            />
            <StatMetric
              label="Qarzdorlik"
              value={formatNumber(statistics.total_debt)}
              icon={<CreditCard size={20} />}
              color="text-amber-500"
              bg="bg-amber-500/10 border-amber-500/20"
              trend={`${(parseFloat(statistics.total_debt) / (parseFloat(statistics.total_income) + parseFloat(statistics.total_debt) || 1) * 100).toFixed(1)}%`}
            />
            <StatMetric
              label="Sof Foyda"
              value={formatNumber(statistics.net_profit)}
              icon={<TrendingUp size={20} />}
              color="text-emerald-500"
              bg="bg-emerald-500/10 border-emerald-500/20"
              trend={`${statistics.profit_trend >= 0 ? '+' : ''}${statistics.profit_trend}%`}
            />
          </div>

          {/* VISUAL CHART */}
          {trendData && trendData.length > 0 && trendBranches && trendBranches.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[#2a2a2a]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <h4 className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em]">
                  Filiallar bo‘yicha oylik {activeMetric === 'income' ? 'tushum' : 'chiqim'} trendi (UZS)
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveMetric('income')}
                    className={`h-8 px-4 rounded-lg text-[9px] font-black tracking-widest border transition-all ${activeMetric === 'income'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-[var(--bg-void)] text-[var(--text-muted)] border-[#2a2a2a] hover:border-emerald-500/20'
                      }`}
                  >
                    Tushum
                  </button>
                  <button
                    onClick={() => setActiveMetric('expense')}
                    className={`h-8 px-4 rounded-lg text-[9px] font-black tracking-widest border transition-all ${activeMetric === 'expense'
                        ? 'bg-red-500/15 text-red-400 border-red-500/30'
                        : 'bg-[var(--bg-void)] text-[var(--text-muted)] border-[#2a2a2a] hover:border-red-500/20'
                      }`}
                  >
                    Chiqim
                  </button>
                </div>
              </div>
              <div className="h-[220px] md:h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 800 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 800 }}
                      tickFormatter={(value) => {
                        if (value >= 1000000000) return (value / 1000000000).toFixed(1) + 'B';
                        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                        if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
                        return value;
                      }}
                      width={45}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', padding: '12px', fontSize: '10px', textTransform: 'capitalize', fontWeight: '900', letterSpacing: '1px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                      formatter={(value, name) => [`${formatCurrency(value)}`, name]}
                      labelStyle={{ color: '#d4af37', marginBottom: '8px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 900, color: 'var(--text-muted)' }} />
                    {trendBranches.map((b, idx) => (
                      <Line
                        key={b.id}
                        type="monotone"
                        dataKey={`b_${b.id}`}
                        name={b.name}
                        strokeWidth={trendBranches.length > 12 ? 1.5 : 2}
                        dot={false}
                        stroke={branchLineColors[idx] || '#10b981'}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

      ) : (
        <div className="h-[250px] bg-[var(--bg-panel)]/40 border border-[#2a2a2a] rounded-[2rem] mb-8" />
      )}

      {/* OPERATIONS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ACCESS PROTOCOL SIDEBAR */}
        <div className="lg:col-span-3 space-y-4">
          <div className="lux-card !p-3 !rounded-xl">
            <p className="text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest px-2 mb-3">
              Muddallar
            </p>
            <nav className="space-y-1.5">
              <SidebarProtocol to="payments-history" icon={<Wallet size={16} />} label="To'lovlar Tarixi" badge={statistics?.new_payments_count > 0 ? statistics.new_payments_count : null} />
              <SidebarProtocol to="staff-payments" icon={<Users size={16} />} label="Xodimlar Maoshi" />
              <SidebarProtocol to="utility-payments" icon={<Zap size={16} />} label="Kommunal To'lovlar" />
              {/* <SidebarProtocol to="" icon={<Activity size={16} />} label="Batafsil Tahlil" /> */}
            </nav>
          </div>

          <div className="lux-card !p-4 !rounded-xl">
            <h4 className="text-[9px] font-bold text-[var(--gold)] capitalize tracking-wider mb-4">
              Filial Ulushi
            </h4>
            <div className="space-y-5">
              {statistics?.branches?.slice(0, 3).map((b, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black">
                    <span className="text-[var(--text-muted)] capitalize tracking-wide truncate pr-4">{b.name}</span>
                    <span className="text-[var(--text-primary)]">{(b.income / (statistics?.total_income || 1) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-[var(--bg-panel)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--gold)] opacity-40" style={{ width: `${(b.income / (statistics?.total_income || 1)) * 100 || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* REGIONAL NODES LIST */}
        <div className="lg:col-span-9 space-y-4">
          <div className="flex justify-between items-end pb-3 border-b border-[#2a2a2a]">
            <h3 className="text-xl font-bold text-[var(--text-primary)] capitalize tracking-tight">Hududiy Filiallar</h3>
            <div className="flex items-center gap-2 px-2 py-0.5 bg-[var(--bg-panel)]/40 border border-[#2a2a2a] rounded">
              <span className="text-[9px] font-bold text-[var(--text-primary)] capitalize tracking-tight">{branches.length} Filial</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {branches.map((branch) => (
              <div
                key={branch.id}
                onClick={() => navigate(`branch-details/${branch.id}`)}
                className="lux-card !p-4 cursor-pointer hover:border-[var(--gold)]/40 flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-void)] border border-[#2a2a2a] flex items-center justify-center text-[var(--text-muted)]">
                      <Building2 size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-[var(--text-primary)] capitalize tracking-tight">{branch.name}</h4>
                      <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize mt-1 flex items-center gap-1">
                        <MapPin size={10} className="opacity-40" /> {branch.address?.slice(0, 20)}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight size={16} className="text-[var(--text-muted)] opacity-20" />
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--bg-void)]/40 rounded-xl border border-[#2a2a2a]">
                  <div>
                    <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize mb-1">Tushum</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] tracking-tight capitalize tabular-nums">
                      {formatNumber(branch.finance?.income)} <span className="text-[8px] text-[var(--text-muted)] font-bold capitalize ml-1">UZS</span>
                    </p>
                  </div>
                  <div className="border-l border-[#2a2a2a] pl-3">
                    <p className="text-[8px] font-bold text-[var(--text-muted)] capitalize mb-1">Xodimlar</p>
                    <p className="text-sm font-bold text-[var(--text-muted)] tracking-tight tabular-nums">
                      {(branch.mentors_count || 0) + (branch.admins_count || 0)} <span className="text-[8px] font-bold capitalize ml-1">Jami</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatMetric = ({ label, value, icon, color, bg, trend }) => (
  <div className="flex items-center p-4 bg-[var(--bg-void)]/40 rounded-2xl border border-[#2a2a2a] group hover:border-[var(--gold)]/30 transition-colors">
    <div className={`p-3 rounded-xl border mr-4 ${bg} ${color} shadow-inner group-hover:scale-110 transition-transform duration-300`}>
      {icon}
    </div>
    <div className="flex-1">
      <h4 className="text-[9px] font-black text-[var(--text-muted)] capitalize tracking-[0.2em] mb-1">{label}</h4>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-black text-[var(--text-primary)] tabular-nums tracking-tight capitalize">{value}</p>
        <span className="text-[9px] font-black text-[var(--text-muted)] capitalize">UZS</span>
      </div>
    </div>
    <div className={`text-right flex items-center justify-center p-2 rounded bg-[var(--bg-panel)] border border-[#2a2a2a] min-w-[48px]`}>
      <p className={`text-[10px] font-black ${color} tracking-widest`}>{trend}</p>
    </div>
  </div>
);

const SidebarProtocol = ({ icon, label, to = "#", badge }) => (
  <NavLink to={to} className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--gold-dim)] border border-transparent transition-all group">
    <div className="flex items-center gap-3">
      <div className="text-[var(--text-muted)] group-hover:text-[var(--gold)]">{icon}</div>
      <span className="text-[9px] font-bold text-[var(--text-muted)] group-hover:text-[var(--text-primary)] capitalize tracking-wide">{label}</span>
    </div>
    {badge ? (
      <span className="px-1.5 py-0.5 bg-[var(--gold)] text-black text-[8px] font-bold rounded">{badge}</span>
    ) : (
      <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 text-[var(--gold)] transition-all" />
    )}
  </NavLink>
);

export default AllPayments;
