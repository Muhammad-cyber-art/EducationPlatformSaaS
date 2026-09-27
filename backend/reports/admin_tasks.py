"""
Celery Beat Tasks for Admin Bot Reporting System

This module contains scheduled tasks for:
1. Daily branch reports to admins
2. Monthly attendance ZIP archives to admins
3. Monthly financial reports to super_admins

All tasks are designed to be non-blocking and include proper error handling.
"""

import logging
from datetime import datetime, date
from celery import shared_task
from django.utils import timezone
from django.conf import settings
from django.db.models import Q

from authenticatsiya.models import UserModel
from reports.report_generator import ReportDistributor, ReportGenerationError

logger = logging.getLogger(__name__)


def _send_daily_reports_for_current_schema():
    distributor = ReportDistributor()
    target_date = timezone.now().date()
    
    admins = UserModel.objects.filter(
        Q(bot_profile__is_active=True) | Q(telegram_chat_id__isnull=False, telegram_chat_id__gt=''),
        role='admin',
        branch__isnull=False
    ).distinct()
    
    success_count = 0
    failure_count = 0
    
    for admin in admins:
        try:
            result = distributor.send_daily_report_to_admin(admin, target_date)
            if result:
                success_count += 1
                logger.info(f"Daily report sent successfully to admin {admin.username}")
            else:
                failure_count += 1
                logger.warning(f"Failed to send daily report to admin {admin.username}")
        except Exception as e:
            failure_count += 1
            logger.error(f"Error sending daily report to admin {admin.username}: {str(e)}")
            
    return {'success_count': success_count, 'failure_count': failure_count, 'total_admins': admins.count()}


@shared_task(name='reports.send_daily_reports_to_admins')
def send_daily_reports_to_admins():
    """
    Send daily Excel reports to all admins with telegram_chat_id (Multi-tenant).
    Scheduled to run daily at a specified time (e.g., 8:00 PM).
    """
    from tenants.models import Tenant
    from tenants.utils import tenant_schema_context

    logger.info("Starting daily report distribution to admins (Multi-tenant)...")
    active_tenants = Tenant.objects.filter(is_active=True)

    if not active_tenants.exists():
        return _send_daily_reports_for_current_schema()

    aggregated = {'success_count': 0, 'failure_count': 0, 'total_admins': 0}
    for tenant in active_tenants:
        try:
            with tenant_schema_context(tenant.schema_name):
                res = _send_daily_reports_for_current_schema()
                aggregated['success_count'] += res['success_count']
                aggregated['failure_count'] += res['failure_count']
                aggregated['total_admins'] += res['total_admins']
        except Exception as exc:
            logger.error(f"Tenant {tenant.schema_name} uchun kunlik hisobot jo'natishda xatolik: {exc}")

    return aggregated


def _send_monthly_attendance_for_current_schema(year, month):
    distributor = ReportDistributor()
    admins = UserModel.objects.filter(
        Q(bot_profile__is_active=True) | Q(telegram_chat_id__isnull=False, telegram_chat_id__gt=''),
        role='admin',
        branch__isnull=False
    ).distinct()
    success_count = 0
    failure_count = 0
    for admin in admins:
        try:
            result = distributor.send_monthly_attendance_to_admin(admin, year, month)
            if result:
                success_count += 1
                logger.info(f"Monthly attendance sent successfully to admin {admin.username}")
            else:
                failure_count += 1
                logger.warning(f"Failed to send monthly attendance to admin {admin.username}")
        except Exception as e:
            failure_count += 1
            logger.error(f"Error sending monthly attendance to admin {admin.username}: {str(e)}")
            
    return {'success_count': success_count, 'failure_count': failure_count, 'total_admins': admins.count(), 'year': year, 'month': month}


@shared_task(name='reports.send_monthly_attendance_to_admins')
def send_monthly_attendance_to_admins():
    """
    Send monthly attendance ZIP archives to all admins (Multi-tenant).
    Scheduled to run on the last day of each month at a specified time.
    """
    from tenants.models import Tenant
    from tenants.utils import tenant_schema_context

    logger.info("Starting monthly attendance distribution to admins (Multi-tenant)...")
    now = timezone.now()
    year = now.year
    month = now.month
    
    # Check if today is the last day of the month
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    
    today = now.date()
    if today != (next_month - timezone.timedelta(days=1)):
        logger.info(f"Today {today} is not the last day of the month. Skipping monthly attendance reports.")
        return {'status': 'skipped', 'reason': 'Not last day of month'}
    
    active_tenants = Tenant.objects.filter(is_active=True)
    if not active_tenants.exists():
        return _send_monthly_attendance_for_current_schema(year, month)

    aggregated = {'success_count': 0, 'failure_count': 0, 'total_admins': 0, 'year': year, 'month': month}
    for tenant in active_tenants:
        try:
            with tenant_schema_context(tenant.schema_name):
                res = _send_monthly_attendance_for_current_schema(year, month)
                aggregated['success_count'] += res['success_count']
                aggregated['failure_count'] += res['failure_count']
                aggregated['total_admins'] += res['total_admins']
        except Exception as exc:
            logger.error(f"Tenant {tenant.schema_name} uchun oylik davomat jo'natishda xatolik: {exc}")

    return aggregated


def _send_monthly_financial_for_current_schema(year, month):
    distributor = ReportDistributor()
    super_admins = UserModel.objects.filter(
        Q(bot_profile__is_active=True) | Q(telegram_chat_id__isnull=False, telegram_chat_id__gt=''),
        role='super_admin'
    ).distinct()
    success_count = 0
    failure_count = 0
    for super_admin in super_admins:
        try:
            result = distributor.send_monthly_financial_to_super_admin(super_admin, year, month)
            if result:
                success_count += 1
                logger.info(f"Monthly financial report sent successfully to super_admin {super_admin.username}")
            else:
                failure_count += 1
                logger.warning(f"Failed to send monthly financial report to super_admin {super_admin.username}")
        except Exception as e:
            failure_count += 1
            logger.error(f"Error sending monthly financial report to super_admin {super_admin.username}: {str(e)}")
            
    return {'success_count': success_count, 'failure_count': failure_count, 'total_super_admins': super_admins.count(), 'year': year, 'month': month}


