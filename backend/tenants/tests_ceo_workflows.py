"""Regressions for CEO provisioning, routing, plans and one-time login."""
from datetime import timedelta
import io
import uuid
from unittest import skipUnless
from django.db import connection
from django.core.management import call_command
from tenants.auth import generate_ceo_tokens
from tenants.utils import tenant_schema_context, reset_search_path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, TransactionTestCase, RequestFactory, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, APIClient, force_authenticate
from rest_framework_simplejwt.tokens import AccessToken

from tenants.context import clear_current_tenant
from tenants.exceptions import TenantNotFoundError
from tenants.middleware import TenantMiddleware
from tenants.models import Tenant, Domain, Subscription, CEOUser, ImpersonationGrant
from tenants.plans import PLAN_SETTINGS
from tenants.services import TenantProvisioningService, TenantDeprovisioningService
from tenants.views import (TenantListCreateView, TenantDetailView,
                           TenantImpersonateView, TenantImpersonationExchangeView)


class CEOWorkflowTests(TestCase):
    def setUp(self):
        cache.clear()
        self.tenant = Tenant.objects.create(name="Academy", schema_name="tenant_academy")
        Domain.objects.create(domain="academy.chronous.uz", tenant=self.tenant)
        self.other = Tenant.objects.create(name="Other", schema_name="tenant_other")
        Domain.objects.create(domain="other.chronous.uz", tenant=self.other)
        self.ceo = CEOUser.objects.create(email="ceo@example.com", full_name="CEO")
        self.admin = get_user_model().objects.create_user(username="owner", role="super_admin", password="test-password")
        Subscription.objects.create(tenant=self.tenant, plan="starter", **PLAN_SETTINGS["starter"],
                                    expires_at=timezone.now() + timedelta(days=30))
        self.factory = APIRequestFactory()
        # Unit tests exercise context/claims while keeping fixtures in the test
        # database's public schema. PostgreSQL lifecycle tests cover real schemas.
        self.schema_patch = patch("tenants.utils.set_search_path")
        self.schema_patch.start()
        self.addCleanup(self.schema_patch.stop)
        self.addCleanup(clear_current_tenant)

    def ceo_request(self, view, method, data=None, **kwargs):
        request = getattr(self.factory, method)("/", data, format="json")
        force_authenticate(request, user=self.ceo)
        return view.as_view()(request, **kwargs)

    def issue(self):
        response = self.ceo_request(TenantImpersonateView, "post", tenant_id=self.tenant.pk)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertEqual(response.data["domain"], "academy.chronous.uz")
        self.assertEqual(response["Cache-Control"], "no-store")
        return response.data["code"]

    def redeem(self, code, tenant=None):
        request = self.factory.post("/", {"code": code}, format="json")
        request.tenant = tenant or self.tenant
        return TenantImpersonationExchangeView.as_view()(request)

    def test_create_calls_provisioning_and_returns_201(self):
        with patch("tenants.views.TenantProvisioningService.provision", return_value={
            "tenant": self.tenant, "admin_user": self.admin, "schema_name": self.tenant.schema_name,
        }) as provision, patch("tenants.serializers.get_tenant_stats_and_admin", return_value=({}, None)):
            response = self.ceo_request(TenantListCreateView, "post", {
                "name": "New Academy", "domain": "new.chronous.uz", "admin_email": "new@example.com",
                "admin_password": "SecurePassword123!",
            })
        self.assertEqual(response.status_code, 201, response.data)
        provision.assert_called_once()

    def test_retained_postgres_schema_is_not_reallocated(self):
        service = TenantProvisioningService()
        with patch.object(service, "_get_db_engine", return_value="postgresql"), patch(
            "tenants.services.schema_exists", side_effect=lambda name: name == "tenant_old"
        ):
            self.assertEqual(service._generate_unique_schema_name("Old"), "tenant_old_2")

    def test_schema_creation_refuses_existing_schema(self):
        service = TenantProvisioningService()
        with patch.object(service, "_get_db_engine", return_value="postgresql"), patch(
            "tenants.services.schema_exists", return_value=True
        ), self.assertRaises(ValueError):
            service._create_postgres_schema("tenant_old")

    def test_partial_and_unregistered_domains_are_rejected(self):
        for host in ("acad.chronous.uz", "academy.evil.test", "academy.localhost"):
            with self.subTest(host=host), self.assertRaises(TenantNotFoundError):
                TenantMiddleware._resolve_tenant(host)

    def test_legacy_cached_tenant_cannot_survive_deletion(self):
        host = "academy.chronous.uz"
        cache.set(f"tenant_resolved_obj_{host}", self.tenant, 600)
        TenantDeprovisioningService().deprovision(self.tenant)
        with self.assertRaises(TenantNotFoundError):
            TenantMiddleware._resolve_tenant(host)

    def test_legacy_cached_tenant_cannot_survive_block(self):
        host = "academy.chronous.uz"
        cache.set(f"tenant_resolved_obj_{host}", self.tenant, 600)
        self.tenant.is_active = False
        self.tenant.save()
        request = RequestFactory().get("/api/groups/", HTTP_HOST=host)
        response = TenantMiddleware(lambda r: None).process_request(request)
        self.assertEqual(response.status_code, 403)

    @override_settings(DEBUG=False, USE_X_FORWARDED_HOST=True)
    def test_headers_cannot_override_host_for_ceo_or_tenant_routing(self):
        for header in ("HTTP_X_TENANT_DOMAIN", "HTTP_X_FORWARDED_HOST"):
            with self.subTest(header=header):
                request = RequestFactory().get("/api/v1/super-admin/tenants/",
                    HTTP_HOST="academy.chronous.uz", **{header: "admin.chronous.uz"})
                response = TenantMiddleware(lambda r: None).process_request(request)
                self.assertEqual(response.status_code, 403)
                request = RequestFactory().get("/api/groups/", HTTP_HOST="academy.chronous.uz",
                                              **{header: "other.chronous.uz"})
                self.assertEqual(TenantMiddleware._get_host(request), "academy.chronous.uz")

    @override_settings(DEBUG=True, TENANT_DEV_SCHEMA_HEADER=True)
    def test_exchange_ignores_stale_dev_schema_header(self):
        request = RequestFactory().post("/api/v1/auth/impersonation/exchange/",
            HTTP_HOST="academy.chronous.uz", HTTP_X_TENANT_SCHEMA=self.other.schema_name)
        middleware = TenantMiddleware(lambda r: None)
        with patch.object(middleware, "_activate_tenant_schema"):
            response = middleware.process_request(request)
        self.assertIsNone(response)
        self.assertEqual(request.tenant.pk, self.tenant.pk)

    def test_plan_updates_price_limits_and_preserves_expiry(self):
        expires = self.tenant.subscription.expires_at
        with patch("tenants.serializers.get_tenant_stats_and_admin", return_value=({}, None)):
            response = self.ceo_request(TenantDetailView, "patch", {"plan": "enterprise"}, tenant_id=self.tenant.pk)
        self.assertEqual(response.status_code, 200, response.data)
        sub = Subscription.objects.get(tenant=self.tenant)
        for field, value in PLAN_SETTINGS["enterprise"].items():
            self.assertEqual(getattr(sub, field), value)
        self.assertEqual(sub.expires_at, expires)
        self.assertEqual(response.data["subscription"]["plan"], "enterprise")

    def test_invalid_plan_does_not_partially_save_tenant(self):
        response = self.ceo_request(TenantDetailView, "patch", {"name": "Changed", "plan": "invalid"}, tenant_id=self.tenant.pk)
        self.assertEqual(response.status_code, 400)
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.name, "Academy")

    def test_invalid_pagination_is_400(self):
        for query in ({"page_size": 0}, {"page_size": -1}, {"page_size": 101}, {"page": "abc"}, {"page": 0}):
            with self.subTest(query=query):
                response = self.ceo_request(TenantListCreateView, "get", query)
                self.assertEqual(response.status_code, 400)

    def test_valid_pagination(self):
        response = self.ceo_request(TenantListCreateView, "get", {"page_size": 1, "page": 2})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["pages"], 2)

    def test_one_time_code_returns_tenant_bound_tokens_once(self):
        code = self.issue()
        self.assertNotEqual(ImpersonationGrant.objects.get().code_hash, code)
        response = self.redeem(code)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(AccessToken(response.data["access"])["tenant_schema"], self.tenant.schema_name)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(self.redeem(code).status_code, 400)

    def test_wrong_tenant_cannot_redeem_or_consume_code(self):
        code = self.issue()
        self.assertEqual(self.redeem(code, self.other).status_code, 400)
        self.assertIsNone(ImpersonationGrant.objects.get().consumed_at)
        self.assertEqual(self.redeem(code).status_code, 200)

    def test_expired_code_is_rejected(self):
        code = self.issue()
        ImpersonationGrant.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.redeem(code).status_code, 400)

    def test_inactive_ceo_cannot_redeem_existing_code(self):
        code = self.issue()
        CEOUser.objects.filter(pk=self.ceo.pk).update(is_active=False)
        self.assertEqual(self.redeem(code).status_code, 400)

    def test_blocked_tenant_cannot_redeem_existing_code(self):
        code = self.issue()
        Tenant.objects.filter(pk=self.tenant.pk).update(is_active=False)
        self.assertEqual(self.redeem(code).status_code, 400)

    def test_inactive_admin_cannot_redeem_existing_code(self):
        code = self.issue()
        get_user_model().objects.filter(pk=self.admin.pk).update(is_active=False)
        self.assertEqual(self.redeem(code).status_code, 403)

    def test_deactivated_admin_cannot_receive_a_grant(self):
        self.admin.is_active = False
        self.admin.save()
        response = self.ceo_request(TenantImpersonateView, "post", tenant_id=self.tenant.pk)
        self.assertEqual(response.status_code, 404)

    def test_custom_domain_is_returned_without_rewriting(self):
        Domain.objects.filter(tenant=self.tenant).update(domain="academy.example.org")
        response = self.ceo_request(TenantImpersonateView, "post", tenant_id=self.tenant.pk)
        self.assertEqual(response.data["domain"], "academy.example.org")

    def test_unauthenticated_and_tenant_users_cannot_issue_grants(self):
        request = self.factory.post("/")
        response = TenantImpersonateView.as_view()(request, tenant_id=self.tenant.pk)
        self.assertEqual(response.status_code, 401)
        request = self.factory.post("/")
        force_authenticate(request, user=self.admin)
        response = TenantImpersonateView.as_view()(request, tenant_id=self.tenant.pk)
        self.assertEqual(response.status_code, 403)

    def test_public_resolver_requires_registered_domain(self):
        response = self.client.get("/api/v1/public/tenants/resolve/", {"subdomain": "acad"})
        self.assertEqual(response.status_code, 404)
        response = self.client.get("/api/v1/public/tenants/resolve/", {"subdomain": "academy"})
        self.assertEqual(response.status_code, 200)


