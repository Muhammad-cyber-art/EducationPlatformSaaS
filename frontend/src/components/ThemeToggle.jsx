import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="w-9 h-9 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] hover:border-[var(--gold)]/50 transition-all group flex items-center justify-center cursor-pointer shadow-sm shrink-0"
      title={theme === 'dark' ? "Yorug' rejim (Light Mode)" : "Qorong'i rejim (Dark Mode)"}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun size={18} className="text-[var(--gold)] group-hover:rotate-180 transition-transform duration-500" />
      ) : (
        <Moon size={18} className="text-[var(--gold)] group-hover:-rotate-12 transition-transform duration-500" />
      )}
    </button>
  );
};

export default ThemeToggle;

