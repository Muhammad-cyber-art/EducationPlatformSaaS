from django.db import models
from django.conf import settings
from django.core.exceptions import PermissionDenied

class FinanceTransaction(models.Model):
    """
    Markaziy moliya daftari (Unified Ledger)
    Hamma tushum va chiqimlar shu yerga yoziladi.
    O'chirish (DELETE) bloklangan. Faqat Cancel yoki Refund mumkin.
    """
    TRANSACTION_TYPE = [
        ('income', 'Tushum (Kirim)'),
        ('expense', 'Chiqim (Chiqit)'),
    ]

    CATEGORY_CHOICES = [
        ('student_fee', 'O\'quvchi to\'lovi'),
        ('salary', 'Xodim maoshi'),
        ('utility', 'Kommunal to\'lovlar'),
        ('rent', 'Ijara'),
        ('refund', 'Qaytarilgan pul (Dars qoldirgani uchun)'),
        ('student_extra', 'O\'quvchi qo\'shimcha to\'lovi'),
        ('owner_withdrawal', 'Super Admin olib ketdi'),
        ('other', 'Boshqa'),
    ]

    STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    RECORD_TYPE_CHOICES = [
        ('payment', 'Payment'),
        ('reversal', 'Reversal'),
        ('refund', 'Refund'),
    ]

    transaction_type = models.CharField(max_length=10, choices=TRANSACTION_TYPE, db_index=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    
    # Ledger qo'shimchalari
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed', db_index=True)
    record_type = models.CharField(max_length=20, choices=RECORD_TYPE_CHOICES, default='payment', db_index=True)
    related_transaction = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='reversals')
    
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    date = models.DateField(db_index=True)
    
    student = models.ForeignKey(
        'groups.Student', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='finance_transactions'
    )
    group = models.ForeignKey(
        'groups.Group', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='finance_transactions'
    )
    # Immutable audit snapshots (Zero Drift Principle)
    student_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="O'quvchi ismi (Snapshot)")
    group_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Guruh nomi (Snapshot)")
    payment_method = models.CharField(max_length=50, null=True, blank=True, verbose_name="To'lov usuli (Snapshot)")
    payer_name = models.CharField(max_length=255, blank=True, null=True)

    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        db_index=True
    )
    
    is_verified = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name="Kassa tasdiqlagani",
        help_text="True bo'lsa, bu tranzaksiya global balansga qo'shilgan hisoblanadi."
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_transactions'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_transactions'
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.PROTECT,
        related_name='transactions',
        db_index=True
    )
    
    title = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, null=True)
    
    related_id = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = "Moliya operatsiyasi"
        verbose_name_plural = "Moliya operatsiyalari"
        indexes = [
            models.Index(fields=['date', 'transaction_type']),
            models.Index(fields=['branch', 'transaction_type']),
            models.Index(fields=['status', 'record_type']),
            models.Index(fields=['is_verified', 'transaction_type']),
            models.Index(fields=['branch', 'is_verified']),
        ]

    def __str__(self):
        verified_str = "✓" if self.is_verified else "⏳"
        return f"{self.date} | {self.transaction_type} | {self.amount} | {self.status} | {verified_str}"

    def delete(self, *args, **kwargs):
        raise PermissionDenied("Deleting transactions is strictly prohibited. Use cancellation instead.")
