"""
Tenants app unit testlari — Bosqich 1 tekshiruvi.

Bu testlar quyidagilarni tekshiradi:
  1. Schema nomi yaratish va validatsiya
  2. Thread-safe tenant context
  3. Middleware: CEO bypass, dev header bypass, tenant topish
  4. Model clean() validatsiyasi
"""

from django.test import TestCase, RequestFactory, override_settings
from unittest.mock import patch, MagicMock

from tenants.context import set_current_tenant, get_current_tenant, clear_current_tenant
from tenants.exceptions import TenantNotFoundError, TenantInactiveError, InvalidSchemaNameError
from tenants.utils import schema_name_from_slug, validate_schema_name, extract_subdomain


# ─────────────────────────────────────────────────────────────────────────────
# SCHEMA NAME UTILS
# ─────────────────────────────────────────────────────────────────────────────

class SchemaNameUtilsTests(TestCase):
    """schema_name_from_slug() va validate_schema_name() testlari."""

    def test_simple_name(self):
        """Oddiy markaz nomi to'g'ri schemaga aylanishi kerak."""
        result = schema_name_from_slug("najot")
        self.assertEqual(result, "tenant_najot")

    def test_name_with_spaces(self):
        """Bo'shliqli nom to'g'ri slugga aylanishi kerak."""
        result = schema_name_from_slug("Najot Talim")  # Apostrof yo'q versiya
        self.assertEqual(result, "tenant_najot_talim")

    def test_name_with_apostrophe(self):
        """Apostrof belgilari ham _ ga aylanishi kerak."""
        result = schema_name_from_slug("Najot Ta'lim")  # apostrof bor
        # apostrof ham maxsus belgi → _ ga aylanadi, so'ng strip bo'ladi
        self.assertTrue(result.startswith("tenant_najot"))
        self.assertRegex(result, r'^[a-z][a-z0-9_]+$')

    def test_name_with_dashes(self):
        """Tire ham '_' ga aylanishi kerak."""
        result = schema_name_from_slug("ustoz-academy")
        self.assertEqual(result, "tenant_ustoz_academy")

    def test_uppercase(self):
        """Katta harflar kichikka aylanishi kerak."""
        result = schema_name_from_slug("NAJOT")
        self.assertEqual(result, "tenant_najot")

    def test_valid_schema_names(self):
        """To'g'ri schema nomlarini validate qilish."""
        valid = ["tenant_najot", "tenant_abc123", "tenant_a", "tenant_x_y_z"]
        for name in valid:
            with self.subTest(name=name):
                self.assertTrue(validate_schema_name(name))

    def test_invalid_schema_names(self):
        """Noto'g'ri schema nomlarini rad etish."""
        invalid = [
            "Tenant_Najot",   # katta harf
            "1tenant",        # raqam bilan boshlash
            "tenant-najot",   # tire
            "tenant najot",   # bo'shliq
            "",               # bo'm-bo'sh
            "DROP TABLE",     # SQL injection urinish
        ]
        for name in invalid:
            with self.subTest(name=name):
                self.assertFalse(validate_schema_name(name))


# ─────────────────────────────────────────────────────────────────────────────
# SUBDOMAIN EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

class SubdomainExtractionTests(TestCase):
    """extract_subdomain() funksiyasi testlari."""

    def test_basic_subdomain(self):
        result = extract_subdomain("najot.crm.uz", "crm.uz")
        self.assertEqual(result, "najot")

    def test_admin_subdomain(self):
        result = extract_subdomain("admin.crm.uz", "crm.uz")
        self.assertEqual(result, "admin")

    def test_no_subdomain(self):
        result = extract_subdomain("crm.uz", "crm.uz")
        self.assertIsNone(result)

    def test_with_port(self):
        """Port raqami olib tashlanishi kerak."""
        result = extract_subdomain("najot.crm.uz:8000", "crm.uz")
        self.assertEqual(result, "najot")

    def test_localhost(self):
        """Localhost uchun birinchi segment qaytariladi."""
        result = extract_subdomain("najot.localhost")
        self.assertEqual(result, "najot")


# ─────────────────────────────────────────────────────────────────────────────
# THREAD-SAFE CONTEXT
# ─────────────────────────────────────────────────────────────────────────────

