"""
Yordamchi funksiyalar (utility functions) — Tenant bilan ishlash uchun.

Bu modul quyidagi vazifalarni bajaradi:
  - Schema nomi yaratish (slugify)
  - Schema mavjudligini tekshirish
  - search_path o'rnatish/tiklash
  - Tenant kontekstini to'g'ri boshqarish uchun context manager

Ishlatish namunasi:
    from tenants.utils import set_search_path, reset_search_path, schema_name_from_slug

    # Schema nomi yaratish
    name = schema_name_from_slug("Najot Ta'lim")  # → "tenant_najot_talim"

    # Search path o'rnatish
    set_search_path("tenant_najot")

    # Context manager orqali (auto reset)
    with tenant_schema_context("tenant_najot"):
        Student.objects.all()  # tenant_najot schemadan o'qiydi
"""

import re
import logging
from contextlib import contextmanager

from django.db import connection

from tenants.context import set_current_tenant, clear_current_tenant, get_current_tenant
from tenants.exceptions import TenantSchemaError, InvalidSchemaNameError

logger = logging.getLogger(__name__)

# Faqat ruxsat etilgan belgilar
_VALID_SCHEMA_CHARS = re.compile(r'^[a-z][a-z0-9_]{1,61}$')
_SCHEMA_PREFIX = "tenant_"


# ─────────────────────────────────────────────────────────────────────────────
# SCHEMA NOMI YARATISH
# ─────────────────────────────────────────────────────────────────────────────

def schema_name_from_slug(slug: str) -> str:
    """
    Inson o'qiy oladigan nomdan to'g'ri PostgreSQL schema nomi yaratadi.

    Args:
        slug: Markaz nomi yoki slugi, masalan: "Najot Ta'lim" yoki "najot-talim"

    Returns:
        str: Masalan "tenant_najot_talim"

    Raises:
        InvalidSchemaNameError: Agar natija noto'g'ri bo'lsa
    """
    # Kichik harfga o'girish
    cleaned = slug.lower()
    # Faqat harf va raqam — qolgani '_' ga almashtirish
    cleaned = re.sub(r'[^a-z0-9]+', '_', cleaned)
    # Bosh va oxiridagi '_' tozalash
    cleaned = cleaned.strip('_')
    # Prefix qo'shish
    schema = f"{_SCHEMA_PREFIX}{cleaned}"

    # Tekshirish
    if not _VALID_SCHEMA_CHARS.match(schema):
        raise InvalidSchemaNameError(schema)

    # Uzunlik chegarasi (PostgreSQL: max 63 belgi)
    if len(schema) > 63:
        schema = schema[:63].rstrip('_')

    return schema


def validate_schema_name(schema_name: str) -> bool:
    """
    Schema nomini tekshiradi — True yoki False qaytaradi.

    Args:
        schema_name: Tekshirilishi kerak bo'lgan schema nomi

    Returns:
        bool: To'g'ri formatda bo'lsa True
    """
    return bool(_VALID_SCHEMA_CHARS.match(schema_name))


# ─────────────────────────────────────────────────────────────────────────────
# POSTGRESQL SEARCH_PATH BOSHQARUVI
# ─────────────────────────────────────────────────────────────────────────────

def set_search_path(schema_name: str) -> None:
    """
    Joriy DB connection uchun search_path o'rnatadi.

    PostgreSQL'da `SET search_path TO tenant_najot, public;` buyrug'i
    Django ORM'ga o'sha schemani birinchi qidirishni buyuradi.

    Args:
        schema_name: Masalan "tenant_najot"

    Raises:
        InvalidSchemaNameError: Agar schema nomi xato formatda bo'lsa
        TenantSchemaError: Agar DB da xatolik yuz bersa
    """
    if not validate_schema_name(schema_name):
        raise InvalidSchemaNameError(schema_name)

    try:
        with connection.cursor() as cursor:
            # Muhim: schema_name to'g'ridan-to'g'ri string interpolation
            # bilan ishlatiladi. Bu xavfsiz, chunki yuqorida regex tekshiruvidan o'tgan.
            cursor.execute(f"SET search_path TO {schema_name}, public")
        logger.debug("search_path o'rnatildi: %s", schema_name)
    except Exception as exc:
        logger.error(
            "search_path o'rnatishda xatolik: schema=%s, error=%s",
            schema_name, exc
        )
        raise TenantSchemaError(schema_name, exc) from exc


