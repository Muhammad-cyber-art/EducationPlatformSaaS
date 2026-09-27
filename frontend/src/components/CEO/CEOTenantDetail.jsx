import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchTenantDetail,
  toggleTenantStatus,
  updateTenant,
  resetAdminPassword,
  updateAdmin,
  impersonateTenant,
} from '../../store/slices/ceoSlice';
import toast from 'react-hot-toast';
import {
  Building2,
  Users,
  GraduationCap,
  Layers,
  MapPin,
  Phone,
  Calendar,
  KeyRound,
  ShieldCheck,
  Edit3,
  ExternalLink,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Unlock,
  AlertTriangle,
  UserCheck,
  Briefcase,
  GitBranch,
  Globe,
} from 'lucide-react';

const PLAN_STYLE = {
  starter:    { bg: 'rgba(99,102,241,0.12)',  color: '#a5b4fc', border: 'rgba(99,102,241,0.3)' },
  pro:        { bg: 'rgba(184,134,11,0.12)',  color: '#d4a017', border: 'rgba(184,134,11,0.3)' },
  enterprise: { bg: 'rgba(16,185,129,0.12)',  color: '#34d399', border: 'rgba(16,185,129,0.3)' },
};

export default function CEOTenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { selectedTenant: tenant, detailLoading } = useSelector((s) => s.ceo);

  // Modals state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditAdminModal, setShowEditAdminModal] = useState(false);
  const [showEditTenantModal, setShowEditTenantModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);

  // Form states
  const [newPassword, setNewPassword] = useState('');
  const [showPassText, setShowPassText] = useState(false);
  const [passSubmitting, setPassSubmitting] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  const [adminForm, setAdminForm] = useState({
    username: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    email: '',
  });
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  const [tenantForm, setTenantForm] = useState({
    name: '',
    city: '',
    contact_phone: '',
    plan: 'starter',
  });
  const [tenantSubmitting, setTenantSubmitting] = useState(false);

  const [toggleReason, setToggleReason] = useState('');
  const [toggleSubmitting, setToggleSubmitting] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  const handleImpersonate = async () => {
    if (!tenant) return;
    setImpersonating(true);
    try {
      const res = await dispatch(impersonateTenant(tenant.id)).unwrap();
      localStorage.setItem('access_token', res.access);
      localStorage.setItem('refresh_token', res.refresh);
      localStorage.setItem('tenant_schema', res.tenant.schema_name);
      localStorage.setItem('tenant_name', res.tenant.name);
      toast.success(`${res.tenant.name} markazi super admini sifatida kirdingiz!`);
      window.open('/super_admin', '_blank');
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Tizimga kirishda xatolik yuz berdi');
    } finally {
      setImpersonating(false);
    }
  };

  useEffect(() => {
    if (id) {
      dispatch(fetchTenantDetail(id));
    }
  }, [id, dispatch]);

  useEffect(() => {
    if (tenant) {
      setTenantForm({
        name: tenant.name || '',
        city: tenant.city || '',
        contact_phone: tenant.contact_phone || '',
        plan: tenant.subscription?.plan || 'starter',
      });
      if (tenant.super_admin) {
        setAdminForm({
          username: tenant.super_admin.username || '',
          first_name: tenant.super_admin.first_name || '',
          last_name: tenant.super_admin.last_name || '',
          phone_number: tenant.super_admin.phone_number || '',
          email: tenant.super_admin.email || '',
        });
      }
    }
  }, [tenant]);

  // Password Generator
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setShowPassText(true);
    toast.success('Kuchli parol generatsiya qilindi!');
  };

  const copyToClipboard = (text, type = 'pass') => {
    navigator.clipboard.writeText(text);
    if (type === 'pass') {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
      toast.success('Parol nusxalandi!');
    } else {
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2000);
      toast.success('Nusxa olindi!');
    }
  };

  // Submit Handlers
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Parol kamida 6 belgidan iborat bo\'lishi shart');
      return;
    }
    setPassSubmitting(true);
    try {
      await dispatch(resetAdminPassword({ id, new_password: newPassword })).unwrap();
      toast.success('Admin paroli muvaffaqiyatli yangilandi!');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Parolni yangilashda xatolik');
    } finally {
      setPassSubmitting(false);
    }
  };

  const handleAdminUpdate = async (e) => {
    e.preventDefault();
    setAdminSubmitting(true);
    try {
      await dispatch(updateAdmin({ id, ...adminForm })).unwrap();
      toast.success('Admin ma\'lumotlari muvaffaqiyatli yangilandi!');
      setShowEditAdminModal(false);
      dispatch(fetchTenantDetail(id));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Adminni yangilashda xatolik');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleTenantUpdate = async (e) => {
    e.preventDefault();
    setTenantSubmitting(true);
    try {
      await dispatch(updateTenant({ id, ...tenantForm })).unwrap();
      toast.success('Markaz ma\'lumotlari muvaffaqiyatli yangilandi!');
      setShowEditTenantModal(false);
      dispatch(fetchTenantDetail(id));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Yangilashda xatolik');
    } finally {
      setTenantSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    setToggleSubmitting(true);
    try {
      await dispatch(toggleTenantStatus({
        id,
        is_active: !tenant.is_active,
        reason: toggleReason || (tenant.is_active ? 'CEO tomonidan to\'xtatildi' : 'CEO tomonidan qayta faollashtirildi'),
      })).unwrap();
      toast.success(tenant.is_active ? 'Markaz bloklandi' : 'Markaz faollashtirildi');
      setShowToggleModal(false);
      setToggleReason('');
      dispatch(fetchTenantDetail(id));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Statusni o\'zgartirishda xatolik');
    } finally {
      setToggleSubmitting(false);
    }
  };

  if (detailLoading && !tenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
        <span className="animate-spin w-8 h-8 border-3 border-[var(--gold)] border-t-transparent rounded-full" />
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          O'quv markaz ma'lumotlari yuklanmoqda...
        </p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-5xl">🏫</p>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          O'quv markaz topilmadi
        </h2>
        <button
          onClick={() => navigate('/ceo/tenants')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--gold)', color: '#000' }}
        >
          <ArrowLeft size={16} /> Markazlar ro'yxatiga qaytish
        </button>
      </div>
    );
  }

  const stats = tenant.stats || {};
  const superAdmin = tenant.super_admin;
  const sub = tenant.subscription || {};
  const planStyle = PLAN_STYLE[sub.plan || 'starter'] || PLAN_STYLE.starter;
  const primaryDomain = tenant.primary_domain || (tenant.domains && tenant.domains[0]?.domain);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto min-h-screen">
      {/* ── TOP BREADCRUMB & BACK ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ceo/tenants')}
            className="p-2 rounded-xl transition-all"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-secondary)',
            }}
            title="Ortga qaytish"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Link to="/ceo/tenants" className="hover:underline">
                O'quv Markazlar
              </Link>
              <span>/</span>
              <span style={{ color: 'var(--gold)' }}>{tenant.name}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3 mt-1" style={{ color: 'var(--text-primary)' }}>
              {tenant.name}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowEditTenantModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-primary)',
            }}
          >
            <Edit3 size={15} style={{ color: 'var(--gold)' }} />
            Markazni Tahrirlash
          </button>

          <button
            onClick={() => setShowToggleModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: tenant.is_active ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
              border: `1px solid ${tenant.is_active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
              color: tenant.is_active ? '#f87171' : '#4ade80',
            }}
          >
            {tenant.is_active ? <Lock size={15} /> : <Unlock size={15} />}
            {tenant.is_active ? 'Markazni Bloklash' : 'Faollashtirish'}
          </button>
        </div>
      </div>

      {/* ── HEADER SUMMARY BANNER ── */}
      <div
        className="p-6 rounded-2xl relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--card-bg) 0%, rgba(184, 134, 11, 0.05) 100%)',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{
                  background: planStyle.bg,
                  color: planStyle.color,
                  border: `1px solid ${planStyle.border}`,
                }}
              >
                {sub.plan || 'Starter'} Plan
              </span>
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: tenant.is_active ? 'rgba(74, 222, 128, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                  color: tenant.is_active ? '#4ade80' : '#f87171',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: tenant.is_active ? '#4ade80' : '#f87171' }} />
                {tenant.is_active ? 'Faol Holatda' : 'Bloklangan'}
              </span>
              {tenant.city && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--bg-void)', color: 'var(--text-secondary)' }}>
                  <MapPin size={12} /> {tenant.city}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 flex-wrap text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center gap-1.5">
                <span style={{ color: 'var(--text-muted)' }}>Schema:</span>
                <span className="font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-void)', color: 'var(--gold)' }}>
                  {tenant.schema_name}
                </span>
                <button
                  onClick={() => copyToClipboard(tenant.schema_name, 'schema')}
                  className="p-1 hover:text-[var(--gold)] transition-colors"
                  title="Nusxa olish"
                >
                  {copiedSchema ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                </button>
              </div>

              {primaryDomain && (
                <div className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--text-muted)' }}>Domen:</span>
                  <a
                    href={`http://${primaryDomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium hover:underline inline-flex items-center gap-1 text-blue-400"
                  >
                    {primaryDomain} <ExternalLink size={12} />
                  </a>
                </div>
              )}

              {tenant.contact_phone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>{tenant.contact_phone}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                <span>Ochilgan sana: {new Date(tenant.created_at).toLocaleDateString('uz-UZ')}</span>
              </div>
            </div>
          </div>

          {/* Quick Subscription Pill */}
          <div
            className="p-4 rounded-xl flex items-center gap-4 shrink-0"
            style={{ background: 'var(--bg-void)', border: '1px solid var(--border-glass)' }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Obuna Holati
              </p>
              <p className="text-base font-bold capitalize mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {sub.status_display || sub.status || 'Active'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {sub.days_remaining !== undefined ? `${sub.days_remaining} kun qoldi` : 'Muddatsiz'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
              <Sparkles size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* ── KEY DYNAMIC STATS GRID ── */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Layers size={18} style={{ color: 'var(--gold)' }} />
          Dinamik Statistika & Faollik
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Students */}
          <div
            className="p-5 rounded-2xl relative overflow-hidden transition-all hover:scale-[1.01]"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Jami O'quvchilar
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                <GraduationCap size={18} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
                {stats.total_students || 0}
              </span>
              <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>nafar</span>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--border-glass)' }}>
              <span className="flex items-center gap-1.5" style={{ color: '#4ade80' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                {stats.active_students || 0} faol
              </span>
              <span className="flex items-center gap-1.5" style={{ color: '#f87171' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {stats.inactive_students || 0} nofaol
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {stats.archived_students || 0} arxiv
              </span>
            </div>
          </div>

          {/* Card 2: Staff */}
          <div
            className="p-5 rounded-2xl relative overflow-hidden transition-all hover:scale-[1.01]"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Jami Xodimlar
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc' }}>
                <Users size={18} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
                {stats.total_staff || 0}
              </span>
              <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>xodim</span>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--border-glass)' }}>
              <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                <Briefcase size={12} style={{ color: 'var(--gold)' }} />
                {stats.mentor_count || 0} mentor
              </span>
              <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                <ShieldCheck size={12} style={{ color: '#60a5fa' }} />
                {stats.admin_count || 0} admin
              </span>
              <span style={{ color: '#34d399' }}>1 super admin</span>
            </div>
          </div>

          {/* Card 3: Groups */}
          <div
            className="p-5 rounded-2xl relative overflow-hidden transition-all hover:scale-[1.01]"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Guruhlar
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#facc15' }}>
                <Layers size={18} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
                {stats.total_groups || 0}
              </span>
              <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>ta guruh</span>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-xs" style={{ borderTop: '1px solid var(--border-glass)' }}>
              <span style={{ color: '#4ade80' }}>
                {stats.active_groups || 0} faol dars jarayonida
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {(stats.total_groups || 0) - (stats.active_groups || 0)} rejalashtirilgan
              </span>
            </div>
          </div>

          {/* Card 4: Branches */}
          <div
            className="p-5 rounded-2xl relative overflow-hidden transition-all hover:scale-[1.01]"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Filiallar Soni
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
                <GitBranch size={18} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
                {stats.total_branches || 0}
              </span>
              <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>filial</span>
            </div>
            <div className="mt-4 pt-3 text-xs" style={{ borderTop: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
              Asosiy markaz: {tenant.city || 'Toshkent'}
            </div>
          </div>
        </div>
      </div>

      {/* ── SUPER ADMIN SECTION & TECHNICAL INFO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Super Admin Card (2 Cols) */}
        <div
          className="lg:col-span-2 p-6 rounded-2xl relative overflow-hidden"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3 pb-5 mb-5" style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--gold)' }} />
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  O'quv Markaz Super Admini
                </h3>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Markazning bosh direktori va tizim administratorining boshqaruv profili
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
                style={{ background: 'var(--gold)', color: '#000' }}
              >
                <KeyRound size={14} />
                Parolni Yangilash
              </button>
              {superAdmin && (
                <button
                  onClick={() => setShowEditAdminModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: 'var(--bg-void)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
                >
                  <Edit3 size={14} style={{ color: 'var(--gold)' }} />
                  Tahrirlash
                </button>
              )}
            </div>
          </div>

          {superAdmin ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Overview */}
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.2), rgba(184, 134, 11, 0.05))',
                    border: '1px solid var(--gold)',
                    color: 'var(--gold)',
                  }}
                >
                  {(superAdmin.first_name?.[0] || superAdmin.username?.[0] || 'A').toUpperCase()}
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {superAdmin.full_name || superAdmin.username}
                  </h4>
                  <p className="text-xs font-mono" style={{ color: 'var(--gold)' }}>
                    @{superAdmin.username}
                  </p>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <ShieldCheck size={11} /> Super Admin
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-3 p-4 rounded-xl text-xs" style={{ background: 'var(--bg-void)' }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {superAdmin.email || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Telefon:</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {superAdmin.phone_number || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Qo'shilgan sana:</span>
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {superAdmin.date_joined ? new Date(superAdmin.date_joined).toLocaleDateString('uz-UZ') : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Oxirgi kirish:</span>
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {superAdmin.last_login ? new Date(superAdmin.last_login).toLocaleString('uz-UZ') : 'Hali kirmagan'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Login / Portal Access */}
            <div className="mt-5 pt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border-glass)]">
              <button
                onClick={handleImpersonate}
                disabled={impersonating || !tenant.is_active}
                className="px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, var(--gold), #d4a017)',
                  color: '#000',
                  boxShadow: '0 4px 20px rgba(184, 134, 11, 0.25)',
                }}
              >
                {impersonating ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <ExternalLink size={14} />
                )}
                Super Admin sifatida kirish (1-bosishda)
              </button>

              <button
                onClick={() => {
                  const sub = tenant.primary_domain?.split('.')[0] || tenant.schema_name?.replace('tenant_', '');
                  const port = window.location.port ? `:${window.location.port}` : '';
                  localStorage.setItem('tenant_schema', tenant.schema_name);
                  localStorage.setItem('tenant_name', tenant.name);
                  window.open(`http://${sub}.localhost${port}/login`, '_blank');
                }}
                className="px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 transition-all"
                style={{
                  background: 'var(--gold-dim)',
                  color: 'var(--gold)',
                  border: '1px solid var(--gold)',
                }}
              >
                <Globe size={14} />
                Subdomen orqali login ({tenant.primary_domain?.split('.')[0] || 'subdomain'}.localhost)
              </button>
            </div>
          </>
          ) : (
            <div className="p-8 text-center space-y-3" style={{ background: 'var(--bg-void)', borderRadius: '12px' }}>
              <p className="text-3xl">⚠️</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Ushbu markazda Super Admin topilmadi
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Parolni yangilash tugmasi orqali yangi admin yaratishingiz yoki parolni tiklashingiz mumkin.
              </p>
            </div>
          )}
        </div>

        {/* Technical & Database Info (1 Col) */}
        <div
          className="p-6 rounded-2xl space-y-4"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-glass)' }}
        >
          <div className="flex items-center gap-2 pb-3" style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <Building2 size={16} style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Texnik & Baza Ma'lumotlari
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>PostgreSQL Schemasi</p>
              <div className="flex items-center justify-between mt-1 p-2 rounded-lg font-mono text-xs" style={{ background: 'var(--bg-void)' }}>
                <span style={{ color: 'var(--gold)' }}>{tenant.schema_name}</span>
                <button
                  onClick={() => copyToClipboard(tenant.schema_name, 'schema')}
                  className="hover:text-[var(--gold)]"
                >
                  {copiedSchema ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Bog'langan Domenlar</p>
              <div className="space-y-1 mt-1">
                {tenant.domains && tenant.domains.length > 0 ? (
                  tenant.domains.map((d) => (
                    <div
                      key={d.id}
                      className="p-2 rounded-lg flex items-center justify-between text-xs"
                      style={{ background: 'var(--bg-void)' }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>{d.domain}</span>
                      {d.is_primary && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-semibold">
                          Asosiy
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Domen mavjud emas</p>
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-glass)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Oylik Tarif To'lovi:</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {sub.price_per_month ? `${Number(sub.price_per_month).toLocaleString()} so'm` : '0 so\'m'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Oxirgi yangilanish:</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {new Date(tenant.updated_at).toLocaleString('uz-UZ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL 1: RESET SUPER ADMIN PASSWORD ── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md p-6 rounded-2xl relative space-y-5"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-highlight)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                  <KeyRound size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    Admin Parolini Yangilash
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {tenant.name} bosh administrator paroli
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Yangi Parol
                </label>
                <div className="relative">
                  <input
                    type={showPassText ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Kamida 6 ta belgi..."
                    required
                    className="w-full pl-3 pr-20 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassText(!showPassText)}
                      className="p-1.5 text-gray-400 hover:text-white"
                      title={showPassText ? 'Yashirish' : 'Ko\'rsatish'}
                    >
                      {showPassText ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    {newPassword && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(newPassword, 'pass')}
                        className="p-1.5 text-gray-400 hover:text-[var(--gold)]"
                        title="Nusxa olish"
                      >
                        {copiedPass ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Generate button */}
              <button
                type="button"
                onClick={generateStrongPassword}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: 'var(--bg-void)',
                  border: '1px dashed var(--border-glass)',
                  color: 'var(--gold)',
                }}
              >
                <Sparkles size={13} />
                Tasodifiy kuchli parol generatsiya qilish
              </button>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowPasswordModal(false); setNewPassword(''); }}
                  className="px-4 py-2 rounded-xl text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={passSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'var(--gold)', color: '#000' }}
                >
                  {passSubmitting && <RefreshCw size={13} className="animate-spin" />}
                  Parolni Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT ADMIN INFO ── */}
      {showEditAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg p-6 rounded-2xl relative space-y-5"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-highlight)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    Super Admin Ma'lumotlarini Tahrirlash
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Ism, familiya, username va telefon raqami
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditAdminModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Ism
                  </label>
                  <input
                    type="text"
                    value={adminForm.first_name}
                    onChange={(e) => setAdminForm({ ...adminForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Familiya
                  </label>
                  <input
                    type="text"
                    value={adminForm.last_name}
                    onChange={(e) => setAdminForm({ ...adminForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={adminForm.username}
                  onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none font-mono"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Telefon Raqami
                </label>
                <input
                  type="text"
                  value={adminForm.phone_number}
                  onChange={(e) => setAdminForm({ ...adminForm, phone_number: e.target.value })}
                  placeholder="+998901234567"
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditAdminModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={adminSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'var(--gold)', color: '#000' }}
                >
                  {adminSubmitting && <RefreshCw size={13} className="animate-spin" />}
                  O'zgarishlarni Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: EDIT TENANT DETAILS ── */}
      {showEditTenantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg p-6 rounded-2xl relative space-y-5"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-highlight)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
                  <Building2 size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    O'quv Markazni Tahrirlash
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Nomi, joylashuvi, aloqa va obuna tarifi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditTenantModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTenantUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  O'quv Markaz Nomi
                </label>
                <input
                  type="text"
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Shahar / Manzil
                  </label>
                  <input
                    type="text"
                    value={tenantForm.city}
                    onChange={(e) => setTenantForm({ ...tenantForm, city: e.target.value })}
                    placeholder="Masalan: Toshkent"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Aloqa Telefoni
                  </label>
                  <input
                    type="text"
                    value={tenantForm.contact_phone}
                    onChange={(e) => setTenantForm({ ...tenantForm, contact_phone: e.target.value })}
                    placeholder="+998711234567"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Tarif Rejasi
                </label>
                <select
                  value={tenantForm.plan}
                  onChange={(e) => setTenantForm({ ...tenantForm, plan: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                >
                  <option value="starter">Starter (Boshlang'ich)</option>
                  <option value="pro">Pro (Professional)</option>
                  <option value="enterprise">Enterprise (Katta korporativ)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditTenantModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={tenantSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'var(--gold)', color: '#000' }}
                >
                  {tenantSubmitting && <RefreshCw size={13} className="animate-spin" />}
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: TOGGLE STATUS (CONFIRMATION) ── */}
      {showToggleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md p-6 rounded-2xl relative space-y-4"
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-highlight)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: tenant.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                  color: tenant.is_active ? '#f87171' : '#4ade80',
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {tenant.is_active ? 'Markazni bloklashni xohlaysizmi?' : 'Markazni faollashtirishni xohlaysizmi?'}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {tenant.name} ({tenant.schema_name})
                </p>
              </div>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {tenant.is_active
                ? 'Bloklangan markaz xodimlari va o\'quvchilari tizimga kira olmaydi (403 xatosi beriladi). Ma\'lumotlar o\'chirilmaydi.'
                : 'Markaz qayta faollashtirilgach barcha xodimlar va foydalanuvchilar o\'z kabinetiga odatdagidek kira oladi.'}
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Sabab (ixtiyoriy)
              </label>
              <input
                type="text"
                value={toggleReason}
                onChange={(e) => setToggleReason(e.target.value)}
                placeholder="Masalan: To'lov kechikkani sababli..."
                className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowToggleModal(false); setToggleReason(''); }}
                className="px-4 py-2 rounded-xl text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={toggleSubmitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                style={{
                  background: tenant.is_active ? '#ef4444' : '#22c55e',
                  color: '#fff',
                }}
              >
                {toggleSubmitting && <RefreshCw size={13} className="animate-spin" />}
                Tasdiqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
