from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
import logging

from .models import Group, GroupEnrollment, Student

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=Group)
def on_group_deleted(sender, instance, **kwargs):
    """
    Guruh o'chirilganda:
    Agar ushbu guruhda o'qigan studentlar boshqa guruhlarda ham bor bo'lsa,
    ularning legacy 'group' va 'branch' maydonlari avtomatik tarzda qolgan faol guruhlariga o'tkaziladi.
    """
    try:
        # group_id bo'sh qolgan yoki instance.id ga teng bo'lgan o'quvchilarni topamiz
        affected_students = Student.objects.filter(
            models.Q(group_id__isnull=True) | models.Q(group_id=instance.id)
        ).filter(is_active=True, is_archived=False)

        for student in affected_students:
            student.sync_active_group_and_branch()
    except Exception as e:
        logger.warning(f"Error in on_group_deleted signal for group {instance.id}: {e}")


@receiver(post_delete, sender=GroupEnrollment)
def on_enrollment_deleted(sender, instance, **kwargs):
    """Enrollment o'chirilganda o'quvchi ma'lumotlarini qolgan faol guruhlar bilan sinxronlash"""
    if instance.student_id:
        try:
            student = Student.objects.filter(id=instance.student_id).first()
            if student:
                student.sync_active_group_and_branch()
        except Exception as e:
            logger.warning(f"Error in on_enrollment_deleted signal: {e}")


@receiver(post_save, sender=GroupEnrollment)
def on_enrollment_saved(sender, instance, **kwargs):
    """
    Enrollment nofaol qilinganda (is_active=False bo'lganda):
    Agar o'quvchining asosiy 'group'i shu guruh bo'lsa, qolgan faol guruhga o'tkaziladi.
    """
    if not instance.is_active and instance.student_id:
        try:
            student = Student.objects.filter(id=instance.student_id).first()
            if student and student.group_id == instance.group_id:
                student.sync_active_group_and_branch()
        except Exception as e:
            logger.warning(f"Error in on_enrollment_saved signal: {e}")
