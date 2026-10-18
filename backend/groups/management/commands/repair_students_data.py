from django.core.management.base import BaseCommand
from tenants.utils import tenant_schema_context
from tenants.models import Tenant
from groups.models import Student, GroupEnrollment


class Command(BaseCommand):
    help = "Barcha tenantlarda o'quvchilarning guruh va filial bog'lanishlarini tekshiradi va tuzatadi (Self-healing backfill)"

    def handle(self, *args, **options):
        total_repaired = 0
        total_scanned = 0

        for tenant in Tenant.objects.exclude(schema_name='public'):
            self.stdout.write(self.style.NOTICE(f"\n--- Tenant: {tenant.schema_name} ---"))
            with tenant_schema_context(tenant.schema_name):
                students = Student.objects.all()
                tenant_repaired = 0
                for student in students:
                    total_scanned += 1
                    was_changed = student.sync_active_group_and_branch(save=True)
                    if was_changed:
                        tenant_repaired += 1
                        total_repaired += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"  [REPAIRED] Student ID={student.id} ('{student.full_name}') -> "
                                f"group={student.group_id} ({student.group.name if student.group else 'None'}), "
                                f"branch={student.branch_id} ({student.branch.name if student.branch else 'None'})"
                            )
                        )

                self.stdout.write(f"Tenant {tenant.schema_name}: {tenant_repaired}/{students.count()} ta o'quvchi tuzatildi.")

        self.stdout.write(
            self.style.SUCCESS(f"\nJami skan qilindi: {total_scanned}, Jami tuzatildi: {total_repaired}")
        )
