import React from "react";
import { Award, Users, Calculator, TrendingUp, History, CheckCircle, AlertCircle } from "lucide-react";

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return "0 UZS";
  return `${Number(amount).toLocaleString("uz-UZ")} UZS`;
};

export const roundNumber = (value, decimals = 1) => {
  if (isNaN(value)) return 0;
  return Number(Math.round(value + "e" + decimals) + "e-" + decimals);
};

export const StudentStatusBadge = React.memo(({ status, label }) => {
  const configs = {
    discount: {
      bg: "bg-purple-500/15 text-purple-400 border-purple-500/30",
      icon: Award,
      text: label || "Imtiyozli (Davlat puli)",
    },
    low_income: {
      bg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      icon: Users,
      text: label || "Kam ta'minlangan",
    },
    negotiated: {
      bg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      icon: Calculator,
      text: label || "Kelishilgan",
    },
    teacher_negotiated: {
      bg: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
      icon: TrendingUp,
      text: label || "O'qituvchi kelishgan",
    },
    archived: {
      bg: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
      icon: History,
      text: label || "Arxivlangan",
    },
    regular: {
      bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      icon: CheckCircle,
      text: label || "Oddiy",
    },
  };

  const current = configs[status] || configs.regular;
  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border whitespace-nowrap shrink-0 ${current.bg}`}
    >
      <Icon size={10} className="shrink-0" />
      <span className="truncate max-w-[120px]" title={current.text}>{current.text}</span>
    </span>
  );
});

export const DebtorBadge = React.memo(() => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 whitespace-nowrap shrink-0">
    <AlertCircle size={9} className="shrink-0" />
    <span>Qarzdor</span>
  </span>
));

export const PartialBadge = React.memo(() => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap shrink-0">
    <span>Qisman to'langan</span>
  </span>
));
