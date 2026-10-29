import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from 'react-router-dom';

export default function GoBackButton({ className = "" }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 shrink-0 rounded-xl bg-[var(--bg-void)] hover:bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-glass)] cursor-pointer transition-all active:scale-90 flex justify-center items-center group shadow-lg shadow-black/20 hover:border-[var(--gold-dim)] ${className}`}
      title="Orqaga"
    >
      <ArrowLeft size={18} className="sm:size-5 group-hover:-translate-x-0.5 transition-transform" />
    </button>
  );
}