# homework_attends/management/commands/create_attendance.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from homework_attends.models import Group, Attendance 

class Command(BaseCommand):
    help = "Yangi davomat yaratish va 7 kundan eski ma'lumotlarni tozalash"
    def handle(self, *args, **options):
        tomorrow = timezone.localdate() + timedelta(days=1)
        groups = Group.objects.all()
        count = 0

        for group in groups:
            # FAQAT ertangi kunga qadar qo'shilgan studentlar uchun yaratadi
            students = group.students.filter(joined_at__date__lte=tomorrow)
            
            if students.exists():
                for student in students:
                    obj, created = Attendance.objects.get_or_create(
                        student=student,
                        group=group,
                        date=tomorrow,
                        defaults={'is_present': True}
                    )
                    if created:
                        count += 1
        
        self.stdout.write(self.style.SUCCESS(f"{tomorrow} uchun {count} ta davomat yaratildi."))