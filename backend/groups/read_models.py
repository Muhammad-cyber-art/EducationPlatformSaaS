"""Batch data for student list/detail serializers; no queries per student."""
from decimal import Decimal
from django.db.models import Sum, Q, Max, Count
from django.utils import timezone
from rest_framework import serializers


def prepare_students(students):
    from groups.models import GroupEnrollment, Group
    from finance.models import Payment, FinanceTransaction
    from homework_attends.models import Attendance
    if not students:
        return
    ids = [s.pk for s in students]
    today = timezone.localdate()
    enrollments = list(GroupEnrollment.objects.filter(student_id__in=ids, is_active=True).order_by('pk'))
    group_ids = {e.group_id for e in enrollments} | {s.group_id for s in students if s.group_id}
    groups = {g.pk: g for g in Group.objects.filter(pk__in=group_ids).select_related(
        'branch', 'mentor__branch', 'admin__branch',
    ).prefetch_related('special_lesson_days', 'canceled_lesson_days', 'mentor__branch_accesses__branch').annotate(
        _students_count=Count('enrollments', filter=Q(enrollments__is_active=True)),
    )}
    metrics = {r['group_id']: r for r in Attendance.objects.filter(group_id__in=group_ids, date=today).order_by().values('group_id').annotate(
        total=Count('pk'), marked=Count('pk', filter=Q(marked_by__isnull=False)),
        present=Count('pk', filter=Q(is_present=True)), absent=Count('pk', filter=Q(is_present=False)),
    )}
    for group in groups.values():
        row = metrics.get(group.pk, {})
        group._attendance_metrics = {
            'confirmed': group.is_lesson_day(today) and row.get('total', 0) > 0 and row.get('marked', 0) >= row.get('total', 0) * .7,
            'present': row.get('present', 0), 'absent': row.get('absent', 0),
        }
    by_student = {pk: [] for pk in ids}
    for enrollment in enrollments:
        enrollment.group = groups[enrollment.group_id]
        by_student[enrollment.student_id].append(enrollment)
    payments = {}
    for payment in Payment.objects.filter(student_id__in=ids, month=today.replace(day=1)).order_by('pk'):
        payments.setdefault(payment.student_id, payment)
    ledger = {r['student_id']: r for r in FinanceTransaction.objects.filter(student_id__in=ids, status='completed').order_by().values('student_id').annotate(
        paid=Sum('amount', filter=Q(transaction_type='income', record_type__in=['payment', 'reversal'])),
        refunded=Sum('amount', filter=Q(record_type='refund')),
        last_date=Max('date', filter=Q(record_type='payment')),
    )}
    billed = {r['student_id']: r['total'] for r in Payment.objects.filter(student_id__in=ids, amount__gt=0, is_auto_discount=False).order_by().values('student_id').annotate(total=Sum('amount'))}
    for student in students:
        if student.group_id in groups:
            student.group = groups[student.group_id]
        row = ledger.get(student.pk, {})
        paid = max(row.get('paid') or Decimal('0'), Decimal('0'))
        refunded = abs(row.get('refunded') or Decimal('0'))
        student._read_snapshot = {
            'enrollments': by_student[student.pk], 'payment': payments.get(student.pk),
            'finance': {
                'total_paid_all_time': paid, 'total_refunded': refunded,
                'last_payment_date': row.get('last_date'),
                'balance': Decimal('0') if student.status == 'discount' else paid - refunded - (billed.get(student.pk) or Decimal('0')),
            },
        }


class StudentListSerializer(serializers.ListSerializer):
    def to_representation(self, data):
        items = list(data.all() if hasattr(data, 'all') else data)
        prepare_students(items)
        return super().to_representation(items)


class StudentSnapshotMixin:
    def to_representation(self, instance):
        if not hasattr(instance, '_read_snapshot'):
            prepare_students([instance])
        return super().to_representation(instance)


class CachedGroupMixin:
    def to_representation(self, instance):
        cache = self.context.setdefault('_group_representations', {})
        key = (type(self).__name__, instance.pk)
        if key not in cache:
            cache[key] = super().to_representation(instance)
        # Callers add enrollment-specific fields to the returned object.
        return dict(cache[key])
