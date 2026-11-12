import uuid
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from branches.models import Branch
from finance.models import EmployeePayment, Payment, StaffProfile
from finance.services import recalculate_attendance_mentor_salary
from groups.models import Group, Student
from homework_attends.models import Attendance
from homework_attends.services import bulk_confirm_attendance
from sync_engine.models import SyncOperation
from sync_engine.services import apply_mutation
from telegram_bot.tasks import send_attendance_notifications_task


class AttendanceConfirmationTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.branch = Branch.objects.create(name='Confirm performance')
        users = get_user_model()
        self.user = users.objects.create_user(username='confirm-owner', role='super_admin')
        self.mentor = users.objects.create_user(username='confirm-mentor', role='mentor', branch=self.branch)
        self.group = Group.objects.create(name='Confirm', branch=self.branch, mentor=self.mentor,
                                          monthly_price=300000, custom_days=list(range(7)))

    def students(self, count, status='regular'):
        return [Student.objects.create(full_name=f'Student {number}', group=self.group, status=status)
                for number in range(count)]

    def confirm(self, students):
        return bulk_confirm_attendance(self.group, self.today, [
            {'student_id': student.pk, 'is_present': True} for student in students
        ], self.user)

    def test_fifty_students_recalculate_salary_once_and_regular_students_skip_finance(self):
        students = self.students(25, 'negotiated') + self.students(25)
        with patch('finance.services.update_attendance_based_payments') as update, \
             patch('finance.services.recalculate_attendance_mentor_salary') as salary, \
             patch.object(send_attendance_notifications_task, 'apply_async'):
            with self.captureOnCommitCallbacks(execute=True):
                self.confirm(students)
        self.assertEqual(update.call_count, 25)
        self.assertTrue(all(call.kwargs == {'recalculate_salary': False} for call in update.call_args_list))
        salary.assert_called_once()
        self.assertEqual(Attendance.objects.count(), 50)

    def test_unchanged_confirmation_does_not_repeat_finance_or_publish(self):
        students = self.students(3, 'negotiated')
        with patch.object(send_attendance_notifications_task, 'apply_async'):
            with self.captureOnCommitCallbacks(execute=True):
                self.confirm(students)
        with patch('finance.services.update_attendance_based_payments') as update, \
             patch('finance.services.recalculate_attendance_mentor_salary') as salary, \
             patch.object(send_attendance_notifications_task, 'apply_async') as publish:
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(self.confirm(students).count(), 3)
        update.assert_not_called()
        salary.assert_not_called()
        publish.assert_not_called()

    def test_confirmation_does_not_query_marked_by_per_student(self):
        students = self.students(50)
        with patch.object(send_attendance_notifications_task, 'apply_async'):
            with self.captureOnCommitCallbacks(execute=True):
                self.confirm(students)
        with CaptureQueriesContext(connection) as queries:
            list(self.confirm(students))
        self.assertLess(len(queries), 20)

    def test_notifications_do_not_subscribe_to_result_backend(self):
        from kombu import Connection
        self.assertTrue(send_attendance_notifications_task.ignore_result)
        # A real Celery publish to the isolated memory broker must not touch
        # the result consumer, which otherwise reconnects repeatedly to Redis.
        with Connection('memory://') as broker, broker.Producer() as producer, \
             patch.object(send_attendance_notifications_task.app.backend, 'on_task_call',
                          side_effect=AssertionError('result backend unavailable')) as subscribe:
            result = send_attendance_notifications_task.apply_async(
                args=[[]], kwargs={'schema_name': 'public'}, retry=False, producer=producer,
            )
        subscribe.assert_not_called()
        self.assertTrue(result.ignored)

    def test_broker_failure_does_not_undo_committed_attendance(self):
        students = self.students(1)
        with patch.object(send_attendance_notifications_task, 'apply_async', side_effect=ConnectionError('broker down')):
            with self.captureOnCommitCallbacks(execute=True):
                self.confirm(students)
        self.assertEqual(Attendance.objects.get().marked_by_id, self.user.pk)

    def test_discount_invoice_is_still_updated_during_bulk_confirmation(self):
        student = self.students(1, 'discount')[0]
        with patch.object(send_attendance_notifications_task, 'apply_async'):
            with self.captureOnCommitCallbacks(execute=True):
                self.confirm([student])
        invoice = Payment.objects.get(student=student, group=self.group, month=self.today.replace(day=1))
        self.assertGreater(invoice.amount, 0)

    def test_paid_salary_is_not_rewritten(self):
        StaffProfile.objects.create(user=self.mentor, salary_type='percentage', commission_percentage=50)
        payment = EmployeePayment.objects.create(employee=self.mentor, month=self.today.replace(day=1),
                                                  salary_base=Decimal('123456'), is_paid=True)
        recalculate_attendance_mentor_salary(self.group, self.today.replace(day=1))
        payment.refresh_from_db()
        self.assertEqual(payment.salary_base, Decimal('123456'))

    def test_retry_after_lost_response_reuses_receipt_without_reconfirming(self):
        student = self.students(1)[0]
        item = {'queue_id': 'confirmation-1', 'entity': 'attendance', 'action': 'confirm',
                'data': {'group_id': self.group.pk, 'date': str(self.today),
                         'attendances': [{'student_id': student.pk, 'is_present': True}]}}
        client = uuid.uuid4()
        with patch.object(send_attendance_notifications_task, 'apply_async') as publish:
            with self.captureOnCommitCallbacks(execute=True):
                first = apply_mutation(self.user, client, item)
            with self.captureOnCommitCallbacks(execute=True):
                second = apply_mutation(self.user, client, item)
        self.assertEqual(first, second)
        self.assertEqual(SyncOperation.objects.count(), 1)
        self.assertEqual(Attendance.objects.count(), 1)
        publish.assert_called_once()
