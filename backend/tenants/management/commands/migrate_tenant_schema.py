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

        # ── search_path o'rnatish va izolyatsiyalangan django_migrations yaratish ─────
        try:
            with connection.cursor() as cursor:
                cursor.execute(f"SET search_path TO {schema_name}, public")
                # Tenant schemasi uchun alohida django_migrations jadvalini ta'minlash.
                # Bu public.django_migrations bilan to'qnashuvni va migratsiyalar o'tkazib yuborilishini oldini oladi.
                cursor.execute(f"""
                    CREATE TABLE IF NOT EXISTS "{schema_name}"."django_migrations" (
                        id serial PRIMARY KEY,
                        app varchar(255) NOT NULL,
                        name varchar(255) NOT NULL,
                        applied timestamp with time zone NOT NULL
                    )
                """)
            logger.info("search_path o'rnatildi va django_migrations ta'minlandi: %s", schema_name)
        except Exception as exc:
            raise CommandError(f"search_path o'rnatishda xatolik: {exc}") from exc

        # ── Migratsiya ishlatish ──────────────────────────────────────────────
        try:
            migrate_kwargs = {
                "verbosity": options.get("verbosity", 1),
                "interactive": False,
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
                    f"[OK] Schema '{schema_name}' uchun barcha migratsiyalar muvaffaqiyatli bajarildi."
                )
            )

        except Exception as exc:
            raise CommandError(f"Migratsiya muvaffaqiyatsiz: {exc}") from exc

        finally:
            # search_path ni albatta tiklash
            from tenants.utils import reset_search_path
            reset_search_path()

    def _migrate_tenant_apps(self, kwargs: dict) -> None:
        """
        Tenant schemasi uchun tegishli applarni migratsiya qiladi.

        Faqat migratsiyasi bor bo'lgan va public/celery/admin ga kirmaydigan
        tenant applari migratsiya qilinadi.
        """
        from django.conf import settings
        from django.db.migrations.loader import MigrationLoader

        loader = MigrationLoader(connection)
        migrated_apps = set(loader.migrated_apps)

        excluded_apps = {
            'tenants',
            'django_celery_beat',
            'admin',
            'sessions',
        }

        tenant_apps = [
            app for app in settings.INSTALLED_APPS
            if app in migrated_apps and app not in excluded_apps
        ]

        for app_label in tenant_apps:
            try:
                call_command("migrate", app_label, **kwargs)
                logger.debug("Migratsiya bajarildi: app=%s", app_label)
            except Exception as exc:
                logger.error("App migratsiya qilishda xatolik: app=%s, error=%s", app_label, exc)
                raise CommandError(f"App '{app_label}' migratsiya qilib bo'lmadi: {exc}") from exc
