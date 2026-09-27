"""
TenantMiddleware — Multi-tenant HTTP request routing.

Bu middleware Django MIDDLEWARE ro'yxatida birinchi bo'lib turishi kerak
(CorsMiddleware dan keyin, lekin barcha biznes middlewarelardan oldin).

Ishlash tartibi:
    1. HTTP Host headerdan domen ajratiladi
    2. CEO panel domeni bo'lsa — tenant tekshiruvi o'tkazib yuboriladi
    3. Dev rejimda X-Tenant-Schema header bo'lsa — bypass qilinadi
    4. Domain jadvali orqali Tenant topiladi
    5. Tenant aktiv ekanligini tekshirish
    6. PostgreSQL search_path o'rnatiladi
    7. Thread-local'ga tenant saqlanadi
    8. Request keyingi middlewarega/view'ga uzatiladi
    9. Finally: search_path reset, thread-local tozalanadi

Muhim:
    - set_search_path() muvaffaqiyatsiz bo'lsa ham request to'xtatiladi (xavfsizlik)
    - PostgreSQL bo'lmasa (SQLite) search_path skip qilinadi
"""

import logging
from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

from tenants.context import set_current_tenant, clear_current_tenant
from tenants.exceptions import TenantNotFoundError, TenantInactiveError, TenantSchemaError
from tenants.utils import set_search_path, reset_search_path

logger = logging.getLogger(__name__)


