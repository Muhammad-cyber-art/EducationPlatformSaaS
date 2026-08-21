
from django.contrib import admin
from django.urls import path, include

from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

urlpatterns = [
    path('adminn/', admin.site.urls),
    path('api/', include([
        # ── CEO / Super Admin API (public schema, tenant bypass) ────────────
        # Bu prefix TenantMiddleware tomonidan taniladi va tenant
        # tekshiruvidan o'tkazib yuboriladi.
        path('v1/super-admin/', include('tenants.urls', namespace='tenants')),

        # ── Tenant API'lari (tenant schema) ────────────────────────────────
        path('', include('authenticatsiya.urls')),
        path('drf-urls/', include('rest_framework.urls')),
        path('groups/', include('groups.urls')),
        path('add_branch/', include('branches.urls')),
        path('homework_attends/', include('homework_attends.urls')),
        path('finance/', include('finance.urls')),
        path('archive/', include('archivebase.urls')),
        path('reports/', include('reports.urls')),
        path('permissions/', include('permissions.urls')),
        path('bot/', include('telegram_bot.urls')),

        # ── API Dokumentatsiya ─────────────────────────────────────────────
        path('schema/', SpectacularAPIView.as_view(), name='schema'),
        path('docs/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
        path('docs/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ])),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
