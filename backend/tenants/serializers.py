"""
Tenants app serializers — CEO Super Admin API uchun.

Serializer qatlamlari:
  - TenantListSerializer   : Qisqa ro'yxat ko'rinishi
  - TenantDetailSerializer : To'liq detallar
  - TenantCreateSerializer : Yangi tenant yaratish (provisioning)
  - SubscriptionSerializer : Obuna ma'lumotlari
  - CEOLoginSerializer     : CEO autentifikatsiya
  - CEOAnalyticsSerializer : Dashboard metrics (read-only)
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from tenants.models import Tenant, Domain, Subscription, CEOUser


# ─────────────────────────────────────────────────────────────────────────────
# SUBSCRIPTION
# ─────────────────────────────────────────────────────────────────────────────

class SubscriptionSerializer(serializers.ModelSerializer):
    plan_display    = serializers.CharField(source="get_plan_display", read_only=True)
    status_display  = serializers.CharField(source="get_status_display", read_only=True)
    is_valid        = serializers.BooleanField(read_only=True)
    days_remaining  = serializers.SerializerMethodField()

    class Meta:
        model  = Subscription
        fields = [
            "id", "plan", "plan_display", "price_per_month",
            "started_at", "expires_at", "status", "status_display",
            "is_valid", "days_remaining",
            "max_students", "max_branches",
        ]
        read_only_fields = ["id", "started_at"]

    def get_days_remaining(self, obj) -> int:
        delta = obj.expires_at - timezone.now()
        return max(0, delta.days)


# ─────────────────────────────────────────────────────────────────────────────
# DOMAIN
# ─────────────────────────────────────────────────────────────────────────────

class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Domain
        fields = ["id", "domain", "is_primary", "created_at"]
        read_only_fields = ["id", "created_at"]


# ─────────────────────────────────────────────────────────────────────────────
# TENANT — RO'YXAT
# ─────────────────────────────────────────────────────────────────────────────

class TenantListSerializer(serializers.ModelSerializer):
    """
    Tenantlar ro'yxati uchun — faqat kerakli maydonlar (performance).
    """
    primary_domain  = serializers.SerializerMethodField()
    plan            = serializers.SerializerMethodField()
    sub_status      = serializers.SerializerMethodField()
    sub_expires_at  = serializers.SerializerMethodField()

    class Meta:
        model  = Tenant
        fields = [
            "id", "name", "schema_name", "is_active",
            "primary_domain", "plan", "sub_status", "sub_expires_at",
            "city", "telegram_bot_token", "created_at",
        ]

    def get_primary_domain(self, obj) -> str | None:
        domain = obj.domains.filter(is_primary=True).first()
        return domain.domain if domain else None

    def get_plan(self, obj) -> str | None:
        try:
            return obj.subscription.plan
        except Subscription.DoesNotExist:
            return None

    def get_sub_status(self, obj) -> str | None:
        try:
            return obj.subscription.status
        except Subscription.DoesNotExist:
            return None

    def get_sub_expires_at(self, obj):
        try:
            return obj.subscription.expires_at
        except Subscription.DoesNotExist:
            return None


# ─────────────────────────────────────────────────────────────────────────────
# TENANT — DETALLAR
# ─────────────────────────────────────────────────────────────────────────────

def get_tenant_stats_and_admin(schema_name: str):
    """
    Tenant schemasi ichidan real vaqt statistikalari va birinchi super adminni oladi.
    """
    import logging
    from tenants.utils import tenant_schema_context
    from django.contrib.auth import get_user_model
    from groups.models import Student, Group
    from branches.models import Branch

    logger = logging.getLogger(__name__)
    UserModel = get_user_model()

    stats = {
        "total_students": 0,
        "active_students": 0,
        "inactive_students": 0,
        "archived_students": 0,
        "total_staff": 0,
        "mentor_count": 0,
        "admin_count": 0,
        "total_groups": 0,
        "active_groups": 0,
        "total_branches": 0,
    }
    super_admin_data = None

    try:
        with tenant_schema_context(schema_name):
            stats["total_students"] = Student.objects.filter(is_archived=False).count()
            stats["active_students"] = Student.objects.filter(is_archived=False, is_active=True).count()
            stats["inactive_students"] = Student.objects.filter(is_archived=False, is_active=False).count()
            stats["archived_students"] = Student.objects.filter(is_archived=True).count()

            stats["total_groups"] = Group.objects.count()
            stats["active_groups"] = Group.objects.filter(is_faol=True).count()

            stats["total_branches"] = Branch.objects.count()

            super_admin_user = UserModel.objects.filter(role="super_admin").first()
            if not super_admin_user:
                super_admin_user = UserModel.objects.filter(is_superuser=True).first()

            mentor_count = UserModel.objects.filter(role="mentor").count()
            admin_count  = UserModel.objects.filter(role="admin").count()

            stats["mentor_count"] = mentor_count
            stats["admin_count"]  = admin_count
            stats["total_staff"]  = mentor_count + admin_count + (1 if super_admin_user else 0)

            if super_admin_user:
                super_admin_data = {
                    "id":           super_admin_user.id,
                    "username":     super_admin_user.username,
                    "email":        super_admin_user.email,
                    "first_name":   super_admin_user.first_name,
                    "last_name":    super_admin_user.last_name,
                    "full_name":    super_admin_user.get_full_name() or super_admin_user.username,
                    "phone_number": super_admin_user.phone_number or "",
                    "is_active":    super_admin_user.is_active,
                    "date_joined":  super_admin_user.date_joined,
                    "last_login":   super_admin_user.last_login,
                }
    except Exception as e:
        logger.warning("Tenant stats olishda xatolik: schema=%s, err=%s", schema_name, e)

    return stats, super_admin_data


# ─────────────────────────────────────────────────────────────────────────────
# TENANT — DETALLAR
# ─────────────────────────────────────────────────────────────────────────────

class TenantDetailSerializer(serializers.ModelSerializer):
    """
    Bitta tenant haqida to'liq ma'lumot (dinamik statistika va super admin bilan).
    """
    domains        = DomainSerializer(many=True, read_only=True)
    subscription   = SubscriptionSerializer(read_only=True)
    primary_domain = serializers.SerializerMethodField()
    stats          = serializers.SerializerMethodField()
    super_admin    = serializers.SerializerMethodField()

    class Meta:
        model  = Tenant
        fields = [
            "id", "name", "schema_name", "is_active",
            "city", "contact_phone", "telegram_bot_token",
            "domains", "primary_domain", "subscription",
            "stats", "super_admin",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "schema_name", "created_at", "updated_at"]

    def get_primary_domain(self, obj) -> str | None:
        domain = obj.domains.filter(is_primary=True).first()
        return domain.domain if domain else None

    def _get_data(self, obj):
        if not hasattr(obj, "_cached_stats_and_admin"):
            obj._cached_stats_and_admin = get_tenant_stats_and_admin(obj.schema_name)
        return obj._cached_stats_and_admin

    def get_stats(self, obj):
        stats, _ = self._get_data(obj)
        return stats

    def get_super_admin(self, obj):
        _, admin_data = self._get_data(obj)
        return admin_data


# ─────────────────────────────────────────────────────────────────────────────
# TENANT — YARATISH (CEO API)
# ─────────────────────────────────────────────────────────────────────────────

class TenantCreateSerializer(serializers.Serializer):
    """
    Yangi tenant yaratish uchun input serializeri.
    Bu serializer faqat validatsiya va parsing uchun — save() chaqirilmaydi.
    Asosiy mantiq TenantProvisioningService.provision() da.
    """
    # Markaz ma'lumotlari
    name          = serializers.CharField(max_length=100, help_text="O'quv markaz nomi")
    domain        = serializers.CharField(max_length=253, help_text="Tenant domeni, masalan: najot.crm.uz")
    city          = serializers.CharField(max_length=100, required=False, default="")
    contact_phone = serializers.CharField(max_length=20,  required=False, default="")
    telegram_bot_token = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default="",
        help_text="Telegram bot tokeni (ixtiyoriy)"
    )

    # Obuna
    plan          = serializers.ChoiceField(
        choices=["starter", "pro", "enterprise"],
        default="starter",
        help_text="Tarif rejasi"
    )
    trial_days    = serializers.IntegerField(
        min_value=1, max_value=365, default=30,
        help_text="Sinov davri (kun soni)"
    )

    # Birinchi admin
    admin_email     = serializers.EmailField(help_text="Admin email manzili")
    admin_password  = serializers.CharField(
        min_length=8, write_only=True,
        style={"input_type": "password"},
        help_text="Admin paroli (kamida 8 belgi)"
    )
    admin_full_name = serializers.CharField(max_length=150, required=False, default="")
    admin_phone     = serializers.CharField(max_length=20,  required=False, default="")

    def validate_domain(self, value: str) -> str:
        value = value.lower().strip()
        if Domain.objects.filter(domain=value).exists():
            raise serializers.ValidationError(
                f"'{value}' domeni allaqachon band. Boshqa domen tanlang."
            )
        return value

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Nomi kamida 2 ta belgidan iborat bo'lishi kerak.")
        return value

    def validate_admin_password(self, value: str) -> str:
        """Minimal parol kuchliligini tekshirish."""
        if value.isdigit():
            raise serializers.ValidationError("Parol faqat raqamlardan iborat bo'lmasligi kerak.")
        return value


# ─────────────────────────────────────────────────────────────────────────────
# TENANT — STATUS TOGGLE
# ─────────────────────────────────────────────────────────────────────────────

class TenantToggleStatusSerializer(serializers.Serializer):
    """Markazni bloklash yoki ochish uchun."""
    is_active = serializers.BooleanField(help_text="True — ochish, False — bloklash")
    reason    = serializers.CharField(
        max_length=500, required=False, default="", allow_blank=True,
        help_text="Bloklash sababi (ixtiyoriy)"
    )


# ─────────────────────────────────────────────────────────────────────────────
# CEO AUTENTIFIKATSIYA
# ─────────────────────────────────────────────────────────────────────────────

class CEOLoginSerializer(serializers.Serializer):
    """
    CEO login uchun input serializer.
    CEOUser — Django's AbstractUser bilan bog'liq emas,
    shuning uchun alohida login logika kerak.
    """
    email    = serializers.EmailField(help_text="CEO email manzili")
    password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        help_text="CEO paroli"
    )

    def validate(self, attrs):
        email    = attrs.get("email", "").lower().strip()
        password = attrs.get("password", "")

        try:
            ceo_user = CEOUser.objects.get(email=email, is_active=True)
        except CEOUser.DoesNotExist:
            raise serializers.ValidationError(
                {"email": "Email yoki parol noto'g'ri."}
            )

        if not ceo_user.check_password(password):
            raise serializers.ValidationError(
                {"password": "Email yoki parol noto'g'ri."}
            )

        attrs["ceo_user"] = ceo_user
        return attrs


class CEOUserSerializer(serializers.ModelSerializer):
    """CEO foydalanuvchi ma'lumotlari (read-only)."""

    class Meta:
        model  = CEOUser
        fields = ["id", "email", "full_name", "phone", "last_login", "created_at"]
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────

