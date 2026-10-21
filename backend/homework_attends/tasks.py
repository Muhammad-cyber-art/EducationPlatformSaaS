from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import Group, Attendance
import logging

logger = logging.getLogger(__name__)

def _create_attendance_for_current_schema():
    """Joriy faol schema ichida davomat yaratish logikasi."""
    from groups.models import GroupEnrollment, Student
    tomorrow = timezone.localdate() + timedelta(days=1)
    groups = Group.objects.all()
    count = 0

    for group in groups:
        if not group.is_faol:
            continue
        if group.start_date and group.start_date > tomorrow:
            continue
        if not group.is_lesson_day(tomorrow):
            continue

        active_student_ids = GroupEnrollment.objects.filter(
            group=group,
            is_active=True,
            joined_at__date__lte=tomorrow,
        ).values_list('student_id', flat=True)

        students = Student.objects.filter(
            id__in=active_student_ids,
            is_archived=False,
            is_active=True,
        )

        for student in students:
            obj, created = Attendance.objects.get_or_create(
                student=student,
                group=group,
                date=tomorrow,
                defaults={'is_present': True}
            )
            if created:
                count += 1
    return count


@shared_task
def create_attendance_task():
    """Ertangi kun uchun davomat yozuvlarini yaratish (har kuni yarim tunda).
    
    Multi-tenant qo'llab-quvvatlash: Barcha faol o'quv markazlari (tenantlar)
    schemalarini aylanib chiqadi va har bir markaz uchun davomat yaratadi.
    """
    from tenants.models import Tenant
    from tenants.utils import tenant_schema_context

    logger.info("Davomat yaratish boshlandi (Multi-tenant)...")
    active_tenants = Tenant.objects.filter(is_active=True)

    if not active_tenants.exists():
        # Tenantlar mavjud bo'lmaganda (masalan dev/legacy holatda)
        count = _create_attendance_for_current_schema()
        logger.info(f"Davomat yaratildi (public): {count} ta")
        return count

    total_count = 0
    for tenant in active_tenants:
        try:
            with tenant_schema_context(tenant.schema_name):
                count = _create_attendance_for_current_schema()
                total_count += count
                logger.info(f"[{tenant.name} - {tenant.schema_name}] {count} ta davomat yaratildi.")
        except Exception as exc:
            logger.error(f"Tenant {tenant.schema_name} uchun davomat yaratishda xatolik: {exc}", exc_info=True)

    logger.info(f"Jami barcha markazlar uchun {total_count} ta davomat yaratildi.")
    return total_count


def _cleanup_old_homeworks_for_current_schema():
    """Joriy faol schema ichida 2 oydan (60 kundan) oshgan uy vazifalarini arxivlash va o'chirish."""
    from homework_attends.models import Homework
    from homework_attends.services import archive_homework
    
    cutoff_date = timezone.now() - timedelta(days=60)
    old_homeworks = Homework.objects.filter(created_at__lt=cutoff_date)
    deleted_count = 0
    
    for hw in old_homeworks:
        try:
            archive_homework(hw, user=None)
        except Exception as e:
            logger.error("Eski uy vazifasini arxivlashda xatolik (id=%s): %s", hw.id, e)
        try:
            hw.delete()
            deleted_count += 1
        except Exception as e:
            logger.error("Eski uy vazifasini o'chirishda xatolik (id=%s): %s", hw.id, e)
            
    return deleted_count


@shared_task
def cleanup_old_homeworks_task():
    """Yaratilganiga 2 oy (60 kun) bo'lgan uy vazifalarini avtomatik arxivlab o'chirish.
    
    Multi-tenant: Barcha faol o'quv markazlari schemalarida ishlaydi.
    """
    from tenants.models import Tenant
    from tenants.utils import tenant_schema_context

    logger.info("2 oylik eski uy vazifalarini tozalash boshlandi (Multi-tenant)...")
    active_tenants = Tenant.objects.filter(is_active=True)

    if not active_tenants.exists():
        count = _cleanup_old_homeworks_for_current_schema()
        logger.info(f"Eski uy vazifalar tozalandi (public): {count} ta")
        return count

    total_count = 0
    for tenant in active_tenants:
        try:
            with tenant_schema_context(tenant.schema_name):
                count = _cleanup_old_homeworks_for_current_schema()
                total_count += count
                if count > 0:
                    logger.info(f"[{tenant.name} - {tenant.schema_name}] {count} ta 2 oylik uy vazifasi o'chirildi.")
        except Exception as exc:
            logger.error(f"Tenant {tenant.schema_name} uchun uy vazifalarini tozalashda xatolik: {exc}", exc_info=True)

    logger.info(f"Jami barcha markazlar bo'yicha {total_count} ta 2 oylik uy vazifasi tozalandi.")
    return total_count

