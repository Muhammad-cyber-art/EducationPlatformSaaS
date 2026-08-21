from django.core.management.base import BaseCommand
from homework_attends.models import Attendance
from groups.models import Student
from django.utils import timezone
from django.contrib.auth import get_user_model
from finance.models import StaffProfile
from finance.utils import calculate_attendance_based_student_payment, calculate_group_revenue_and_mentor_share

User = get_user_model()


class Command(BaseCommand):
    help = "Diagnose why discount student's salary isn't being calculated for mentor"

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
            
        current_month = current_date.replace(month=month, year=year, day=1)

        for student_id in [2, 3]:
            self.stdout.write(f"\n\n{'='*60}")
            self.stdout.write(f"DIAGNOSING STUDENT ID: {student_id} (Oy: {month}.{year})")
            self.stdout.write(f"{'='*60}")

            try:
                student = Student.objects.get(id=student_id)
                self.stdout.write(f"\n✅ O'quvchi topildi: {student.full_name}")
                self.stdout.write(f"   Status: {student.get_status_display()} (code: {student.status})")

                if student.status not in ["discount", "negotiated"]:
                    self.stdout.write(self.style.WARNING("⚠️ O'quvchi 'discount' yoki 'negotiated' emas!"))

                if not student.group:
                    self.stdout.write(self.style.ERROR("❌ O'quvchi guruhga biriktirilmagan!"))
                    continue

                group = student.group
                self.stdout.write(f"\n✅ Guruh topildi: {group.name}")

                if not group.mentor:
                    self.stdout.write(self.style.ERROR("❌ Guruhga mentor biriktirilmagan!"))
                    continue
                self.stdout.write(f"✅ Mentor topildi: {group.mentor.get_full_name()}")

                if not hasattr(group.mentor, 'staff_profile'):
                    self.stdout.write(self.style.ERROR("❌ Mentor uchun StaffProfile yaratilmagan!"))
                    continue

                profile = group.mentor.staff_profile
                self.stdout.write(f"\nMentor StaffProfile ma'lumotlari:")
                self.stdout.write(f"   Salary type: {profile.salary_type}")

                if profile.salary_type == "fixed":
                    self.stdout.write(self.style.WARNING("⚠️ Mentor maoshi 'fixed' (foiz yoki student_count emas!), shuning uchun imtiyozli o'quvchi hisoblanmaydi!"))

                if profile.salary_type == "percentage":
                    self.stdout.write(self.style.SUCCESS(f"   Foiz: {profile.commission_percentage}%"))
                elif profile.salary_type == "student_count":
                    self.stdout.write(self.style.SUCCESS(f"   Har student uchun: {profile.per_student_amount}"))

                # Check lesson dates
                lesson_dates = group.get_lesson_dates(year, month)
                self.stdout.write(f"\nJoriy oydagi darslar soni: {len(lesson_dates)}")
                if len(lesson_dates) ==0:
                    self.stdout.write(self.style.WARNING("⚠️ Joriy oyda darslar yo'q!"))


                # Check attendances
                attendances = Attendance.objects.filter(student=student, group=group, date__year=year, date__month=month)
                self.stdout.write(f"\nDavomat yozuvlari soni: {attendances.count()}")

                present_attendances = attendances.filter(is_present=True)
                self.stdout.write(f"   Is_Present=True: {present_attendances.count()}")

                present_with_marker = present_attendances.filter(marked_by__isnull=False)
                self.stdout.write(f"   Is_Present=True + Marked_By bor: {present_with_marker.count()}")

                # Show each attendance
                self.stdout.write(f"\nHar bir davomat yozuvi:")
                for att in attendances.order_by('date'):
                    status_str = "✅" if att.is_present else "❌"
                    marker_str = f" (marked by: {att.marked_by.username if att.marked_by else 'YO\'Q'})"
                    self.stdout.write(f"   {att.date}: {status_str} is_present={att.is_present}{marker_str}")

                # Test calculate_attendance_based_student_payment with more details
                from groups.models import GroupEnrollment
                from homework_attends.models import Attendance
                
                self.stdout.write(f"\n\nDETAILED DEBUG FOR calculate_attendance_based_student_payment:")
                base_price = group.monthly_price
                if student.status in ["low_income", "negotiated", "discount"]:
                    if student.custom_fee is not None:
                        base_price = student.custom_fee
                self.stdout.write(f"  base_price: {base_price}")

                # Join date
                join_date = None
                enrollment = GroupEnrollment.objects.filter(student=student, group=group).only("joined_at").first()
                if enrollment and enrollment.joined_at:
                    join_date = enrollment.joined_at.date()
                elif student.joined_at:
                    join_date = student.joined_at.date()
                self.stdout.write(f"  join_date: {join_date}")

                # Lesson dates
                lesson_dates = group.get_lesson_dates(year, month)
                if join_date:
                    lesson_dates = [d for d in lesson_dates if d >= join_date]
                self.stdout.write(f"  lesson_dates (after join date): {lesson_dates}")
                total_lessons_count = len(lesson_dates)
                self.stdout.write(f"  total_lessons_count: {total_lessons_count}")

                today = timezone.localdate()
                active_lesson_dates = [d for d in lesson_dates if d <= today]
                self.stdout.write(f"  today: {today}")
                self.stdout.write(f"  active_lesson_dates (<= today): {active_lesson_dates}")
                self.stdout.write(f"  active_lessons_count: {len(active_lesson_dates)}")

                # Attendance count
                attendance_filters = {
                    "student": student, "group": group,
                    "date__year": year, "date__month": month,
                    "date__in": active_lesson_dates,
                    "is_present": True, "marked_by__isnull": False,
                }
                if join_date:
                    attendance_filters["date__gte"] = join_date
                present_count = Attendance.objects.filter(**attendance_filters).count()
                self.stdout.write(f"  present_count (from filters): {present_count}")
                
                student_payment = calculate_attendance_based_student_payment(student, group, current_month, ignore_today_check=True)
                self.stdout.write(f"\ncalculate_attendance_based_student_payment FINAL natijasi: {student_payment}")

                # Test calculate_group_revenue_and_mentor_share
                result = calculate_group_revenue_and_mentor_share(group, current_month, profile=profile, ignore_today_check=True)
                self.stdout.write(f"\ncalculate_group_revenue_and_mentor_share natijalari:")
                self.stdout.write(f"   mentor_share_paid: {result['mentor_share_paid']}")
                self.stdout.write(f"   mentor_share_expected: {result['mentor_share_expected']}")
                self.stdout.write(f"   expected_revenue: {result['expected_revenue']}")


            except Student.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"❌ ID {student_id} li o'quvchi topilmadi!"))

