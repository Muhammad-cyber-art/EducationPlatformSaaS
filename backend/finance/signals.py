import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from homework_attends.models import Attendance

from finance.services import update_attendance_based_payments

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Attendance)
def handle_attendance_save(sender, instance, created, **kwargs):
    """
    Attendance saqlanganda (yangi yaratilgan yoki o'zgartirilgan)
    discount/negotiated studentlar uchun joriy oyda qayta hisoblashni ishga tushiradi.
    """
    try:
        if not instance.student_id or not instance.student:
            return
    except Exception:
        return

    if instance.student.status in ["discount", "negotiated"]:
        update_attendance_based_payments(
            instance.student, instance.group, instance.date
        )


@receiver(post_delete, sender=Attendance)
def handle_attendance_delete(sender, instance, **kwargs):
    """
    Attendance o'chirilganda ham
    discount/negotiated studentlar uchun joriy oyda qayta hisoblashni ishga tushiradi.
    """
    try:
        if not instance.student_id or not instance.student:
            return
    except Exception:
        return

    if instance.student.status in ["discount", "negotiated"]:
        update_attendance_based_payments(
            instance.student, instance.group, instance.date
        )

from django.db.models import Sum
from decimal import Decimal
from groups.models import Student
from finance.models import FinanceTransaction, StudentFinanceProfile

@receiver(post_save, sender=Student)
def create_student_finance_profile(sender, instance, created, **kwargs):
    """
    Yangi o'quvchi yaratilganda avtomatik Wallet profilini ham ochish.
    """
    if created:
        StudentFinanceProfile.objects.get_or_create(student=instance)
