from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.models import Count, Q

from finance.models import Payment


class Command(BaseCommand):
    help = 'Read-only invoice audit; returns nonzero for duplicates or negative amounts.'

    def add_arguments(self, parser):
        parser.add_argument('--all-tenants', action='store_true')

    def audit(self, label):
        issues = 0
        duplicates = Payment.objects.filter(
            student__isnull=False, group__isnull=False, month__isnull=False,
        ).values('student_id', 'group_id', 'month').annotate(count=Count('id')).filter(count__gt=1)
        for key in duplicates.iterator():
            ids = list(Payment.objects.filter(
                student_id=key['student_id'], group_id=key['group_id'], month=key['month'],
            ).values_list('id', flat=True))
            self.stdout.write(f'{label}: DUPLICATE invoice_ids={ids} month={key["month"]}')
            issues += 1
        invalid_ids = list(Payment.objects.filter(
            Q(amount__lt=0) | Q(paid_amount__lt=0) | Q(refund_amount__lt=0),
        ).values_list('id', flat=True))
        if invalid_ids:
            self.stdout.write(f'{label}: NEGATIVE_AMOUNT invoice_ids={invalid_ids}')
            issues += len(invalid_ids)
        self.stdout.write(f'{label}: {issues} issue(s); no data changed')
        return issues

    def handle(self, *args, **options):
        if options['all_tenants'] and connection.vendor != 'postgresql':
            raise CommandError('--all-tenants requires PostgreSQL')
        if not options['all_tenants']:
            issues = self.audit('current schema')
        else:
            from tenants.models import Tenant
            from tenants.utils import tenant_schema_context
            with tenant_schema_context('public'):
                schemas = ['public'] + list(Tenant.objects.exclude(schema_name='public').values_list('schema_name', flat=True))
            issues = 0
            for schema in schemas:
                with tenant_schema_context(schema):
                    # Never accidentally audit public tables through search_path fallback.
                    with connection.cursor() as cursor:
                        cursor.execute('SELECT to_regclass(%s)', [f'{schema}.finance_payment'])
                        exists = cursor.fetchone()[0]
                    if not exists:
                        raise CommandError(f'{schema}: local finance_payment table missing')
                    issues += self.audit(schema)
        if issues:
            raise CommandError(f'Financial integrity audit failed: {issues} issue(s). Reconcile before deployment.')
