import os
import asyncio
import pandas as pd
from django.db import connection
from celery import shared_task
from django.utils import timezone
import logging

from authenticatsiya.models import UserModel
from homework_attends.models import Attendance
from finance.models.transaction import FinanceTransaction
from telegram_bot.utils import _send_message_sync

logger = logging.getLogger(__name__)

def get_isolated_queryset(queryset, user):
    """
    Strict Data Isolation: filters database queries by branch_id.
    No super_admin data leaks to admin.
    """
    if user.role == 'super_admin':
        return queryset
    elif user.role == 'admin':
        if user.branch_id:
            # Assumes the queryset model has a relation to branch. 
            # For Attendance, it's group__branch or we can filter by group__branch_id
            if queryset.model == Attendance:
                return queryset.filter(group__branch_id=user.branch_id)
            elif queryset.model == FinanceTransaction:
                return queryset.filter(branch_id=user.branch_id)
        return queryset.none()
    return queryset.none()

def send_document_sync(chat_id, filepath, caption="", filename=None):
    """Sinxron hujjat jo'natish bot orqali."""
    import requests
    from django.conf import settings
    bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    url = f"https://api.telegram.org/bot{bot_token}/sendDocument"
    import time
    for attempt in range(3):
        try:
            with open(filepath, 'rb') as f:
                file_tuple = (filename, f) if filename else f
                files = {'document': file_tuple}
                data = {'chat_id': chat_id, 'caption': caption}
                response = requests.post(url, files=files, data=data, timeout=30)
                
            if response.status_code == 429:
                retry_after = int(response.json().get('parameters', {}).get('retry_after', 3))
                logger.warning(f"Telegram rate limit hit. Waiting {retry_after}s (Attempt {attempt+1}/3)")
                time.sleep(retry_after)
                continue
                
            if response.status_code != 200:
                logger.error(f"Telegram API xatoligi: {response.status_code} - {response.text}")
                
            return response
        except Exception as e:
            logger.error(f"Telegram document yuborishda xatolik ({filepath}): {e}")
            if attempt == 2:
                return None
            time.sleep(2)
            
    return None

from reports.services_new import DailyAttendanceReport, MonthlyFinanceReport, GroupAttendanceReport

@shared_task(bind=True, max_retries=5, default_retry_delay=60)
def generate_and_send_report_pandas(self, report_type, user_id, is_manual=False, group_id=None):
    """
    Report generation using the Unified Excel Reporting Engine (openpyxl).
    Ensures os.remove() is called in a finally block.
    If is_manual=True, fetches data for the current period up to now.
    """
    import tempfile
    from django.core.cache import cache
    
    lock_key = f"report_lock_{user_id}_{report_type}_{group_id or 'all'}"
    # Acquire lock for 10 minutes to prevent duplicate processing
    if not cache.add(lock_key, "locked", 600):
        logger.warning(f"Task skipped due to active lock: {lock_key}")
        return

    temp_dir = tempfile.gettempdir()
    filepath = None
    
    try:
        user = UserModel.objects.get(id=user_id)
        
        chat_id = None
        from django.core.exceptions import ObjectDoesNotExist
        try:
            if user.bot_profile and user.bot_profile.is_active:
                chat_id = user.bot_profile.telegram_id
        except ObjectDoesNotExist:
            pass
            
        if not chat_id:
            chat_id = user.telegram_chat_id
        
        if not chat_id:
            logger.error(f"Telegram chat ID topilmadi user_id={user_id} uchun.")
            return
            
        now = timezone.now()
        period_str = ""
        filename = "Hisobot.xlsx"
        
        if report_type == "daily_branch":
            service = DailyAttendanceReport(user=user, target_date=now.date(), is_manual=is_manual)
            period_str = f"{now.date().strftime('%d.%m.%Y')}"
            filename = f"{period_str} kunlik hisobot.xlsx"
            
        elif report_type == "monthly_finance":
            target_date = now if is_manual else (now.replace(day=1) - timezone.timedelta(days=1))
            service = MonthlyFinanceReport(
                user=user, target_year=target_date.year, target_month=target_date.month, is_manual=is_manual
            )
            period_str = f"{target_date.strftime('%Y-%m')}"
            filename = f"{period_str} moliyaviy hisobot.xlsx"
            
        elif report_type == "group_attendance" and group_id:
            service = GroupAttendanceReport(
                user=user, group_id=group_id, 
                target_year=now.year, target_month=now.month, is_manual=is_manual
            )
            period_str = f"{now.strftime('%Y-%m')}"
            filename = f"{period_str} {service.group.name} davomati.xlsx"
            
        else:
            return
            
        # Rename the temp file so telegram uses the beautiful filename
        filepath = os.path.join(temp_dir, f"{user_id}_{int(now.timestamp())}_{filename}")
        
        # Generate beautiful Excel file using the unified service
        wb = service.generate()
        wb.save(filepath)
                
        # Send via Bot
        caption = f"📊 Sizning {report_type.replace('_', ' ').title()} hisobotingiz\n"
        caption += f"📅 Davr: {period_str}\n"
        if is_manual:
            caption += f"⏱ So'rov vaqti: {now.strftime('%Y-%m-%d %H:%M')}"
            
        send_document_sync(chat_id, filepath, caption, filename=filename)
        
    except Exception as exc:
        # Retries with exponential backoff
        logger.error(f"Report generation error for {user_id}: {exc}")
        if hasattr(self, 'request') and hasattr(self.request, 'retries'):
            retry_delay = (2 ** self.request.retries) * 60
            raise self.retry(exc=exc, countdown=retry_delay)
        else:
            raise
    finally:
        # Cleanup lock and temp file
        cache.delete(lock_key)
        if filepath and os.path.exists(filepath):
            os.remove(filepath)

from django.db.models import Q

@shared_task
def trigger_daily_branch_reports_pandas():
    admins = UserModel.objects.filter(
        Q(bot_profile__is_active=True) | Q(telegram_chat_id__isnull=False),
        role='admin', 
        is_active=True
    ).distinct()
    for admin in admins:
        generate_and_send_report_pandas.delay("daily_branch", admin.id)

@shared_task
def trigger_monthly_finance_reports_pandas():
    super_admins = UserModel.objects.filter(
        Q(bot_profile__is_active=True) | Q(telegram_chat_id__isnull=False),
        role='super_admin', 
        is_active=True
    ).distinct()
    for sa in super_admins:
        generate_and_send_report_pandas.delay("monthly_finance", sa.id)
