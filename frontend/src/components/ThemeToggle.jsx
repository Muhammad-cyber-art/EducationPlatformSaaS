import React, { useEffect, useState } from'react';
import { Sun, Moon } from'lucide-react';

const ThemeToggle = () => {
 const [theme, setTheme] = useState(() => {
 return localStorage.getItem('theme') ||'dark';
 });

 useEffect(() => {
 const root = document.documentElement;
 if (theme ==='light') {
 root.setAttribute('data-theme','light');
 } else {
 root.removeAttribute('data-theme');
 }
 localStorage.setItem('theme', theme);
 }, [theme]);

 const toggleTheme = () => {
 setTheme(prev => prev ==='dark' ?'light' :'dark');
 };

 return (
 <button
 onClick={toggleTheme}
 className="p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-glass)] hover:border-[var(--gold)]/50 transition-all group"
 title={theme ==='dark' ?'Light Mode' :'Dark Mode'}
 >
 {theme ==='dark' ? (
 <Sun size={18} className="text-[var(--gold)] group-hover:rotate-180 transition-transform duration-500" />
 ) : (
 <Moon size={18} className="text-[var(--gold)] group-hover:-rotate-12 transition-transform duration-500" />
 )}
 </button>
 );
};

export default ThemeToggle;
