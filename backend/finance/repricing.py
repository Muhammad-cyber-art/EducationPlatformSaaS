"""Reprice open current-month invoices without changing collected cash."""
from copy import copy
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from finance.models import Payment
from finance.utils import calculate_attendance_based_student_payment, floor_amount, get_teacher_negotiated_center_fee
from groups.models import GroupEnrollment, Student
from groups.utils import get_lessons_in_month


def _fee(student, group):
    if student.status == 'teacher_negotiated':
        return get_teacher_negotiated_center_fee(group)
    return Decimal(str(group.monthly_price or 0))


def _tariff_candidates(group, enrollment, old_fee, new_fee, month):
    candidates = [(floor_amount(old_fee), floor_amount(new_fee))]
    dates = group.get_lesson_dates(month.year, month.month)
    if not dates:
        return candidates
    if group.start_date and group.start_date > month:
        full = get_lessons_in_month(group._get_effective_days(), month.year, month.month)
        if full:
            candidates.append((floor_amount(old_fee / len(full) * len(dates)),
                               floor_amount(new_fee / len(full) * len(dates))))
    if enrollment and enrollment.joined_at:
        joined = timezone.localdate(enrollment.joined_at)
        if joined > month:
            remaining = sum(day >= joined for day in dates)
            candidates.append((floor_amount(old_fee / len(dates) * remaining),
                               floor_amount(new_fee / len(dates) * remaining)))
    return candidates


@transaction.atomic
def reprice_current_group_invoices(group, old_price):
    """The caller holds the group lock and commits the tariff and invoices together.

Closed invoices, explicit individual fees and historical memberships are kept.
Ambiguous legacy amounts are reported for review instead of guessing their basis.
"""
    today = timezone.localdate()
    group.monthly_price = Decimal(str(group.monthly_price or 0))
    month = today.replace(day=1)
    summary = {'month': str(month), 'updated_count': 0, 'paid_preserved_count': 0,
               'individual_preserved_count': 0, 'unmatched_count': 0, 'unmatched_students': []}
    if group.monthly_price < 0:
        raise ValueError('Guruh narxi manfiy bo‘lishi mumkin emas.')
    if group.is_archived or not group.is_faol:
        return summary
    old_group = copy(group)
    old_group.monthly_price = Decimal(str(old_price))
    enrollments = {row.student_id: row for row in GroupEnrollment.objects.filter(
        group=group, is_active=True, left_at__isnull=True, is_frozen=False,
        student__is_active=True, student__is_archived=False,
    )}
    legacy_ids = Student.objects.filter(group=group, is_active=True, is_archived=False,
                                        is_frozen=False).exclude(enrollments__group=group).values('pk')
    payments = Payment.objects.select_for_update(of=('self',)).select_related('student').filter(
        group=group, month=month,
    ).filter(Q(student_id__in=enrollments) | Q(student_id__in=legacy_ids)).order_by('pk')
    for payment in payments:
        student = payment.student
        amount = Decimal(str(payment.amount or 0))
        paid = Decimal(str(payment.paid_amount or 0))
        if payment.is_paid or (amount > 0 and paid >= amount):
            summary['paid_preserved_count'] += 1
            continue
        if student.status in ('low_income', 'negotiated', 'teacher_negotiated', 'discount') and student.custom_fee is not None:
            summary['individual_preserved_count'] += 1
            continue
        old_fee, new_fee = _fee(student, old_group), _fee(student, group)
        refund = Decimal(str(payment.refund_amount or 0)) if not payment.refund_ignored else Decimal('0')
        new_refund = refund
        new_amount = None
        if student.status == 'discount':
            old_expected = calculate_attendance_based_student_payment(student, old_group, month)
            if amount == old_expected:
                new_amount = calculate_attendance_based_student_payment(student, group, month)
        else:
            for old_gross, new_gross in _tariff_candidates(group, enrollments.get(student.pk), old_fee, new_fee, month):
                if max(Decimal('0'), old_gross - refund) == amount:
                    new_refund = floor_amount(refund * new_fee / old_fee) if old_fee else Decimal('0')
                    new_amount = max(Decimal('0'), new_gross - new_refund)
                    break
        if new_amount is None:
            summary['unmatched_count'] += 1
            summary['unmatched_students'].append({'student_id': student.pk,
                                                   'student_name': student.full_name,
                                                   'payment_id': payment.pk})
            continue
        if new_amount == amount and (payment.refund_ignored or new_refund == (payment.refund_amount or 0)):
            continue
        payment.amount = new_amount
        # Ignored refund metadata is historical and must not become active.
        if not payment.refund_ignored:
            payment.refund_amount = new_refund
        payment.is_paid = paid >= new_amount
        payment.is_partial = paid > 0 and not payment.is_paid
        audit = (f'Tarif tahriri ({today}): {old_price} → {group.monthly_price} UZS; '
                 f'{month:%Y-%m} hisobi {amount} → {new_amount} UZS.')
        payment.notes = f'{payment.notes}\n{audit}' if payment.notes else audit
        payment.save(update_fields=['amount', 'refund_amount', 'is_paid', 'is_partial', 'notes'])
        summary['updated_count'] += 1
    if summary['updated_count']:
        from finance.services import sync_mentor_salary
        sync_mentor_salary(group, month)
    return summary
