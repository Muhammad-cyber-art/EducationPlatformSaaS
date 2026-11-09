"""
Thread-safe and async-safe tenant context management.

contextvars.ContextVar (PEP 567) ishlatilib, har bir thread va asinxron korutina
(asyncio / async views / tasks) uchun alohida tenant ob'ekti xavfsiz saqlanadi.
Shu bilan birga, orqaga muvofiqlik (backward compatibility) uchun threading.local()
ham sinxron tarzda yangilanib boriladi.

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

import contextvars
import threading
import logging

logger = logging.getLogger(__name__)

# Zamonaviy ContextVar (Python 3.7+) — async & thread-safe
_current_tenant_var: contextvars.ContextVar = contextvars.ContextVar("current_tenant", default=None)

# Orqaga muvofiqlik uchun threading.local()
_thread_locals = threading.local()
_TENANT_KEY = "current_tenant"


def set_current_tenant(tenant) -> None:
    """
    Joriy kontekst (thread va coroutine) uchun tenant o'rnatadi.

    Args:
        tenant: Tenant model instance yoki None
    """
    _current_tenant_var.set(tenant)
    setattr(_thread_locals, _TENANT_KEY, tenant)
    if tenant:
        logger.debug(
            "Tenant context o'rnatildi: schema=%s, name=%s",
            tenant.schema_name,
            tenant.name,
        )


def get_current_tenant():
    """
    Joriy kontekst uchun saqlangan tenant ob'ektini qaytaradi.

    Returns:
        Tenant instance yoki None (agar CEO panel yoki tenant
        o'rnatilmagan bo'lsa)
    """
    tenant = _current_tenant_var.get()
    if tenant is not None:
        return tenant
    return getattr(_thread_locals, _TENANT_KEY, None)


def clear_current_tenant() -> None:
    """
    Joriy kontekst uchun tenant kontekstini tozalaydi.

    Har doim request tugagach finally blokida chaqirilishi shart —
    aks holda connection pool'dan olingan thread boshqa requestda
    noto'g'ri tenant ma'lumotlarini saqlab qolishi mumkin.
    """
    tenant = get_current_tenant()
    if tenant:
        logger.debug("Tenant context tozalandi: schema=%s", tenant.schema_name)
    _current_tenant_var.set(None)
    if hasattr(_thread_locals, _TENANT_KEY):
        try:
            delattr(_thread_locals, _TENANT_KEY)
        except AttributeError:
            pass


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
