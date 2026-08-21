from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import Group, Attendance
import logging

logger = logging.getLogger(__name__)

@shared_task
def create_attendance_task():
    """Ertangi kun uchun davomat yozuvlarini yaratish (har kuni yarim tunda).

    BUG #5 FIX: Avvalgi kod `group.students.filter(joined_at__date__lte=tomorrow)`
    ishlatgan — bu M2M aloqa orqali barcha studentlarni (arxivlangan, o'chirilgan,
    guruhdan chiqarilgan) olib kelardi. Natijada ular uchun ham Attendance yaratilardi
    va keyingi hisobotlarda ortiqcha qatorlar paydo bo'lardi.

    Endi faqat guruhda FAOL enrollment'i bor, arxivlanmagan va faol studentlar
    uchun davomat yaratiladi.
    """
    from groups.models import GroupEnrollment, Student

    logger.info("Davomat yaratish boshlandi...")
    tomorrow = timezone.localdate() + timedelta(days=1)
    groups = Group.objects.all()
    count = 0

    for group in groups:
        # User talabi: Boshlanish sanasi kelmaguncha davomat ishlamasligi kerak
        if not group.is_logic_enabled():
            continue

        # BUG #5 FIX: Faqat guruhda faol bo'lgan, arxivlanmagan va faol studentlar
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

    logger.info(f"{tomorrow} uchun {count} ta davomat yaratildi.")
    return count
