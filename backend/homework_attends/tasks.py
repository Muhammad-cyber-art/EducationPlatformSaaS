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
        if not group.is_logic_enabled():
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

