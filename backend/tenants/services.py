"""
TenantProvisioningService — Yangi tenant (o'quv markaz) yaratish servisi.

Bu servis yangi tenant yaratilganda quyidagi ishlarni ketma-ket bajaradi:
  1. public.tenants jadvaliga yozuv qo'shadi
  2. public.tenants_domain jadvaliga domen qo'shadi
  3. public.tenants_subscription jadvaliga obuna qo'shadi
  4. PostgreSQL'da yangi schema yaratadi: CREATE SCHEMA tenant_xyz
  5. Yangi schema ichida barcha app migratsiyalarini ishlatadi
  6. Markazning birinchi super_admin foydalanuvchisini yaratadi

Atomik operatsiya:
  - Har qanday bosqichda xatolik yuz bersa, yaratilgan yozuvlar
    o'chiriladi (rollback), lekin PostgreSQL schemasi qo'lda o'chirilishi
    kerak (CREATE SCHEMA transaction ichida rollback bo'ladi).
"""

import logging
import re
import subprocess
import sys
from contextlib import contextmanager
from datetime import timedelta

from django.db import connection, transaction
from django.utils import timezone

from tenants.exceptions import TenantSchemaError, InvalidSchemaNameError
from tenants.models import Tenant, Domain, Subscription, CEOUser
from tenants.utils import schema_name_from_slug, schema_exists, validate_schema_name

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# PROVISIONING SERVICE
# ─────────────────────────────────────────────────────────────────────────────

