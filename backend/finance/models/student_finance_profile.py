from django.db import models
from decimal import Decimal
from django.db.models import Sum

class StudentFinanceProfile(models.Model):
    """
    O'quvchining moliyaviy holati va tarixiy statistikasi (Wallet).
    Faqat dinamik hisoblash uchun xizmat qiluvchi proxy profil (Ledger orqali).
    Hech qanday statik balans maydonlari yo'q!
    """
    student = models.OneToOneField(
        'groups.Student', 
        on_delete=models.CASCADE, 
        related_name='finance_profile',
        verbose_name="O'quvchi"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "O'quvchi Moliyaviy Profili (Wallet)"
        verbose_name_plural = "O'quvchilar Moliyaviy Profillari"

    def __str__(self):
        return f"{self.student.full_name} Wallet"

    @property
    def total_paid_all_time(self):
        """
        O'quvchining kassaga haqiqatda tushgan netto summasi.
        Bekor qilingan to'lovlar uchun yaratilgan reversal tranzaksiyalar
        (manfiy amount bilan) bu summani avtomatik kamaytiradi.
        """
        from finance.models import FinanceTransaction
        # Barcha completed income (payment + reversal) tranzaksiyalarini yig'amiz.
        # Reversallar amount=-summa bo'lgani uchun yig'indidan avtomatik ayriladi.
        res = FinanceTransaction.objects.filter(
            student=self.student,
            transaction_type='income',
            record_type__in=['payment', 'reversal'],
            status='completed',
            is_verified=True
        ).aggregate(total=Sum('amount'))
        return max(res['total'] or Decimal('0'), Decimal('0'))

    @property
    def total_refunded(self):
        from finance.models import FinanceTransaction
        # Refund record_type bilan va manfiy summa ekanligini hisobga olsak.
        # Aslida user aytdi "summa (musbat = to'lov, manfiy = bekor qilish/refund)"
        # Demak amount manfiy bo'ladi. Agar manfiy bo'lsa uni absolut olishimiz mumkin.
        # Yoki agar database-da manfiy kiritilsa.
        res = FinanceTransaction.objects.filter(
            student=self.student,
            record_type='refund',
            status='completed',
            is_verified=True
        ).aggregate(total=Sum('amount'))
        # summani musbat ko'rinishda qaytaramiz (agar u DB da manfiy bo'lsa)
        return abs(res['total'] or Decimal('0'))

    @property
    def last_payment_date(self):
        from finance.models import FinanceTransaction
        last_tx = FinanceTransaction.objects.filter(
            student=self.student,
            record_type='payment',
            status='completed'
        ).order_by('-date').first()
        return last_tx.date if last_tx else None

    @property
    def balance(self):
        """
        O'quvchining haqiqiy balansi (Ledger netto usulida).

        Formula:
            Balance = total_paid_net - total_refunded - total_billed_active

        - total_paid_net   : kassaga tushgan real pul (reversallar avtomatik ayiriladi)
        - total_refunded   : pul qaytarish (refund) summasi
        - total_billed_active : faqat hali to'liq yopilmagan AKTIV invoicelar
                               (bekor qilingan, ya'ni paid_amount=0 va is_paid=False
                               bo'lgan invoicelar hisobga olinmaydi)

        BUG-FIX: Avval barcha Payment.amount hisoblanardi, shu sababli bekor qilingan
        to'lovdan keyin o'sha summa yana qarz sifatida ko'rinardi.
        """
        from finance.models import Payment

        paid = self.total_paid_all_time
        refunded = self.total_refunded

        # Agar hozir o'quvchi imtiyozli (discount) bo'lsa, umuman qarz hisoblanmasligi kerak (talabga asosan)
        if self.student.status == 'discount':
            return Decimal('0')

        # Barcha hisoblangan (billed) invoicelar, jumladan hali to'lanmaganlari ham,
        # shunda o'quvchi qarzi to'g'ri hisoblanadi (manfiy balans = qarz).
        # TUZATILDI (BUG-STRING-FILTER): Avval:
        #   .exclude(notes="Avtomatik imtiyozli to'lov")  ← string literal (fragile!)
        # Bu notes matniga bog'liq edi va hech qayerda SET qilinmagan edi —
        # ya'ni bu filter hech qachon ishlamagan (dead code).
        # Endi: dedicated is_auto_discount=True boolean field ishlatiladi.
        # Discount o'quvchi uchun avtomatik yaratilgan invoicelar qarzga kirmaydi.
        billed_agg = Payment.objects.filter(
            student=self.student,
            amount__gt=0,
        ).exclude(
            is_auto_discount=True
        ).aggregate(total=Sum('amount'))
        total_billed = billed_agg['total'] or Decimal('0')

        return paid - refunded - total_billed
