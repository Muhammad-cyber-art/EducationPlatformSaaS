import axios from"axios";
import { useEffect, useState } from"react";
import api from"../../tokenUpdater/updater";
import { useNavigate } from"react-router-dom";
import { get_user_info } from"./getRole";
import { jwtDecode } from"jwt-decode";
import LoginError from"../Errors/LoginError";
import ThemeToggle from"../ThemeToggle";
import { User, Lock, ArrowRight, ShieldCheck, Eye, EyeOff } from"lucide-react";

export default function Login() {
 const user_info = get_user_info()
 const navigate = useNavigate();

 useEffect(() => {
 if (user_info) {
 navigate(`/${user_info.role}`)
 }
 }, [user_info, navigate])

 const [error, setError] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [form, setForm] = useState({
 username:"",
 password:"",
 });

 function handlechange(e) {
 setForm({
 ...form,
 [e.target.name]: e.target.value,
 });
 }

 async function handlesubmit(e) {
 e.preventDefault();
 try {
 const res = await api.post("/login/", form);
 localStorage.setItem("access_token", res.data.access);
 localStorage.setItem("refresh_token", res.data.refresh);
 setError("");
 const access = res.data.access;
 const payload = jwtDecode(access);

 let role = payload.role;
 if (payload.is_superuser) {
 role ="super_admin";
 }

 if (role ==="admin") {
 navigate("/admin");
 } else if (role ==="mentor") {
 navigate("/mentor");
 } else if (role ==="super_admin") {
 navigate('/super_admin');
 }
 } catch (errorr) {
 setError(errorr.response?.status === 401 ?"Server bilan xatolik, iltimos keyinroq urinib ko'ring" :"Siz ro'yxatdan o'tmagansiz yoki Parol / Login noto'g'ri");
 setTimeout(() => setError(""), 4000);
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
 <div className="flex flex-col items-center space-y-6">
 <div className="relative group">
 <div className="absolute -inset-4 bg-[var(--gold)]/20 rounded-full blur-2xl group-hover:bg-[var(--gold)]/30 transition-all duration-700"></div>
 <div className="relative w-24 h-24 flex items-center justify-center rounded-[24px] transition-all duration-500">
 <img src="/YNlogo_without_word.png" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(184,134,11,0.5)]" />
 </div>
 </div>
 <div className="text-center space-y-1">
 <h1 className="text-4xl font-serif tracking-[0.05em] text-[var(--text-primary)] capitalize">
 Yaxshi Niyat
 </h1>
 <p className="text-[10px] text-[var(--gold)] font-bold capitalize tracking-[0.5em] opacity-80">
 PLATFORM
 </p>
 </div>
 </div>

 {/* Login Form Card */}
 <div className="lux-card !p-8 md:!p-12 !bg-[var(--bg-panel)]/40 backdrop-blur-3xl border-[var(--border-glass)]">
 {error && (
 <div className="mb-8 animate-in fade-in slide-in-from-top-2 duration-400">
 <LoginError loginErr={error} />
 </div>
 )}

 <form onSubmit={handlesubmit} className="space-y-6">
 <div className="space-y-4">
 <div className="relative group/input">
 <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within/input:text-[var(--gold)] transition-colors">
 <User size={20} />
 </div>
 <input
 required
 onChange={handlechange}
 type="text"
 name="username"
 placeholder="Username"
 className="lux-input !pl-14 !py-4 group-focus-within/input:!border-[var(--gold)] transition-all"
 />
 </div>

 <div className="relative group/input">
 <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within/input:text-[var(--gold)] transition-colors">
 <Lock size={20} />
 </div>
 <input
 required
 onChange={handlechange}
 type={showPassword ?"text" :"password"}
 name="password"
 placeholder="Password"
 className="lux-input !pl-14 !pr-14 !py-4 group-focus-within/input:!border-[var(--gold)] transition-all"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors"
 >
 {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
 </button>
 </div>
 </div>

 <button
 type="submit"
 className="lux-btn lux-btn-primary w-full !py-4 group shadow-[0_0_20px_rgba(184,134,11,0.2)]"
 >
 <span className="text-[12px] font-black tracking-[0.2em]">ACCESS SYSTEM</span>
 <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
 </button>
 </form>

 <div className="mt-12 flex items-center justify-between border-t border-[var(--border-glass)] pt-8 opacity-60 hover:opacity-100 transition-opacity">
 <div className="flex items-center gap-2 text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-widest">
 <ShieldCheck size={14} className="text-[var(--gold)]" />
 <span>Diamond Secure</span>
 </div>
 <ThemeToggle />
 </div>
 </div>


 {/* System Footer */}
 <p className="text-center text-[9px] font-bold text-[var(--text-muted)] capitalize tracking-[0.3em] opacity-40">
 version 4.2.0 • build 1024
 </p>
 </div>
 </div>
 );
}