class TenantContextTests(TestCase):
    """Thread-safe tenant context testlari."""

    def setUp(self):
        """Har test oldidan kontekstni tozalash."""
        clear_current_tenant()

    def tearDown(self):
        """Har test keyidan ham tozalash."""
        clear_current_tenant()

    def test_set_and_get(self):
        """Tenant o'rnatilgach get_current_tenant() qaytarishi kerak."""
        mock_tenant = MagicMock()
        mock_tenant.schema_name = "tenant_test"
        mock_tenant.name = "Test Markaz"

        set_current_tenant(mock_tenant)
        result = get_current_tenant()

        self.assertIs(result, mock_tenant)

    def test_clear(self):
        """clear_current_tenant() dan keyin None qaytarishi kerak."""
        mock_tenant = MagicMock()
        set_current_tenant(mock_tenant)
        clear_current_tenant()

        result = get_current_tenant()
        self.assertIsNone(result)

    def test_default_is_none(self):
        """Hech narsa o'rnatilmasa None bo'lishi kerak."""
        result = get_current_tenant()
        self.assertIsNone(result)

    def test_thread_isolation(self):
        """Turli threadlarda tenant alohida bo'lishi kerak."""
        import threading

        results = {}

        def thread_worker(tenant_name, results_dict):
            mock = MagicMock()
            mock.schema_name = f"tenant_{tenant_name}"
            mock.name = tenant_name
            set_current_tenant(mock)
            # Biroz kutish — boshqa thread bilan race condition tekshirish
            import time
            time.sleep(0.01)
            results_dict[tenant_name] = get_current_tenant()
            clear_current_tenant()

        t1 = threading.Thread(target=thread_worker, args=("alpha", results))
        t2 = threading.Thread(target=thread_worker, args=("beta", results))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Har bir thread o'z tenant'ini olishi kerak
        self.assertEqual(results["alpha"].schema_name, "tenant_alpha")
        self.assertEqual(results["beta"].schema_name, "tenant_beta")


# ─────────────────────────────────────────────────────────────────────────────
# EXCEPTIONS
# ─────────────────────────────────────────────────────────────────────────────

class ExceptionTests(TestCase):
    """Custom exception sinflar testlari."""

    def test_tenant_not_found_with_domain(self):
        exc = TenantNotFoundError(domain="unknown.crm.uz")
        self.assertIn("unknown.crm.uz", str(exc))
        self.assertEqual(exc.domain, "unknown.crm.uz")

    def test_tenant_inactive(self):
        exc = TenantInactiveError(tenant_name="Najot Ta'lim")
        self.assertIn("Najot", str(exc))
        self.assertEqual(exc.tenant_name, "Najot Ta'lim")

    def test_invalid_schema_name(self):
        exc = InvalidSchemaNameError("INVALID SCHEMA!")
        self.assertIn("INVALID SCHEMA!", str(exc))
        self.assertEqual(exc.schema_name, "INVALID SCHEMA!")


# ─────────────────────────────────────────────────────────────────────────────
# MIDDLEWARE TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TenantMiddlewareTests(TestCase):
    """TenantMiddleware testlari."""

    def setUp(self):
        self.factory = RequestFactory()
        self.get_response = MagicMock(return_value=MagicMock(status_code=200))

    def _get_middleware(self):
        from tenants.middleware import TenantMiddleware
        return TenantMiddleware(self.get_response)

    @override_settings(
        TENANT_CEO_URL_PREFIX='/api/v1/super-admin/',
        TENANT_CEO_DOMAINS={'admin.crm.uz'},
        DEBUG=True,
    )
    def test_ceo_url_prefix_bypasses_tenant_check(self):
        """CEO URL prefiksi tenant tekshiruvini chetlab o'tishi kerak."""
        middleware = self._get_middleware()
        request = self.factory.get(
            '/api/v1/super-admin/tenants/',
            SERVER_NAME='localhost',
            SERVER_PORT='8000',
        )
        request.META['HTTP_HOST'] = 'localhost:8000'

        response = middleware.process_request(request)

        # None qaytishi kerak (davom etish)
        self.assertIsNone(response)
        # Tenant o'rnatilmagan bo'lishi kerak
        self.assertIsNone(request.tenant)
        self.assertTrue(request.is_ceo_request)

    @override_settings(
        TENANT_CEO_URL_PREFIX='/api/v1/super-admin/',
        TENANT_CEO_DOMAINS={'admin.crm.uz'},
        TENANT_DEV_SCHEMA_HEADER=False,
        DEBUG=True,
    )
    def test_unknown_domain_returns_404(self):
        """Noma'lum domendan kelgan so'rov 404 qaytarishi kerak."""
        from tenants.exceptions import TenantNotFoundError

        middleware = self._get_middleware()

        # _resolve_tenant ni to'g'ridan-to'g'ri patch qilamiz
        with patch.object(
            middleware.__class__,
            '_resolve_tenant',
            staticmethod(lambda host: (_ for _ in ()).throw(TenantNotFoundError(domain="unknown.crm.uz")))
        ):
            request = self.factory.get('/api/some-path/')
            request.META['HTTP_HOST'] = 'unknown.crm.uz'
            response = middleware.process_request(request)

        self.assertEqual(response.status_code, 404)

    @override_settings(
        TENANT_CEO_URL_PREFIX='/api/v1/super-admin/',
        TENANT_CEO_DOMAINS={'admin.crm.uz'},
        TENANT_DEV_SCHEMA_HEADER=False,
        DEBUG=True,
    )
    def test_inactive_tenant_returns_403(self):
        """Bloklangan tenant 403 qaytarishi kerak."""
        mock_tenant = MagicMock()
        mock_tenant.is_active = False
        mock_tenant.name = "Bloklangan Markaz"
        mock_tenant.schema_name = "tenant_blocked"

        middleware = self._get_middleware()

        with patch.object(middleware, '_resolve_tenant', return_value=mock_tenant):
            request = self.factory.get('/api/groups/')
            request.META['HTTP_HOST'] = 'blocked.crm.uz'

            response = middleware.process_request(request)

        self.assertEqual(response.status_code, 403)
