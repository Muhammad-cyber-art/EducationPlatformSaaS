"""
Connection Pooling va Multi-Tenant xavfsizlik signallari.

CONN_MAX_AGE > 0 bo'lganda (persistent connections / connection pooling),
bitta connection bir nechta requestlarda qayta ishlatiladi.
Multi-tenant tizimda bu boshqa tenant ma'lumotlari sizib chiqishiga (schema leak)
sabab bo'lmasligi uchun, har bir request boshlanishi va tugashida
search_path ning qat'iy nazorati va tozalanishi ta'minlanadi.
"""

import logging
from django.core.signals import request_started, request_finished
from django.db.backends.signals import connection_created
from django.db import connection

from tenants.context import clear_current_tenant
from tenants.utils import reset_search_path

logger = logging.getLogger(__name__)


def on_connection_created(sender, connection, **kwargs):
    """
    Yangi DB ulanishi yaratilganda, uning boshlang'ich search_path'i
    har doim faqat 'public' bo'lishini kafolatlaydi.
    """
    if getattr(connection, 'vendor', None) != 'postgresql':
        return
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET search_path TO public")
        logger.debug("[Pool] Yangi connection ochildi va search_path=public o'rnatildi")
    except Exception as exc:
        logger.warning("[Pool] Yangi connectionda search_path o'rnatishda xatolik: %s", exc)


def on_request_started(sender, **kwargs):
    """
    Har bir HTTP request boshlanishida kontekst toza ekanligini ta'minlaydi.
    """
    clear_current_tenant()


def on_request_finished(sender, **kwargs):
    """
    Har bir HTTP request yakunlanganda (muvaffaqiyatli yoki exception bilan),
    connection search_path'ini 'public' ga qaytaradi.
    Agar reset qilishda xatolik yuz bersa (tranzaksiya abort holatida bo'lsa),
    connection darhol yopiladi (connection.close()), shunda ifloslangan ulanish
    keyingi so'rovlarga aslo o'tmaydi.
    """
    clear_current_tenant()
    if getattr(connection, 'vendor', None) == 'postgresql':
        reset_search_path()


def register_pooling_signals():
    """Signallarni Django lifecycle ga ulash."""
    connection_created.connect(on_connection_created, dispatch_uid="tenant_connection_created")
    request_started.connect(on_request_started, dispatch_uid="tenant_request_started")
    request_finished.connect(on_request_finished, dispatch_uid="tenant_request_finished")
