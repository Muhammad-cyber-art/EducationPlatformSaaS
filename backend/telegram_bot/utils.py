import threading
import requests
import time
from django.conf import settings
from django.db.models import Q
import logging

# Circular importni oldini olish uchun modelni funksiya ichida import qilamiz
# yoki Student modelini groups.models dan olamiz.
# Lekin Student modeli groups.models da ekanligini bilamiz.

logger = logging.getLogger(__name__)

import re
# BOT_TOKEN ni settings dan olish (settings.py da .env dan yuklanadi - fallback sifatida)
GLOBAL_BOT_TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')

def get_tenant_bot_token(explicit_token=None):
    """
    Joriy tenantga tegishli bot tokenni aniqlash.
    1. Agar explicit_token berilgan bo'lsa - uni ishlatadi.
    2. Agar joriy thread context'ida tenant bo'lsa va unda telegram_bot_token bo'lsa - uni oladi.
    3. Agar context bo'lmasa, joriy search_path bo'yicha bazadan qidiradi.
    4. Aks holda fallback sifatida GLOBAL_BOT_TOKEN (settings dan) oladi.
    """
    if explicit_token:
        return explicit_token.strip()
    try:
        from tenants.context import get_current_tenant
        tenant = get_current_tenant()
        if tenant and getattr(tenant, 'telegram_bot_token', None):
            return tenant.telegram_bot_token.strip()
    except Exception:
        pass

    try:
        from django.db import connection
        from tenants.models import Tenant
        with connection.cursor() as cur:
            cur.execute("SHOW search_path")
            row = cur.fetchone()
            if row:
                first_schema = row[0].split(',')[0].strip()
                if first_schema.startswith('tenant_'):
                    token = Tenant.objects.filter(schema_name=first_schema).values_list('telegram_bot_token', flat=True).first()
                    if token and token.strip():
                        return token.strip()
    except Exception:
        pass

    return GLOBAL_BOT_TOKEN


def validate_telegram_bot_token(token: str) -> dict:
    """
    Telegram bot tokenini tekshirish (getMe API orqali).
    Agar to'g'ri bo'lsa:
      - bot haqida ma'lumot (username, first_name) qaytaradi
      - avvalgi webhook bo'lsa, uni avtomatik o'chiradi (deleteWebhook),
        shunda polling rejimida Conflict xatosi chiqmaydi.
    """
    if not token or not isinstance(token, str):
        return {'ok': False, 'error': "Bot token bo'sh bo'lishi mumkin emas."}

    token = token.strip()
    if not re.match(r'^\d{8,12}:[A-Za-z0-9_-]{30,}$', token):
        return {
            'ok': False,
            'error': "Bot token formati noto'g'ri. BotFather bergan tokenni to'liq kiriting (masalan: 123456789:ABC...)."
        }

    try:
        url = f"https://api.telegram.org/bot{token}/getMe"
        resp = requests.get(url, timeout=7)
        data = resp.json()

        if resp.status_code == 200 and data.get('ok'):
            bot_info = data.get('result', {})
            # Webhookni tozalash (conflict oldini olish uchun)
            try:
                requests.post(
                    f"https://api.telegram.org/bot{token}/deleteWebhook",
                    json={'drop_pending_updates': True},
                    timeout=5
                )
            except Exception as del_err:
                logger.warning(f"deleteWebhook tozalash xatoligi: {del_err}")

            return {
                'ok': True,
                'bot_info': {
                    'id': bot_info.get('id'),
                    'username': bot_info.get('username'),
                    'first_name': bot_info.get('first_name'),
                }
            }
        else:
            description = data.get('description', "Telegram API dan noto'g'ri javob qaytdi.")
            return {
                'ok': False,
                'error': f"Telegram token xato: {description}"
            }
    except requests.exceptions.Timeout:
        return {'ok': False, 'error': "Telegram serveri bilan bog'lanishda timeout yuz berdi. Qaytadan urinib ko'ring."}
    except Exception as exc:
        return {'ok': False, 'error': f"Telegram bilan bog'lanishda xatolik: {str(exc)}"}


def get_student_telegram_ids(student):
    """
    O'quvchi va uning ota-onasiga tegishli barcha unikal Telegram IDlarni yig'ish.
    Bir xil telefon raqamli boshqa o'quvchilardan ham IDlarni qidiradi (aka-ukalar uchun).
    """
    from groups.models import Student 
    chat_ids = set()
    
    # 1. Bevosita o'zining IDlari
    if student.telegram_id:
        chat_ids.add(student.telegram_id)
    if student.parent_telegram_id:
        chat_ids.add(student.parent_telegram_id)
        
    return chat_ids

