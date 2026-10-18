import uuid
from django.db import models
from django.utils import timezone
from django.conf import settings


class SyncedModel(models.Model):
    """
    Offline-First sinxronizatsiya uchun tayanch abstrakt model.
    Barcha sinxronlanadigan modellar shu klassdan voris oladi.

    BUG FIX: save() metodi to'g'ri qayta yozildi.
    Oldingi versiyada: `if not self.updated_at` — bu hech qachon True bo'lmaydi,
    chunki `default=timezone.now` har doim qiymat beradi.
    Natija: push operatsiyasida `skip_updated_at=True` berilganda ham
    updated_at qayta o'rnatib qo'yilardi.
    Tuzatma: skip_updated_at=True bo'lmasa, ALWAYS updated_at ni yangilaydi.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Mijoz (client) tomonidan offline yaratilganda ham ID takrorlanmasligi uchun UUIDv4"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="Yozuvning dastlabki yaratilgan vaqti"
    )
    updated_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        help_text="Oxirgi tahrir vaqti (Last-Write-Wins konflikti uchun kalit maydon)"
    )
    is_deleted = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Soft-delete belgisi. Haqiqiy qatordan o'chirilmaydi, tombstone sifatida qoladi"
    )

    class Meta:
        abstract = True
        indexes = [
            # Keyset pagination va delta-sync uchun kompozit indeks
            models.Index(fields=['updated_at', 'id'], name='%(class)s_sync_idx'),
            models.Index(fields=['is_deleted', 'updated_at'], name='%(class)s_del_sync_idx'),
        ]

    def save(self, *args, **kwargs):
        """
        BUG FIX: Oldingi kod:
            if not kwargs.pop('skip_updated_at', False) and not self.updated_at:
                self.updated_at = timezone.now()
        Bu noto'g'ri edi — `not self.updated_at` hech qachon True bo'lmaydi.

        To'g'ri logika:
        - skip_updated_at=True: updated_at ni O'ZGARTIRMA (LWW push da ishlatiladi)
        - skip_updated_at=False (default): updated_at ni YANGILASH
        """
        skip = kwargs.pop('skip_updated_at', False)
        if not skip:
            self.updated_at = timezone.now()
        super().save(*args, **kwargs)


class ClientLead(SyncedModel):
    """
    Dala xodimlari ishlaydigan asosiy biznes obyekti (Mijoz / Lidi).
    """
    STATUS_CHOICES = (
        ('new', 'Yangi'),
        ('in_progress', 'Jarayonda'),
        ('qualified', 'Mos keldi'),
        ('rejected', 'Rad etildi'),
        ('converted', 'Shartnoma tuzildi'),
    )

    name = models.CharField(max_length=255, db_index=True, verbose_name="Mijoz F.I.SH")
    phone = models.CharField(max_length=32, db_index=True, verbose_name="Telefon raqami")
    email = models.EmailField(blank=True, null=True, verbose_name="Elektron pochta")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='new', db_index=True)
    notes = models.TextField(blank=True, default="", verbose_name="Eslatmalar")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_leads',
        verbose_name="Biriktirilgan xodim"
    )

    class Meta(SyncedModel.Meta):
        verbose_name = "Mijoz Lidi"
        verbose_name_plural = "Mijoz Lidi (CRM)"
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} ({self.phone})"
