from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
import uuid

class Payment(models.Model):
    # O'quvchi va Guruh bilan bog'liqlik
    student = models.ForeignKey('groups.Student', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    # O'quvchi ma'lumotlarini saqlash (student o'chirilganda ham saqlanadi)
    student_full_name = models.CharField(max_length=200, blank=True, null=True)
    student_phone = models.CharField(max_length=20, blank=True, null=True)
    
    group = models.ForeignKey('groups.Group', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    # Guruh ma'lumotlarini saqlash (group o'chirilganda ham saqlanadi)
    group_name = models.CharField(max_length=200, blank=True, null=True)
    
    # Qaysi oy uchun to'lov (Masalan: 2025-12-01)
    month = models.DateField(null=True, blank=True)    
    
    # To'lov holati
    is_paid = models.BooleanField(default=False)
    
    # Refund (Qaytarib berish) ni bekor qilish opsiyasi
    refund_ignored = models.BooleanField(default=False, verbose_name="Refund bekor qilingan")

    # Guruhning o'sha paytdagi narxi (audit uchun muhim!)
    amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    paid_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="To'langan summa (jami)",
    )
    is_partial = models.BooleanField(default=False, verbose_name="Bo'lib to'langan")
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Refund miqdori")
    
    # Kim tomonidan va qachon tasdiqlandi
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='marked_student_payments',
        limit_choices_to={'role__in': ['admin', 'super_admin']}
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Payment Gateway dan keladigan ma'lumotlar
    transaction_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    payer_name = models.CharField(max_length=100, null=True, blank=True)
    payer_phone = models.CharField(max_length=20, null=True, blank=True)
    payer_card_mask = models.CharField(max_length=20, null=True, blank=True)
    
    # Yangi: To'lov turi va tasdiqlari
    PAYMENT_METHODS = [
        ('cash', 'Naqd'),
        ('click', 'Click / Card'),
        ('payme', 'Payme'),
        ('other', 'Boshqa'),
    ]
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHODS, default='cash')
    receipt_image = models.ImageField(upload_to='receipts/', null=True, blank=True)
    is_receiptless = models.BooleanField(default=False, verbose_name="Chek yo'q")
    is_full_amount = models.BooleanField(default=False, verbose_name="To'liq oylik to'langan")
    notes = models.TextField(blank=True, null=True)

    # TUZATILDI (BUG-STRING-FILTER): Avval StudentFinanceProfile.balance da
    # notes="Avtomatik imtiyozli to'lov" string literal bilan filter qilinardi.
    # Bu fragile yondashuv — notes matnini o'zgartirish barcha imtiyozli
    # invoicelarni qarzga aylantirishi mumkin edi.
    # Endi dedicated boolean field ishlatiladi.
    is_auto_discount = models.BooleanField(
        default=False,
        verbose_name="Imtiyozli (avtomatik) invoice",
        help_text=(
            "True bo'lsa, bu invoice discount o'quvchi uchun avtomatik "
            "yaratilgan va StudentFinanceProfile.balance hisobiga kiritilmaydi."
        )
    )

    # Super Admin tasdig'i (Verification)
    is_verified = models.BooleanField(default=False, verbose_name="Tasdiqlangan")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_student_payments'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-month']
        verbose_name = "O'quvchi to'lovi"
        verbose_name_plural = "O'quvchilar to'lovlari"

    def __str__(self):
        student_name = self.student_full_name or (self.student.full_name if self.student else "Unknown Student")
        group_name = self.group_name or (self.group.name if self.group else "Unknown Group")
        return f"{student_name} - {group_name} - {self.month.strftime('%B %Y') if self.month else 'No month'}"
    
    def save(self, *args, **kwargs):
        # O'quvchi va guruh ma'lumotlarini avtomatik tarzda saqlash
        if self.student:
            self.student_full_name = self.student.full_name
            self.student_phone = self.student.phone
        if self.group:
            self.group_name = self.group.name
        if self.month:
            from finance.utils import normalize_month
            self.month = normalize_month(self.month)
        super().save(*args, **kwargs)

    @property
    def remaining_amount(self):
        """Qolgan qarz summasi"""
        expected = Decimal(str(self.amount or 0))
        paid = Decimal(str(self.paid_amount or 0))
        return max(Decimal('0'), expected - paid)

    def apply_payment(
        self,
        admin_user,
        installment_amount,
        method='cash',
        receipt=None,
        notes=None,
        is_receiptless=False,
        is_full_amount=False,
        is_custom_amount=False,
    ):
        """
        To'lovni qabul qilish:
        1. Oddiy (to'liq/bo'lib)
        2. Custom (berilgan summani to'liq qabul qiladi va oylikni yopadi)
        Har bir qism uchun alohida FinanceTransaction yaratiladi.
        """
        from django.db import transaction as db_transaction
        from finance.models import FinanceTransaction

        if self.student and self.student.status == 'discount':
            raise ValueError("Imtiyozli (discount) o'quvchilardan qo'lda pul qabul qilib bo'lmaydi.")

        installment = Decimal(str(installment_amount))
        if installment <= 0:
            raise ValueError("To'lov summasi 0 dan katta bo'lishi kerak")

        with db_transaction.atomic():
            expected = Decimal(str(self.amount or 0))
            current_paid = Decimal(str(self.paid_amount or 0))

            if is_custom_amount:
                # Custom summa rejimi: berilgan summani to'liq qabul qiladi va oylikni yopadi
                self.paid_amount = current_paid + installment
                if not self.paid_at:
                    self.paid_at = timezone.now()
                self.marked_by = admin_user
                self.payment_method = method
                self.is_receiptless = is_receiptless
                self.is_full_amount = is_full_amount
                if receipt:
                    self.receipt_image = receipt
                if notes:
                    self.notes = notes
                self.is_paid = True
                self.is_partial = False
            else:
                # Oddiy rejim: expected dan oshmasin
                remaining = max(Decimal('0'), expected - current_paid)
                
                # BUG #3 FIX + BUG #7 FIX:
                # Agar allaqachon to'liq to'langan bo'lsa (remaining == 0),
                # installmentni 0 ga tushuramiz — ikkinchi marta yozmaymiz.
                if remaining > 0 and installment > remaining:
                    installment = remaining
                elif remaining == 0:
                    # To'liq to'langan — qo'shimcha tranzaksiya yaratmaymiz
                    installment = Decimal('0')

                self.paid_amount = current_paid + installment
                if not self.paid_at:
                    self.paid_at = timezone.now()
                self.marked_by = admin_user
                self.payment_method = method
                self.is_receiptless = is_receiptless
                self.is_full_amount = is_full_amount
                if receipt:
                    self.receipt_image = receipt
                if notes:
                    self.notes = notes

                # BUG #7 FIX: expected == 0 holat (hali dars yo'q, lekin to'ladi)
                # Bu holda pul qabul qilindi, lekin "to'liq to'landi" deb belgilab bo'lmaydi.
                # BUG #1 FIX (is_paid): is_full_amount=True bo'lganda to'g'ridan-to'g'ri is_paid=True.
                if is_full_amount and self.paid_amount > 0:
                    self.is_paid = True
                    self.is_partial = False
                elif expected == 0 and self.paid_amount > 0:
                    self.is_paid = False
                    self.is_partial = True
                elif expected > 0 and self.paid_amount >= expected:
                    self.is_paid = True
                    self.is_partial = False
                elif self.paid_amount > 0:
                    self.is_paid = False
                    self.is_partial = True
                else:
                    self.is_paid = False
                    self.is_partial = False

            self.save()

            # Faqat haqiqiy pul harakati bo'lsa tranzaksiya yaratamiz
            if installment > 0:
                payment_type_str = "To'liq" if self.is_full_amount else "Bo'lib" if self.is_partial else "Davomat"
                receiptless_str = "(Cheksiz)" if self.is_receiptless else ""
                notes_str = self.notes or ""

                # BUG-1 FIX: student yoki group None bo'lsa (SET_NULL holatida)
                # snapshot fieldlardan (student_full_name, group_name) foydalanamiz
                _student_name = (
                    self.student_full_name
                    or (self.student.full_name if self.student else "Noma'lum o'quvchi")
                )
                _group_name = (
                    self.group_name
                    or (self.group.name if self.group else "Noma'lum guruh")
                )
                _branch = (
                    (self.student.branch if self.student else None)
                    or (self.group.branch if self.group else None)
                )

                if _branch is None:
                    # Branch aniqlanmasa tranzaksiya yaratmaymiz — AttributeError dan saqlaymiz
                    import logging as _logging
                    _logging.getLogger(__name__).error(
                        "apply_payment: branch aniqlanmadi, tranzaksiya yaratilmadi. "
                        "Payment id=%s, student_full_name=%s",
                        self.id, _student_name
                    )
                else:
                    # KASSA LOGIKASI:
                    # Super Admin to'lovni o'zi qilsa — darhol tasdiqlanadi (is_verified=True).
                    # Filial admin (admin) to'lov kiritsa — kassa rejimida (is_verified=False),
                    # ya'ni o'quvchi qarzi yopiladi, lekin global balansga HALI qo'shilmaydi.
                    _user_role = getattr(admin_user, 'role', None)
                    _is_discount = (self.student.status == 'discount') if self.student else False
                    
                    # Barcha to'lovlar kassa orqali tasdiqlanishi shart (avtomat tasdiqlash o'chirildi)
                    _is_auto_verified = False
                    _verified_at = None

                    FinanceTransaction.objects.create(
                        related_id=f"STP-{self.id}-INS-{uuid.uuid4().hex[:12]}",
                        transaction_type='income',
                        category='student_fee',
                        status='completed',
                        record_type='payment',
                        amount=installment,
                        date=self.paid_at.date(),
                        marked_by=admin_user,
                        branch=_branch,
                        student=self.student,
                        group=self.group,
                        student_name=_student_name,
                        group_name=_group_name,
                        payment_method=self.payment_method,
                        title=_student_name,
                        description=(
                            f"{_group_name} ({payment_type_str}) "
                            f"{self.month.strftime('%Y-%m')} — {installment} UZS. "
                            f"Usul: {self.get_payment_method_display()}. "
                            f"{receiptless_str} {notes_str}"
                        ).strip(),
                        is_verified=_is_auto_verified,
                        verified_by=admin_user if _is_auto_verified else None,
                        verified_at=_verified_at,
                    )

        return self

    def mark_as_paid(self, admin_user, method='cash', receipt=None, notes=None, is_receiptless=False, is_full_amount=False):
        """Orqaga moslik: to'liq qolgan summani bir martada qabul qiladi.

        BUG #1 TUZATILDI: Oldingi versiyada allaqachon to'liq to'langan
        to'lovga qayta to'liq summa qo'shilishi mumkin edi (ikki marta kirim).
        Endi: remaining = expected - paid, agar remaining <= 0 — hech narsa qilinmaydi.
        """
        if self.is_paid:
            return self
        expected = Decimal(str(self.amount or 0))
        paid = Decimal(str(self.paid_amount or 0))
        # Faqat haqiqiy qolgan summani hisoblaymiz — eski noto'g'ri max() formulasi o'chirildi
        remaining = max(Decimal('0'), expected - paid)
        if remaining <= 0:
            # Allaqachon to'liq to'langan yoki amount=0 — ikkinchi marta yozmaymiz
            return self
        return self.apply_payment(
            admin_user,
            remaining,
            method=method,
            receipt=receipt,
            notes=notes,
            is_receiptless=is_receiptless,
            is_full_amount=is_full_amount,
        )
