import React, { useState, useEffect } from 'react';
import { 
  X, CreditCard, Calendar, CheckCircle2, 
  AlertCircle, Phone, MapPin, User, FileText, Upload, 
  Layers, Clock, ArrowRight, DollarSign, Loader2, Sparkles, Receipt, Trash2 
} from 'lucide-react';
import api from '../../../tokenUpdater/updater';
import toast from 'react-hot-toast';
import AmountInput from '../../Common/AmountInput';

import { useQueryClient } from '@tanstack/react-query';
import { db, queueCashierPayment } from '../../../db/db';

export default function StudentDetailDrawer({
  isOpen,
  onClose,
  student,
  branchId,
  month,
  onPaymentSuccess,
  formatCurrency
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  
  // Payment Form States
  const [activePaymentGroupId, setActivePaymentGroupId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [isReceiptless, setIsReceiptless] = useState(true);
  const [receiptImage, setReceiptImage] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [cancelling, setCancelling] = useState(false);

  // Fetch student drill-down details when opened
  useEffect(() => {
    if (!isOpen || !student?.student_id) return;

    let isMounted = true;
    setLoading(true);
    setActivePaymentGroupId(student.group_id);

    const fallbackToLocal = async () => {
      const cacheKey = `cashier-student-detail_${student.student_id}_${student.group_id}_${month}`;
      try {
        const cached = await db.query_cache.get(cacheKey);
        if (cached?.data && isMounted) {
          setDetailData(cached.data);
          const targetGrp = cached.data.all_active_groups?.find(g => g.group_id === student.group_id);
          if (targetGrp) {
            setPayAmount(String(targetGrp.remaining_amount || ''));
          }
          return;
        }
      } catch (_) {}

      // Fallback 2: student prop dagi ma'lumotlar bilan drawer ni to'ldirish
      if (isMounted) {
        const syntheticDetail = {
          student: {
            id: student.student_id,
            full_name: student.student_name,
            phone: student.student_phone,
            parent_phone: student.parent_phone,
            status: student.status,
            status_display: student.status_display,
          },
          target_group: {
            id: student.group_id,
            name: student.group_name,
            monthly_price: student.expected_amount,
            remaining_amount: student.remaining_amount,
            paid_amount: student.paid_amount,
            is_paid: student.is_paid,
            payment_id: student.payment_id
          },
          all_active_groups: [
            {
              group_id: student.group_id,
              group_name: student.group_name,
              monthly_price: student.expected_amount,
              remaining_amount: student.remaining_amount,
              paid_amount: student.paid_amount,
              is_paid: student.is_paid,
              payment_id: student.payment_id
            },
            ...(student.other_groups || []).map(og => ({
              group_id: og.group_id,
              group_name: og.group_name,
              monthly_price: og.monthly_price,
              remaining_amount: og.monthly_price,
              paid_amount: 0,
              is_paid: false
            }))
          ]
        };
        setDetailData(syntheticDetail);
        setPayAmount(String(student.remaining_amount || student.expected_amount || ''));
      }
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      fallbackToLocal().finally(() => {
        if (isMounted) setLoading(false);
      });
      return () => { isMounted = false; };
    }

    api.get('/finance/student-payments/cashier-student-detail/', {
      params: {
        student_id: student.student_id,
        group_id: student.group_id,
        month: month
      }
    }).then(res => {
      if (isMounted) {
        setDetailData(res.data);
        db.query_cache.put({
          query_key: `cashier-student-detail_${student.student_id}_${student.group_id}_${month}`,
          data: res.data,
          updated_at: new Date().toISOString()
        }).catch(() => {});
        // Find target group payment to set initial pay amount
        const targetGrp = res.data.all_active_groups?.find(g => g.group_id === student.group_id);
        if (targetGrp) {
          setPayAmount(String(targetGrp.remaining_amount || ''));
        }
      }
    }).catch(err => {
      fallbackToLocal();
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => { isMounted = false; };
  }, [isOpen, student, month]);

  if (!isOpen || !student) return null;

  // Active group currently selected in drawer for payment
  const activeGroup = detailData?.all_active_groups?.find(g => g.group_id === activePaymentGroupId) || {
    group_id: student.group_id,
    group_name: student.group_name,
    monthly_price: student.expected_amount,
    remaining_amount: student.remaining_amount,
    paid_amount: student.paid_amount,
    is_paid: student.is_paid,
    payment_id: student.payment_id
  };

  const handleGroupSelectForPayment = (grp) => {
    setActivePaymentGroupId(grp.group_id);
    setPayAmount(String(grp.remaining_amount || grp.monthly_price || ''));
  };

  // Submit Payment (Online + Offline-First)
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(payAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error("To'lov summasi 0 dan katta bo'lishi kerak");
      return;
    }

    const effectiveBranchId = branchId || student.branch_id || activeGroup.branch_id;
    const targetMonthlyPrice = Number(activeGroup.monthly_price || activeGroup.expected_amount || 0);
    const isPayingFull = targetMonthlyPrice > 0 && amountVal >= targetMonthlyPrice;

    const paymentPayload = {
      branch_id: effectiveBranchId,
      student_id: student.student_id,
      group_id: activeGroup.group_id,
      payment_id: activeGroup.payment_id || null,
      month: month ? `${month}-01` : '',
      amount: amountVal,
      payment_method: payMethod,
      method: payMethod,
      pay_full_month: isPayingFull,
      ignore_refund: isPayingFull,
      is_full_amount: isPayingFull,
      is_partial_payment: !isPayingFull,
      is_receiptless: true,
      notes: notes.trim(),
    };

    // OFFLAYN REJIM: Tarmoq yo'q bo'lsa darhol lokal bazaga yozamiz
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        setSubmitting(true);
        await queueCashierPayment(paymentPayload, queryClient);
        toast.success("To'lov oflayn qabul qilindi! Internet paydo bo'lganda serverga yuboriladi.", {
          icon: '💾',
          duration: 4000
        });
        onPaymentSuccess();
        onClose();
      } catch (err) {
        toast.error("Oflayn to'lovni saqlashda xatolik");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ONLAYN: Serverga yuborish
    try {
      setSubmitting(true);
      const formData = new FormData();
      if (activeGroup.payment_id) {
        formData.append('payment_id', activeGroup.payment_id);
      }
      formData.append('student_id', student.student_id);
      formData.append('group_id', activeGroup.group_id);
      formData.append('month', month ? `${month}-01` : '');
      formData.append('amount', amountVal);
      formData.append('payment_method', payMethod);
      formData.append('method', payMethod);

      if (isPayingFull) {
        formData.append('pay_full_month', 'true');
        formData.append('ignore_refund', 'true');
        formData.append('is_full_amount', 'true');
      } else if (targetMonthlyPrice > 0 && amountVal < targetMonthlyPrice) {
        formData.append('is_partial_payment', 'true');
      }

      const effectiveReceiptless = receiptImage ? false : isReceiptless;
      formData.append('is_receiptless', effectiveReceiptless ? 'true' : 'false');
      formData.append('notes', notes.trim());
      if (receiptImage && !effectiveReceiptless) {
        formData.append('receipt_image', receiptImage);
        formData.append('receipt', receiptImage);
      }

      const res = await api.post('/finance/student-payments/cashier-pay/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(res.data?.message || "To'lov muvaffaqiyatli qabul qilindi!");
      onPaymentSuccess();
      onClose();
    } catch (err) {
      const isNetworkErr = !err.response || err.code === 'ERR_NETWORK' || err.isOffline;
      if (isNetworkErr) {
        // Tarmoq kutilmaganda uzilib qolsa — oflayn qabul qilish
        await queueCashierPayment(paymentPayload, queryClient);
        toast.success("Tarmoq uzildi. To'lov oflayn saqlandi va internet tiklanganda serverga yuboriladi.", {
          icon: '💾',
          duration: 4000
        });
        onPaymentSuccess();
        onClose();
      } else {
        console.error(err);
        toast.error(err.response?.data?.detail || err.response?.data?.error || "To'lovni qabul qilishda xatolik yuz berdi");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Payment completely
  const handleCancelPayment = async () => {
    if (!activeGroup?.payment_id) {
      toast.error("Bekor qilish uchun to'lov topilmadi");
      return;
    }
    const studentName = student.student_name || "o'quvchi";
    const confirmCancel = window.confirm(
      `Rostdan ham ${studentName} ning to'lovini bekor qilmoqchimisiz?\n\nTo'lov to'liq bekor qilinadi va Super Admin hamda filial kassasida to'lov o'chiriladi.`
    );
    if (!confirmCancel) return;

    try {
      setCancelling(true);
      await api.delete(`/finance/student-payments/${activeGroup.payment_id}/`);
      toast.success("To'lov muvaffaqiyatli bekor qilindi!");
      onPaymentSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "To'lovni bekor qilishda xatolik yuz berdi");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[var(--bg-panel)] border-l border-[var(--border-glass)] h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-glass)] bg-[var(--bg-void)]/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] font-bold">
              {student.student_name ? student.student_name.charAt(0).toUpperCase() : 'O'}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[var(--text-primary)] truncate max-w-xs sm:max-w-md">
                {student.student_name}
              </h3>
              <p className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                <span>{student.student_phone || "Telefon kiritilmagan"}</span>
                {student.parent_phone && <span>· Ota-onasi: {student.parent_phone}</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--border-glass)]/30 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 scrollbar-thin scrollbar-thumb-[var(--border-glass)]">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[var(--gold)]">
              <Loader2 size={32} className="animate-spin" />
            </div>
          ) : (
            <>
              {/* SECTION 1: Multi-Group Accounting (Barcha Guruhlari) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Layers size={14} className="text-[var(--gold)]" />
                    <span>O'quvchining Faol Guruhlari (Multi-Group)</span>
                  </h4>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {detailData?.all_active_groups?.length || 1} ta guruh
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {detailData?.all_active_groups?.map((grp) => {
                    const isSelectedForPay = activePaymentGroupId === grp.group_id;
                    const hasDebt = (grp.remaining_amount || 0) > 0;

                    return (
                      <div
                        key={grp.group_id}
                        onClick={() => handleGroupSelectForPayment(grp)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelectedForPay
                            ? 'bg-[var(--gold)]/10 border-[var(--gold)]/60 shadow-md shadow-[var(--gold)]/5'
                            : 'bg-[var(--bg-void)] border-[var(--border-glass)] hover:border-[var(--gold)]/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <h5 className="text-xs font-bold text-[var(--text-primary)] truncate">{grp.group_name}</h5>
                          {grp.is_paid ? (
                            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5">
                              <CheckCircle2 size={11} /> To'langan
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-500 font-bold tabular-nums">
                              -{formatCurrency(grp.remaining_amount)}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-[var(--text-muted)] truncate">
                          {grp.mentor_name} · {grp.branch_name || ""}
                        </p>

                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--border-glass)] text-[10px]">
                          <span className="text-[var(--text-secondary)]">Oylik narx:</span>
                          <span className="text-[var(--text-primary)] font-semibold">{formatCurrency(grp.monthly_price)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: Attendance Summary */}
              {detailData?.attendance && (
                <div className="p-3.5 bg-[var(--bg-void)]/60 border border-[var(--border-glass)] rounded-xl">
                  <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)] mb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} className="text-[var(--gold)]" />
                      Davomat Xulosasi ({activeGroup.group_name})
                    </span>
                    <span className="text-[11px] text-emerald-500 font-semibold">
                      {detailData.attendance.passed_lessons > 0 
                        ? Math.round((detailData.attendance.present_count / detailData.attendance.passed_lessons) * 100) + "% qatnashish"
                        : "Darslar boshlanmagan"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-[var(--bg-panel)] rounded-lg border border-[var(--border-glass)]">
                      <p className="text-[10px] text-[var(--text-muted)]">O'tilgan dars</p>
                      <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{detailData.attendance.passed_lessons}</p>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-500">
                      <p className="text-[10px] opacity-80">Kelgan</p>
                      <p className="text-sm font-bold mt-0.5">{detailData.attendance.present_count}</p>
                    </div>
                    <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20 text-rose-500">
                      <p className="text-[10px] opacity-80">Qoldirgan</p>
                      <p className="text-sm font-bold mt-0.5">{detailData.attendance.absences}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: Point-of-Sale Payment Form */}
              <div className="p-4 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-2xl shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-[var(--gold)]" />
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">
                      Tezkor To'lov Qabul Qilish: <span className="text-[var(--gold)]">{activeGroup.group_name}</span>
                    </h4>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">
                    Qarz: <strong className="text-rose-500">{formatCurrency(activeGroup.remaining_amount || 0)}</strong>
                  </span>
                </div>

                <form onSubmit={handlePaymentSubmit} className="space-y-3.5">
                  {/* Amount Input with quick presets */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      To'lov Summasi (UZS) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gold)] z-10 pointer-events-none" />
                      <AmountInput
                        required
                        placeholder="Summani kiriting..."
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full pl-9 pr-14 py-2 text-sm font-bold bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)]"
                      />
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setPayAmount(String(activeGroup.remaining_amount || ''))}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 hover:bg-[var(--gold)]/20 transition-colors"
                      >
                        Qolgan qarz ({formatCurrency(activeGroup.remaining_amount || 0)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayAmount(String(activeGroup.monthly_price || ''))}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--bg-panel)] text-[var(--text-secondary)] border border-[var(--border-glass)] hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-colors"
                      >
                        To'liq oylik ({formatCurrency(activeGroup.monthly_price || 0)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayAmount(String(Math.round((activeGroup.monthly_price || 0) / 2)))}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--bg-panel)] text-[var(--text-secondary)] border border-[var(--border-glass)] hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] hover:border-[var(--gold)]/30 transition-colors"
                      >
                        50%
                      </button>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      To'lov Usuli
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'cash', label: 'Naqd' },
                        { id: 'click', label: 'Click/Karta' },
                        { id: 'payme', label: 'Payme' },
                        { id: 'other', label: 'Boshqa' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setPayMethod(m.id);
                            if (m.id === 'click' || m.id === 'payme') {
                              setIsReceiptless(false);
                            } else if (m.id === 'cash') {
                              setIsReceiptless(true);
                              setReceiptImage(null);
                            }
                          }}
                          className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all ${
                            payMethod === m.id
                              ? 'bg-[var(--gold)] text-white shadow-md'
                              : 'bg-[var(--bg-panel)] text-[var(--text-secondary)] border border-[var(--border-glass)] hover:text-[var(--text-primary)] hover:border-[var(--gold)]/40'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Receiptless toggle & Notes */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={isReceiptless}
                        onChange={(e) => setIsReceiptless(e.target.checked)}
                        className="w-4 h-4 rounded text-[var(--gold)] focus:ring-0 bg-[var(--bg-panel)] border-[var(--border-glass)]"
                      />
                      <span>Cheksiz to'lov (kvitansiyasiz)</span>
                    </label>

                    {!isReceiptless && (
                      <label className="text-xs text-[var(--gold)] hover:underline cursor-pointer flex items-center gap-1">
                        <Upload size={12} />
                        <span>Chek yuklash</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setReceiptImage(e.target.files[0])}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {receiptImage && !isReceiptless && (
                    <div className="flex items-center justify-between text-[11px] text-emerald-500 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                      <span className="truncate">Chek tanlandi: {receiptImage.name}</span>
                      <button
                        type="button"
                        onClick={() => setReceiptImage(null)}
                        className="ml-2 text-rose-500 hover:text-rose-400 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div>
                    <input
                      type="text"
                      placeholder="Izoh (ixtiyoriy)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-[var(--bg-panel)] border border-[var(--border-glass)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-white font-black text-xs rounded-xl shadow-lg shadow-[var(--gold)]/10 active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                    <span>To'lovni Tasdiqlash va Kassaga Yozish</span>
                  </button>
                </form>
              </div>

              {/* Cancel Action */}
              {activeGroup.paid_amount > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleCancelPayment}
                    className="w-full py-2.5 px-4 btn-danger-action dark:bg-rose-500/10 dark:hover:bg-rose-600 dark:text-rose-400 dark:hover:text-white dark:border-rose-500/30 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm group cursor-pointer"
                    title="To'lovni butunlay bekor qilish va kassadan o'chirish"
                  >
                    {cancelling ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} className="shrink-0" />
                    )}
                    <span>To'lovni Bekor Qilish</span>
                  </button>
                </div>
              )}

              {/* SECTION 4: Recent Transactions History */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                  <Receipt size={14} className="text-[var(--gold)]" />
                  <span>Oxirgi Tranzaksiyalar Tarixi</span>
                </h4>

                {detailData?.transactions?.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] text-center py-4 bg-[var(--bg-void)] rounded-xl border border-[var(--border-glass)]">
                    Tranzaksiyalar mavjud emas
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {detailData?.transactions?.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-2.5 bg-[var(--bg-void)] border border-[var(--border-glass)] rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                            <span className={tx.transaction_type === 'income' ? 'text-emerald-500' : 'text-rose-500'}>
                              {tx.transaction_type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] font-normal">
                              ({tx.payment_method || "usul noma'lum"})
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {tx.date} · {tx.group_name || "Guruh"} · {tx.marked_by_name}
                          </p>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          tx.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border border-[var(--border-glass)]'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
