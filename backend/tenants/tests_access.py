from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from tenants.auth import generate_ceo_tokens
from tenants.models import Tenant, Domain, CEOUser


class TenantDocumentAccessTests(TestCase):
    client_class = APIClient
    path = '/api/v1/public/tenants/access/'

    def setUp(self):
        cache.clear()
        self.tenant = Tenant.objects.create(name='School', schema_name='tenant_school')
        Domain.objects.create(domain='school.chronous.uz', tenant=self.tenant)

    def test_active_tenant_is_admitted_without_login_or_schema_activation(self):
        with patch('tenants.middleware.TenantMiddleware._activate_tenant_schema') as activate:
            response = self.client.get(self.path, HTTP_HOST='school.chronous.uz')
        self.assertEqual(response.status_code, 204)
        activate.assert_not_called()
        self.assertIn('no-store', response['Cache-Control'])

    def test_blocked_tenant_cannot_receive_document_admission(self):
        Tenant.objects.filter(pk=self.tenant.pk).update(is_active=False)
        response = self.client.get(self.path, HTTP_HOST='school.chronous.uz')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], 'TENANT_INACTIVE')
        self.assertEqual(response.data['error'], 'Malumot olishda xatolik')
        self.assertNotIn('School', str(response.data))
        self.assertIn('no-store', response['Cache-Control'])

    def test_unknown_or_partial_host_is_denied(self):
        for host in ('scho.chronous.uz', 'unknown.chronous.uz'):
            with self.subTest(host=host):
                self.assertEqual(self.client.get(self.path, HTTP_HOST=host).status_code, 403)

    def test_main_platform_and_ceo_remain_accessible(self):
        for host in ('chronous.uz', 'www.chronous.uz', 'admin.chronous.uz'):
            with self.subTest(host=host), patch('tenants.middleware.TenantMiddleware._resolve_tenant') as resolve:
                self.assertEqual(self.client.get(self.path, HTTP_HOST=host).status_code, 204)
                resolve.assert_not_called()

    @override_settings(ALLOWED_HOSTS=['school.example'])
    def test_custom_domain_uses_same_blocking_policy(self):
        Domain.objects.filter(tenant=self.tenant).update(domain='school.example')
        self.assertEqual(self.client.get(self.path, HTTP_HOST='school.example').status_code, 204)
        Tenant.objects.filter(pk=self.tenant.pk).update(is_active=False)
        self.assertEqual(self.client.get(self.path, HTTP_HOST='school.example').status_code, 403)

    @override_settings(DEBUG=False, USE_X_FORWARDED_HOST=True)
    def test_client_headers_cannot_bypass_admission(self):
        Tenant.objects.filter(pk=self.tenant.pk).update(is_active=False)
        response = self.client.get(self.path, HTTP_HOST='school.chronous.uz',
                                   HTTP_X_TENANT_DOMAIN='admin.chronous.uz', HTTP_X_FORWARDED_HOST='admin.chronous.uz')
        self.assertEqual(response.status_code, 403)

    @override_settings(DEBUG=True, TENANT_DEV_SCHEMA_HEADER=True)
    def test_localhost_tenant_is_checked_without_trusting_schema_header(self):
        Domain.objects.filter(tenant=self.tenant).update(domain='school.localhost')
        Tenant.objects.filter(pk=self.tenant.pk).update(is_active=False)
        response = self.client.get(self.path, HTTP_HOST='localhost',
                                   HTTP_X_TENANT_DOMAIN='school.localhost', HTTP_X_TENANT_SCHEMA='tenant_fake')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], 'TENANT_INACTIVE')

    def test_ceo_block_and_unblock_changes_admission_without_cached_status(self):
        ceo = CEOUser.objects.create(email='ceo@example.com', full_name='CEO')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + generate_ceo_tokens(ceo)['access'])
        path = f'/api/v1/super-admin/tenants/{self.tenant.pk}/toggle-status/'
        for active, expected in ((False, 403), (True, 204)):
            result = self.client.patch(path, {'is_active': active}, format='json')
            self.assertEqual(result.status_code, 200)
            response = self.client.get(self.path, HTTP_HOST='school.chronous.uz')
            self.assertEqual(response.status_code, expected)