@shared_task(name='reports.send_monthly_financial_to_super_admins')
def send_monthly_financial_to_super_admins():
    """
    Send monthly financial Excel reports to all super_admins (Multi-tenant).
    Scheduled to run on the last day of each month at a specified time.
    """
    from tenants.models import Tenant
    from tenants.utils import tenant_schema_context

    logger.info("Starting monthly financial report distribution to super_admins (Multi-tenant)...")
    now = timezone.now()
    year = now.year
    month = now.month
    
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    
    today = now.date()
    if today != (next_month - timezone.timedelta(days=1)):
        logger.info(f"Today {today} is not the last day of the month. Skipping monthly financial reports.")
        return {'status': 'skipped', 'reason': 'Not last day of month'}
    
    active_tenants = Tenant.objects.filter(is_active=True)
    if not active_tenants.exists():
        return _send_monthly_financial_for_current_schema(year, month)

    aggregated = {'success_count': 0, 'failure_count': 0, 'total_super_admins': 0, 'year': year, 'month': month}
    for tenant in active_tenants:
        try:
            with tenant_schema_context(tenant.schema_name):
                res = _send_monthly_financial_for_current_schema(year, month)
                aggregated['success_count'] += res['success_count']
                aggregated['failure_count'] += res['failure_count']
                aggregated['total_super_admins'] += res['total_super_admins']
        except Exception as exc:
            logger.error(f"Tenant {tenant.schema_name} uchun oylik moliyaviy hisobot jo'natishda xatolik: {exc}")

    return aggregated


@shared_task(name='reports.send_manual_daily_report')
def send_manual_daily_report(admin_id: int, target_date_str: str = None):
    """
    Manually trigger daily report for a specific admin.
    Can be called from admin panel or API.
    
    Args:
        admin_id: ID of the admin user
        target_date_str: Optional date string in YYYY-MM-DD format
    """
    logger.info(f"Manual daily report requested for admin ID {admin_id}")
    
    try:
        admin = UserModel.objects.get(id=admin_id)
        
        if admin.role != 'admin':
            logger.error(f"User {admin.username} is not an admin")
            return {'status': 'error', 'reason': 'User is not an admin'}
        
        target_date = None
        if target_date_str:
            target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        
        distributor = ReportDistributor()
        result = distributor.send_daily_report_to_admin(admin, target_date)
        
        if result:
            return {'status': 'success', 'admin': admin.username}
        else:
            return {'status': 'error', 'reason': 'Failed to send report'}
            
    except UserModel.DoesNotExist:
        logger.error(f"Admin with ID {admin_id} not found")
        return {'status': 'error', 'reason': 'Admin not found'}
    except Exception as e:
        logger.error(f"Error in manual daily report: {str(e)}")
        return {'status': 'error', 'reason': str(e)}


@shared_task(name='reports.send_manual_monthly_attendance')
def send_manual_monthly_attendance(admin_id: int, year: int, month: int):
    """
    Manually trigger monthly attendance ZIP for a specific admin.
    
    Args:
        admin_id: ID of the admin user
        year: Year for the report
        month: Month for the report
    """
    logger.info(f"Manual monthly attendance requested for admin ID {admin_id}")
    
    try:
        admin = UserModel.objects.get(id=admin_id)
        
        if admin.role != 'admin':
            logger.error(f"User {admin.username} is not an admin")
            return {'status': 'error', 'reason': 'User is not an admin'}
        
        distributor = ReportDistributor()
        result = distributor.send_monthly_attendance_to_admin(admin, year, month)
        
        if result:
            return {'status': 'success', 'admin': admin.username}
        else:
            return {'status': 'error', 'reason': 'Failed to send report'}
            
    except UserModel.DoesNotExist:
        logger.error(f"Admin with ID {admin_id} not found")
        return {'status': 'error', 'reason': 'Admin not found'}
    except Exception as e:
        logger.error(f"Error in manual monthly attendance: {str(e)}")
        return {'status': 'error', 'reason': str(e)}


@shared_task(name='reports.send_manual_monthly_financial')
def send_manual_monthly_financial(super_admin_id: int, year: int, month: int):
    """
    Manually trigger monthly financial report for a specific super_admin.
    
    Args:
        super_admin_id: ID of the super_admin user
        year: Year for the report
        month: Month for the report
    """
    logger.info(f"Manual monthly financial report requested for super_admin ID {super_admin_id}")
    
    try:
        super_admin = UserModel.objects.get(id=super_admin_id)
        
        if super_admin.role != 'super_admin':
            logger.error(f"User {super_admin.username} is not a super_admin")
            return {'status': 'error', 'reason': 'User is not a super_admin'}
        
        distributor = ReportDistributor()
        result = distributor.send_monthly_financial_to_super_admin(super_admin, year, month)
        
        if result:
            return {'status': 'success', 'super_admin': super_admin.username}
        else:
            return {'status': 'error', 'reason': 'Failed to send report'}
            
    except UserModel.DoesNotExist:
        logger.error(f"Super admin with ID {super_admin_id} not found")
        return {'status': 'error', 'reason': 'Super admin not found'}
    except Exception as e:
        logger.error(f"Error in manual monthly financial: {str(e)}")
        return {'status': 'error', 'reason': str(e)}
