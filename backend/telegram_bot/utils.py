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

# BOT_TOKEN ni settings dan olish (settings.py da .env dan yuklanadi)
BOT_TOKEN = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')

if not BOT_TOKEN:
    logger.warning("TELEGRAM_BOT_TOKEN sozlanmagan! .env faylini tekshiring.")

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

def send_telegram_message_async(chat_id, text):
    """Xabarni asinxron (threading orqali) jo'natish - serverni qotirmaydi"""
    if not chat_id:
        return
    
    thread = threading.Thread(target=_send_message_sync, args=(chat_id, text))
    thread.start()

def _send_message_sync(chat_id, text, max_retries=3):
    """Xabarni yuborishning sinxron qismi (Retry mexanizmi bilan)"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
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

def send_document_sync(chat_id, filepath, caption=''):
    url = f'https://api.telegram.org/bot{BOT_TOKEN}/sendDocument'
    try:
        with open(filepath, 'rb') as f:
            files = {'document': f}
            data = {'chat_id': chat_id, 'caption': caption}
            response = requests.post(url, files=files, data=data, timeout=30)
            return response
    except Exception as e:
        logger.error(f'Telegram document yuborishda xatolik: {e}')
        return None
