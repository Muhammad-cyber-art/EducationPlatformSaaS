"""Lossless archive snapshots and tenant-local, ID-based restoration helpers."""
import json
import logging
from datetime import date, datetime

from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Count, Q
from rest_framework.exceptions import PermissionDenied, ValidationError

logger = logging.getLogger(__name__)


def snapshot(instance):
    data = {field.name: getattr(instance, field.attname)
            for field in instance._meta.concrete_fields}
    # FileField values are FieldFiles, not JSON values.
    for field in instance._meta.concrete_fields:
        if field.get_internal_type() in ('FileField', 'ImageField'):
            data[field.name] = getattr(instance, field.name).name
    def encode(value):
        # DjangoJSONEncoder truncates datetime microseconds; membership dates must round-trip.
        if isinstance(value, (date, datetime)):
            return value.isoformat()
        return DjangoJSONEncoder().default(value)
    return json.loads(json.dumps(data, default=encode))


def snapshot_rows(queryset):
    return [snapshot(obj) for obj in queryset]


def student_history(student):
    from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult
    from finance.models import FinanceTransaction
    return {
        'attendance': list(Attendance.objects.filter(student=student).values_list('pk', flat=True)),
        'homework': list(HomeworkSubmission.objects.filter(student=student).values_list('pk', flat=True)),
        'mock_test': list(MockTestResult.objects.filter(student=student).values_list('pk', flat=True)),
        'transactions': list(FinanceTransaction.objects.filter(student=student).values_list('pk', flat=True)),
    }


def scope_archives(queryset, user):
    """Unknown or ambiguous legacy branch names remain super-admin-only."""
    from branches.models import Branch
    from permissions.scopes import allowed_branch_ids
    if user.is_superuser or user.role == 'super_admin':
        return queryset
    if user.role != 'admin':
        return queryset.none()
    allowed = allowed_branch_ids(user)
    unique_names = Branch.objects.values('name').annotate(n=Count('pk')).filter(n=1).values('name')
    names = Branch.objects.filter(pk__in=allowed, name__in=unique_names).values('name')
    no_id = Q(metadata__branch_id__isnull=True) | Q(metadata__branch_id=None)
    no_branch = Q(metadata__branch__isnull=True) | Q(metadata__branch=None)
    return queryset.filter(
        Q(metadata__branch_id__in=allowed)
        | (no_id & Q(metadata__branch__in=allowed))
        | (no_id & no_branch & Q(branch_name__in=names))
    )


def require_archive_access(archived, user):
    if not scope_archives(type(archived).objects.filter(pk=archived.pk), user).exists():
        raise PermissionDenied("Ushbu filial arxiviga ruxsat yo'q.")


def restore_row(model, data, **overrides):
    """Restore concrete fields, retaining dates/decimals and clearing deleted optional FKs."""
    values = {}
    for field in model._meta.concrete_fields:
        if field.name not in data:
            continue
        value = data[field.name]
        if field.is_relation and value is not None:
            if not field.remote_field.model.objects.filter(pk=value).exists():
                if not field.null:
                    raise ValidationError(f"{model.__name__}.{field.name}: bog'liq yozuv topilmadi.")
                value = None
        values[field.attname] = field.to_python(value)
    values.update(overrides)
    obj = model(**values)
    obj._restoring_from_archive = True
    obj._notification_handled = True
    obj.save(force_insert=True)
    dates = {field.attname: values[field.attname] for field in model._meta.concrete_fields
             if (getattr(field, 'auto_now_add', False) or getattr(field, 'auto_now', False))
             and field.attname in values}
    if dates:
        model.objects.filter(pk=obj.pk).update(**dates)
        for key, value in dates.items():
            setattr(obj, key, value)
    return obj


def restore_student_history(archived, student):
    from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult
    from finance.models import FinanceTransaction
    history = archived.metadata.get('history_ids')
    if history is None:
        warning = ("Eski arxivda tarix yozuvlarining IDlari saqlanmagan. "
                   "Bog'lanmagan davomat va moliyaviy tarixni alohida tekshirish kerak.")
        logger.warning('Legacy archive %s: orphan links require explicit reconciliation', archived.pk)
        return [warning]
    relations = ((Attendance, 'attendance'), (HomeworkSubmission, 'homework'),
                 (MockTestResult, 'mock_test'), (FinanceTransaction, 'transactions'))
    for model, key in relations:
        rows = model.objects.filter(pk__in=history.get(key, []), student__isnull=True)
        if model is not FinanceTransaction:
            rows.filter(Q(student_full_name__isnull=True) | Q(student_full_name='')).update(
                student_full_name=student.full_name)
        rows.update(student=student)
    return []


def restore_payments(rows, student=None):
    from finance.models import Payment
    for data in rows:
        overrides = {'student_id': student.pk} if student else {}
        existing = Payment.objects.filter(pk=data.get('id')).first() if data.get('id') else None
        if existing:
            # A group snapshot and its student snapshot can contain the same invoice.
            expected_student = student.pk if student else data.get('student')
            if existing.student_id != expected_student or existing.group_id not in (None, data.get('group')):
                raise ValidationError("To'lov IDsi boshqa yozuvga tegishli; tiklash bekor qilindi.")
            if existing.group_id is None and data.get('group'):
                from groups.models import Group
                if Group.objects.filter(pk=data['group']).exists():
                    Payment.objects.filter(pk=existing.pk).update(group_id=data['group'])
            continue
        restore_row(Payment, data, **overrides)
