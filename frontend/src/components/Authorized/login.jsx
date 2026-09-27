import { useEffect, useState } from "react";
import api from "../../tokenUpdater/updater";
import { useNavigate, Link } from "react-router-dom";
import { get_user_info } from "./getRole";
import { jwtDecode } from "jwt-decode";
import LoginError from "../Errors/LoginError";
import ThemeToggle from "../ThemeToggle";
import { User, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Building2, Globe, ChevronLeft } from "lucide-react";
import { extractSubdomain } from "../../utils/subdomain";

export default function Login() {
  const user_info = get_user_info();
  const navigate = useNavigate();

  useEffect(() => {
    if (user_info) {
      navigate(`/${user_info.role}`);
    }
  }, [user_info, navigate]);

  const [subdomain, setSubdomain] = useState(() => extractSubdomain());
  const [workspaceInput, setWorkspaceInput] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
  });

  // Agar subdomen mavjud bo'lsa, uning haqiqiyligini tekshirib nomini olish
  useEffect(() => {
    const activeSub = extractSubdomain();
    if (activeSub) {
      setSubdomain(activeSub);
      // Subdomen ma'lumotini tekshirish
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.endsWith(".localhost");
      const resolveUrl = isLocal
        ? `http://127.0.0.1:8000/api/v1/public/tenants/resolve/?subdomain=${activeSub}`
        : `/api/v1/public/tenants/resolve/?subdomain=${activeSub}`;

      fetch(resolveUrl)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && data.exists) {
            setWorkspaceName(data.name);
            localStorage.setItem("tenant_schema", data.schema_name);
            localStorage.setItem("tenant_name", data.name);
          } else {
            setError(`'${activeSub}' subdomenli o'quv markaz topilmadi.`);
          }
        })
        .catch(() => {});
    }
  }, []);

  function handlechange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  // 1. Subdomen kiritilganda uni tekshirib yo'naltirish
  async function handleWorkspaceSubmit(e) {
    e.preventDefault();
    const cleanSub = workspaceInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!cleanSub) return;

    setWorkspaceLoading(true);
    setError("");

    try {
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.endsWith(".localhost");
      const resolveUrl = isLocal
        ? `http://127.0.0.1:8000/api/v1/public/tenants/resolve/?subdomain=${cleanSub}`
        : `/api/v1/public/tenants/resolve/?subdomain=${cleanSub}`;

      const res = await fetch(resolveUrl);
      const data = await res.json();

      if (!res.ok || !data.exists) {
        setError(data.error || `'${cleanSub}' nomli o'quv markaz topilmadi.`);
        return;
      }

      setWorkspaceName(data.name);
      localStorage.setItem("tenant_schema", data.schema_name);
      localStorage.setItem("tenant_name", data.name);

      // Agar localhost muhitida bo'lsa, subdomenga to'g'ridan-to'g'ri o'tamiz
      const port = window.location.port ? `:${window.location.port}` : "";
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        // Avval subdomen.localhost ni ochishga urinib ko'rish
        window.location.href = `http://${cleanSub}.localhost${port}/login`;
      } else {
        setSubdomain(cleanSub);
      }
    } catch {
      // Agar tarmoq xatosi bo'lsa, query param orqali shu joyning o'zida aktivlashtiramiz
      setSubdomain(cleanSub);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  // 2. Markaz portali ichida login qilish
  async function handlesubmit(e) {
    e.preventDefault();
    setLoginLoading(true);
    setError("");

    try {
      const headers = {};
      if (subdomain) {
        headers["X-Tenant-Domain"] = `${subdomain}.localhost`;
        headers["X-Tenant-Subdomain"] = subdomain;
      }

      const res = await api.post("/login/", form, { headers });
      localStorage.setItem("access_token", res.data.access);
      localStorage.setItem("refresh_token", res.data.refresh);
      if (res.data.tenant?.schema_name) {
        localStorage.setItem("tenant_schema", res.data.tenant.schema_name);
      }
      if (res.data.tenant?.name) {
        localStorage.setItem("tenant_name", res.data.tenant.name);
      }

      const access = res.data.access;
      const payload = jwtDecode(access);

      let role = payload.role;
      if (payload.is_superuser) {
        role = "super_admin";
      }

      if (role === "admin") {
        navigate("/admin");
      } else if (role === "mentor") {
        navigate("/mentor");
      } else if (role === "super_admin") {
        navigate("/super_admin");
      }
    } catch (errorr) {
      const msg = errorr.response?.data?.error || errorr.response?.data?.detail;
      setError(
        msg ||
        (errorr.response?.status === 401
          ? "Parol yoki login noto'g'ri"
          : errorr.response?.status === 404
          ? "Ushbu markaz domeni topilmadi"
          : "Server bilan xatolik, iltimos keyinroq urinib ko'ring")
      );
      setTimeout(() => setError(""), 5000);
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-void)] flex flex-col items-center justify-center px-4 font-sans relative overflow-hidden">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none opacity-50">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[var(--gold)]/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[var(--gold)]/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-[440px] relative z-10 space-y-8">
        {/* Diamond Logo Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative group">
            <div className="absolute -inset-4 bg-[var(--gold)]/20 rounded-full blur-2xl group-hover:bg-[var(--gold)]/30 transition-all duration-700"></div>
            <div className="relative w-20 h-20 flex items-center justify-center rounded-[20px] transition-all duration-500">
              <img
                src="/YNlogo_without_word.png"
                alt="Logo"
                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(184,134,11,0.5)]"
              />
            </div>
          </div>
          <div className="text-center space-y-0.5">
            <h1 className="text-3xl font-serif tracking-[0.05em] text-[var(--text-primary)] capitalize">
              Yaxshi Niyat
            </h1>
            <p className="text-[10px] text-[var(--gold)] font-bold capitalize tracking-[0.4em] opacity-80">
              EDUCATION SAAS
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="lux-card !p-8 md:!p-10 !bg-[var(--bg-panel)]/40 backdrop-blur-3xl border-[var(--border-glass)]">
          {error && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <LoginError loginErr={error} />
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              HOLAT 1: FOYDALANUVCHI SUBDOMENDA (e.g. najot.localhost:5173)
              YOKI SUBDOMEN ANIKLANGAN HOLATDA
              ════════════════════════════════════════════════════════════════════ */}
          {subdomain ? (
            <div className="space-y-6">
              {/* Workspace Header */}
              <div className="text-center pb-2 border-b border-[var(--border-glass)] space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold"
                  style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold)' }}>
                  <Globe size={13} />
                  <span>{subdomain}.localhost</span>
                </div>
                {workspaceName && (
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {workspaceName}
                  </h3>
                )}
                <p className="text-xs text-[var(--text-muted)]">
                  O'quv markazining boshqaruv tizimiga kirish
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handlesubmit} className="space-y-5">
                <div className="space-y-3.5">
                  <div className="relative group/input">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within/input:text-[var(--gold)] transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      required
                      onChange={handlechange}
                      type="text"
                      name="username"
                      placeholder="Username yoki Email"
                      className="lux-input !pl-14 !py-3.5 group-focus-within/input:!border-[var(--gold)] transition-all text-xs"
                    />
                  </div>

                  <div className="relative group/input">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within/input:text-[var(--gold)] transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      required
                      onChange={handlechange}
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Parol"
                      className="lux-input !pl-14 !pr-14 !py-3.5 group-focus-within/input:!border-[var(--gold)] transition-all text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="lux-btn lux-btn-primary w-full !py-3.5 group shadow-[0_0_20px_rgba(184,134,11,0.2)] disabled:opacity-50"
                >
                  <span className="text-[12px] font-black tracking-[0.2em]">
                    {loginLoading ? "TEKSHIRILMOQDA..." : "ACCESS SYSTEM"}
                  </span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </form>

              {/* Boshqa subdomenga o'tish */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setSubdomain("");
                    setWorkspaceName("");
                    localStorage.removeItem("tenant_schema");
                    localStorage.removeItem("tenant_name");
                    // Root login sahifasiga qaytish
                    const port = window.location.port ? `:${window.location.port}` : "";
                    window.location.href = `http://localhost${port}/login`;
                  }}
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors"
                >
                  <ChevronLeft size={14} />
                  Boshqa o'quv markaz subdomenini kiritish
                </button>
              </div>
            </div>
          ) : (
            /* ════════════════════════════════════════════════════════════════════
               HOLAT 2: ASOSIY DOMENDA (SUBDOMEN YO'Q) — SLACK/JIRA USLUBI
               FOYDALANUVCHIDAN WORKSPACE SUBDOMENINI SO'RAYMIZ
               ════════════════════════════════════════════════════════════════════ */
            <div className="space-y-6">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
                  style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold)' }}>
                  <Building2 size={24} />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  O'quv markaz portaliga kiring
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Tizimga kirish uchun markazingizning subdomen nomini kiriting
                </p>
              </div>

              <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--gold)] uppercase tracking-wider block ml-1">
                    Markaz subdomeni
                  </label>
                  <div className="flex items-center rounded-xl overflow-hidden"
                    style={{ background: 'var(--bg-void)', border: '1px solid var(--border-glass)' }}>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={workspaceInput}
                      onChange={(e) => setWorkspaceInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      placeholder="masalan: najot"
                      className="flex-1 bg-transparent px-4 py-3.5 text-xs font-mono font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/50"
                    />
                    <span className="px-3.5 py-3.5 text-xs font-mono font-bold shrink-0"
                      style={{ background: 'rgba(184, 134, 11, 0.1)', color: 'var(--gold)' }}>
                      .localhost:5173
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={workspaceLoading || !workspaceInput.trim()}
                  className="lux-btn lux-btn-primary w-full !py-3.5 font-bold text-xs tracking-wider disabled:opacity-40"
                >
                  {workspaceLoading ? "TEKSHIRILMOQDA..." : "DAVOM ETISH →"}
                </button>
              </form>

              <div className="pt-2 text-center border-t border-[var(--border-glass)]">
                <Link
                  to="/ceo/login"
                  className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors"
                >
                  Platforma boshqaruvi (CEO Panel) →
                </Link>
              </div>
            </div>
          )}

          {/* Footer security */}
          <div className="mt-6 flex items-center justify-between border-t border-[var(--border-glass)] pt-5 opacity-60 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest">
              <ShieldCheck size={13} className="text-[var(--gold)]" />
              <span>Multi-Tenant Isolated</span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* System Footer */}
        <p className="text-center text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-[0.3em] opacity-40">
          version 4.2.0 • multi-tenant architecture
        </p>
      </div>
    </div>
  );
}
