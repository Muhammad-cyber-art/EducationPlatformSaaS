import React, { useEffect } from 'react';
import { X, Save, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';

const EditProfileModal = ({ isOpen, onClose, user, onSave, isPending }) => {
  const { register, handleSubmit, reset } = useForm();
  const [showPassword, setShowPassword] = React.useState(false);

  useEffect(() => {
    if (user && isOpen) {
      reset({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone_number: user.phone_number || '',
        username: user.username || '',
        password: '', // parolni har doim bosh kiritish uchun qoldiramiz
      });
    }
  }, [user, isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = (data) => {
    // Agar parol bo'sh bo'lsa uni yubormaymiz, faqat o'zgargan maydonlarni yuboramiz
    const payload = { ...data };
    if (!payload.password) {
      delete payload.password;
    }
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-lux-fade">
      <div className="bg-[var(--bg-void)] border border-[var(--border-glass)] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-glass)]">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Profilni tahrirlash</h2>
          <button onClick={onClose} className="p-2 bg-[var(--bg-panel)] rounded-xl hover:bg-red-500/10 hover:text-red-500 text-[var(--text-secondary)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Ism</label>
              <input
                type="text"
                {...register('first_name', { required: "Ism kiritilishi shart" })}
                className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:border-[var(--gold)] focus:outline-none transition-colors"
                placeholder="Ismingiz..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Familya</label>
              <input
                type="text"
                {...register('last_name', { required: "Familya kiritilishi shart" })}
                className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:border-[var(--gold)] focus:outline-none transition-colors"
                placeholder="Familyangiz..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Telefon raqam</label>
            <input
              type="text"
              {...register('phone_number', { required: "Telefon raqam kiritilishi shart" })}
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:border-[var(--gold)] focus:outline-none transition-colors"
              placeholder="+998901234567"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Username</label>
            <input
              type="text"
              {...register('username', { required: "Username kiritilishi shart" })}
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:border-[var(--gold)] focus:outline-none transition-colors"
              placeholder="admin123"
            />
          </div>

          <div className="space-y-1.5 relative">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Yangi Parol (ixtiyoriy)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                className="w-full bg-[var(--bg-panel)] border border-[var(--border-glass)] text-[var(--text-primary)] rounded-xl px-4 py-2.5 text-sm focus:border-[var(--gold)] focus:outline-none transition-colors pr-10"
                placeholder="Parolni o'zgartirish uchun kiriting..."
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">Agar parolni o'zgartirmasangiz, bo'sh qoldiring.</p>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[var(--border-glass)] mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-panel)] transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black rounded-xl text-sm font-bold flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
            >
              {isPending ? 'Saqlanmoqda...' : <><Save size={18} /> Saqlash</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
