"""Bounded-query data sources shared by downloadable and scheduled reports."""
from decimal import Decimal
from django.db.models import OuterRef, Subquery, Sum, Q, F, Value, DecimalField
from django.db.models.functions import Greatest
from finance.models import FinanceTransaction, Payment, AdminExpense
from homework_attends.models import Homework, HomeworkSubmission


def with_homework_status(queryset):
    homework = Homework.objects.filter(
        group_id=OuterRef('group_id'), created_at__date=OuterRef('date'),
    ).order_by('-created_at', '-pk')
    queryset = queryset.annotate(
        report_homework_id=Subquery(homework.values('pk')[:1]),
        report_homework_title=Subquery(homework.values('title')[:1]),
    )
    return queryset.annotate(report_submission_status=Subquery(
        HomeworkSubmission.objects.filter(
            homework_id=OuterRef('report_homework_id'), student_id=OuterRef('student_id'),
        ).values('status')[:1]
    ))


def monthly_branch_totals(year, month):
    """Cash totals use verified ledger entries; debt uses outstanding invoices."""
    money = DecimalField(max_digits=18, decimal_places=2)
    fields = {
        'inc_fees': Q(transaction_type='income', category='student_fee'),
        'inc_extra': Q(transaction_type='income', category='student_extra'),
        'exp_salary': Q(transaction_type='expense', category='salary'),
        'exp_refund': Q(transaction_type='expense', category='refund'),
        'exp_util': Q(transaction_type='expense', category='utility'),
        'exp_other': Q(transaction_type='expense') & ~Q(category__in=['salary', 'refund', 'utility']),
    }
    totals = {}
    for row in FinanceTransaction.objects.filter(
        date__year=year, date__month=month, status='completed', is_verified=True,
    ).order_by().values('branch_id').annotate(**{
        key: Sum('amount', filter=condition, default=Decimal('0'))
        for key, condition in fields.items()
    }):
        totals[row['branch_id']] = {key: row[key] for key in fields}
    for row in Payment.objects.filter(
        month__year=year, month__month=month, is_paid=False, is_auto_discount=False,
    ).exclude(student__status='discount').order_by().values('group__branch_id').annotate(
        debt=Sum(Greatest(F('amount') - F('paid_amount'), Value(Decimal('0')), output_field=money)),
    ):
        totals.setdefault(row['group__branch_id'], {})['debt'] = row['debt'] or Decimal('0')
    for row in AdminExpense.objects.filter(date__year=year, date__month=month).order_by().values('branch_id').annotate(total=Sum('amount')):
        record = totals.setdefault(row['branch_id'], {})
        record['exp_other'] = record.get('exp_other', Decimal('0')) + row['total']
    return totals
