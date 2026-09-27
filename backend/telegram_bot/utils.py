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

# BOT_TOKEN ni settings dan olish (settings.py da .env dan yuklanadi - fallback sifatida)
GLOBAL_BOT_TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')

def get_tenant_bot_token(explicit_token=None):
    """
    Joriy tenantga tegishli bot tokenni aniqlash.
    1. Agar explicit_token berilgan bo'lsa - uni ishlatadi.
    2. Agar joriy thread context'ida tenant bo'lsa va unda telegram_bot_token bo'lsa - uni oladi.
    3. Aks holda fallback sifatida GLOBAL_BOT_TOKEN (settings dan) oladi.
    """
    if explicit_token:
        return explicit_token
    try:
        from tenants.context import get_current_tenant
        tenant = get_current_tenant()
        if tenant and getattr(tenant, 'telegram_bot_token', None):
            return tenant.telegram_bot_token
    except Exception:
        pass
    return GLOBAL_BOT_TOKEN

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
    """Xabarni Celery foni orqali jo'natish (ishonchli, retry mexanizmi bilan)"""
    if not chat_id:
        return
    
    token = get_tenant_bot_token(bot_token)
    if not token:
        logger.warning(f"Telegram token yo'q! Xabar jo'natilmadi (chat_id: {chat_id}).")
        return
    
    try:
        from .tasks import send_telegram_message_task
        send_telegram_message_task.delay(chat_id, text, bot_token=token)
    except Exception as exc:
        logger.warning(f"Celery task dispatch failed ({exc}), falling back to background thread.")
        thread = threading.Thread(target=_send_message_sync, args=(chat_id, text), kwargs={'bot_token': token}, daemon=True)
        thread.start()


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
    try:
        with open(filepath, 'rb') as f:
            files = {'document': f}
            data = {'chat_id': chat_id, 'caption': caption}
            response = requests.post(url, files=files, data=data, timeout=30)
            return response
    except Exception as e:
        logger.error(f'Telegram document yuborishda xatolik: {e}')
        return None
