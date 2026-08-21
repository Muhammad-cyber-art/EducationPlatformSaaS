from celery import shared_task
import logging
from django.contrib.auth import get_user_model
from django.utils import timezone
from zoneinfo import ZoneInfo
from datetime import date
from .models import ReportDownloadTrack

logger = logging.getLogger(__name__)

@shared_task
def alert_uncollected_reports_task():
    """
    Celery Beat orqali rejalashtirilgan tarzda (cron job) fonda ishga tushib,
    hisobotlarni yuklab olmagan admin/superadminlarni tekshiradi va logga ogohlantirish yozadi.
    """
    User = get_user_model()
    tashkent_tz = ZoneInfo('Asia/Tashkent')
    now_tashkent = timezone.now().astimezone(tashkent_tz)
    today_tashkent = now_tashkent.date()
    current_hour = now_tashkent.hour
    current_day = now_tashkent.day

    # 1. Kunlik hisobot: soat 18:30 dan keyin yuklab olinmagan bo'lsa
    if current_hour >= 18:
        admins = User.objects.filter(role__in=['admin', 'super_admin'], is_active=True)
        for admin in admins:
            downloaded = ReportDownloadTrack.objects.filter(
                user=admin,
                report_type='daily',
                report_date=today_tashkent
            ).exists()
            if not downloaded:
                logger.warning(
                    f"[CELERY ALARM] Admin/SuperAdmin '{admin.username}' "
                    f"bugungi ({today_tashkent}) kunlik Excel hisobotini hali yuklab olmagan!"
                )

    # 2. Oylik moliya hisoboti: 28, 29, 30 va 31 sanalarda superadmin uchun
    if current_day in [28, 29, 30, 31]:
        superadmins = User.objects.filter(role='super_admin', is_active=True)
        first_of_month = date(now_tashkent.year, now_tashkent.month, 1)
        for sa in superadmins:
            downloaded = ReportDownloadTrack.objects.filter(
                user=sa,
                report_type='monthly',
                report_date=first_of_month
            ).exists()
            if not downloaded:
                logger.warning(
                    f"[CELERY ALARM] SuperAdmin '{sa.username}' ushbu oylik moliya "
                    f"hisobotini hali yuklab olmagan!"
                )
