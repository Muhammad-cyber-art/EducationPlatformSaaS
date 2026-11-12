import hashlib
import json
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from permissions.scopes import accessible_groups, require_finance_access
from .models import ClientLead, SyncOperation
from .payloads import AttendancePayload, PaymentPayload, ExpensePayload, SubmissionPayload, LeadPayload
from .serializers import ClientLeadSerializer


PAYLOADS = {
    'attendance': AttendancePayload, 'cashier_payment': PaymentPayload,
    'student_payment': PaymentPayload, 'admin_expense': ExpensePayload,
    'homework_submission': SubmissionPayload, 'leads': LeadPayload,
}
ACTIONS = {
    'attendance': {'confirm', 'update'}, 'cashier_payment': {'pay', 'confirm'},
    'student_payment': {'pay', 'confirm'}, 'admin_expense': {'create'},
    'homework_submission': {'update'}, 'leads': {'create', 'update', 'delete'},
}


def apply_mutation(user, client_id, item):
    entity = item['entity']
    if entity not in PAYLOADS or item['action'] not in ACTIONS[entity]:
        raise ValidationError('Entity yoki action qo‘llab-quvvatlanmaydi.')
    payload = PAYLOADS[entity](data=item['data'])
    payload.is_valid(raise_exception=True)
    fingerprint = hashlib.sha256(json.dumps(
        {'entity': entity, 'action': item['action'], 'data': item['data']},
        sort_keys=True, separators=(',', ':'), ensure_ascii=True,
    ).encode()).hexdigest()
    with transaction.atomic():
        receipt, created = SyncOperation.objects.get_or_create(
            client_id=client_id, queue_id=item['queue_id'],
            defaults={'request_hash': fingerprint, 'user': user},
        )
        receipt = SyncOperation.objects.select_for_update().get(pk=receipt.pk)
        if not created:
            if receipt.user_id != user.pk:
                raise PermissionDenied('Bu operatsiya boshqa foydalanuvchiga tegishli.')
            if receipt.request_hash != fingerprint:
                raise ValidationError('Bu queue_id boshqa operatsiya uchun ishlatilgan.')
            return receipt.result
        result = _execute(user, entity, item['action'], payload.validated_data)
        receipt.result = result
        receipt.save(update_fields=['result'])
        return result


def _execute(user, entity, action, data):
    if entity == 'attendance':
        from homework_attends.services import bulk_confirm_attendance, get_last_3_lesson_dates
        from homework_attends.views.attendance import AttendanceViewSet
        group = get_object_or_404(accessible_groups(user), pk=data['group_id'])
        day, today = data['date'], timezone.localdate()
        # The shared service validates exact dated membership and reports names.
        full = AttendanceViewSet()._user_has_full_attendance(user)
        recent = today - timedelta(days=30) <= day <= today
        grace = timezone.localtime().hour < 4 and day == today - timedelta(days=1)
        if day != today and day not in get_last_3_lesson_dates(group) and not grace and not (full and recent):
            raise ValidationError('Ushbu sana davomatini tahrirlash mumkin emas.')
        bulk_confirm_attendance(group, day, data['attendances'], user)
    elif entity in ('cashier_payment', 'student_payment'):
        from finance.models import Payment
        from finance.services import confirm_student_payment
        from finance.utils import normalize_month
        from groups.models import Student, Group, GroupEnrollment
        if user.role not in ('admin', 'super_admin'):
            raise PermissionDenied('To‘lov qabul qilish huquqi yo‘q.')
        if data.get('payment_id'):
            payment = get_object_or_404(Payment.objects.select_related('group', 'student'), pk=data['payment_id'])
            if not payment.group or not payment.student:
                raise ValidationError('Arxivlangan to‘lovni sync orqali tasdiqlash mumkin emas.')
            require_finance_access(user, payment.group.branch_id)
        else:
            group = get_object_or_404(Group, pk=data['group_id'])
            require_finance_access(user, group.branch_id)
            student = get_object_or_404(Student, pk=data['student_id'], is_active=True, is_archived=False)
            if not GroupEnrollment.objects.filter(student=student, group=group, is_active=True).exists():
                raise ValidationError('O‘quvchi ushbu guruhga biriktirilmagan.')
            fee = student.custom_fee if student.status in ('low_income', 'negotiated', 'teacher_negotiated') and student.custom_fee is not None else group.monthly_price
            payment, _ = Payment.objects.get_or_create(
                student=student, group=group, month=normalize_month(data.get('month', timezone.localdate())),
                defaults={'amount': fee or Decimal('0')},
            )
        confirm_student_payment(user, payment, data)
    elif entity == 'admin_expense':
        from finance.models import AdminExpense
        from branches.models import Branch
        require_finance_access(user, data['branch'])
        branch = get_object_or_404(Branch, pk=data['branch'])
        AdminExpense.objects.create(
            title=data['title'], amount=data['amount'], description=data.get('description', ''),
            date=data.get('date', timezone.localdate()), branch=branch, marked_by=user,
        )
    elif entity == 'homework_submission':
        from homework_attends.models import HomeworkSubmission
        sub = get_object_or_404(HomeworkSubmission.objects.filter(
            homework__group__in=accessible_groups(user)
        ).select_related('student', 'homework__group'), pk=data['submission_id'])
        sub.status = data['status']
        sub.submitted_at = None if sub.status == 'not_submitted' else timezone.now()
        sub.save()
    else:
        updated_at = data.pop('updated_at', timezone.now())
        if updated_at > timezone.now() + timedelta(minutes=5):
            raise ValidationError('Mijoz vaqti server vaqtidan juda oldinda.')
        existing = ClientLead.objects.select_for_update().filter(pk=data['id']).first()
        if existing:
            if user.role != 'super_admin' and existing.assigned_to_id != user.pk:
                raise PermissionDenied('Bu lid boshqa xodimga tegishli.')
            if updated_at < existing.updated_at:
                return {'conflict': {
                    'record_id': str(existing.pk), 'reason': 'server_wins',
                    'server_record': ClientLeadSerializer(existing).data,
                    'server_updated_at': existing.updated_at.isoformat(),
                }}
            for field in ('name', 'phone', 'email', 'status', 'notes', 'is_deleted'):
                if field in data:
                    setattr(existing, field, data[field])
        else:
            existing = ClientLead(**data, assigned_to=user)
        if action == 'delete':
            existing.is_deleted = True
        existing.updated_at = updated_at
        existing.full_clean()
        existing.save(skip_updated_at=True)
    return {}
