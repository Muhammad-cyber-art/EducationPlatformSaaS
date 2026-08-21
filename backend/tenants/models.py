"""
Tenants app modellari — PUBLIC schemada saqlanadi.

Bu modellar barcha tenant ma'lumotlarini global darajada boshqaradi.
Django ORM ularni har doim 'public' schemadan o'qiydi (TenantSchemaRouter
orqali ta'minlanadi).

Jadval tuzilishi:
    public.tenants_tenant       → Asosiy o'quv markaz yozuvi
    public.tenants_domain       → Tenant domenlariga mapping
    public.tenants_subscription → Obuna va to'lov rejasi
    public.tenants_ceouser      → CEO (Platform Super Admin) foydalanuvchisi
"""

import re
from django.db import models
from django.contrib.auth.hashers import make_password, check_password as django_check_password
from tenants.exceptions import InvalidSchemaNameError

# Schema nomi uchun ruxsat etilgan belgilar (SQL injection himoyasi)
VALID_SCHEMA_RE = re.compile(r'^[a-z][a-z0-9_]{1,61}$')


def _validate_schema_name(schema_name: str) -> None:
    """Schema nomini tekshiradi. Xato bo'lsa InvalidSchemaNameError ko'taradi."""
    if not VALID_SCHEMA_RE.match(schema_name):
        raise InvalidSchemaNameError(schema_name)


# ─────────────────────────────────────────────────────────────────────────────
# TENANT
# ─────────────────────────────────────────────────────────────────────────────

class Tenant(models.Model):
    """
    O'quv markaz (tenant) asosiy modeli.

    Har bir o'quv markaz uchun alohida PostgreSQL schemasi yaratiladi.
    schema_name = "tenant_" + slugified_name, masalan: "tenant_najot"

    is_active=False bo'lsa, middleware shu markazga barcha requestlarni
    403 bilan to'sib qo'yadi (ma'lumotlar o'chirilmaydi).
    """
    name = models.CharField(
        max_length=100,
        verbose_name="O'quv markaz nomi",
        help_text="Masalan: 'Najot Ta'lim', 'Ustoz Academy'"
    )
    schema_name = models.CharField(
        max_length=63,
        unique=True,
        verbose_name="PostgreSQL schema nomi",
        help_text="Faqat kichik harf, raqam va '_' — masalan: tenant_najot"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Faolmi?",
        help_text="False bo'lsa markaz bloklangan hisoblanadi"
    )
    city = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Shahar",
    )
    contact_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name="Aloqa telefon raqami",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan sana")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Yangilangan sana")

    class Meta:
        db_table = "tenants_tenant"
        verbose_name = "O'quv Markaz"
        verbose_name_plural = "O'quv Markazlar"
        ordering = ["-created_at"]

    def __str__(self):
        status = "✅" if self.is_active else "🔒"
        return f"{status} {self.name} ({self.schema_name})"

    def clean(self):
        _validate_schema_name(self.schema_name)

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# DOMAIN
# ─────────────────────────────────────────────────────────────────────────────

class Domain(models.Model):
    """
    Tenant domeniga mapping.

    Bir tenant bir nechta domenga ega bo'lishi mumkin:
        - najot.crm.uz  (is_primary=True)
        - najottalim.uz (is_primary=False, custom domen)

    Middleware HTTP Host headeridan shu jadvalga murojaat qiladi.
    """
    domain = models.CharField(
        max_length=253,
        unique=True,
        db_index=True,
        verbose_name="Domen",
        help_text="Masalan: najot.crm.uz (port raqamisiz)"
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="domains",
        verbose_name="O'quv markaz",
    )
    is_primary = models.BooleanField(
        default=True,
        verbose_name="Asosiy domenmi?",
        help_text="Har bir tenant uchun faqat bitta asosiy domen bo'lishi kerak"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tenants_domain"
        verbose_name = "Domen"
        verbose_name_plural = "Domenlar"

    def __str__(self):
        marker = " [PRIMARY]" if self.is_primary else ""
        return f"{self.domain} → {self.tenant.name}{marker}"


# ─────────────────────────────────────────────────────────────────────────────
# SUBSCRIPTION
# ─────────────────────────────────────────────────────────────────────────────

class Subscription(models.Model):
    """
    Tenant obuna (tarif) rejasi.

    CEO dashboard bu jadval orqali har bir markazning to'lov statusini
    va obuna muddatini ko'radi.
    """
    PLAN_CHOICES = [
        ("starter", "Starter — Asosiy"),
        ("pro", "Pro — Kengaytirilgan"),
        ("enterprise", "Enterprise — Korporativ"),
    ]
    STATUS_CHOICES = [
        ("active", "Faol"),
        ("trial", "Sinov davri"),
        ("expired", "Muddati tugagan"),
        ("suspended", "To'xtatilgan"),
    ]

    tenant = models.OneToOneField(
        Tenant,
        on_delete=models.CASCADE,
        related_name="subscription",
        verbose_name="O'quv markaz",
    )
    plan = models.CharField(
        max_length=20,
        choices=PLAN_CHOICES,
        default="starter",
        verbose_name="Tarif rejasi",
    )
    price_per_month = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="Oylik to'lov (so'm)",
    )
    started_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Obuna boshlangan sana",
    )
    expires_at = models.DateTimeField(
        verbose_name="Obuna tugash sanasi",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="trial",
        verbose_name="Obuna holati",
    )
    max_students = models.PositiveIntegerField(
        default=500,
        verbose_name="Maksimal o'quvchilar soni",
    )
    max_branches = models.PositiveIntegerField(
        default=1,
        verbose_name="Maksimal filiallar soni",
    )

    class Meta:
        db_table = "tenants_subscription"
        verbose_name = "Obuna"
        verbose_name_plural = "Obunalar"

    def __str__(self):
        return f"{self.tenant.name} — {self.get_plan_display()} ({self.status})"

    @property
    def is_valid(self) -> bool:
        """Obuna hali amal qiladimi?"""
        from django.utils import timezone
        return self.status in ("active", "trial") and self.expires_at > timezone.now()


# ─────────────────────────────────────────────────────────────────────────────
# CEO USER (Platform Super Admin)
# ─────────────────────────────────────────────────────────────────────────────

class CEOUser(models.Model):
    """
    Platforma darajasidagi CEO/Super Admin foydalanuvchisi.

    Bu model public schemada saqlanadi va Django'ning standart
    AbstractUser bilan bog'liq EMAS — butunlay alohida autentifikatsiya.

    Nima uchun alohida model?
    - Tenant schemaga kirishi yo'q (u barcha tenantlarni boshqaradi)
    - Alohida JWT token (tenant tokenlaridan farqli)
    - Qo'shimcha permissions tizimi
    """
    email = models.EmailField(unique=True, verbose_name="Email manzil")
    password_hash = models.CharField(max_length=256, verbose_name="Parol (hash)")
    full_name = models.CharField(max_length=150, verbose_name="To'liq ism")
    phone = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenants_ceo_user"
        verbose_name = "CEO / Platform Admin"
        verbose_name_plural = "CEO Foydalanuvchilar"

    def __str__(self):
        return f"CEO: {self.full_name} <{self.email}>"

    def set_password(self, raw_password: str) -> None:
        """Parolni Django hashers orqali saqlaydi."""
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        """Berilgan parol to'g'riligini tekshiradi."""
        return django_check_password(raw_password, self.password_hash)

    @property
    def is_authenticated(self) -> bool:
        """Middleware'larda request.user.is_authenticated tekshiruvi uchun."""
        return True
