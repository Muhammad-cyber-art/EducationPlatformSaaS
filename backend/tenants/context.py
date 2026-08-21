"""
Thread-safe tenant context management.

Django har bir HTTP requestni alohida thread (yoki coroutine)da ishlaydi.
threading.local() ishlatib, har bir thread uchun alohida tenant ob'ekti
saqlanadi — boshqa requestlar bir-birining tenant ma'lumotlarini ko'rmaydi.

Ishlatish:
    # Middleware da:
    set_current_tenant(tenant_instance)

    # View, Serializer, Signal ichida:
    tenant = get_current_tenant()
    if tenant:
        print(tenant.schema_name)  # "tenant_najot"

    # Request tugagach (finally blokida):
    clear_current_tenant()
"""

import threading
import logging

logger = logging.getLogger(__name__)

# Har bir thread uchun alohida namespace — thread-safe
_thread_locals = threading.local()

# Thread-local kalit nomi
_TENANT_KEY = "current_tenant"


def set_current_tenant(tenant) -> None:
    """
    Joriy thread uchun tenant o'rnatadi.

    Args:
        tenant: Tenant model instance yoki None
    """
    setattr(_thread_locals, _TENANT_KEY, tenant)
    if tenant:
        logger.debug(
            "Tenant context o'rnatildi: schema=%s, name=%s",
            tenant.schema_name,
            tenant.name,
        )


def get_current_tenant():
    """
    Joriy thread uchun saqlangan tenant ob'ektini qaytaradi.

    Returns:
        Tenant instance yoki None (agar CEO panel yoki tenant
        o'rnatilmagan bo'lsa)
    """
    return getattr(_thread_locals, _TENANT_KEY, None)


def clear_current_tenant() -> None:
    """
    Joriy thread uchun tenant kontekstini tozalaydi.

    Har doim request tugagach finally blokida chaqirilishi shart —
    aks holda connection pool'dan olingan thread boshqa requestda
    noto'g'ri tenant ma'lumotlarini saqlab qolishi mumkin.
    """
    if hasattr(_thread_locals, _TENANT_KEY):
        tenant = getattr(_thread_locals, _TENANT_KEY, None)
        if tenant:
            logger.debug("Tenant context tozalandi: schema=%s", tenant.schema_name)
        delattr(_thread_locals, _TENANT_KEY)


def get_current_schema_name() -> str:
    """
    Joriy tenant schema nomini qaytaradi.
    Tenant yo'q bo'lsa 'public' qaytaradi.

    Returns:
        str: Masalan "tenant_najot" yoki "public"
    """
    tenant = get_current_tenant()
    if tenant:
        return tenant.schema_name
    return "public"
