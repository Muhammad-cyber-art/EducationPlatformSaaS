from celery import shared_task
import time
import logging
from .utils import _send_message_sync, get_student_telegram_ids

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def send_telegram_message_task(self, chat_id, text, bot_token=None):
    """
    Yagona Telegram xabarini Celery orqali xavfsiz va ishonchli yuborish.
    Retry va exponential backoff qo'llab-quvvatlanadi.
    """
    try:
        response = _send_message_sync(chat_id, text, bot_token=bot_token)
        if response is None or response.status_code != 200:
            raise Exception(f"Telegram API xatolik qaytardi: {getattr(response, 'text', 'No response')}")
        return True
    except Exception as exc:
        logger.warning(f"Telegram xabar yuborishda xatolik (urinish {self.request.retries + 1}): {exc}")
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=5 * (2 ** self.request.retries))
        logger.error(f"Telegram xabari {chat_id} ga {self.max_retries} marta urinishdan so'ng ham bormadi: {exc}")
        return False

@shared_task
def send_attendance_notifications_task(attendance_ids, bot_token=None, schema_name=None):
    """
    Davomat xabarnomalarini fonda (Celery orqali) navbat bilan yuborish.
    Multi-tenant qo'llab-quvvatlaydi (schema_name parametri orqali).
    """
    from homework_attends.models import Attendance
    from .signals import send_attendance_notification
    
    def _execute():
        attendances = Attendance.objects.filter(id__in=attendance_ids).select_related('student', 'group')
        for att in attendances:
            try:
                send_attendance_notification(att, async_send=False, bot_token=bot_token)
                time.sleep(0.05) # Telegram bot limitini buzmaslik uchun
            except Exception as e:
                logger.error(f"Error in send_attendance_notifications_task for att {att.id}: {e}")

    if schema_name:
        from tenants.utils import tenant_schema_context
        with tenant_schema_context(schema_name):
            _execute()
    else:
        _execute()

@shared_task
def send_broadcast_message_task(chat_ids, message, bot_token=None):
    """
    Ommaviy xabarlarni (Broadcast) fonda, navbat bilan yuborish.
    """
    if not chat_ids:
        return
    
    # Unikal IDlar ro'yxatiga o'tkazamiz
    ids_list = list(set(chat_ids))
    
    for chat_id in ids_list:
        try:
            _send_message_sync(chat_id, message, bot_token=bot_token)
            time.sleep(0.05) # ~20 xabar/sekund (Telegram limitiga mos)
        except Exception as e:
            logger.error(f"Error in send_broadcast_message_task for chat {chat_id}: {e}")

@shared_task
def send_homework_notification_task(homework_id, bot_token=None):
    """Guruh o'quvchilariga yangi uyga vazifa haqida xabar va yuklangan faylni yuborish."""
    from homework_attends.models import Homework
    from groups.models import GroupEnrollment
    from .utils import get_student_telegram_ids, send_document_sync, _send_message_sync, get_tenant_bot_token
    import os

    try:
        hw = Homework.objects.select_related('group', 'mentor').get(id=homework_id)
    except Homework.DoesNotExist:
        logger.warning(f"Homework {homework_id} topilmadi.")
        return

    # Guruhdagi faol o'quvchilar
    active_student_ids = GroupEnrollment.objects.filter(
        group=hw.group,
        is_active=True
    ).values_list('student_id', flat=True)

    students = hw.group.students.filter(
        id__in=active_student_ids,
        is_archived=False,
        is_active=True
    )

    all_chat_ids = set()
    for student in students:
        ids = get_student_telegram_ids(student)
        all_chat_ids.update(ids)

    if not all_chat_ids:
        logger.info(f"Homework {homework_id}: Guruh o'quvchilarida Telegram ID mavjud emas.")
        return

    mentor_name = hw.mentor.get_full_name() if hw.mentor and hasattr(hw.mentor, 'get_full_name') and hw.mentor.get_full_name() else (hw.mentor.username if hw.mentor else "O'qituvchi")
    group_name = hw.group.name if hw.group else "Guruh"
    desc = hw.description.strip() if hw.description else "Tavsif berilmagan."

    message_text = (
        f"📚 <b>Yangi uyga vazifa!</b>\n\n"
        f"👥 <b>Guruh:</b> {group_name}\n"
        f"📝 <b>Mavzu:</b> {hw.title}\n"
        f"👨‍🏫 <b>O'qituvchi:</b> {mentor_name}\n"
        f"📅 <b>Sana:</b> {hw.created_at.strftime('%Y-%m-%d %H:%M')}\n\n"
        f"📋 <b>Vazifa tavsifi:</b>\n{desc}"
    )

    file_path = None
    if hw.file:
        try:
            if hasattr(hw.file, 'path') and os.path.exists(hw.file.path):
                file_path = hw.file.path
        except Exception as e:
            logger.warning(f"Homework {homework_id} fayl yo'lini olishda xatolik: {e}")

    token = get_tenant_bot_token(bot_token)

    for chat_id in all_chat_ids:
        try:
            if file_path:
                caption = message_text[:1000] if len(message_text) > 1000 else message_text
                resp = send_document_sync(chat_id, file_path, caption=caption, bot_token=token)
                if not resp or resp.status_code != 200:
                    _send_message_sync(chat_id, message_text, bot_token=token)
            else:
                _send_message_sync(chat_id, message_text, bot_token=token)
            time.sleep(0.05)
        except Exception as err:
            logger.error(f"Homework xabari yuborishda xatolik (chat_id: {chat_id}): {err}")


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
    filepath = None
    try:
        import tempfile
        profile = BotProfile.objects.select_related('user').get(id=bot_profile_id)
        chat_id = profile.telegram_id
        
        filepath = os.path.join(tempfile.gettempdir(), f"{report_type}_{chat_id}.xlsx")
        
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
        if filepath and os.path.exists(filepath):
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

from .reports_bot_logic import (
    generate_and_send_report_pandas,
    trigger_daily_branch_reports_pandas,
    trigger_monthly_attendance_reports_pandas,
    trigger_monthly_finance_reports_pandas,
)