def reset_search_path() -> None:
    """
    search_path ni default holatiga (faqat public) qaytaradi.

    Request tugagach yoki xatolik yuz bergach chaqiriladi.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET search_path TO public")
        logger.debug("search_path public ga qaytarildi")
    except Exception as exc:
        # Reset muvaffaqiyatsiz bo'lsa faqat log qilamiz — exception ko'tarmaymiz
        logger.warning("search_path reset qilishda xatolik: %s", exc)


def schema_exists(schema_name: str) -> bool:
    """
    Berilgan schema PostgreSQL'da mavjudligini tekshiradi.

    Args:
        schema_name: Tekshirilishi kerak bo'lgan schema

    Returns:
        bool: Mavjud bo'lsa True
    """
    if not validate_schema_name(schema_name):
        return False

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = %s)",
                [schema_name],
            )
            return cursor.fetchone()[0]
    except Exception as exc:
        logger.error("Schema mavjudligini tekshirishda xatolik: %s", exc)
        return False


# ─────────────────────────────────────────────────────────────────────────────
# CONTEXT MANAGER
# ─────────────────────────────────────────────────────────────────────────────

@contextmanager
def tenant_schema_context(tenant_or_schema_name):
    """
    Tenant schemasi ichida ishlash uchun context manager.

    Bloк tugagach yoki xatolik yuz bergach search_path avtomatik
    public'ga qaytariladi va thread-local tozalanadi.

    Args:
        tenant_or_schema_name: Tenant instance yoki schema nomi (str)

    Ishlatish:
        with tenant_schema_context("tenant_najot"):
            students = Student.objects.all()  # tenant_najot da

        # Tenant instance bilan:
        tenant = Tenant.objects.get(schema_name="tenant_najot")
        with tenant_schema_context(tenant):
            payments = Payment.objects.filter(month=current_month)
    """
    from tenants.models import Tenant as TenantModel

    # Schema nomini aniqlash
    if isinstance(tenant_or_schema_name, str):
        schema_name = tenant_or_schema_name
        tenant_obj = None
    elif isinstance(tenant_or_schema_name, TenantModel):
        tenant_obj = tenant_or_schema_name
        schema_name = tenant_obj.schema_name
    else:
        raise TypeError(
            f"tenant_schema_context Tenant yoki str qabul qiladi, "
            f"lekin {type(tenant_or_schema_name)} berildi."
        )

    # Oldingi holatni saqlash (nested context uchun)
    previous_tenant = get_current_tenant()

    try:
        if tenant_obj:
            set_current_tenant(tenant_obj)
        set_search_path(schema_name)
        yield schema_name
    finally:
        # Oldingi holatni tiklash
        if previous_tenant:
            set_current_tenant(previous_tenant)
            set_search_path(previous_tenant.schema_name)
        else:
            clear_current_tenant()
            reset_search_path()


# ─────────────────────────────────────────────────────────────────────────────
# HOST → SUBDOMEN PARSERI
# ─────────────────────────────────────────────────────────────────────────────

def extract_subdomain(host: str, base_domain: str = None) -> str | None:
    """
    HTTP Host headerdan subdomeni ajratib oladi.

    Args:
        host: Masalan "najot.crm.uz" yoki "najot.localhost:8000"
        base_domain: Asosiy domen, masalan "crm.uz" (agar None bo'lsa
                     avtomatik birinchi segment qaytariladi)

    Returns:
        str | None: Subdomen nomi yoki None (agar topilmasa)

    Misol:
        extract_subdomain("najot.crm.uz", "crm.uz")     → "najot"
        extract_subdomain("admin.crm.uz", "crm.uz")     → "admin"
        extract_subdomain("crm.uz", "crm.uz")           → None
        extract_subdomain("najot.localhost:8000")        → "najot"
    """
    # Port raqamini olib tashlash
    host_without_port = host.split(':')[0].lower()

    if base_domain:
        base = base_domain.lower()
        if host_without_port == base:
            return None  # Subdomen yo'q
        if host_without_port.endswith(f".{base}"):
            # "najot.crm.uz" → "najot"
            return host_without_port[: -(len(base) + 1)]
        return None

    # base_domain berilmagan — birinchi segment
    parts = host_without_port.split('.')
    if len(parts) > 1:
        return parts[0]

    return None
