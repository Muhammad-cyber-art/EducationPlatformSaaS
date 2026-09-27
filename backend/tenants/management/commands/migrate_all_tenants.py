"""
migrate_all_tenants — Barcha aktiv tenantlar schemalariga migratsiyalarni qo'llash.

Serverga yangi kod deploy qilinganda migratsiyalarni public schema va barcha
tenant schemalariga birdaniga qo'llash uchun ishlatiladi:

    python manage.py migrate_all_tenants
"""

import logging
from django.core.management import call_command
from django.core.management.base import BaseCommand
from tenants.models import Tenant

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Public schema va barcha faol tenant schemalariga Django migratsiyalarini qo'llaydi."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-public",
            action="store_true",
            default=False,
            help="Public schema migratsiyasini o'tkazib yuborish",
        )
        parser.add_argument(
            "--fake-initial",
            action="store_true",
            default=False,
            help="Allaqachon yaratilgan jadvallar uchun migratsiyalarni fake qilish",
        )

    def handle(self, *args, **options):
        skip_public = options["skip_public"]
        fake_initial = options["fake_initial"]

        if not skip_public:
            self.stdout.write(self.style.MIGRATE_HEADING("1. Public schema migratsiyasi bajarilmoqda..."))
            call_command("migrate", interactive=False)
            self.stdout.write(self.style.SUCCESS("[OK] Public schema migratsiyasi tayyor."))

        tenants = Tenant.objects.filter(is_active=True).order_by("id")
        count = tenants.count()
        self.stdout.write(self.style.MIGRATE_HEADING(f"2. Barcha tenantlar ({count} ta) migratsiyasi boshlanmoqda..."))

        success_count = 0
        error_tenants = []

        for tenant in tenants:
            schema = tenant.schema_name
            self.stdout.write(f"-> Tenant: '{tenant.name}' (schema: {schema}) migratsiya qilinmoqda...")
            try:
                call_command(
                    "migrate_tenant_schema",
                    schema,
                    fake_initial=fake_initial,
                    verbosity=0,
                )
                success_count += 1
                self.stdout.write(self.style.SUCCESS(f"   [OK] {schema} muvaffaqiyatli migratsiya qilindi."))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"   [XATO] {schema}: {e}"))
                error_tenants.append((tenant.name, schema, str(e)))

        self.stdout.write(self.style.SUCCESS(
            f"\nMigratsiya yakunlandi: {success_count}/{count} ta tenant muvaffaqiyatli yangilandi."
        ))
        if error_tenants:
            self.stderr.write(self.style.ERROR(f"Xatolik yuz bergan tenantlar soni: {len(error_tenants)}"))
            for name, schema, err in error_tenants:
                self.stderr.write(self.style.ERROR(f" - {name} ({schema}): {err}"))