class TenantProvisioningService:
    """
    Yangi o'quv markaz (tenant) yaratishni boshqaruvchi servis.

    Ishlatish:
        service = TenantProvisioningService()
        result = service.provision(
            name="Najot Ta'lim",
            domain="najot.crm.uz",
            plan="pro",
            admin_email="admin@najot.crm.uz",
            admin_password="SecurePass123!",
            admin_full_name="Abdulloh Rahimov",
            trial_days=30,
        )
        # result = {"tenant": <Tenant>, "admin_user": <UserModel>, ...}
    """

    def provision(
        self,
        *,
        name: str,
        domain: str,
        plan: str = "starter",
        admin_email: str,
        admin_password: str,
        admin_full_name: str = "",
        admin_phone: str = "",
        trial_days: int = 30,
        city: str = "",
        contact_phone: str = "",
        telegram_bot_token: str = "",
    ) -> dict:
        """
        Yangi tenant to'liq provisioning jarayonini bajaradi.

        Args:
            name: O'quv markaz nomi, masalan: "Najot Ta'lim"
            domain: Tenant domeni, masalan: "najot.crm.uz"
            plan: Tarif rejasi: 'starter' | 'pro' | 'enterprise'
            admin_email: Birinchi admin email
            admin_password: Birinchi admin paroli
            admin_full_name: Birinchi admin to'liq ismi
            admin_phone: Birinchi admin telefon raqami
            trial_days: Sinov davri (kun)
            city: Markaz shahri
            contact_phone: Markaz aloqa telefoni
            telegram_bot_token: Markaz shaxsiy Telegram bot tokeni

        Returns:
            dict: {
                "tenant": Tenant,
                "domain": Domain,
                "subscription": Subscription,
                "admin_user": UserModel (tenant schemadagi),
                "schema_name": str,
            }

        Raises:
            ValueError: Agar parametrlar noto'g'ri bo'lsa
            TenantSchemaError: DB bilan ishlashda xatolik
        """
        # ── Validatsiya ───────────────────────────────────────────────────────
        schema_name = self._generate_unique_schema_name(name)
        self._validate_provision_params(name, domain, plan, admin_email, admin_password)

        logger.info(
            "Provisioning boshlandi: name=%s, domain=%s, schema=%s",
            name, domain, schema_name
        )

        # ── Asosiy jarayon (transaction ichida) ───────────────────────────────
        with transaction.atomic():
            # Qadam 1: Public schema yozuvlari
            tenant = self._create_tenant_record(name, schema_name, city, contact_phone, telegram_bot_token)
            domain_obj = self._create_domain_record(tenant, domain)
            subscription = self._create_subscription_record(tenant, plan, trial_days)

            # Qadam 2: PostgreSQL schema yaratish
            self._create_postgres_schema(schema_name)

        try:
            # Qadam 3: Schema ichida migratsiya (transaction tashqarisida — alohida connection)
            self._run_migrations_for_schema(schema_name)

            # Qadam 4: Birinchi admin user yaratish (tenant schema ichida)
            admin_user = self._create_first_admin(
                schema_name=schema_name,
                email=admin_email,
                password=admin_password,
                full_name=admin_full_name,
                phone=admin_phone,
            )
        except Exception as exc:
            logger.error(
                "Provisioning xatolik bilan to'xtadi, rollback bajarilmoqda: schema=%s, xato=%s",
                schema_name, exc
            )
            try:
                TenantDeprovisioningService().deprovision(tenant, drop_schema=True)
            except Exception as cleanup_exc:
                logger.error("Rollback jarayonida xatolik: %s", cleanup_exc)
            raise

        logger.info(
            "Provisioning muvaffaqiyatli tugadi: tenant=%s, schema=%s",
            tenant.name, schema_name
        )

        return {
            "tenant": tenant,
            "domain": domain_obj,
            "subscription": subscription,
            "admin_user": admin_user,
            "schema_name": schema_name,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # PRIVATE METODLAR
    # ─────────────────────────────────────────────────────────────────────────

    def _validate_provision_params(
        self, name: str, domain: str, plan: str, email: str, password: str
    ) -> None:
        """Barcha parametrlarni tekshiradi."""
        if not name or len(name.strip()) < 2:
            raise ValueError("Markaz nomi kamida 2 belgidan iborat bo'lishi kerak.")

        if not domain or '.' not in domain:
            raise ValueError(f"Noto'g'ri domen formati: '{domain}'")

        # Domen band ekanligini tekshirish
        if Domain.objects.filter(domain=domain.lower()).exists():
            raise ValueError(f"'{domain}' domeni allaqachon band.")

        valid_plans = [choice[0] for choice in Subscription.PLAN_CHOICES]
        if plan not in valid_plans:
            raise ValueError(f"Noto'g'ri tarif rejasi: '{plan}'. Mumkinlar: {valid_plans}")

        if not email or '@' not in email:
            raise ValueError(f"Noto'g'ri email manzil: '{email}'")

        if not password or len(password) < 8:
            raise ValueError("Parol kamida 8 belgidan iborat bo'lishi kerak.")

    def _generate_unique_schema_name(self, name: str) -> str:
        """
        Noyob schema nomi yaratadi.
        Agar schema_name band bo'lsa, raqam qo'shadi: tenant_najot_2, tenant_najot_3 ...
        """
        base_schema = schema_name_from_slug(name)
        schema_name = base_schema

        counter = 2
        while Tenant.objects.filter(schema_name=schema_name).exists():
            schema_name = f"{base_schema}_{counter}"
            counter += 1
            if counter > 99:
                raise ValueError(f"'{name}' nomi uchun noyob schema topilmadi.")

        return schema_name

    def _create_tenant_record(
        self, name: str, schema_name: str, city: str, contact_phone: str, telegram_bot_token: str = ""
    ) -> Tenant:
        """public.tenants_tenant ga yozuv qo'shadi."""
        tenant = Tenant.objects.create(
            name=name.strip(),
            schema_name=schema_name,
            is_active=True,
            city=city.strip() if city else None,
            contact_phone=contact_phone.strip() if contact_phone else None,
            telegram_bot_token=telegram_bot_token.strip() if telegram_bot_token else None,
        )
        logger.debug("Tenant yozuvi yaratildi: id=%s, schema=%s", tenant.id, schema_name)
        return tenant

    def _create_domain_record(self, tenant: Tenant, domain: str) -> Domain:
        """public.tenants_domain ga yozuv qo'shadi."""
        domain_obj = Domain.objects.create(
            tenant=tenant,
            domain=domain.lower().strip(),
            is_primary=True,
        )
        logger.debug("Domain yozuvi yaratildi: %s → %s", domain, tenant.schema_name)
        return domain_obj

    def _create_subscription_record(
        self, tenant: Tenant, plan: str, trial_days: int
    ) -> Subscription:
        """public.tenants_subscription ga yozuv qo'shadi."""
        plan_prices = {
            "starter": 500_000,    # 500,000 so'm/oy
            "pro": 1_500_000,      # 1,500,000 so'm/oy
            "enterprise": 3_000_000,  # 3,000,000 so'm/oy
        }
        plan_limits = {
            "starter": {"max_students": 200, "max_branches": 1},
            "pro": {"max_students": 1000, "max_branches": 3},
            "enterprise": {"max_students": 10000, "max_branches": 20},
        }

        subscription = Subscription.objects.create(
            tenant=tenant,
            plan=plan,
            price_per_month=plan_prices.get(plan, 500_000),
            expires_at=timezone.now() + timedelta(days=trial_days),
            status="trial",
            **plan_limits.get(plan, plan_limits["starter"]),
        )
        logger.debug("Subscription yaratildi: plan=%s, expires=%s", plan, subscription.expires_at)
        return subscription

    def _create_postgres_schema(self, schema_name: str) -> None:
        """
        PostgreSQL'da yangi schema yaratadi.

        SQLite'da bu qadam o'tkazib yuboriladi (dev rejim).
        """
        db_engine = self._get_db_engine()

        if 'sqlite' in db_engine:
            logger.info(
                "SQLite ishlatilmoqda — CREATE SCHEMA o'tkazib yuborildi (schema=%s)",
                schema_name
            )
            return

        if not validate_schema_name(schema_name):
            raise InvalidSchemaNameError(schema_name)

        if schema_exists(schema_name):
            logger.warning("Schema allaqachon mavjud: %s", schema_name)
            return

        try:
            with connection.cursor() as cursor:
                # NOTA: schema_name regex tekshiruvidan o'tgan — SQL injection xavfi yo'q
                cursor.execute(f'CREATE SCHEMA "{schema_name}"')
            logger.info("PostgreSQL schema yaratildi: %s", schema_name)
        except Exception as exc:
            logger.error("Schema yaratishda xatolik: schema=%s, error=%s", schema_name, exc)
            raise TenantSchemaError(schema_name, exc) from exc

    def _run_migrations_for_schema(self, schema_name: str) -> None:
        """
        Yangi schema ichida barcha Django migratsiyalarini ishlatadi.

        Bu jarayon alohida subprocess sifatida ishga tushiriladi,
        chunki search_path joriy connection da o'rnatiladi va
        bu boshqa requestlarga ta'sir qilmasligi kerak.

        SQLite uchun o'tkazib yuboriladi.
        """
        db_engine = self._get_db_engine()

        if 'sqlite' in db_engine:
            logger.info(
                "SQLite ishlatilmoqda — tenant migratsiya o'tkazib yuborildi (schema=%s)",
                schema_name
            )
            return

        logger.info("Schema %s uchun migratsiyalar ishga tushirilmoqda...", schema_name)

        try:
            # Joriy Python interpretatori ishlatiladi (venv mos kelishi uchun)
            result = subprocess.run(
                [sys.executable, "manage.py", "migrate_tenant_schema", schema_name],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=120,  # 2 daqiqa timeout
            )

            if result.returncode != 0:
                logger.error(
                    "Migratsiya muvaffaqiyatsiz: schema=%s\nstdout=%s\nstderr=%s",
                    schema_name, result.stdout, result.stderr
                )
                raise TenantSchemaError(
                    schema_name,
                    Exception(f"Migration failed: {result.stderr[:500]}")
                )

            logger.info(
                "Migratsiyalar muvaffaqiyatli bajarildi: schema=%s",
                schema_name
            )

        except subprocess.TimeoutExpired:
            raise TenantSchemaError(
                schema_name,
                Exception("Migration timeout (120s) — server yuklanishi juda yuqori bo'lishi mumkin")
            )
        except FileNotFoundError:
            # manage.py topilmasa (test muhiti) — o'tkazib yuborish
            logger.warning(
                "manage.py topilmadi — migratsiya o'tkazib yuborildi (test rejimi?) schema=%s",
                schema_name
            )

    def _create_first_admin(
        self,
        *,
        schema_name: str,
        email: str,
        password: str,
        full_name: str,
        phone: str,
    ):
        """
        Tenant schemasi ichida birinchi super_admin foydalanuvchisini yaratadi.

        Bu metod search_path ni schema ga o'rnatib, mavjud Django UserModel
        (authenticatsiya.UserModel) dan foydalanadi.

        SQLite/dev rejimda public schemada yaratiladi.
        """
        from tenants.utils import set_search_path, reset_search_path

        db_engine = self._get_db_engine()
        is_sqlite = 'sqlite' in db_engine

        if not is_sqlite:
            set_search_path(schema_name)

        try:
            # Django auth modeli import
            from django.contrib.auth import get_user_model
            UserModel = get_user_model()

            # Username — email dan oldingi qism
            username = email.split('@')[0]

            # Agar username band bo'lsa, unikallashtiramiz
            base_username = username
            counter = 1
            while UserModel.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            # To'liq ismni ism va familiyaga ajratish
            name_parts = full_name.strip().split(' ', 1) if full_name else ['Admin']
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ''

            admin_user = UserModel.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role='super_admin',
                phone_number=phone or None,
            )

            logger.info(
                "Birinchi admin yaratildi: username=%s, email=%s, schema=%s",
                username, email, schema_name
            )
            return admin_user

        except Exception as exc:
            logger.error(
                "Admin user yaratishda xatolik: schema=%s, email=%s, error=%s",
                schema_name, email, exc
            )
            raise
        finally:
            if not is_sqlite:
                reset_search_path()

    @staticmethod
    def _get_db_engine() -> str:
        """Joriy DB engine nomini qaytaradi."""
        from django.conf import settings
        return settings.DATABASES.get('default', {}).get('ENGINE', '')


