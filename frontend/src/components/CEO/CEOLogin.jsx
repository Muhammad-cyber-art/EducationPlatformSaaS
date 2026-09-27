import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ceoLogin } from '../../store/slices/ceoSlice';
import CEOSubdomainForbidden from './CEOSubdomainForbidden';
import { isTenantSubdomain } from '../../utils/subdomain';

export default function CEOLogin() {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const { authLoading, authError } = useSelector((s) => s.ceo);

  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);

  if (isTenantSubdomain()) {
    return <CEOSubdomainForbidden />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await dispatch(ceoLogin(form));
    if (ceoLogin.fulfilled.match(res)) navigate('/ceo/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-void)' }}>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--gold) 0%, transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="var(--gold)" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 22V12M3 7l9 5 9-5" stroke="var(--gold)" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>CEO Panel</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Platform boshqaruvi — faqat vakolatli shaxslar uchun
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-glass)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
          }}>

          {authError && (
            <div className="mb-5 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ceo@crm.uz"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                onBlur={(e)  => e.target.style.borderColor = 'var(--input-border)'}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}>Parol</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                  onBlur={(e)  => e.target.style.borderColor = 'var(--input-border)'}
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-secondary)' }}>
                  {show ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200"
              style={{
                background:  authLoading ? 'rgba(184,134,11,0.4)' : 'var(--gold)',
                color:       '#000',
                cursor:      authLoading ? 'not-allowed' : 'pointer',
                boxShadow:   authLoading ? 'none' : 'var(--gold-glow)',
              }}
              onMouseEnter={(e) => { if (!authLoading) e.target.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'none'; }}
            >
              {authLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full inline-block" />
                  Kirish...
                </span>
              ) : 'Kirish'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
          CRM Platform v2.0 · Multi-Tenant SaaS
        </p>
      </div>
    </div>
  );
}
