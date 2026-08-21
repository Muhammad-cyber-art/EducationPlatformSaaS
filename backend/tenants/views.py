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
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants.auth import CEOJWTAuthentication, IsCEOPermission, generate_ceo_tokens, refresh_ceo_token
from tenants.models import Tenant, Domain, Subscription, CEOUser
from tenants.serializers import (
    TenantListSerializer,
    TenantDetailSerializer,
    TenantCreateSerializer,
    TenantToggleStatusSerializer,
    CEOLoginSerializer,
    CEOUserSerializer,
    CEOAnalyticsSerializer,
)
from tenants.services import TenantProvisioningService

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
        page      = max(1, int(request.query_params.get("page", 1)))
        page_size = min(100, int(request.query_params.get("page_size", 20)))
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
        service = TenantProvisioningService()

        try:
            result = service.provision(
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
