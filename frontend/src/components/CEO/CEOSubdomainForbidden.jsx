import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft, ExternalLink, Building2, Lock } from "lucide-react";
import { extractSubdomain, getRootPlatformUrl } from "../../utils/subdomain";

export default function CEOSubdomainForbidden() {
  const subdomain = extractSubdomain();
  const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
  const rootCeoUrl = getRootPlatformUrl("/ceo/login");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 50% 20%, #171111 0%, #0a0808 60%, #050404 100%)",
        color: "var(--text-primary, #f1f5f9)",
      }}
    >
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, #ef4444 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-lg z-10">
        {/* Main Card */}
        <div
          className="rounded-3xl p-8 sm:p-10 border border-red-500/20 backdrop-blur-2xl text-center shadow-2xl"
          style={{
            background: "rgba(18, 14, 14, 0.85)",
            boxShadow: "0 30px 60px -12px rgba(239, 68, 68, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          }}
        >
          {/* Icon Badge */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 bg-red-500/10 border border-red-500/30 text-red-400 shadow-inner">
            <ShieldAlert size={40} className="animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase mb-4 bg-red-500/15 border border-red-500/30 text-red-400">
            <Lock size={12} />
            Subdomen Cheklovi
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3 text-white">
            CEO Paneliga Kirish Cheklangan
          </h1>

          <p className="text-sm leading-relaxed text-slate-300/80 mb-6">
            Siz hozirda{" "}
            <span className="font-semibold text-white px-2 py-0.5 rounded bg-white/10 border border-white/10">
              {subdomain ? `${subdomain}` : currentHost}
            </span>{" "}
            subdomenidasiz. Xavfsizlik va ko'p ijarachilik (multi-tenant) arxitekturasi qoidalariga
            ko'ra, <strong>CEO Super Admin</strong> boshqaruv paneliga subdomen orqali kirish qat'iyan
            taqiqlanadi.
          </p>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] mb-8 text-xs text-slate-400 text-left space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Building2 size={14} className="text-amber-400" />
              Nima uchun bu sodir bo'ldi?
            </div>
            <p>
              Har bir o'quv markaz alohida ma'lumotlar bazasi (schema) va subdomenga ega. CEO paneli esa butun
              platformaning umumiy boshqaruvini amalga oshirgani sababli, faqat markaziy platforma domenidan
              ochiladi.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              to="/login"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 transition-all shadow-lg shadow-red-900/40 active:scale-[0.99]"
            >
              <ArrowLeft size={16} />
              O'quv markaz login sahifasiga qaytish
            </Link>

            <a
              href={rootCeoUrl}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl font-semibold text-sm text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-all"
            >
              <ExternalLink size={16} />
              Markaziy CEO paneliga o'tish (localhost)
            </a>
          </div>
        </div>

        {/* Security watermark */}
        <p className="text-center text-[10px] text-slate-500 font-mono tracking-widest mt-6 uppercase">
          Multi-Tenant Isolation Guard • 403 Forbidden
        </p>
      </div>
    </div>
  );
}
