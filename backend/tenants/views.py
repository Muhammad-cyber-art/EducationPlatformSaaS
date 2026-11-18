"""
CEO Super Admin API Views.

Endpoints:
    POST   /api/v1/super-admin/auth/login/         → CEO login, JWT token olish
    POST   /api/v1/super-admin/auth/refresh/        → Token yangilash
    GET    /api/v1/super-admin/auth/me/             → CEO profili

    GET    /api/v1/super-admin/tenants/             → Barcha tenantlar ro'yxati
    POST   /api/v1/super-admin/tenants/             → Yangi tenant yaratish
    GET    /api/v1/super-admin/tenants/{id}/        → Tenant detallari
    PATCH  /api/v1/super-admin/tenants/{id}/toggle-status/ → Bloklash/ochish
    DELETE /api/v1/super-admin/tenants/{id}/        → Tenant o'chirish (xavfli!)

    GET    /api/v1/super-admin/analytics/           → Dashboard metrics
"""

import logging
from decimal import Decimal
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants.auth import CEOJWTAuthentication, IsCEOPermission, generate_ceo_tokens, refresh_ceo_token
from tenants.models import Tenant, Domain, Subscription, CEOUser
from tenants.serializers import (
    TenantListSerializer,
    TenantPaginationSerializer,
    TenantUpdateSerializer,
    TenantDetailSerializer,
    TenantCreateSerializer,
    TenantToggleStatusSerializer,
    CEOLoginSerializer,
    CEOUserSerializer,
    CEOAnalyticsSerializer,
)
from tenants.services import TenantProvisioningService
from tenants.plans import PLAN_SETTINGS

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# MIXIN — CEO Auth uchun
# ─────────────────────────────────────────────────────────────────────────────

class CEOAuthMixin:
    """Barcha CEO views uchun umumiy auth/permission."""
    authentication_classes = [CEOJWTAuthentication]
    permission_classes     = [IsCEOPermission]


# ─────────────────────────────────────────────────────────────────────────────
# AUTH VIEWS
# ─────────────────────────────────────────────────────────────────────────────

class CEOLoginView(APIView):
    """
    CEO login endpoint.

    POST /api/v1/super-admin/auth/login/
    Body: {"email": "ceo@crm.uz", "password": "..."}
    Response: {"access": "...", "refresh": "...", "expires_in": 28800, "user": {...}}
    """
    authentication_classes = []
    permission_classes     = []

    def post(self, request):
        serializer = CEOLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ceo_user = serializer.validated_data["ceo_user"]
        tokens   = generate_ceo_tokens(ceo_user)

        return Response({
            **tokens,
            "user": CEOUserSerializer(ceo_user).data,
        }, status=status.HTTP_200_OK)