@skipUnless(connection.vendor == "postgresql", "Requires isolated PostgreSQL")
class CEOPostgresLifecycleTests(TransactionTestCase):
    client_class = APIClient

    def test_create_delete_recreate_and_redeem_on_real_schemas(self):
        self.assertTrue(connection.settings_dict["NAME"].startswith("test_"))
        name = "Lifecycle " + uuid.uuid4().hex[:12]
        service = TenantProvisioningService()
        original = service._generate_unique_schema_name(name)
        schemas = [original, original + "_2"]
        ceo = CEOUser.objects.create(email="lifecycle@example.com", full_name="CEO")
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + generate_ceo_tokens(ceo)["access"])
        payload = {"name": name, "domain": "lifecycle.chronous.uz", "admin_email": "owner@example.com",
                   "admin_password": "SecureLifecycle123!", "plan": "pro"}

        def migrate_in_test_database(_service, schema):
            call_command("migrate_tenant_schema", schema, verbosity=0, stdout=io.StringIO())

        try:
            with patch.object(TenantProvisioningService, "_run_migrations_for_schema", migrate_in_test_database):
                response = self.client.post("/api/v1/super-admin/tenants/", payload, format="json")
                self.assertEqual(response.status_code, 201, response.data)
                first = Tenant.objects.get(pk=response.data["tenant"]["id"])
                self.assertEqual(response.data["tenant"]["super_admin"]["username"], "owner")
                with tenant_schema_context(first):
                    with connection.cursor() as cursor:
                        cursor.execute("CREATE TABLE retention_probe (id integer)")
                response = self.client.delete(f"/api/v1/super-admin/tenants/{first.pk}/",
                                             {"confirm_name": name}, format="json")
                self.assertEqual(response.status_code, 200, response.data)
                self.assertFalse(response.data["schema_dropped"])
                response = self.client.post("/api/v1/super-admin/tenants/", payload, format="json")
                self.assertEqual(response.status_code, 201, response.data)
                second = Tenant.objects.get(pk=response.data["tenant"]["id"])
                self.assertEqual(second.schema_name, original + "_2")
            with connection.cursor() as cursor:
                cursor.execute("SELECT to_regclass(%s), to_regclass(%s)",
                               [original + ".retention_probe", second.schema_name + ".retention_probe"])
                retained, fresh = cursor.fetchone()
                self.assertIsNotNone(retained)
                self.assertIsNone(fresh)
            response = self.client.post(f"/api/v1/super-admin/tenants/{second.pk}/impersonate/")
            self.assertEqual(response.status_code, 200, response.data)
            code = response.data["code"]
            self.client.credentials()
            response = self.client.post("/api/v1/auth/impersonation/exchange/", {"code": code},
                                        format="json", HTTP_HOST="lifecycle.chronous.uz")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(AccessToken(response.data["access"])["tenant_schema"], second.schema_name)
            replay = self.client.post("/api/v1/auth/impersonation/exchange/", {"code": code},
                                     format="json", HTTP_HOST="lifecycle.chronous.uz")
            self.assertEqual(replay.status_code, 400)
            # Simultaneous requests must not redeem the same grant twice.
            from concurrent.futures import ThreadPoolExecutor
            from threading import Barrier
            from django.db import close_old_connections, connections
            self.client.credentials(HTTP_AUTHORIZATION="Bearer " + generate_ceo_tokens(ceo)["access"])
            issued = self.client.post(f"/api/v1/super-admin/tenants/{second.pk}/impersonate/")
            self.assertEqual(issued.status_code, 200, issued.data)
            simultaneous_code = issued.data["code"]
            barrier = Barrier(2)

            def redeem_concurrently():
                close_old_connections()
                try:
                    barrier.wait(timeout=10)
                    return APIClient().post("/api/v1/auth/impersonation/exchange/",
                        {"code": simultaneous_code}, format="json",
                        HTTP_HOST="lifecycle.chronous.uz").status_code
                finally:
                    connections.close_all()

            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = [executor.submit(redeem_concurrently) for _ in range(2)]
                self.assertEqual(sorted(f.result(timeout=20) for f in futures), [200, 400])
        finally:
            reset_search_path()
            with connection.cursor() as cursor:
                for schema in schemas:
                    cursor.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
