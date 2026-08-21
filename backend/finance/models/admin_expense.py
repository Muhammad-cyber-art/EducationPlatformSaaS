from django.db import models
from django.conf import settings

class AdminExpense(models.Model):
    """
    Adminlar tomonidan kiritiladigan mayda (operatsion) harajatlar.
    Asosiy moliya hisoboti (Unified Ledger) ga ta'sir qilmaydi.
    """
    title = models.CharField(max_length=255, verbose_name="Harajat nomi")
    description = models.TextField(blank=True, null=True, verbose_name="Tafsilotlar")
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Summa")
    date = models.DateField(db_index=True, verbose_name="Sana")
    
    branch = models.ForeignKey(
        'branches.Branch',
        on_delete=models.CASCADE,
        related_name='admin_expenses',
        verbose_name="Filial"
    )
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="Kiritdi"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = "Admin harajati"
        verbose_name_plural = "Admin harajatlari"

    def __str__(self):
        return f"{self.title} - {self.amount} ({self.date})"
