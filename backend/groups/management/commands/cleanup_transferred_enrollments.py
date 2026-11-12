from django.core.management.base import BaseCommand, CommandError

from groups.models import GroupEnrollment
from tenants.models import Tenant
from tenants.utils import tenant_schema_context


class Command(BaseCommand):
    help = "Legacy cleanup is disabled; --dry-run reports membership counts only."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--tenant', type=str, default=None)

    def handle(self, *args, **options):
        # A primary-group mismatch or old transfer is not evidence that another
        # enrollment/invoice is invalid: students may attend several courses or
        # rejoin. Never infer deletions from these legacy heuristics.
        if not options['dry_run']:
            raise CommandError(
                "Cleanup disabled: it can delete valid memberships and invoices. "
                "No data changed. Use --dry-run for a read-only membership summary. "
                "Historical repairs require a verified student/group mapping."
            )

        tenants = Tenant.objects.exclude(schema_name='public')
        if options['tenant']:
            tenants = tenants.filter(schema_name=options['tenant'])
        for tenant in tenants:
            with tenant_schema_context(tenant.schema_name):
                active = GroupEnrollment.objects.filter(is_active=True).count()
                inactive = GroupEnrollment.objects.filter(is_active=False).count()
                self.stdout.write(f"{tenant.schema_name}: active={active}, inactive={inactive}")
        self.stdout.write("Read-only summary complete. No memberships or invoices changed.")
