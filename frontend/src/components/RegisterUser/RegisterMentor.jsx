import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import GoBackButton from "../sendback";
import { AlertCircle, Loader2, Building2, User, Hash, Phone, Book, Key, UserPlus, Eye, EyeOff } from "lucide-react";
import { useCurrentBranch } from "../Authorized/useBranchId";
import { get_user_info } from "../Authorized/getRole";

export default function MentorRegister() {
    const navigate = useNavigate();
    const { currentBranchId, currentBranchName, isLoading: branchLoading } = useCurrentBranch();
    const { branchId } = useOutletContext()
    const [form, setForm] = useState({
        username: "",
        first_name: "",
        last_name: "",
        subject: "",
        phone_number: "",
        role: "mentor",
        branch_id: null, // Boshida bo'sh
        password: ""
    });
    const user_info = get_user_info()
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const { data: userData = {} } = useQuery({
        queryKey: ['user-me'],
        queryFn: () => api.get('/user/me/').then(res => res.data),
        staleTime: Infinity,
    });

    const perms = userData.permissions || {};
    const isSuperAdmin = user_info?.role === "super_admin";

    useEffect(() => {
        if (userData.id && perms.teachers === false && !isSuperAdmin) {
            toast.error("Sizda mentor qo'shish ruxsati yo'q!");
            navigate(-1);
        }
    }, [userData.id, perms.teachers, isSuperAdmin, navigate]);

    // Filial yuklanganda yoki o'zgarganda formni yangilaymiz
    useEffect(() => {
        if (currentBranchId) {
            setForm(prev => ({
                ...prev,
                branch_id: currentBranchId
            }));
        }
    }, [currentBranchId]);

    function handleChange(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError("");

        const payload = user_info.role === 'super_admin'
            ? { ...form, branch_id: branchId }
            : { ...form, branch_id: currentBranchId };

        try {
            const res = await api.post("/register/users/", payload);
            toast.success("Yangi Mentor muvaffaqiyatli qo'shildi");
            navigate(-1);
        } catch (err) {
            console.error("Xatolik tafsiloti:", err.response?.data);
            const backendError = err.response?.data;
            
            if (backendError && typeof backendError === 'object' && !Array.isArray(backendError)) {
                Object.entries(backendError).forEach(([key, value]) => {
                    const errMsg = Array.isArray(value) ? value[0] : value;
                    // Format error key slightly better if needed, but direct key is fine too
                    const formattedKey = key.replace('_', ' ').toUpperCase();
                    toast.error(`${formattedKey}: ${errMsg}`);
                });
            } else {
                toast.error("Mentor qo'shishda xatolik yuz berdi.");
            }
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[var(--bg-void)] flex items-start justify-center pt-8 pb-12 px-4 relative overflow-hidden">

            {/* Decorative Background Orbs */}
            <div className="fixed top-[-10%] right-[-5%] w-[400px] h-[400px] bg-[var(--gold)]/5 blur-[100px] rounded-full pointer-events-none z-0"></div>
            <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none z-0"></div>

            <div className="w-full max-w-xl relative z-10">
                <div className="bg-[var(--bg-panel)]/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">

                    {/* HEADER */}
                    <div className="w-full py-6 border-b border-white/5 flex justify-between items-center px-8 md:px-10">
                        <div className="flex items-center gap-5">
                            <GoBackButton />
                            <div className="w-1 h-8 bg-[var(--gold)] rounded-full shadow-[0_0_15px_rgba(212,175,55,0.4)]"></div>
                            <div>
                                <h1 className="text-xl font-black text-[var(--text-primary)] leading-none capitalize tracking-tighter">
                                    Mentor <br /> <span className="text-[var(--text-secondary)] font-medium not-italic opacity-40 text-sm">Qo'shish</span>
                                </h1>
                            </div>
                        </div>
                        <div className="text-right hidden sm:block">
                            <p className="text-[9px] text-[var(--gold)] font-black capitalize tracking-[0.2em] opacity-80 mb-1">
                                Joriy Filial
                            </p>
                            <div className="flex items-center justify-end gap-2 text-[var(--text-primary)] font-bold text-xs capitalize">
                                <Building2 size={12} className="text-[var(--gold)]" />
                                {branchLoading ? "..." : currentBranchName}
                            </div>
                        </div>
                    </div>

                    {/* FORM */}
                    <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-8">
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 mb-4">
                                <h2 className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-[0.4em] opacity-40">
                                    Asosiy Ma'lumotlar
                                </h2>
                                <div className="h-px flex-1 bg-white/5"></div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
                                    <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Ism</label>
                                    <div className="lux-input-group">
                                        <User size={16} />
                                        <input onChange={handleChange} name="first_name" type="text" placeholder="Masalan: Ali" className="lux-input !bg-transparent" required />
                                    </div>
                                </div>
                                <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
                                    <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Familiya</label>
                                    <div className="lux-input-group">
                                        <User size={16} />
                                        <input onChange={handleChange} name="last_name" type="text" placeholder="Masalan: Valiyev" className="lux-input !bg-transparent" required />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
                                    <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Username (Login)</label>
                                    <div className="lux-input-group">
                                        <Hash size={16} />
                                        <input onChange={handleChange} name="username" type="text" placeholder="ali_mentor" className="lux-input !bg-transparent" required />
                                    </div>
                                </div>
                                <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
                                    <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Telefon raqami</label>
                                    <div className="lux-input-group">
                                        <Phone size={16} />
                                        <input onChange={handleChange} name="phone_number" type="tel" placeholder="+998" className="lux-input !bg-transparent" required />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
                                <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Yo‘nalish (Subject)</label>
                                <div className="lux-input-group">
                                    <Book size={16} />
                                    <input onChange={handleChange} name="subject" type="text" placeholder="Frontend Dasturlash, Ingliz tili va h.k." className="lux-input !bg-transparent" required />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4 mb-4">
                                <h2 className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-[0.4em] opacity-40">
                                    Xavfsizlik
                                </h2>
                                <div className="h-px flex-1 bg-white/5"></div>
                            </div>

                            <div className="space-y-1.5 focus-within:translate-x-1 transition-transform duration-300">
                                <label className="text-[10px] font-black text-[var(--text-secondary)] capitalize tracking-widest ml-1 opacity-60">Parol</label>
                                <div className="relative flex items-center w-full group/pass">
                                    <div className="absolute left-4 pointer-events-none text-[var(--gold)] opacity-50 z-10 transition-all group-focus-within/pass:opacity-100 group-focus-within/pass:scale-110">
                                        <Key size={16} />
                                    </div>
                                    <input
                                        onChange={handleChange}
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        className="w-full h-[52px] bg-transparent border border-[var(--border-glass)] rounded-2xl pl-[48px] pr-12 text-[14px] text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--gold)] focus:shadow-[0_0_15px_rgba(212,175,55,0.1)] transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 z-20 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors cursor-pointer p-2 flex items-center justify-center"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || branchLoading}
                            className="w-full py-4 bg-[var(--gold)] hover:bg-[var(--gold)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black text-[11px] font-black capitalize tracking-[0.2em] rounded-[1.5rem] transition-all shadow-xl shadow-[var(--gold)]/20 flex items-center justify-center gap-3 mt-6 active:scale-95"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : (
                                <>
                                    <UserPlus size={18} /> Ro‘yxatdan o‘tkazish
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}