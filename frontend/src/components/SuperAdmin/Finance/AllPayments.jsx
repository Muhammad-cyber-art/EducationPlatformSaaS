import { useState, useEffect, useMemo } from 'react';
import {
  Search, Download, TrendingUp, Building2, Wallet, ArrowRight,
  Bell, MoreHorizontal, Loader2, Users, Activity, CreditCard,
  ChevronRight, MapPin, TrendingDown, ShieldCheck, Zap, Globe, ArrowUpRight, Circle, Calendar,
  Award, Sparkles, Receipt, PieChart, Coins
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
        api.get(`/add_branch/branches/`, { timeout: 20000 }),
        api.get(`/finance/statistics/`, { params: { year: selectedYear, month: selectedMonth }, timeout: 25000 }),
        api.get(`/finance/statistics/monthly-branch-trends/`, { params: { year: selectedYear, month: selectedMonth, months_back: 12 }, timeout: 25000 })
      ]);

      const branchesData = branchRes.data?.results || branchRes.data || [];
      const statsData = statsRes.data || {};
      const trendsData = trendsRes.data || {};

      const statsMap = {};
      if (Array.isArray(statsData.branches)) {
        statsData.branches.forEach(b => {
          statsMap[Number(b.id)] = b;
        });
      }

      const mergedBranches = Array.isArray(branchesData) ? branchesData.map(b => ({
        ...b,
        finance: statsMap[Number(b.id)] || { income: 0, expense: 0, profit: 0 }
      })) : [];
      setBranches(mergedBranches);
      setStatistics(statsData);

      const normalized = normalizeTrendsForChart(trendsData, activeMetric);
      setTrendData(normalized.data || []);
      setTrendBranches(normalized.branchesList || []);
    } catch (error) {
      console.warn("Fetch Data Error:", error?.message || error);
      toast.error("Ma'lumotlarni yuklashda xatolik yuz berdi.");
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 sm:p-4 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-sm mb-6">
        <div className="flex items-center gap-3.5 min-w-0 shrink-0">
          <div className="w-2 h-9 bg-gradient-to-b from-[var(--gold)] to-amber-600 rounded-full shrink-0 shadow-sm" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight">Moliya Boshqaruvi</h1>
            <p className="text-[10px] sm:text-xs text-[var(--text-muted)] font-bold tracking-wide truncate">
              Oylik davr: <span className="text-[var(--gold)] font-black">{formatMonthLabel(selectedYear, selectedMonth)}</span>
            </p>
          </div>
        </div>

        <div className="w-full lg:w-auto min-w-0 flex flex-wrap sm:flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <div
            className="flex shrink-0 items-center gap-1.5 h-9 px-2.5 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl shadow-inner"
            title="Oy va yilni tanlang"
          >
            <Calendar size={13} className="text-[var(--gold)] shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-[var(--text-primary)] outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }).map((_, idx) => (
                <option key={idx + 1} value={idx + 1} className="bg-[var(--bg-panel)] text-[var(--text-primary)]">
                  {String(idx + 1).padStart(2, '0')}-oy
                </option>
              ))}
            </select>
            <span className="text-[var(--text-muted)] font-bold">/</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-[var(--text-primary)] outline-none cursor-pointer"
            >
              {Array.from({ length: 6 }).map((_, i) => {
                const y = today.getFullYear() - i;
                return <option key={y} value={y} className="bg-[var(--bg-panel)] text-[var(--text-primary)]">{y}</option>;
              })}
            </select>
          </div>

          <button
            type="button"
            onClick={goPrevMonth}
            title="O'tgan oy ma'lumotlari"
            className="shrink-0 inline-flex items-center justify-center gap-1 h-9 px-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-xl font-bold text-xs whitespace-nowrap transition-all active:scale-95 shadow-sm"
          >
            <span>O'tgan oy</span>
          </button>

          <button
            type="button"
            onClick={goCurrentMonth}
            title="Joriy oy"
            className="shrink-0 inline-flex items-center justify-center gap-1 h-9 px-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl font-bold text-xs whitespace-nowrap transition-all active:scale-95 shadow-sm"
          >
            <span>Joriy oy</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('kassa')}
            title="Filial kassasi (POS)"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-3.5 bg-[var(--gold)]/10 hover:bg-[var(--gold)] text-[var(--gold)] hover:text-white border border-[var(--gold)]/30 rounded-xl font-bold text-xs whitespace-nowrap transition-all active:scale-95 shadow-sm"
          >
            <Wallet size={14} className="shrink-0" />
            <span>Kassa</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadMonthlyReport}
            disabled={isDownloading}
            title="Oylik moliyaviy hisobotni yuklab olish"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-3.5 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white rounded-xl font-black text-xs whitespace-nowrap transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-[var(--gold)]/15"
          >
            {isDownloading ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Download size={14} className="shrink-0" />}
            <span>Yuklash</span>
          </button>

          <ThemeToggle />
        </div>
      </div>

      {/* PRIMARY INTELLIGENCE CARD */}
      {!loading && statistics ? (
        <div className="lux-card !p-6 mb-8">
          {/* HEADER ROW */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 pb-6 border-b border-[var(--border-glass)]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-void)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--gold)] shadow-inner">
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
            <div className="mt-8 pt-6 border-t border-[var(--border-glass)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <h4 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">
                  Filiallar bo‘yicha oylik {activeMetric === 'income' ? 'tushum' : 'chiqim'} trendi (UZS)
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveMetric('income')}
                    className={`h-8 px-4 rounded-xl text-xs font-bold border transition-all ${activeMetric === 'income'
                      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 shadow-sm'
                      : 'bg-[var(--bg-void)] text-[var(--text-muted)] border-[var(--border-glass)] hover:text-[var(--text-primary)] hover:border-emerald-500/30'
                      }`}
                  >
                    Tushum
                  </button>
                  <button
                    onClick={() => setActiveMetric('expense')}
                    className={`h-8 px-4 rounded-xl text-xs font-bold border transition-all ${activeMetric === 'expense'
                      ? 'bg-red-500/15 text-red-500 border-red-500/30 shadow-sm'
                      : 'bg-[var(--bg-void)] text-[var(--text-muted)] border-[var(--border-glass)] hover:text-[var(--text-primary)] hover:border-red-500/30'
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
        <div className="h-[250px] bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl mb-8 animate-pulse" />
      )}

      {/* OPERATIONS & MODULES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* FINANCIAL MODULES & REVENUE SHARE (Left Column) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Main Financial Modules Box */}
          <div className="lux-card !p-4 !rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-panel)] shadow-sm">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-[var(--border-glass)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] shadow-sm">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                    Moliyaviy Bo'limlar
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium">Boshqaruv reyestrlari</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-[var(--gold)] bg-[var(--gold)]/10 px-2 py-0.5 rounded-full border border-[var(--gold)]/20">
                5 modul
              </span>
            </div>

            <nav className="space-y-2.5">
              <FinanceModuleCard
                to="payments-history"
                icon={<Receipt size={18} />}
                title="To'lovlar Tarixi"
                subtitle="Kirimlar, cheklar va tranzaksiyalar"
                badge={statistics?.new_payments_count > 0 ? `+${statistics.new_payments_count} yangi` : "Reyestr"}
                accentColor="emerald"
              />

              <FinanceModuleCard
                to="staff-payments"
                icon={<Users size={18} />}
                title="Xodimlar Maoshi"
                subtitle="Oyliklar, avans va o'qituvchi ulushi"
                badge={totalPersonnel > 0 ? `${totalPersonnel} xodim` : "Oyliklar"}
                accentColor="indigo"
              />

              <FinanceModuleCard
                to="utility-payments"
                icon={<Zap size={18} />}
                title="Kommunal To'lovlar"
                subtitle="Ijara, kommunal va ofis xarajatlari"
                badge="Chiqim"
                accentColor="amber"
              />



              <FinanceModuleCard
                to="kassa"
                icon={<Wallet size={18} />}
                title="Filiallar Kassasi"
                subtitle="Kunlik kassa aylanmasi va POS desk"
                badge="Jonli"
                accentColor="gold"
              />
            </nav>
          </div>

          {/* Revenue Distribution (Filiallar Daromad Ulushi) */}
          <div className="lux-card !p-4 !rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-panel)] shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-[var(--border-glass)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] shadow-sm">
                  <PieChart size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                    Daromad Taqsimoti
                  </h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium">Filiallar ulushi</p>
                </div>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-semibold">
                Jami tushumdan
              </span>
            </div>

            <div className="space-y-3.5">
              {statistics?.branches && statistics.branches.length > 0 ? (
                statistics.branches.slice(0, 5).map((b, i) => {
                  const pct = Math.round((b.income / (statistics?.total_income || 1)) * 100) || 0;
                  return (
                    <div key={i} className="space-y-1.5 p-2 rounded-xl bg-[var(--bg-void)]/60 border border-[var(--border-glass)]">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <Building2 size={12} className="text-[var(--gold)] shrink-0 opacity-70" />
                          <span className="font-bold text-[var(--text-primary)] truncate">{b.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] tabular-nums">
                            {formatNumber(b.income)} UZS
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/25 tabular-nums">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-[var(--bg-panel)] rounded-full overflow-hidden border border-[var(--border-glass)]/40">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--gold)] to-amber-400 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, Math.max(pct, 3))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">Filiallar tushumi mavjud emas</p>
              )}
            </div>
          </div>
        </div>

        {/* REGIONAL BRANCHES (Right Column) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--border-glass)]">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-[var(--text-primary)] tracking-tight">Hududiy Filiallar</h3>
              <p className="text-xs text-[var(--text-muted)] font-medium">Filiallar bo'yicha moliyaviy oqim va monitoring</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl shadow-sm">
              <Building2 size={14} className="text-[var(--gold)]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">{branches.length} ta Filial</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {branches.map((branch) => (
              <div
                key={branch.id}
                onClick={() => navigate(`branch-details/${branch.id}`)}
                className="lux-card !p-4 sm:!p-5 rounded-2xl cursor-pointer hover:border-[var(--gold)]/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-xl hover:-translate-y-0.5 relative overflow-hidden bg-[var(--bg-panel)] border border-[var(--border-glass)]"
              >
                {/* Subtle hover gradient */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--gold)]/5 rounded-full blur-2xl group-hover:bg-[var(--gold)]/10 transition-all pointer-events-none" />

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] shrink-0 shadow-sm relative">
                        <Building2 size={20} />
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[var(--bg-panel)]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-black text-[var(--text-primary)] group-hover:text-[var(--gold)] transition-colors truncate">
                          {branch.name}
                        </h4>
                        <p className="text-[11px] font-medium text-[var(--text-muted)] mt-0.5 flex items-center gap-1 truncate">
                          <MapPin size={11} className="opacity-60 shrink-0" />
                          <span>{branch.address || "Manzil ko'rsatilmagan"}</span>
                        </p>
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[var(--bg-void)] border border-[var(--border-glass)] text-[var(--text-muted)] group-hover:text-[var(--gold)] group-hover:border-[var(--gold)]/30 transition-all shrink-0">
                      <ArrowUpRight size={15} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 p-3 bg-[var(--bg-void)]/60 rounded-xl border border-[var(--border-glass)] mb-3">
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Tushum</p>
                      <p className="text-sm font-black text-emerald-500 tabular-nums">
                        {formatNumber(branch.finance?.income)} <span className="text-[9px] font-bold text-[var(--text-muted)]">UZS</span>
                      </p>
                    </div>
                    <div className="border-l border-[var(--border-glass)] pl-2.5">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Xodimlar</p>
                      <p className="text-sm font-black text-[var(--text-primary)] tabular-nums flex items-center gap-1">
                        <Users size={12} className="text-[var(--gold)] opacity-70" />
                        <span>{(branch.mentors_count || 0) + (branch.admins_count || 0)}</span>
                        <span className="text-[9px] font-normal text-[var(--text-muted)]">jami</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Quick Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-glass)]/60">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`branch-details/${branch.id}`);
                    }}
                    className="flex-1 py-1.5 px-3 bg-[var(--gold)]/10 hover:bg-[var(--gold)] text-[var(--gold)] hover:text-white border border-[var(--gold)]/25 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <span>Moliya Tafsilotlari</span>
                    <ArrowRight size={12} />
                  </button>

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
  <div className="flex items-center p-4 sm:p-5 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-glass)] group hover:border-[var(--gold)]/40 transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-0.5">
    <div className={`p-3.5 rounded-2xl border mr-4 ${bg} ${color} shadow-sm group-hover:scale-105 transition-transform duration-300 shrink-0`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <h4 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-1 truncate">{label}</h4>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <p className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tabular-nums tracking-tight">{value}</p>
        <span className="text-[10px] font-bold text-[var(--text-muted)]">UZS</span>
      </div>
    </div>
    <div className="text-right flex items-center justify-center px-2.5 py-1 rounded-xl bg-[var(--bg-void)] border border-[var(--border-glass)] shrink-0 ml-2">
      <p className={`text-xs font-black ${color} tracking-tight`}>{trend}</p>
    </div>
  </div>
);

const FinanceModuleCard = ({
  to,
  onClick,
  icon,
  title,
  subtitle,
  badge,
  accentColor = "emerald"
}) => {
  const colorStyles = {
    emerald: {
      iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-500/20",
      borderHover: "hover:border-emerald-500/40 hover:shadow-emerald-500/5",
      titleHover: "group-hover:text-emerald-500",
      badgeStyle: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    },
    indigo: {
      iconBg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/25 group-hover:bg-indigo-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-500/20",
      borderHover: "hover:border-indigo-500/40 hover:shadow-indigo-500/5",
      titleHover: "group-hover:text-indigo-500",
      badgeStyle: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30",
    },
    amber: {
      iconBg: "bg-amber-500/10 text-amber-500 border-amber-500/25 group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-amber-500/20",
      borderHover: "hover:border-amber-500/40 hover:shadow-amber-500/5",
      titleHover: "group-hover:text-amber-500",
      badgeStyle: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    },
    cyan: {
      iconBg: "bg-cyan-500/10 text-cyan-500 border-cyan-500/25 group-hover:bg-cyan-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-cyan-500/20",
      borderHover: "hover:border-cyan-500/40 hover:shadow-cyan-500/5",
      titleHover: "group-hover:text-cyan-500",
      badgeStyle: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
    },
    gold: {
      iconBg: "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30 group-hover:bg-[var(--gold)] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[var(--gold)]/20",
      borderHover: "hover:border-[var(--gold)]/50 hover:shadow-[var(--gold)]/5",
      titleHover: "group-hover:text-[var(--gold)]",
      badgeStyle: "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30",
    }
  };

  const style = colorStyles[accentColor] || colorStyles.gold;

  const content = (
    <div className={`p-3 sm:p-3.5 rounded-2xl bg-[var(--bg-void)]/60 hover:bg-[var(--bg-void)] border border-[var(--border-glass)] ${style.borderHover} transition-all duration-300 group flex items-center justify-between gap-3 shadow-sm hover:shadow-md cursor-pointer hover:-translate-y-0.5 relative overflow-hidden`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 shadow-sm ${style.iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className={`text-xs sm:text-sm font-black text-[var(--text-primary)] ${style.titleHover} transition-colors truncate`}>
              {title}
            </h4>
            {badge && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${style.badgeStyle}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] font-medium mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors pl-1 shrink-0">
        <ChevronRight size={15} className="transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );

  if (to) {
    return <NavLink to={to} className="block">{content}</NavLink>;
  }
  return <div onClick={onClick}>{content}</div>;
};

export default AllPayments;
