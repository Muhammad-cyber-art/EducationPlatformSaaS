import { useId } from 'react';
import { Calculator, ArrowDown, ChevronDown, Info, CalendarDays } from 'lucide-react';

const lessonStates = {
  present: { label: 'Kelgan', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  absent: { label: 'Kelmagan', color: 'bg-rose-500/10 text-rose-500 border-rose-500/25' },
  before_join: { label: "Qo‘shilishdan oldin", color: 'bg-[var(--bg-void)] text-[var(--text-muted)] border-[var(--border-glass)]' },
  after_leave: { label: 'Guruhdan chiqqan', color: 'bg-[var(--bg-void)] text-[var(--text-muted)] border-[var(--border-glass)]' },
  frozen: { label: 'Muzlatilgan', color: 'bg-sky-500/10 text-sky-500 border-sky-500/25' },
  unmarked: { label: 'Tasdiqlanmagan', color: 'bg-amber-500/10 text-amber-500 border-amber-500/25' },
  scheduled: { label: 'Rejadagi dars', color: 'bg-[var(--bg-void)] text-[var(--text-secondary)] border-[var(--border-glass)]' },
};

export default function PaymentCalculation({ calculation, formatCurrency }) {
  const titleId = useId();
  if (!calculation) return (
    <div className="rounded-xl border border-[var(--border-glass)] p-3 text-xs text-[var(--text-muted)]">
      Batafsil hisob mavjud emas. Internetga ulangach o‘quvchi tafsilotini qayta oching.
    </div>
  );
  const c = calculation;
  const maximum = Math.max(Number(c.standard_amount), Number(c.expected_amount), Number(c.remaining_amount), 1);
  const rows = [
    { label: 'Odatiy kurs narxi', value: c.standard_amount, color: 'bg-[var(--text-muted)]' },
    { label: 'Shu oy uchun hisob', value: c.expected_amount, color: 'bg-[var(--gold)]' },
    { label: 'Hozir to‘lash kerak', value: c.remaining_amount, color: 'bg-rose-500' },
  ];
  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--bg-void)]/50 overflow-hidden">
      <div className="p-4 border-b border-[var(--border-glass)]">
        <h4 id={titleId} className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
          <Calculator size={17} className="text-[var(--gold)] shrink-0" /> Nega aynan shu summa?
        </h4>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{c.group_name} · {c.month.slice(0, 7)} · {c.context.status_label}</p>
        <div className="mt-4 space-y-3">
          {rows.map(row => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="text-[var(--text-secondary)]">{row.label}</span>
                <strong className="text-[var(--text-primary)] tabular-nums">{formatCurrency(row.value)}</strong>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border-glass)] overflow-hidden" aria-hidden="true">
                <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(0, Number(row.value)) / maximum * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        {Number(c.paid_amount) > 0 && <p className="mt-3 text-xs text-emerald-500">Avval to‘langan: <strong>{formatCurrency(c.paid_amount)}</strong></p>}
        {c.source === 'estimate' && <p className="mt-3 text-xs text-amber-500">Hisob yozuvi hali yaratilmagan. Bu kassadagi joriy hisob ko‘rinishi.</p>}
      </div>
      <details open={c.is_reduced} className="group/calculation">
        <summary className="cursor-pointer list-none p-4 flex items-center justify-between text-xs font-bold text-[var(--gold)]">
          Bosqichma-bosqich arifmetika
          <ChevronDown size={16} className="transition-transform group-open/calculation:rotate-180" />
        </summary>
        <div className="px-4 pb-4 space-y-2">
          {c.steps.map((step, index) => (
            <div key={`${step.code}-${index}`}>
              {index > 0 && <ArrowDown size={13} aria-hidden="true" className="mx-auto my-1 text-[var(--text-muted)]" />}
              <div className={`rounded-xl border p-3 ${index === c.steps.length - 1 ? 'border-[var(--gold)]/35 bg-[var(--gold)]/5' : 'border-[var(--border-glass)] bg-[var(--bg-panel)]'}`}>
                <h5 className="text-xs font-bold text-[var(--text-primary)]">{index + 1}. {step.title}</h5>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{step.detail}</p>
                <p className="mt-2 rounded-lg bg-[var(--bg-void)] px-2.5 py-2 font-mono text-xs leading-relaxed break-words text-[var(--gold)] tabular-nums">{step.formula}</p>
              </div>
            </div>
          ))}
          <div className="pt-3 text-xs font-bold text-[var(--text-primary)] flex justify-between gap-2">
            <span>Yakuniy qoldiq</span><span className="text-rose-500 tabular-nums">{formatCurrency(c.remaining_amount)}</span>
          </div>
        </div>
      </details>
      <details className="border-t border-[var(--border-glass)]">
        <summary className="cursor-pointer p-4 text-xs font-semibold text-[var(--text-secondary)]">
          <CalendarDays size={13} className="inline mr-1.5" /> Darslar va hisobga olingan sanalar ({c.context.total_lessons})
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-[var(--text-muted)]">Guruhga qo‘shilgan: {c.context.joined_date || 'Sana mavjud emas'}. Tasdiqlangan kelgan darslar: {c.context.confirmed_present_count}.</p>
          <div className="flex flex-wrap gap-1.5">
            {c.lessons.map(lesson => {
              const state = lessonStates[lesson.state] || lessonStates.unmarked;
              return <span key={lesson.date} title={`${lesson.date}: ${state.label}`} className={`rounded-lg border px-2 py-1 text-[10px] ${state.color}`}>
                {lesson.date.slice(8)}.{lesson.date.slice(5, 7)} · {state.label}
              </span>;
            })}
          </div>
          {!c.lessons.length && <p className="text-xs text-[var(--text-muted)]">Bu oyda rejalashtirilgan dars yo‘q.</p>}
          {c.context.canceled_dates.length > 0 && <p className="text-[11px] text-[var(--text-muted)]">Bekor qilingan darslar: {c.context.canceled_dates.join(', ')}. Joriy darslar soniga kiritilmagan.</p>}
          {c.context.special_dates.length > 0 && <p className="text-[11px] text-[var(--text-muted)]">Qo‘shimcha darslar: {c.context.special_dates.join(', ')}.</p>}
        </div>
      </details>
      {(c.warnings.length > 0 || c.notes) && <div className="border-t border-[var(--border-glass)] p-4 space-y-2">
        {c.warnings.map(warning => <p key={warning} className="flex gap-2 text-[11px] leading-relaxed text-amber-500"><Info size={13} className="mt-0.5 shrink-0" />{warning}</p>)}
        {c.notes && <p className="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap">Hisob izohi: {c.notes}</p>}
      </div>}
    </section>
  );
}
