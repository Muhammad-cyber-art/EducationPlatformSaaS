
from django.core.management.base import BaseCommand
from homework_attends.models import Attendance
from groups.models import Student
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import date

User = get_user_model()


class Command(BaseCommand):
    help = "ID 2 va 3 li o'quvchilarning belgilangan oy uchun davomatlarini yaratadi va oxirgi 10 tasini True ga o'zgartiradi"

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, help='Yil (masalan: 2026)')
        parser.add_argument('--month', type=int, help='Oy (masalan: 5)')

    def handle(self, *args, **options):
        current_date = timezone.localdate()
        
        if options['year']:
            year = options['year']
        else:
            year = current_date.year
            
        if options['month']:
            month = options['month']
        else:
            month = current_date.month
        
        # Get a user to set as marked_by
        marker = User.objects.first()

        for student_id in [15,16,17,18,19,20]:
            self.stdout.write(f"\nO'quvchi ID: {student_id} uchun davomatlarini yaratib yangilamoqda... (Oy: {month}.{year})")

            try:
                student = Student.objects.get(id=student_id)
                self.stdout.write(self.style.SUCCESS(f"O'quvchi: {student.full_name} (status: {student.get_status_display()})"))

                if not student.group:
                    self.stdout.write(self.style.WARNING(f"Xato: O'quvchi guruhga biriktirilmagan!"))
                    continue

                group = student.group
                self.stdout.write(f"Guruh: {group.name}")

                # Guruhning belgilangan oy uchun dars kunlarini olamiz
                lesson_dates = group.get_lesson_dates(year, month)
                self.stdout.write(f"{month}.{year} oyda {len(lesson_dates)} ta dars kuni mavjud")

                created_count = 0
                for lesson_date in lesson_dates:
                    # Davomat yaratamiz (agar mavjud bo'lmasa)
                    att, created = Attendance.objects.get_or_create(
                        student=student,
                        group=group,
                        date=lesson_date,
                        defaults={'is_present': False, 'marked_by': marker}
                    )
                    if created:
                        created_count += 1
                    elif att.marked_by is None:
                        att.marked_by = marker
                        att.save()

                if created_count > 0:
                    self.stdout.write(self.style.SUCCESS(f"{created_count} ta yangi davomat yozuvi yaratildi!"))

                # Oxirgi 10 ta davomatni True ga o'zgartiramiz
                all_attendances = Attendance.objects.filter(
                    student_id=student_id,
                    date__year=year,
                    date__month=month
                ).order_by('date')

                self.stdout.write(f"Jami davomat yozuvi: {all_attendances.count()} ta")

                if all_attendances.count() >= 10:
                    last_10_ids = list(all_attendances.values_list('id', flat=True))[-10:]
                    Attendance.objects.filter(id__in=last_10_ids).update(is_present=True, marked_by=marker)
                    self.stdout.write(self.style.SUCCESS("Oxirgi 10 davomat yozuvi 'True' ga yangilandi!"))
                else:
                    all_attendances.update(is_present=True, marked_by=marker)
                    self.stdout.write(self.style.SUCCESS(f"Barcha {all_attendances.count()} ta davomat yozuvi 'True' ga yangilandi!"))

            except Student.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"Xato: ID {student_id} li o'quvchi topilmadi!"))