class CEOAnalyticsSerializer(serializers.Serializer):
    """
    CEO Dashboard analytics — global metrics.
    Bu serializer faqat output uchun (read-only).
    """
    # Tenantlar
    total_tenants       = serializers.IntegerField(read_only=True)
    active_tenants      = serializers.IntegerField(read_only=True)
    inactive_tenants    = serializers.IntegerField(read_only=True)
    new_tenants_month   = serializers.IntegerField(read_only=True, help_text="Shu oyda qo'shilganlar")

    # Obunalar
    active_subscriptions = serializers.IntegerField(read_only=True)
    trial_subscriptions  = serializers.IntegerField(read_only=True)
    expired_subscriptions = serializers.IntegerField(read_only=True)

    # Daromad (MRR — Monthly Recurring Revenue)
    mrr_uzs             = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True,
        help_text="Oylik takroriy daromad (so'm)"
    )
    plan_breakdown      = serializers.DictField(
        child=serializers.IntegerField(),
        read_only=True,
        help_text="Tarif bo'yicha taqsimot: {starter: N, pro: N, enterprise: N}"
    )

    # O'sish grafigi (so'nggi 6 oy)
    monthly_growth      = serializers.ListField(
        child=serializers.DictField(),
        read_only=True,
        help_text="[{month: 'YYYY-MM', new_tenants: N, mrr: X}, ...]"
    )
