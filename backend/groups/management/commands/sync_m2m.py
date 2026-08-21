from django.core.management.base import BaseCommand
from groups.models import Student, GroupEnrollment

class Command(BaseCommand):
    help = 'Populates GroupEnrollment (M2M) from legacy Student.group (FK)'

    def handle(self, *args, **options):
        self.stdout.write('Syncing M2M enrollments...')
        students_with_group = Student.objects.filter(group__isnull=False)
        count = 0
        for s in students_with_group:
            _, created = GroupEnrollment.objects.get_or_create(student=s, group=s.group)
            if created:
                count += 1
        
        self.stdout.write(self.style.SUCCESS(f'Successfully created {count} new enrollment records.'))
        self.stdout.write(self.style.SUCCESS('All students with a group FK are now also in the M2M through table.'))