class TenantMiddleware(MiddlewareMixin):
    """
    Har bir HTTP request uchun tenant identifikatsiya va DB isolation.

    Konfiguratsiya (settings.py da):
        TENANT_BASE_DOMAIN = "crm.uz"           # Asosiy domen
        TENANT_CEO_DOMAINS = {"admin.crm.uz"}    # CEO panel domenlari
        TENANT_CEO_URL_PREFIX = "/api/v1/super-admin/"  # CEO URL prefiksi
        TENANT_DEV_SCHEMA_HEADER = True          # Dev uchun header bypass
    """

    def process_request(self, request):
        """
        Requestni qayta ishlash — tenant topib, search_path o'rnatish.

        None qaytarsa → keyingi middleware/view'ga o'tkaziladi.
        JsonResponse qaytarsa → request shu yerda to'xtatiladi.
        """
        # ── 0. BYPASS OPTIONS REQUESTS (CORS Preflight) ──────────────────────
        if request.method == "OPTIONS":
            return None

        host = self._get_host(request)
        path = request.path_info
        ceo_url_prefix = getattr(settings, 'TENANT_CEO_URL_PREFIX', '/api/v1/super-admin/')

        # ── 1. CEO ROUTELARIGA SUBDOMENDAN KIRISHNI TAQIQLASH ────────────────
        effective_host = self._get_request_subdomain_host(request, host)
        if path.startswith(ceo_url_prefix) and self._is_tenant_subdomain(effective_host):
            logger.warning(
                "Subdomendan CEO route'ga urinish taqiqlandi: host=%s, path=%s",
                effective_host, path
            )
            return JsonResponse(
                {
                    "error": "CEO paneliga subdomendan kirish taqiqlangan",
                    "detail": (
                        f"'{effective_host}' subdomeni orqali CEO boshqaruv paneliga kirish taqiqlangan. "
                        "CEO amallari faqat markaziy platforma domenidan amalga oshirilishi mumkin."
                    ),
                    "code": "CEO_FORBIDDEN_ON_SUBDOMAIN",
                },
                status=403,
            )

        # ── 1.1. CEO PANEL VA PUBLIC API YO'LI ───────────────────────────────
        if self._is_ceo_request(host, path, request):
            logger.debug("CEO request: host=%s, path=%s", host, path)
            # CEO uchun tenant o'rnatilmaydi — public schema ishlatiladi
            request.tenant = None
            request.is_ceo_request = True
            return None  # Keyingi middleware'ga o'tkazish

        if self._is_public_request(path):
            logger.debug("Public request: path=%s", path)
            request.tenant = None
            request.is_ceo_request = False
            return None

        # ── 2. DEV BYPASS: X-Tenant-Schema HEADER ────────────────────────────
        if getattr(settings, 'TENANT_DEV_SCHEMA_HEADER', False) and settings.DEBUG:
            dev_schema = request.META.get('HTTP_X_TENANT_SCHEMA')
            if dev_schema:
                return self._handle_dev_bypass(request, dev_schema)

        # ── 3. TENANT TOPISH ─────────────────────────────────────────────────
        try:
            tenant = self._resolve_tenant(host)
        except TenantNotFoundError as exc:
            logger.warning("Tenant topilmadi: %s", exc)
            return JsonResponse(
                {
                    "error": "O'quv markaz topilmadi",
                    "detail": str(exc),
                    "code": "TENANT_NOT_FOUND",
                },
                status=404,
            )
        except Exception as exc:
            logger.error("Tenant resolve qilishda kutilmagan xatolik: %s", exc)
            return JsonResponse(
                {"error": "Server xatoligi", "code": "INTERNAL_ERROR"},
                status=500,
            )

        # ── 4. TENANT STATUS TEKSHIRUVI ───────────────────────────────────────
        if not tenant.is_active:
            logger.warning(
                "Bloklangan tenantga urinish: tenant=%s, host=%s",
                tenant.schema_name, host
            )
            return JsonResponse(
                {
                    "error": "O'quv markaz vaqtincha bloklangan",
                    "detail": f"'{tenant.name}' markazi administrator tomonidan to'xtatilgan.",
                    "code": "TENANT_INACTIVE",
                },
                status=403,
            )

        # ── 5. SEARCH_PATH O'RNATISH ──────────────────────────────────────────
        try:
            self._activate_tenant_schema(tenant)
        except TenantSchemaError as exc:
            logger.error(
                "Schema o'rnatishda xatolik: schema=%s, error=%s",
                tenant.schema_name, exc
            )
            return JsonResponse(
                {"error": "Ma'lumotlar bazasiga ulanishda xatolik", "code": "DB_ERROR"},
                status=503,
            )

        # ── 6. REQUEST KONTEKSTINI TO'LDIRISH ────────────────────────────────
        request.tenant = tenant
        request.is_ceo_request = False
        set_current_tenant(tenant)

        logger.debug(
            "Tenant faollashtirildi: name=%s, schema=%s, host=%s",
            tenant.name, tenant.schema_name, host
        )
        return None  # Keyingi middleware'ga o'tkazish

    def process_response(self, request, response):
        """
        Response qaytishidan oldin tozalash.
        search_path public'ga qaytariladi, thread-local tozalanadi.
        """
        # Faqat tenant faollashtirilgan bo'lsa reset qilamiz
        if getattr(request, 'tenant', None) is not None:
            clear_current_tenant()
            reset_search_path()

        return response

    def process_exception(self, request, exception):
        """
        View'da exception yuz berganda ham tozalash.
        """
        if getattr(request, 'tenant', None) is not None:
            clear_current_tenant()
            reset_search_path()
        return None  # Exception handling'ni Django'ga qoldirish

    # ─────────────────────────────────────────────────────────────────────────
    # PRIVATE YORDAMCHI METODLAR
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _get_host(request) -> str:
        """
        Host headerdan toza domen olish (port va protokol olib tashlanadi).
        X-Tenant-Domain, X-Forwarded-Host va Host headerlarini ketma-ket tekshiradi.
        """
        host = (
            request.META.get('HTTP_X_TENANT_DOMAIN')
            or request.META.get('HTTP_X_FORWARDED_HOST')
            or request.get_host()
        )
        return host.split(':')[0].lower().strip()

    @staticmethod
    def _get_request_subdomain_host(request, default_host: str) -> str:
        """
        Request qaysi subdomen/domendan kelganini aniqlash.
        X-Tenant-Domain header, Origin yoki Referer orqali.
        """
        # 1. X-Tenant-Domain header (frontend explicit o'rnatgan bo'lsa)
        x_tenant = request.META.get('HTTP_X_TENANT_DOMAIN')
        if x_tenant:
            return x_tenant.split(':')[0].lower().strip()

        # 2. Origin header (CORS so'rovlarida brauzer yuboradi)
        origin = request.META.get('HTTP_ORIGIN')
        if origin:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(origin)
                if parsed.hostname:
                    return parsed.hostname.lower().strip()
            except Exception:
                pass

        # 3. Referer header
        referer = request.META.get('HTTP_REFERER')
        if referer:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(referer)
                if parsed.hostname:
                    return parsed.hostname.lower().strip()
            except Exception:
                pass

        return default_host

    @staticmethod
    def _is_tenant_subdomain(host: str) -> bool:
        """
        Domen tenant subdomeni ekanligini aniqlash.

        Tenant subdomen EMAS (Platform / CEO domenlari):
          - 'localhost', '127.0.0.1', 'testserver'
          - settings.TENANT_CEO_DOMAINS (masalan: 'admin.crm.uz', 'app.crm.uz')
          - settings.TENANT_BASE_DOMAIN (masalan: 'crm.uz')
          - platform subdomenlari ('admin', 'ceo', 'api', 'www')

        Tenant subdomeni HISOBLANADI:
          - '*.localhost' (masalan: 'najot.localhost', 'maktab1.localhost')
          - '*.crm.uz' (masalan: 'najot.crm.uz', 'maktab1.crm.uz')
        """
        if not host:
            return False

        clean_host = host.split(':')[0].lower().strip()

        # 1. Root dev va test platform domenlari
        if clean_host in ('localhost', '127.0.0.1', 'testserver'):
            return False

        # 2. Belgilangan CEO domenlari
        ceo_domains = getattr(settings, 'TENANT_CEO_DOMAINS', set())
        if clean_host in ceo_domains:
            return False

        base_domain = getattr(settings, 'TENANT_BASE_DOMAIN', 'chronous.uz').lower().strip()
        if clean_host == base_domain:
            return False

        # 3. Localhost subdomenlari (masalan: 'najot.localhost')
        if clean_host.endswith('.localhost'):
            sub = clean_host[:-len('.localhost')].strip()
            if sub and sub not in ('localhost', '127', 'admin', 'ceo', 'www', 'api'):
                return True
            return False

        # 4. Asosiy domen subdomenlari (masalan: 'najot.crm.uz')
        if base_domain and clean_host.endswith('.' + base_domain):
            sub = clean_host[:-len('.' + base_domain)].strip()
            if sub and sub not in ('admin', 'ceo', 'www', 'api', 'mail'):
                return True
            return False

        # 5. Har qanday 3 yoki undan ko'p qismli domen (masalan: tenant.domain.com)
        parts = clean_host.split('.')
        if len(parts) >= 3 and parts[0] not in ('admin', 'ceo', 'www', 'api'):
            return True

        return False

    def _is_ceo_request(self, host: str, path: str, request) -> bool:
        """
        Bu request CEO paneliga tegishli ekanligini aniqlaydi.

        CEO requestlari faqat markaziy platforma domenlaridan ruxsat etiladi:
          - CEO domenidan kelgan (admin.crm.uz, app.crm.uz)
          - Localhost/127.0.0.1 dan developer rejimda va CEO URL prefiksiga ega bo'lganda

        Subdomenlardan kelgan so'rovlar hech qachon CEO hisoblanmaydi!
        """
        effective_host = self._get_request_subdomain_host(request, host)
        if self._is_tenant_subdomain(effective_host):
            return False

        ceo_domains = getattr(settings, 'TENANT_CEO_DOMAINS', set())
        ceo_url_prefix = getattr(settings, 'TENANT_CEO_URL_PREFIX', '/api/v1/super-admin/')

        # CEO domeni
        if host in ceo_domains:
            return True

        # CEO URL prefiksi (faqat subdomen bo'lmaganda)
        if path.startswith(ceo_url_prefix):
            return True

        # Dev rejimda localhost — CEO sifatida
        if settings.DEBUG and host in ('localhost', '127.0.0.1'):
            if path.startswith(ceo_url_prefix):
                return True

        return False

    @staticmethod
    def _is_public_request(path: str) -> bool:
        """
        Public endpoints that do not require tenant schema (public schema).
        e.g. /api/v1/public/, swagger, redoc, Django admin.
        """
        public_prefixes = (
            '/api/v1/public/',
            '/api/schema/',
            '/api/docs/',
            '/adminn/',
        )
        return any(path.startswith(prefix) for prefix in public_prefixes)

    @staticmethod
    def _resolve_tenant(host: str):
        """
        Domen yoki subdomen bo'yicha Tenant ob'ektini qaytaradi.

        Args:
            host: Toza domen (port va protokolsiz), masalan: "najot.localhost", "najot.crm.uz"

        Returns:
            Tenant instance

        Raises:
            TenantNotFoundError: Agar topilmasa
        """
        from tenants.models import Domain, Tenant
        from django.db.models import Q

        # 1. Aniq to'liq domen bo'yicha qidirish (masalan: "najot.crm.uz", "maktab1.localhost")
        domain_obj = Domain.objects.select_related('tenant').filter(domain=host).first()
        if domain_obj:
            return domain_obj.tenant

        # 2. Subdomen bo'yicha qidirish (masalan: "najot.localhost" -> subdomen "najot")
        subdomain = host.split('.')[0].lower()
        if subdomain and subdomain not in ('localhost', '127', 'www', 'api', 'admin', 'ceo'):
            # Domain jadvalida "najot.crm.uz" yoki "najot.localhost.uz" bo'lsa
            domain_by_sub = Domain.objects.select_related('tenant').filter(
                Q(domain__istartswith=f"{subdomain}.") |
                Q(tenant__schema_name__icontains=subdomain)
            ).first()
            if domain_by_sub:
                return domain_by_sub.tenant

            tenant_by_schema = Tenant.objects.filter(
                Q(schema_name=f"tenant_{subdomain}") |
                Q(schema_name__icontains=subdomain)
            ).first()
            if tenant_by_schema:
                return tenant_by_schema

        # Django test muhiti (host == 'testserver') uchun avtomatik test tenant
        if host == 'testserver':
            tenant, _ = Tenant.objects.get_or_create(
                schema_name="tenant_testserver",
                defaults={"name": "Test Server Tenant", "is_active": True}
            )
            Domain.objects.get_or_create(
                domain='testserver',
                defaults={'tenant': tenant, 'is_primary': True}
            )
            return tenant

        raise TenantNotFoundError(domain=host)

    @staticmethod
    def _activate_tenant_schema(tenant) -> None:
        """
        PostgreSQL DB ulanishi uchun search_path o'rnatadi.

        SQLite uchun (development) bu operatsiya skip qilinadi.

        Args:
            tenant: Faollashtirilishi kerak bo'lgan Tenant instance

        Raises:
            TenantSchemaError: Agar DB operatsiyasi muvaffaqiyatsiz bo'lsa
        """
        # SQLite uchun search_path mavjud emas — skip
        db_engine = settings.DATABASES.get('default', {}).get('ENGINE', '')
        if 'sqlite' in db_engine:
            logger.debug(
                "SQLite ishlatilmoqda — search_path skip qilindi (schema=%s)",
                tenant.schema_name
            )
            return

        set_search_path(tenant.schema_name)

    @staticmethod
    def _handle_dev_bypass(request, dev_schema: str):
        """
        Development uchun X-Tenant-Schema header bypass.

        Bu imkoniyat faqat DEBUG=True bo'lganda ishlaydi.
        Production'da avtomatik o'chiriladi.

        Args:
            request: Django HTTP request
            dev_schema: X-Tenant-Schema header qiymati

        Returns:
            None (davom etish) yoki JsonResponse (xato)
        """
        from tenants.models import Tenant
        from tenants.utils import validate_schema_name

        if not validate_schema_name(dev_schema):
            return JsonResponse(
                {
                    "error": f"X-Tenant-Schema qiymati noto'g'ri: '{dev_schema}'",
                    "code": "INVALID_SCHEMA",
                },
                status=400,
            )

        try:
            tenant = Tenant.objects.get(schema_name=dev_schema)
        except Tenant.DoesNotExist:
            return JsonResponse(
                {
                    "error": f"Dev bypass: '{dev_schema}' schema topilmadi",
                    "code": "TENANT_NOT_FOUND",
                },
                status=404,
            )

        if not tenant.is_active:
            return JsonResponse(
                {
                    "error": f"Dev bypass: '{tenant.name}' markazi bloklangan",
                    "code": "TENANT_INACTIVE",
                },
                status=403,
            )

        db_engine = settings.DATABASES.get('default', {}).get('ENGINE', '')
        if 'sqlite' not in db_engine:
            set_search_path(tenant.schema_name)

        request.tenant = tenant
        request.is_ceo_request = False
        set_current_tenant(tenant)

        logger.info(
            "[DEV BYPASS] X-Tenant-Schema: schema=%s, name=%s",
            dev_schema, tenant.name
        )
        return None
