import { CheckCircle2, Clock, CloudOff, HelpCircle } from 'lucide-react';

const states = {
  verified: { Icon: CheckCircle2, label: 'Superadmin tasdiqlagan', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25' },
  pending: { Icon: Clock, label: "Superadmin tasdig'i kutilmoqda", color: 'text-amber-500 bg-amber-500/10 border-amber-500/25' },
  sync_pending: { Icon: CloudOff, label: 'Serverga yuborish kutilmoqda', color: 'text-sky-500 bg-sky-500/10 border-sky-500/25' },
  unknown: { Icon: HelpCircle, label: "Tasdiq holati yangilanmagan", color: 'text-[var(--text-muted)] bg-[var(--bg-void)] border-[var(--border-glass)]' },
};

export default function PaymentVerificationBadge({ payment }) {
  if (!payment || payment.is_discount || payment.status === 'discount' || Number(payment.paid_amount || 0) <= 0) return null;
  const status = payment.verification_status ||
    (typeof payment.is_verified === 'boolean' ? (payment.is_verified ? 'verified' : 'pending') : 'unknown');
  const { Icon, label, color } = states[status] || states.unknown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold ${color}`} title={label}>
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      <span>{label}</span>
    </span>
  );
}
