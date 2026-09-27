import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createTenant, clearCreateState } from '../../store/slices/ceoSlice';

const INPUT_STYLE = {
  background: 'var(--input-bg)',
  border:     '1px solid var(--input-border)',
  color:      'var(--text-primary)',
};

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
        style={{ color: 'var(--text-secondary)' }}>
        {label} {required && <span style={{ color: 'var(--gold)' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const INITIAL = {
  name: '', domain: '', city: '', contact_phone: '',
  telegram_bot_token: '',
  plan: 'starter', trial_days: 30,
  admin_email: '', admin_password: '', admin_full_name: '', admin_phone: '',
};

export default function AddTenantModal({ onClose }) {
  const dispatch = useDispatch();
  const { createLoading, createError, createSuccess } = useSelector((s) => s.ceo);

  const [form, setForm]   = useState(INITIAL);
  const [show, setShow]   = useState(false);
  const [step, setStep]   = useState(1); // 1: Markaz, 2: Admin, 3: Tarif

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await dispatch(createTenant(form));
    if (createTenant.fulfilled.match(res)) {
      setTimeout(() => { dispatch(clearCreateState()); onClose(); }, 1800);
    }
  };

  const close = () => { dispatch(clearCreateState()); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && close()}>

      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card-bg)',
          border:     '1px solid var(--border-glass)',
          boxShadow:  '0 32px 80px rgba(0,0,0,0.6)',
          maxHeight:  '90vh',
          overflowY:  'auto',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-glass)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Yangi O'quv Markaz
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Bosqich {step} / 3
            </p>
          </div>
          <button onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
            style={{ background: 'var(--border-glass)', color: 'var(--text-secondary)' }}>
            ✕
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {[1, 2, 3].map((s) => (
            <button key={s} onClick={() => setStep(s)}
              className="flex-1 h-1 rounded-full transition-all duration-300"
              style={{ background: step >= s ? 'var(--gold)' : 'var(--border-glass)' }} />
          ))}
        </div>

        {/* Success state */}
        {createSuccess ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(74,222,128,0.1)', border: '2px solid #4ade80' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#4ade80' }}>Muvaffaqiyatli yaratildi!</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--gold)' }}>{form.name}</strong> o'quv markazi tizimga qo'shildi.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* Step 1: Markaz ma'lumotlari */}
            {step === 1 && (
              <>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--gold)' }}>
                  🏫 Markaz Ma'lumotlari
                </p>
                <Field label="Markaz nomi" required>
                  <input value={form.name} onChange={(e) => set('name', e.target.value)}
                    placeholder="Najot Ta'lim" required
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={INPUT_STYLE}
                    onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={(e)  => e.target.style.borderColor = 'var(--input-border)'} />
                </Field>
                <Field label="Domen" required>
                  <div className="flex items-center rounded-xl overflow-hidden"
                    style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)' }}>
                    <span className="px-3 text-xs" style={{ color: 'var(--text-muted)' }}>https://</span>
                    <input value={form.domain} onChange={(e) => set('domain', e.target.value)}
                      placeholder="najot.crm.uz" required
                      className="flex-1 py-2.5 pr-4 text-sm outline-none"
                      style={{ background: 'transparent', color: 'var(--text-primary)' }}
                      onFocus={(e) => e.target.closest('div').style.borderColor = 'var(--gold)'}
                      onBlur={(e)  => e.target.closest('div').style.borderColor = 'var(--input-border)'} />
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Shahar">
                    <input value={form.city} onChange={(e) => set('city', e.target.value)}
                      placeholder="Toshkent"
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                      style={INPUT_STYLE}
                      onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                      onBlur={(e)  => e.target.style.borderColor = 'var(--input-border)'} />
                  </Field>
                  <Field label="Aloqa telefon">
                    <input value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)}
                      placeholder="+998 90 000 00 00"
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                      style={INPUT_STYLE}
                      onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                      onBlur={(e)  => e.target.style.borderColor = 'var(--input-border)'} />
                  </Field>
                </div>
                <Field label="Telegram Bot Token (ixtiyoriy)">
                  <input value={form.telegram_bot_token} onChange={(e) => set('telegram_bot_token', e.target.value)}
                    placeholder="Masalan: 123456789:AAHkjlfsd..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all font-mono"
                    style={INPUT_STYLE}
                    onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={(e)  => e.target.style.borderColor = 'var(--input-border)'} />
                  <span className="text-[11px] block mt-1" style={{ color: 'var(--text-muted)' }}>
                    O'quv markazning shaxsiy Telegram bot tokeni (@BotFather dan olingan). Keyinchalik ham kiritish mumkin.
                  </span>
                </Field>
              </>
            )}

            {/* Step 2: Admin */}
            {step === 2 && (
              <>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--gold)' }}>
                  👤 Birinchi Admin
                </p>
                <Field label="To'liq ism">
                  <input value={form.admin_full_name} onChange={(e) => set('admin_full_name', e.target.value)}
                    placeholder="Abdulloh Rahimov"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={INPUT_STYLE}
                    onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={(e)  => e.target.style.borderColor = 'var(--input-border)'} />
                </Field>
                <Field label="Email" required>
                  <input type="email" value={form.admin_email} onChange={(e) => set('admin_email', e.target.value)}
                    placeholder="admin@najot.crm.uz" required
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={INPUT_STYLE}
                    onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={(e)  => e.target.style.borderColor = 'var(--input-border)'} />
                </Field>
                <Field label="Parol" required>
                  <div className="relative">
                    <input type={show ? 'text' : 'password'} value={form.admin_password}
                      onChange={(e) => set('admin_password', e.target.value)}
                      placeholder="Kamida 8 belgi" required minLength={8}
                      className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm outline-none transition-all"
                      style={INPUT_STYLE}
                      onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                      onBlur={(e)  => e.target.style.borderColor = 'var(--input-border)'} />
                    <button type="button" onClick={() => setShow(!show)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
                      {show ? '🙈' : '👁️'}
                    </button>
                  </div>
                </Field>
                <Field label="Telefon">
                  <input value={form.admin_phone} onChange={(e) => set('admin_phone', e.target.value)}
                    placeholder="+998 90 000 00 00"
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={INPUT_STYLE}
                    onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                    onBlur={(e)  => e.target.style.borderColor = 'var(--input-border)'} />
                </Field>
              </>
            )}

            {/* Step 3: Tarif */}
            {step === 3 && (
              <>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--gold)' }}>
                  📦 Tarif Rejasi
                </p>
                <Field label="Tarif" required>
                  <div className="space-y-2">
                    {[
                      { val: 'starter',    label: 'Starter',    price: '500,000 so\'m/oy',    desc: '200 ta talaba, 1 ta filial' },
                      { val: 'pro',        label: 'Pro',        price: '1,500,000 so\'m/oy',  desc: '1000 ta talaba, 3 ta filial' },
                      { val: 'enterprise', label: 'Enterprise', price: '3,000,000 so\'m/oy',  desc: '10,000 ta talaba, 20 ta filial' },
                    ].map(({ val, label, price, desc }) => (
                      <label key={val} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                        style={{
                          border:     form.plan === val ? '1px solid var(--gold)' : '1px solid var(--border-glass)',
                          background: form.plan === val ? 'var(--gold-dim)' : 'transparent',
                        }}>
                        <input type="radio" name="plan" value={val} checked={form.plan === val}
                          onChange={() => set('plan', val)} className="hidden" />
                        <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{ borderColor: form.plan === val ? 'var(--gold)' : 'var(--border-glass)' }}>
                          {form.plan === val && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--gold)' }} />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>{price}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Sinov davri (kun)">
                  <div className="flex items-center gap-3">
                    <input type="range" min="7" max="90" value={form.trial_days}
                      onChange={(e) => set('trial_days', Number(e.target.value))}
                      className="flex-1" style={{ accentColor: 'var(--gold)' }} />
                    <span className="text-sm font-bold w-16 text-right" style={{ color: 'var(--gold)' }}>
                      {form.trial_days} kun
                    </span>
                  </div>
                </Field>
              </>
            )}

            {/* Error */}
            {createError && (
              <div className="px-4 py-3 rounded-xl text-xs"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                ⚠️ {createError}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              {step > 1 && (
                <button type="button" onClick={() => setStep((s) => s - 1)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', background: 'transparent' }}>
                  ← Orqaga
                </button>
              )}
              {step < 3 ? (
                <button type="button" onClick={() => setStep((s) => s + 1)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'var(--gold)', color: '#000' }}>
                  Davom → 
                </button>
              ) : (
                <button type="submit" disabled={createLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: createLoading ? 'rgba(184,134,11,0.4)' : 'var(--gold)', color: '#000', cursor: createLoading ? 'not-allowed' : 'pointer' }}>
                  {createLoading && <span className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />}
                  {createLoading ? 'Yaratilmoqda...' : '✓ Markaz Yaratish'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
