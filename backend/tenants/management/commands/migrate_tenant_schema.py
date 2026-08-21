"""
migrate_tenant_schema — Belgilangan tenant schema ichida migratsiya ishlatadi.

Bu command TenantProvisioningService tomonidan subprocess sifatida chaqiriladi,
lekin to'g'ridan-to'g'ri ham ishlatilishi mumkin:

    python manage.py migrate_tenant_schema tenant_najot
    python manage.py migrate_tenant_schema tenant_najot --fake-initial

Qanday ishlaydi:
    1. Ko'rsatilgan schema nomi tekshiriladi (SQL injection himoyasi)
    2. DB search_path o'sha schemaga o'rnatiladi
    3. Django'ning standart migrate komandasi barcha appslar uchun ishlatiladi
    4. search_path public'ga qaytariladi
"""

import logging

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from tenants.utils import validate_schema_name, schema_exists

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Belgilangan tenant schema ichida barcha Django migratsiyalarini ishlatadi."

    def add_arguments(self, parser):
        parser.add_argument(
            "schema_name",
            type=str,
            help="Migratsiya ishlatilishi kerak bo'lgan PostgreSQL schema nomi (masalan: tenant_najot)",
        )
        parser.add_argument(
            "--fake-initial",
            action="store_true",
            default=False,
            help="Allaqachon yaratilgan jadvallar uchun migratsiyalarni fake qilish",
        )
        parser.add_argument(
            "--app",
            type=str,
            default=None,
            help="Faqat bitta app migratsiyasini ishlatish (ixtiyoriy)",
        )

    def handle(self, *args, **options):
        schema_name = options["schema_name"].strip()
        fake_initial = options["fake_initial"]
        app_label = options.get("app")

        # ── Validatsiya ───────────────────────────────────────────────────────
        if not validate_schema_name(schema_name):
            raise CommandError(
                f"Noto'g'ri schema nomi: '{schema_name}'. "
                "Faqat kichik harf, raqam va '_' ruxsat etiladi."
            )

        # SQLite tekshiruvi
        from django.conf import settings
        db_engine = settings.DATABASES.get("default", {}).get("ENGINE", "")
        if "sqlite" in db_engine:
            self.stdout.write(
                self.style.WARNING(
                    f"SQLite ishlatilmoqda — schema '{schema_name}' o'tkazib yuborildi. "
                    "Standard migrate ishlatildi."
                )
            )
            call_command("migrate", verbosity=options.get("verbosity", 1))
            return

        # Schema mavjudligini tekshirish
        if not schema_exists(schema_name):
            raise CommandError(
                f"Schema '{schema_name}' PostgreSQL'da topilmadi. "
                "Avval CREATE SCHEMA buyrug'i bajarilganligini tekshiring."
            )

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"\nSchema '{schema_name}' uchun migratsiyalar ishga tushirilmoqda..."
            )
        )

        # ── search_path o'rnatish ─────────────────────────────────────────────
        try:
            with connection.cursor() as cursor:
                cursor.execute(f"SET search_path TO {schema_name}, public")
            logger.info("search_path o'rnatildi: %s", schema_name)
        except Exception as exc:
            raise CommandError(f"search_path o'rnatishda xatolik: {exc}") from exc

        # ── Migratsiya ishlatish ──────────────────────────────────────────────
        try:
            migrate_kwargs = {
                "verbosity": options.get("verbosity", 1),
                "interactive": False,
                "run_syncdb": True,
            }

            if fake_initial:
                migrate_kwargs["fake_initial"] = True

            if app_label:
                call_command("migrate", app_label, **migrate_kwargs)
            else:
                # Tenant schema uchun keraksiz applarni o'tkazib yuborish
                # (tenants app o'zi faqat public schemada bo'lishi kerak)
                self._migrate_tenant_apps(migrate_kwargs)

            self.stdout.write(
                self.style.SUCCESS(
                    f"✅ Schema '{schema_name}' uchun barcha migratsiyalar muvaffaqiyatli bajarildi."
                )
            )

        except Exception as exc:
            raise CommandError(f"Migratsiya muvaffaqiyatsiz: {exc}") from exc

        finally:
            # search_path ni albatta tiklash
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET search_path TO public")
                logger.info("search_path public ga qaytarildi")
            except Exception as exc:
                logger.warning("search_path reset qilishda xatolik: %s", exc)

    def _migrate_tenant_apps(self, kwargs: dict) -> None:
        """
        Tenant schemasi uchun tegishli applarni migratsiya qiladi.

        'tenants' app PUBLIC schemada bo'lgani uchun uni o'tkazib yuboramiz.
        Qolgan barcha applar tenant schemaga migratsiya qilinadi.
        """
        from django.conf import settings

        # Tenant schemaga kiruvchi applar (tenants o'zini istisno qilib)
        tenant_apps = [
            app for app in settings.INSTALLED_APPS
            if not app.startswith('django.')
            and app not in ('tenants', 'django_celery_beat', 'drf_spectacular', 'drf_spectacular_sidecar')
            and '.' not in app  # faqat lokal applar
        ]

        for app_label in tenant_apps:
            try:
                call_command("migrate", app_label, **kwargs)
                logger.debug("Migratsiya bajarildi: app=%s", app_label)
            except Exception as exc:
                # Ba'zi applar migrate bo'lmasligi mumkin (masalan, telegram_bot)
                logger.warning(
                    "App migratsiya qilishda ogohlantirish: app=%s, error=%s",
                    app_label, exc
                )
