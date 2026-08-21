import os
import re
from django.core.management.base import BaseCommand
from django.db import transaction, IntegrityError
from groups.models import Student, GroupEnrollment, GroupTransfer
from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult
from finance.models import Payment, FinanceTransaction

class Command(BaseCommand):
    help = 'Merges duplicate students based on phone number and populates Many-to-Many relationships'

    def normalize_phone(self, phone):
        if not phone:
            return None
        return re.sub(r'\D', '', str(phone))[-9:] # Take last 9 digits to handle +998 vs 998 vs no code

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting migration to Many-to-Many and duplicate merging...'))

        # Step 1: Initial population of GroupEnrollment from current group field
        self.stdout.write('Populating GroupEnrollment from existing group fields...')
        students_with_group = Student.objects.filter(group__isnull=False)
        for s in students_with_group:
            GroupEnrollment.objects.get_or_create(student=s, group=s.group)
        self.stdout.write(self.style.SUCCESS(f'Populated {students_with_group.count()} enrollments.'))

        # Step 2: Identify and Merge Duplicates
        self.stdout.write('Identifying duplicates by phone number...')
        all_students = Student.objects.all()
        phone_map = {}

        for s in all_students:
            norm_phone = self.normalize_phone(s.phone)
            if norm_phone:
                if norm_phone not in phone_map:
                    phone_map[norm_phone] = []
                phone_map[norm_phone].append(s)

        merged_count = 0
        deleted_count = 0

        for phone, students in phone_map.items():
            if len(students) > 1:
                # Merge logic
                students.sort(key=lambda x: x.joined_at or x.id) # Earliest is master
                master = students[0]
                duplicates = students[1:]

                self.stdout.write(f'Merging {len(duplicates)} duplicates into Master: {master.full_name} ({phone})')

                for dup in duplicates:
                    with transaction.atomic():
                        # 1. Transfer Groups to Master
                        if dup.group:
                            GroupEnrollment.objects.get_or_create(student=master, group=dup.group)
                        
                        for enrollment in dup.enrollments.all():
                            GroupEnrollment.objects.get_or_create(student=master, group=enrollment.group)

                        # 2. Transfer Attendance
                        attendances = Attendance.objects.filter(student=dup)
                        for attr in attendances:
                            try:
                                attr.student = master
                                attr.save()
                            except IntegrityError:
                                # Duplicate attendance for same student/group/date
                                attr.delete()

                        # 3. Transfer Homework Submissions
                        submissions = HomeworkSubmission.objects.filter(student=dup)
                        for sub in submissions:
                            try:
                                sub.student = master
                                sub.save()
                            except IntegrityError:
                                sub.delete()

                        # 4. Transfer Mock Test Results
                        mock_results = MockTestResult.objects.filter(student=dup)
                        for res in mock_results:
                            try:
                                res.student = master
                                res.save()
                            except IntegrityError:
                                res.delete()

                        # 5. Transfer Payments
                        payments = Payment.objects.filter(student=dup)
                        for pay in payments:
                            try:
                                pay.student = master
                                pay.save()
                            except IntegrityError:
                                pay.delete()

                        # 6. Transfer Finance Transactions
                        transactions = FinanceTransaction.objects.filter(student=dup)
                        for tx in transactions:
                            tx.student = master
                            tx.save()

                        # 7. Transfer Group Transfers
                        tfers = GroupTransfer.objects.filter(student=dup)
                        for tf in tfers:
                            tf.student = master
                            tf.save()

                        # 8. Merge data fields if master is missing some
                        if not master.telegram_id and dup.telegram_id:
                            master.telegram_id = dup.telegram_id
                        if not master.parent_telegram_id and dup.parent_telegram_id:
                            master.parent_telegram_id = dup.parent_telegram_id
                        if not master.birth_date and dup.birth_date:
                            master.birth_date = dup.birth_date
                        
                        master.notes = f"{master.notes}\nMerged from dup ID {dup.id}: {dup.notes}".strip()
                        master.save()

                        # 9. Delete Duplicate
                        dup.delete()
                        deleted_count += 1
                
                merged_count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully merged {merged_count} unique student sets and deleted {deleted_count} duplicates.'))
        self.stdout.write(self.style.SUCCESS('Data migration complete! All students are now unified by phone.'))
