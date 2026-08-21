from celery import shared_task
import time
import logging
from .utils import _send_message_sync, get_student_telegram_ids

logger = logging.getLogger(__name__)

@shared_task
def send_attendance_notifications_task(attendance_ids):
    """
    Davomat xabarnomalarini fonda (Celery orqali) navbat bilan yuborish.
    """
    from homework_attends.models import Attendance
    from .signals import send_attendance_notification
    
    attendances = Attendance.objects.filter(id__in=attendance_ids).select_related('student', 'group')
    
    for att in attendances:
        try:
            # async_send=False qilamiz, chunki o'zi fon taskida ketayapti, 
            # har bir xabar uchun alohida thread shartmas, aksincha ularni navbat bilan yuboramiz.
            send_attendance_notification(att, async_send=False)
            time.sleep(0.05) # Telegram bot limitini buzmaslik uchun
        except Exception as e:
            logger.error(f"Error in send_attendance_notifications_task for att {att.id}: {e}")

@shared_task
def send_broadcast_message_task(chat_ids, message):
    """
    Ommaviy xabarlarni (Broadcast) fonda, navbat bilan yuborish.
    """
    if not chat_ids:
        return
    
    # Unikal IDlar ro'yxatiga o'tkazamiz
    ids_list = list(set(chat_ids))
    
    for chat_id in ids_list:
        try:
            _send_message_sync(chat_id, message)
            time.sleep(0.05) # ~20 xabar/sekund (Telegram limitiga mos)
        except Exception as e:
            logger.error(f"Error in send_broadcast_message_task for chat {chat_id}: {e}")

import os
import pandas as pd
from django.db import connection
from celery import shared_task
from .utils import get_isolated_queryset, send_document_sync
from .models import BotProfile
from homework_attends.models import Attendance
from finance.models.transaction import FinanceTransaction

@shared_task(bind=True, max_retries=5, default_retry_delay=60)
def generate_and_send_report(self, report_type, bot_profile_id):
    try:
        profile = BotProfile.objects.select_related('user').get(id=bot_profile_id)
        chat_id = profile.telegram_id
        
        filepath = f"/tmp/{report_type}_{chat_id}.xlsx"
        
        if report_type == "daily_branch" or report_type == "monthly_attendance":
            base_query = Attendance.objects.all()
        elif report_type == "monthly_finance":
            base_query = FinanceTransaction.objects.all()
        else:
            return
            
        isolated_query = get_isolated_queryset(base_query, profile)
        
        raw_sql, params = isolated_query.query.sql_with_params()
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            startrow = 0
            for chunk in pd.read_sql(raw_sql, connection, params=params, chunksize=5000):
                chunk.to_excel(
                    writer, 
                    sheet_name='Report', 
                    index=False, 
                    header=(startrow == 0), 
                    startrow=startrow
                )
                startrow += len(chunk) + (1 if startrow == 0 else 0)
                
        send_document_sync(chat_id, filepath, f"Sizning {report_type.replace('_', ' ').title()} hisobotingiz")
        
    except Exception as exc:
        retry_delay = (2 ** self.request.retries) * 60
        raise self.retry(exc=exc, countdown=retry_delay)
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

@shared_task
def trigger_daily_branch_reports():
    admins = BotProfile.objects.filter(role='admin', is_active=True)
    for admin in admins:
        generate_and_send_report.delay("daily_branch", admin.id)

@shared_task
def trigger_monthly_attendance_reports():
    admins = BotProfile.objects.filter(role='admin', is_active=True)
    for admin in admins:
        generate_and_send_report.delay("monthly_attendance", admin.id)

@shared_task
def trigger_monthly_finance_reports():
    super_admins = BotProfile.objects.filter(role='super_admin', is_active=True)
    for sa in super_admins:
        generate_and_send_report.delay("monthly_finance", sa.id)

from .reports_bot_logic import *

