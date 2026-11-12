from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from homework_attends.tasks import create_attendance_task


class Command(BaseCommand):
    help = "Create tomorrow's attendance in all active tenants."

    def handle(self, *args, **options):
        # Execute synchronously using the same tenant/membership rules as Beat.
        count = create_attendance_task()
        tomorrow = timezone.localdate() + timedelta(days=1)
        self.stdout.write(self.style.SUCCESS(f"{tomorrow}: {count} attendance records created."))
