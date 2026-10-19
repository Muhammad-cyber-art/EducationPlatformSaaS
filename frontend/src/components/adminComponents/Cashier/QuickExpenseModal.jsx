import React, { useState } from 'react';
import { X, TrendingDown, DollarSign, FileText, Calendar, Loader2 } from 'lucide-react';
import api from '../../../tokenUpdater/updater';
import toast from 'react-hot-toast';
import AmountInput from '../../Common/AmountInput';

import { useQueryClient } from '@tanstack/react-query';
import { queueAdminExpense } from '../../../db/db';

export default function QuickExpenseModal({ isOpen, onClose, branchId, onExpenseAdded }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !amount) {
      toast.error("Iltimos, harajat nomi va summasini kiriting");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Summa 0 dan katta bo'lishi kerak");
      return;
    }

    const payload = {
      title: title.trim(),
      amount: numAmount,
      description: description.trim(),
      date,
      branch: branchId
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        setSubmitting(true);
        await queueAdminExpense(payload, queryClient);
        toast.success("Chiqim oflayn saqlandi! Internet tiklanganda serverga yuboriladi.", {
          icon: '💾',
          duration: 4000
        });
        setTitle('');
        setAmount('');
        setDescription('');
        onExpenseAdded();
        onClose();
      } catch (_) {
        toast.error("Chiqimni saqlashda xatolik yuz berdi");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/finance/admin-expenses/', payload);
      toast.success("Kassadan chiqim muvaffaqiyatli saqlandi!");
      setTitle('');
      setAmount('');
      setDescription('');
      onExpenseAdded();
      onClose();
    } catch (err) {
      const isNetworkErr = !err.response || err.code === 'ERR_NETWORK' || err.isOffline;
      if (isNetworkErr) {
        await queueAdminExpense(payload, queryClient);
        toast.success("Tarmoq uzildi. Chiqim oflayn saqlandi va internet tiklanganda serverga yuboriladi.", {
          icon: '💾',
          duration: 4000
        });
        setTitle('');
        setAmount('');
        setDescription('');
        onExpenseAdded();
        onClose();
      } else {
        toast.error(err.response?.data?.detail || "Chiqim kiritishda xatolik yuz berdi");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-2xl shadow-2xl overflow-hidden p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--border-glass)]/30 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <TrendingDown size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Kassadan Chiqim Kiritish</h3>
            <p className="text-xs text-[var(--text-muted)]">Filial operatsion harajati (Kassa qoldig'idan ayiriladi)</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Harajat Nomi <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                required
                placeholder="Masalan: Kantselyariya, tozalash vositalari..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Summa (UZS) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-500 z-10 pointer-events-none" />
              <AmountInput
                required
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-14 py-2.5 text-sm font-semibold bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Sana
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Qo'shimcha izoh (ixtiyoriy)
            </label>
            <textarea
              rows="2"
              placeholder="Sabab yoki tafsilot..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 text-sm bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--border-glass)]/30 transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <TrendingDown size={16} />}
              Chiqimni tasdiqlash
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
