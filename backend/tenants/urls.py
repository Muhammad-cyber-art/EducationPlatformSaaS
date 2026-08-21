"""
Tenants app URL konfiguratsiyasi — CEO Super Admin API.

Barcha URL'lar /api/v1/super-admin/ prefiksi ostida bo'ladi.
Bu prefix TenantMiddleware tomonidan CEO bypass sifatida taniladi.
"""

from django.urls import path

from tenants.views import (
    CEOLoginView,
    CEOTokenRefreshView,
    CEOMeView,
    TenantListCreateView,
    TenantDetailView,
    TenantToggleStatusView,
    CEOAnalyticsView,
)

app_name = "tenants"

urlpatterns = [
    # ── Autentifikatsiya ───────────────────────────────────────────────────
    # POST  /api/v1/super-admin/auth/login/    → CEO login
    path("auth/login/",   CEOLoginView.as_view(),        name="ceo-login"),
    # POST  /api/v1/super-admin/auth/refresh/  → Token yangilash
    path("auth/refresh/", CEOTokenRefreshView.as_view(), name="ceo-token-refresh"),
    # GET   /api/v1/super-admin/auth/me/       → CEO profili
    path("auth/me/",      CEOMeView.as_view(),           name="ceo-me"),

    # ── Tenantlar boshqaruvi ───────────────────────────────────────────────
    # GET   /api/v1/super-admin/tenants/       → Ro'yxat (search + filter)
    # POST  /api/v1/super-admin/tenants/       → Yangi tenant yaratish
    path("tenants/",                          TenantListCreateView.as_view(), name="tenant-list"),
    # GET   /api/v1/super-admin/tenants/{id}/  → Tenant detallari
    # DELETE /api/v1/super-admin/tenants/{id}/ → Tenant o'chirish
    path("tenants/<int:tenant_id>/",          TenantDetailView.as_view(),     name="tenant-detail"),
    # PATCH /api/v1/super-admin/tenants/{id}/toggle-status/
    path("tenants/<int:tenant_id>/toggle-status/",
         TenantToggleStatusView.as_view(), name="tenant-toggle-status"),

    # ── Analytics ─────────────────────────────────────────────────────────
    # GET   /api/v1/super-admin/analytics/     → Dashboard metrics
    path("analytics/", CEOAnalyticsView.as_view(), name="ceo-analytics"),
]