class CEOTokenRefreshView(APIView):
    """
    CEO access token yangilash.

    POST /api/v1/super-admin/auth/refresh/
    Body: {"refresh": "..."}
    Response: {"access": "...", "expires_in": 28800}
    """
    authentication_classes = []
    permission_classes     = []

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response(
                {"error": "refresh token talab qilinadi."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            result = refresh_ceo_token(refresh)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_401_UNAUTHORIZED
            )


class CEOMeView(CEOAuthMixin, APIView):
    """
    CEO profili.

    GET /api/v1/super-admin/auth/me/
    """
    def get(self, request):
        return Response(
            CEOUserSerializer(request.user).data,
            status=status.HTTP_200_OK
        )


# ─────────────────────────────────────────────────────────────────────────────
# TENANT VIEWS
# ─────────────────────────────────────────────────────────────────────────────

class TenantListCreateView(CEOAuthMixin, APIView):
    """
    GET  /api/v1/super-admin/tenants/ → Barcha tenantlar ro'yxati
    POST /api/v1/super-admin/tenants/ → Yangi tenant yaratish
    """

    def get(self, request):
        """
        Tenantlar ro'yxati — filter va search qo'llab-quvvatlanadi.

        Query params:
            ?search=najot         → nom yoki domen bo'yicha qidirish
            ?is_active=true/false → faollik bo'yicha filter
            ?plan=pro             → tarif bo'yicha filter
        """
        qs = Tenant.objects.prefetch_related(
            "domains", "subscription"
        ).order_by("-created_at")

        # Search
        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(schema_name__icontains=search)
                | Q(domains__domain__icontains=search)
            ).distinct()

        # Filter: is_active
        is_active_param = request.query_params.get("is_active")
        if is_active_param is not None:
            is_active = is_active_param.lower() in ("true", "1", "yes")
            qs = qs.filter(is_active=is_active)

        # Filter: plan
        plan = request.query_params.get("plan")
        if plan:
            qs = qs.filter(subscription__plan=plan)

        # Oddiy pagination
        pagination = TenantPaginationSerializer(data=request.query_params)
        pagination.is_valid(raise_exception=True)
        page = pagination.validated_data["page"]
        page_size = pagination.validated_data["page_size"]
        offset    = (page - 1) * page_size
        total     = qs.count()

        tenants = qs[offset: offset + page_size]

        return Response({
            "count":     total,
            "page":      page,
            "page_size": page_size,
            "pages":     (total + page_size - 1) // page_size,
            "results":   TenantListSerializer(tenants, many=True).data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        """
        Yangi tenant yaratish (provisioning).

        Body: TenantCreateSerializer fields
        Response: Yaratilgan tenant detallari
        """
        serializer = TenantCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data    = serializer.validated_data
        raw_bot_token = data.get("telegram_bot_token", "")
        if raw_bot_token and raw_bot_token.strip():
            from telegram_bot.utils import validate_telegram_bot_token
            check_res = validate_telegram_bot_token(raw_bot_token.strip())
            if not check_res['ok']:
                return Response({"telegram_bot_token": [check_res['error']]}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = TenantProvisioningService().provision(
                name            = data["name"],
                domain          = data["domain"],
                plan            = data["plan"],
                admin_email     = data["admin_email"],
                admin_password  = data["admin_password"],
                admin_full_name = data.get("admin_full_name", ""),
                admin_phone     = data.get("admin_phone", ""),
                trial_days      = data.get("trial_days", 30),
                city            = data.get("city", ""),
                contact_phone   = data.get("contact_phone", ""),
                telegram_bot_token = raw_bot_token.strip() if raw_bot_token else "",
            )

            tenant = result["tenant"]
            logger.info(
                "CEO API orqali yangi tenant yaratildi: %s (schema=%s), CEO=%s",
                tenant.name, tenant.schema_name, request.user.email
            )

            return Response({
                "message": f"'{tenant.name}' o'quv markazi muvaffaqiyatli yaratildi.",
                "tenant":  TenantDetailSerializer(tenant).data,
                "admin":   {
                    "username": result["admin_user"].username,
                    "email":    data["admin_email"],
                },
                "schema":  result["schema_name"],
            }, status=status.HTTP_201_CREATED)

        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.error("Tenant provisioning xatoligi: %s", exc, exc_info=True)
            return Response(
                {"error": "Tenant yaratishda server xatoligi yuz berdi."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TenantDetailView(CEOAuthMixin, APIView):
    """
    GET    /api/v1/super-admin/tenants/{id}/ → Tenant detallari
    DELETE /api/v1/super-admin/tenants/{id}/ → Tenant o'chirish
    """

    def _get_tenant(self, tenant_id: int) -> Tenant | None:
        try:
            return Tenant.objects.prefetch_related(
                "domains", "subscription"
            ).get(id=tenant_id)
        except Tenant.DoesNotExist:
            return None

    def get(self, request, tenant_id: int):
        tenant = self._get_tenant(tenant_id)
        if not tenant:
            return Response(
                {"error": f"Tenant (id={tenant_id}) topilmadi."},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(TenantDetailSerializer(tenant).data)

    def patch(self, request, tenant_id: int):
        """
        Tenant ma'lumotlarini (nomi, shahar, telefon, tarif) yangilash.
        """
        tenant = self._get_tenant(tenant_id)
        if not tenant:
            return Response(
                {"error": f"Tenant (id={tenant_id}) topilmadi."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = TenantUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "plan" in data and not hasattr(tenant, "subscription"):
            return Response({"plan": ["Tenant subscription not found."]}, status=400)
        if "name" in data and data["name"].strip():
            tenant.name = data["name"].strip()
        if "city" in data:
            tenant.city = data["city"].strip()
        if "contact_phone" in data:
            tenant.contact_phone = data["contact_phone"].strip()
        if "telegram_bot_token" in data:
            val = data["telegram_bot_token"]
            if val and val.strip():
                from telegram_bot.utils import validate_telegram_bot_token
                check_res = validate_telegram_bot_token(val.strip())
                if not check_res['ok']:
                    return Response({"telegram_bot_token": [check_res['error']]}, status=status.HTTP_400_BAD_REQUEST)
                tenant.telegram_bot_token = val.strip()
            else:
                tenant.telegram_bot_token = None

        with transaction.atomic():
            tenant.save()
            if "plan" in data:
                subscription = Subscription.objects.select_for_update().get(tenant=tenant)
                subscription.plan = data["plan"]
                for field, value in PLAN_SETTINGS[subscription.plan].items():
                    setattr(subscription, field, value)
                subscription.save(update_fields=["plan", *PLAN_SETTINGS[subscription.plan]])
        # Discard the prefetched subscription after changing it separately.
        tenant.refresh_from_db()

        # Cached ma'lumotlarni tozalash
        if hasattr(tenant, "_cached_stats_and_admin"):
            delattr(tenant, "_cached_stats_and_admin")

        return Response(TenantDetailSerializer(tenant).data, status=status.HTTP_200_OK)

    def delete(self, request, tenant_id: int):
        """
        Tenantni o'chirish. JUDA XAVFLI operatsiya.
        Query param: ?drop_schema=true — schemani ham o'chiradi.
        """
        tenant = self._get_tenant(tenant_id)
        if not tenant:
            return Response(
                {"error": f"Tenant (id={tenant_id}) topilmadi."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Qo'shimcha tasdiqlash: tenant nomi body da bo'lishi shart
        confirm_name = request.data.get("confirm_name", "")
        if confirm_name.strip() != tenant.name:
            return Response(
                {
                    "error": "Tasdiqlash nomi mos kelmadi.",
                    "detail": f"'confirm_name' maydoniga '{tenant.name}' deb yozing.",
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        drop_schema = request.query_params.get("drop_schema", "false").lower() == "true"

        from tenants.services import TenantDeprovisioningService
        service = TenantDeprovisioningService()

        result = service.deprovision(tenant, drop_schema=drop_schema)

        logger.warning(
            "CEO API: Tenant o'chirildi: %s (schema=%s, schema_dropped=%s), CEO=%s",
            tenant.name, result["schema_name"], result["schema_dropped"],
            request.user.email
        )

        return Response({
            "message":      f"'{tenant.name}' markazi o'chirildi.",
            "schema_name":  result["schema_name"],
            "schema_dropped": result["schema_dropped"],
        }, status=status.HTTP_200_OK)


class TenantToggleStatusView(CEOAuthMixin, APIView):
    """
    PATCH /api/v1/super-admin/tenants/{id}/toggle-status/
    Markazni bloklash yoki faollashtirish.

    Body: {"is_active": false, "reason": "To'lov muddati o'tdi"}
    """

    def patch(self, request, tenant_id: int):
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return Response(
                {"error": f"Tenant (id={tenant_id}) topilmadi."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = TenantToggleStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_status = serializer.validated_data["is_active"]
        reason     = serializer.validated_data.get("reason", "")

        old_status = tenant.is_active
        tenant.is_active = new_status
        tenant.save(update_fields=["is_active", "updated_at"])

        action = "faollashtirildi" if new_status else "bloklandi"

        logger.info(
            "Tenant status o'zgartirildi: %s → is_active=%s (reason=%s), CEO=%s",
            tenant.name, new_status, reason, request.user.email
        )

        return Response({
            "message":    f"'{tenant.name}' {action}.",
            "tenant_id":  tenant.id,
            "is_active":  tenant.is_active,
            "old_status": old_status,
            "reason":     reason,
        }, status=status.HTTP_200_OK)


class TenantResetAdminPasswordView(CEOAuthMixin, APIView):
    """
    POST /api/v1/super-admin/tenants/{tenant_id}/reset-admin-password/
    O'quv markaz super adminining parolini o'zgartirish.
    Body: {"new_password": "NewStrongPassword123!"}
    """
    def post(self, request, tenant_id: int):
        new_password = request.data.get("new_password", "").strip()
        if not new_password or len(new_password) < 6:
            return Response(
                {"error": "Yangi parol kamida 6 belgidan iborat bo'lishi kerak."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return Response({"error": "Tenant topilmadi."}, status=status.HTTP_404_NOT_FOUND)

        from tenants.utils import tenant_schema_context
        from django.contrib.auth import get_user_model
        UserModel = get_user_model()

        try:
            with tenant_schema_context(tenant.schema_name):
                admin_user = UserModel.objects.filter(role="super_admin").first()
                if not admin_user:
                    admin_user = UserModel.objects.filter(is_superuser=True).first()
                if not admin_user:
                    return Response(
                        {"error": "Ushbu markazda super admin foydalanuvchisi topilmadi."},
                        status=status.HTTP_404_NOT_FOUND
                    )

                admin_user.set_password(new_password)
                admin_user.save()

                logger.info(
                    "CEO API: Tenant admin paroli yangilandi: tenant=%s, admin=%s, CEO=%s",
                    tenant.name, admin_user.username, request.user.email
                )

                return Response({
                    "message": f"'{admin_user.username}' administrator paroli muvaffaqiyatli yangilandi.",
                    "username": admin_user.username,
                }, status=status.HTTP_200_OK)

        except Exception as exc:
            logger.error("Admin parolini o'zgartirishda xatolik: %s", exc)
            return Response({"error": f"Xatolik: {str(exc)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TenantUpdateAdminView(CEOAuthMixin, APIView):
    """
    PATCH /api/v1/super-admin/tenants/{tenant_id}/update-admin/
    O'quv markaz super adminining ma'lumotlarini (ism, telefon, email, username) tahrirlash.
    """
    def patch(self, request, tenant_id: int):
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return Response({"error": "Tenant topilmadi."}, status=status.HTTP_404_NOT_FOUND)

        from tenants.utils import tenant_schema_context
        from django.contrib.auth import get_user_model
        UserModel = get_user_model()

        try:
            with tenant_schema_context(tenant.schema_name):
                admin_user = UserModel.objects.filter(role="super_admin").first()
                if not admin_user:
                    admin_user = UserModel.objects.filter(is_superuser=True).first()
                if not admin_user:
                    return Response(
                        {"error": "Super admin foydalanuvchisi topilmadi."},
                        status=status.HTTP_404_NOT_FOUND
                    )

                data = request.data
                if "username" in data and data["username"].strip():
                    new_uname = data["username"].strip()
                    if UserModel.objects.filter(username=new_uname).exclude(id=admin_user.id).exists():
                        return Response({"error": "Bu username allaqachon band."}, status=status.HTTP_400_BAD_REQUEST)
                    admin_user.username = new_uname

                if "first_name" in data:
                    admin_user.first_name = data["first_name"].strip()
                if "last_name" in data:
                    admin_user.last_name = data["last_name"].strip()
                if "phone_number" in data:
                    admin_user.phone_number = data["phone_number"].strip()
                if "email" in data and data["email"].strip():
                    admin_user.email = data["email"].strip()

                admin_user.save()

                return Response({
                    "message": "Super admin ma'lumotlari muvaffaqiyatli yangilandi.",
                    "super_admin": {
                        "id":           admin_user.id,
                        "username":     admin_user.username,
                        "email":        admin_user.email,
                        "first_name":   admin_user.first_name,
                        "last_name":    admin_user.last_name,
                        "full_name":    admin_user.get_full_name() or admin_user.username,
                        "phone_number": admin_user.phone_number or "",
                    }
                }, status=status.HTTP_200_OK)

        except Exception as exc:
            logger.error("Admin ma'lumotlarini tahrirlashda xatolik: %s", exc)
            return Response({"error": f"Xatolik: {str(exc)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────────────────────────────────────────
# ANALYTICS VIEW
# ─────────────────────────────────────────────────────────────────────────────

class CEOAnalyticsView(CEOAuthMixin, APIView):
    """
    GET /api/v1/super-admin/analytics/
    CEO Dashboard uchun global metrics.
    """

    def get(self, request):
        now        = timezone.now()
        month_ago  = now - timedelta(days=30)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # ── Tenant statistika ─────────────────────────────────────────────────
        total_tenants    = Tenant.objects.count()
        active_tenants   = Tenant.objects.filter(is_active=True).count()
        inactive_tenants = total_tenants - active_tenants
        new_tenants_month = Tenant.objects.filter(created_at__gte=month_start).count()

        # ── Obuna statistika ──────────────────────────────────────────────────
        subs = Subscription.objects.select_related("tenant").all()
        active_subs  = subs.filter(status="active").count()
        trial_subs   = subs.filter(status="trial").count()
        expired_subs = subs.filter(status="expired").count()

        # ── MRR (Monthly Recurring Revenue) ───────────────────────────────────
        mrr_result = Subscription.objects.filter(
            status__in=["active", "trial"]
        ).aggregate(total=Sum("price_per_month"))
        mrr = mrr_result["total"] or Decimal("0")

        # ── Tarif taqsimoti ───────────────────────────────────────────────────
        plan_qs = Subscription.objects.values("plan").annotate(count=Count("id"))
        plan_breakdown = {row["plan"]: row["count"] for row in plan_qs}

        # ── So'nggi 6 oy o'sish grafigi ───────────────────────────────────────
        monthly_growth = self._get_monthly_growth(now)

        data = {
            "total_tenants":        total_tenants,
            "active_tenants":       active_tenants,
            "inactive_tenants":     inactive_tenants,
            "new_tenants_month":    new_tenants_month,
            "active_subscriptions": active_subs,
            "trial_subscriptions":  trial_subs,
            "expired_subscriptions": expired_subs,
            "mrr_uzs":              mrr,
            "plan_breakdown":       plan_breakdown,
            "monthly_growth":       monthly_growth,
        }

        return Response(
            CEOAnalyticsSerializer(data).data,
            status=status.HTTP_200_OK
        )

    @staticmethod
    def _get_monthly_growth(now) -> list:
        """So'nggi 6 oy bo'yicha yangi tenantlar va MRR grafiği."""
        result = []
        for i in range(5, -1, -1):
            # i oylar oldingi oy boshlang'ichi
            target = now - timedelta(days=30 * i)
            month_start = target.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if i > 0:
                next_month = target.replace(day=1) + timedelta(days=32)
                month_end  = next_month.replace(day=1)
            else:
                month_end = now

            new_tenants = Tenant.objects.filter(
                created_at__gte=month_start,
                created_at__lt=month_end,
            ).count()

            mrr_res = Subscription.objects.filter(
                tenant__created_at__lt=month_end,
                status__in=["active", "trial"],
            ).aggregate(total=Sum("price_per_month"))

            result.append({
                "month":       month_start.strftime("%Y-%m"),
                "new_tenants": new_tenants,
                "mrr":         float(mrr_res["total"] or 0),
            })

        return result


class TenantImpersonateView(CEOAuthMixin, APIView):
    """Issue a one-time code; JWTs are returned only by the tenant exchange."""
    def post(self, request, tenant_id):
        import hashlib
        import secrets
        from django.contrib.auth import get_user_model
        from tenants.models import ImpersonationGrant
        from tenants.utils import tenant_schema_context

        tenant = Tenant.objects.filter(pk=tenant_id, is_active=True).first()
        if tenant is None:
            return Response({"error": "Tenant topilmadi yoki bloklangan."}, status=404)
        domain = tenant.domains.filter(is_primary=True).first()
        if domain is None:
            return Response({"error": "Tenantning asosiy domeni topilmadi."}, status=400)
        with tenant_schema_context(tenant):
            users = get_user_model().objects.filter(is_active=True)
            admin = users.filter(role="super_admin").first() or users.filter(is_superuser=True).first()
            if admin is None:
                return Response({"error": "Faol super admin topilmadi."}, status=404)
            admin_id = admin.pk
        code = secrets.token_urlsafe(32)
        ImpersonationGrant.objects.create(
            code_hash=hashlib.sha256(code.encode()).hexdigest(), tenant=tenant,
            ceo=request.user, admin_user_id=admin_id,
            expires_at=timezone.now() + timedelta(seconds=60),
        )
        logger.info("CEO login grant issued: CEO=%s tenant=%s", request.user.pk, tenant.pk)
        response = Response({"code": code, "domain": domain.domain, "expires_in": 60})
        response["Cache-Control"] = "no-store"
        return response


class TenantImpersonationExchangeView(APIView):
    """Redeem a code once, on its own active tenant domain only."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        import hashlib
        from django.contrib.auth import get_user_model
        from authenticatsiya.serializers import LoginSerializer
        from tenants.models import ImpersonationGrant
        from tenants.utils import tenant_schema_context

        tenant = getattr(request, "tenant", None)
        code = request.data.get("code")
        if tenant is None or not tenant.is_active or not isinstance(code, str) or not 20 <= len(code) <= 128:
            return Response({"error": "Kirish kodi yaroqsiz yoki muddati tugagan."}, status=400)
        now = timezone.now()
        with transaction.atomic():
            grant = ImpersonationGrant.objects.select_for_update().filter(
                code_hash=hashlib.sha256(code.encode()).hexdigest(), tenant_id=tenant.pk,
                tenant__is_active=True, ceo__is_active=True,
                consumed_at__isnull=True, expires_at__gt=now,
            ).first()
            if grant is None:
                return Response({"error": "Kirish kodi yaroqsiz yoki muddati tugagan."}, status=400)
            with tenant_schema_context(tenant):
                admin = get_user_model().objects.filter(pk=grant.admin_user_id, is_active=True).first()
                if admin is None or not (admin.role == "super_admin" or admin.is_superuser):
                    return Response({"error": "Faol super admin topilmadi."}, status=403)
                # Conditional update also protects backends without row locks.
                if not ImpersonationGrant.objects.filter(pk=grant.pk, consumed_at__isnull=True).update(consumed_at=now):
                    return Response({"error": "Kirish kodi ishlatilgan."}, status=400)
                refresh = LoginSerializer.get_token(admin)
                data = {"access": str(refresh.access_token), "refresh": str(refresh),
                        "tenant": {"schema_name": tenant.schema_name, "name": tenant.name}}
            logger.info("CEO login grant redeemed: CEO=%s tenant=%s admin=%s", grant.ceo_id, tenant.pk, admin.pk)
        response = Response(data)
        response["Cache-Control"] = "no-store"
        response["Referrer-Policy"] = "no-referrer"
        return response


class ResolveSubdomainView(APIView):
    """
    GET /api/v1/public/tenants/resolve/?subdomain=najot
    Subdomen mavjudligini xavfsiz tekshirish (barcha tenantlar ro'yxatini oshkor qilmaydi).
    Faqatgina so'ralgan bitta subdomen mavjud yoki yo'qligini qaytaradi.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        subdomain = request.query_params.get("subdomain", "").strip().lower()
        if not subdomain:
            return Response({"error": "Subdomen parametri ko'rsatilmadi."}, status=status.HTTP_400_BAD_REQUEST)

        import re
        from django.conf import settings
        if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", subdomain):
            return Response({"error": "Subdomen formati noto'g'ri."}, status=400)
        domains = [f"{subdomain}.{settings.TENANT_BASE_DOMAIN}"]
        if settings.DEBUG:
            domains.insert(0, f"{subdomain}.localhost")
        domain_obj = Domain.objects.select_related("tenant").filter(
            domain__in=domains, tenant__is_active=True,
        ).order_by("-is_primary", "id").first()
        if domain_obj:
            return Response({"exists": True, "name": domain_obj.tenant.name,
                             "subdomain": subdomain, "schema_name": domain_obj.tenant.schema_name,
                             "primary_domain": domain_obj.domain})
        return Response({"exists": False, "error": "Faol o'quv markaz topilmadi."}, status=404)