# ─────────────────────────────────────────────────────────────────────────────
# DEPROVISIONING (Tenant o'chirish)
# ─────────────────────────────────────────────────────────────────────────────

class TenantDeprovisioningService:
    """
    Tenant va uning barcha ma'lumotlarini o'chirish servisi.

    DIQQAT: Bu operatsiya qaytarib bo'lmaydi!
    Faqat CEO tomonidan tasdiqlangan holatlarda ishlatilsin.
    """

    def deprovision(self, tenant: Tenant, drop_schema: bool = False) -> dict:
        """
        Tenantni o'chiradi.

        Args:
            tenant: O'chiriladigan Tenant ob'ekti
            drop_schema: True bo'lsa PostgreSQL schemasini ham o'chiradi
                         (JUDA XAVFLI — barcha ma'lumotlar yo'qoladi!)

        Returns:
            dict: {"schema_name": str, "schema_dropped": bool}
        """
        schema_name = tenant.schema_name
        schema_dropped = False

        logger.warning(
            "Tenant deprovisioning boshlandi: name=%s, schema=%s, drop_schema=%s",
            tenant.name, schema_name, drop_schema
        )

        with transaction.atomic():
            # Domenlar, obuna va tenant yozuvini o'chirish
            Domain.objects.filter(tenant=tenant).delete()
            Subscription.objects.filter(tenant=tenant).delete()
            tenant.delete()

        if drop_schema:
            db_engine = self._get_db_engine()
            if 'sqlite' not in db_engine:
                schema_dropped = self._drop_schema(schema_name)

        logger.warning(
            "Tenant deprovisioning tugadi: schema=%s, schema_dropped=%s",
            schema_name, schema_dropped
        )

        return {"schema_name": schema_name, "schema_dropped": schema_dropped}

    def _drop_schema(self, schema_name: str) -> bool:
        """PostgreSQL schemani o'chiradi (CASCADE bilan)."""
        if not validate_schema_name(schema_name):
            logger.error("DROP SCHEMA rad etildi — noto'g'ri schema nomi: %s", schema_name)
            return False
        try:
            with connection.cursor() as cursor:
                cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
            logger.warning("PostgreSQL schema o'chirildi: %s", schema_name)
            return True
        except Exception as exc:
            logger.error("Schema o'chirishda xatolik: %s — %s", schema_name, exc)
            return False

    @staticmethod
    def _get_db_engine() -> str:
        from django.conf import settings
        return settings.DATABASES.get('default', {}).get('ENGINE', '')