def send_telegram_message_async(chat_id, text, bot_token=None):
    """Xabarni fon oqimida (daemon thread) jo'natish — asosiy HTTP so'rovni 0ms ham to'xtatmaydi."""
    if not chat_id:
        return
    
    token = get_tenant_bot_token(bot_token)
    if not token:
        logger.warning(f"Telegram token yo'q! Xabar jo'natilmadi (chat_id: {chat_id}).")
        return
    
    try:
        thread = threading.Thread(
            target=_send_message_sync,
            args=(chat_id, text),
            kwargs={'bot_token': token},
            daemon=True
        )
        thread.start()
    except Exception as exc:
        logger.error(f"Telegram thread yaratishda xato: {exc}")


def _send_message_sync(chat_id, text, max_retries=3, bot_token=None):
    """Xabarni yuborishning sinxron qismi (Retry mexanizmi bilan)"""
    token = get_tenant_bot_token(bot_token)
    if not token:
        logger.warning(f"Telegram bot token topilmadi (chat_id: {chat_id}). Xabar jo'natilmadi.")
        return None

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML'
    }
    
    for attempt in range(max_retries):
        try:
            response = requests.post(url, json=payload, timeout=10)
            if response.status_code != 200:
                logger.error(f"Telegram error (Attempt {attempt+1}): {response.text}")
                # Too Many Requests xatosi bo'lsa, Telegram so'ragan vaqtcha kutamiz
                if response.status_code == 429:
                    retry_after = response.json().get('parameters', {}).get('retry_after', 3)
                    time.sleep(retry_after)
                    continue
                # Agar HTML parse xatosi bo'lsa (&, < kabi belgilar sabab), formatlashsiz (plain text) qayta yuboramiz
                if response.status_code == 400 and "can't parse entities" in response.text.lower():
                    logger.warning("Telegram HTML parse xatosi aniqlandi. Oddiy matn (plain text) sifatida qayta jo'natilmoqda.")
                    plain_payload = {'chat_id': chat_id, 'text': text}
                    plain_res = requests.post(url, json=plain_payload, timeout=10)
                    if plain_res.status_code == 200:
                        return plain_res
            return response
        except Exception as e:
            logger.error(f"Telegram connection error (Attempt {attempt+1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff (1s, 2s...)
            else:
                logger.error(f"Telegram xabari {chat_id} ga {max_retries} marta urinishdan so'ng ham yuborilmadi.")
                return None


def get_isolated_queryset(queryset, bot_profile):
    if bot_profile.role == 'super_admin':
        return queryset
    elif bot_profile.role == 'admin':
        if bot_profile.user and bot_profile.user.branch_id:
            return queryset.filter(branch_id=bot_profile.user.branch_id)
        return queryset.none()
    return queryset.none()

def send_document_sync(chat_id, filepath, caption='', bot_token=None):
    token = get_tenant_bot_token(bot_token)
    if not token:
        logger.warning(f"Telegram bot token topilmadi (chat_id: {chat_id}). Hujjat jo'natilmadi.")
        return None

    url = f'https://api.telegram.org/bot{token}/sendDocument'
    safe_caption = caption[:1024] if caption else ''
    try:
        with open(filepath, 'rb') as f:
            files = {'document': f}
            data = {'chat_id': chat_id, 'caption': safe_caption, 'parse_mode': 'HTML'}
            response = requests.post(url, files=files, data=data, timeout=30)
            if response.status_code != 200 and "can't parse entities" in response.text.lower():
                # HTML parse error bo'lsa, plain text sifatida qayta urinish
                f.seek(0)
                data = {'chat_id': chat_id, 'caption': safe_caption}
                response = requests.post(url, files=files, data=data, timeout=30)
            return response
    except Exception as e:
        logger.error(f'Telegram document yuborishda xatolik: {e}')
        return None


def send_homework_notification_async(homework_id, bot_token=None):
    """
    Yangi uyga vazifa xabarnomasini fon oqimida (daemon thread) jo'natish.
    Bu funksiya darhol qaytadi va HTTP so'rovni 0ms ham to'xtatmaydi.
    Thread ichida tegishli tenant sxema konteksti saqlanadi.
    """
    from django.db import connection
    schema_name = getattr(connection, 'schema_name', None)
    token = get_tenant_bot_token(bot_token)

    def _worker():
        try:
            from .tasks import send_homework_notification_task
            if schema_name:
                from tenants.utils import tenant_schema_context
                with tenant_schema_context(schema_name):
                    send_homework_notification_task(homework_id, bot_token=token)
            else:
                send_homework_notification_task(homework_id, bot_token=token)
        except Exception as err:
            logger.error(f"send_homework_notification_async xatolik (hw_id: {homework_id}): {err}")
        finally:
            try:
                from django.db import connection as conn
                conn.close()
            except Exception:
                pass

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()

