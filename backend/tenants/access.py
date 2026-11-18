"""Public, uncached admission check for tenant document and SPA navigation."""
from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants.exceptions import TenantNotFoundError
from tenants.middleware import TenantMiddleware


class TenantAccessView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        host = TenantMiddleware._get_host(request)
        central_hosts = set(settings.TENANT_CEO_DOMAINS)
        central_hosts.update((settings.TENANT_BASE_DOMAIN, "www." + settings.TENANT_BASE_DOMAIN))
        if settings.DEBUG:
            central_hosts.update(("localhost", "127.0.0.1", "[::1]"))
        if host in central_hosts:
            response = Response(status=204)
        else:
            try:
                tenant = TenantMiddleware._resolve_tenant(host)
            except TenantNotFoundError:
                response = Response({"error": "Malumot olishda xatolik", "code": "TENANT_NOT_FOUND"}, status=403)
            else:
                response = (Response(status=204) if tenant.is_active else
                            Response({"error": "Malumot olishda xatolik", "code": "TENANT_INACTIVE"}, status=403))
        response["Cache-Control"] = "no-store, private"
        response["Vary"] = "Host, X-Tenant-Domain"
        return response
