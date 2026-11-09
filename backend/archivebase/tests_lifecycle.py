from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from branches.models import Branch
from finance.models import FinanceTransaction, Payment
from groups.models import (Group, GroupEnrollment, MentorGroupAssignment, Student,
                           SpecialLessonDay, CanceledLessonDay, WaitingStudent)
from groups.services import unenroll_student_from_group, assign_waiting_student_to_group
from homework_attends.models import Attendance, Homework, HomeworkSubmission, MockTest, MockTestResult
from homework_attends.services import get_or_create_attendance_records, bulk_confirm_attendance
from .models import ArchivedStudent, ArchivedGroup
from .services import (move_student_to_archive, restore_student_from_archive,
                       move_group_to_archive, restore_group_from_archive)


class ArchiveLifecycleTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name='Branch A')
        self.other_branch = Branch.objects.create(name='Branch B')
        self.user = get_user_model().objects.create_user(username='boss', role='super_admin')
        self.group = Group.objects.create(name='G1', branch=self.branch, custom_days=list(range(7)))
        self.student = Student.objects.create(full_name='Same name', phone='901234567', group=self.group)
        self.today = timezone.localdate()
        self.joined = timezone.now() - timedelta(days=60)
        Student.objects.filter(pk=self.student.pk).update(joined_at=self.joined)
        GroupEnrollment.objects.filter(student=self.student).update(joined_at=self.joined)

    def test_generated_and_bulk_confirmed_attendance_has_snapshots(self):
        rows = list(get_or_create_attendance_records(self.group, self.today))
        self.assertEqual(rows[0].student_full_name, self.student.full_name)
        self.assertEqual(rows[0].group_name, self.group.name)
        bulk_confirm_attendance(self.group, self.today - timedelta(days=1),
                                [{'student_id': self.student.pk, 'is_present': False}], self.user)
        att = Attendance.objects.get(date=self.today - timedelta(days=1))
        self.assertEqual(att.student_full_name, self.student.full_name)
        self.assertEqual(att.group_name, self.group.name)

    def test_archive_restores_exact_unnamed_bulk_record_and_original_dates(self):
        # Reproduce records created by old bulk_create before this fix.
        Attendance.objects.bulk_create([Attendance(student=self.student, group=self.group, date=self.today)])
        att = Attendance.objects.get()
        original_pk = self.student.pk
        archived = move_student_to_archive(self.student, self.user)
        restored = restore_student_from_archive(archived.pk, self.user)
        att.refresh_from_db()
        self.assertEqual(att.student_id, original_pk)
        self.assertEqual(restored.pk, original_pk)
        self.assertEqual(restored.joined_at, self.joined)
        self.assertEqual(restored.enrollments.get().joined_at, self.joined)

    def test_same_name_students_retain_separate_history(self):
        other = Student.objects.create(full_name=self.student.full_name, phone='909999999', group=self.group)
        att1 = Attendance.objects.create(student=self.student, group=self.group, date=self.today)
        att2 = Attendance.objects.create(student=other, group=self.group, date=self.today)
        a1 = move_student_to_archive(self.student, self.user)
        a2 = move_student_to_archive(other, self.user)
        restored1 = restore_student_from_archive(a1.pk, self.user)
        att2.refresh_from_db()
        self.assertIsNone(att2.student_id)
        restored2 = restore_student_from_archive(a2.pk, self.user)
        att1.refresh_from_db(); att2.refresh_from_db()
        self.assertEqual(att1.student_id, restored1.pk)
        self.assertEqual(att2.student_id, restored2.pk)

    def test_legacy_archive_never_claims_unidentified_orphans(self):
        att = Attendance.objects.create(student=self.student, group=self.group, date=self.today)
        archived = move_student_to_archive(self.student, self.user)
        metadata = archived.metadata
        metadata.pop('history_ids')
        archived.metadata = metadata
        archived.save()
        with self.assertLogs('archivebase.snapshots', level='WARNING'):
            restore_student_from_archive(archived.pk, self.user)
        att.refresh_from_db()
        self.assertIsNone(att.student_id)

    def test_last_group_to_waiting_hall_and_back_preserves_attendance(self):
        att = list(get_or_create_attendance_records(self.group, self.today))[0]
        self.assertEqual(unenroll_student_from_group(self.group, self.student.pk, self.user), 'waiting_hall')
        restored = assign_waiting_student_to_group(WaitingStudent.objects.get(), self.group.pk, self.user)
        att.refresh_from_db()
        self.assertEqual(att.student_id, restored.pk)
        self.assertTrue(restored.enrollments.get(group=self.group).is_active)
        self.assertIsNone(restored.enrollments.get(group=self.group).left_at)

    def test_group_round_trip_preserves_schedule_money_and_history(self):
        self.group.custom_days = [1, 4]
        self.group.group_type = 'advanced'
        self.group.start_date = self.joined.date()
        self.group.save()
        mentor = get_user_model().objects.create_user(username='mentor', role='mentor')
        MentorGroupAssignment.objects.create(group=self.group, mentor=mentor, assigned_by=self.user)
        SpecialLessonDay.objects.create(group=self.group, date=self.today)
        CanceledLessonDay.objects.create(group=self.group, date=self.today-timedelta(days=2), reason='Holiday')
        payment = Payment.objects.create(student=self.student, group=self.group,
            month=self.today.replace(day=1), amount=Decimal('120000.25'), paid_amount=Decimal('50000.25'),
            is_partial=True, is_verified=True, verified_by=self.user, refund_amount=Decimal('1000.25'))
        tx = FinanceTransaction.objects.create(student=self.student, group=self.group, branch=self.branch,
            transaction_type='income', category='student_fee', amount=Decimal('50000.25'),
            date=self.today, title='Receipt', related_id=str(payment.pk))
        att = Attendance.objects.create(student=self.student, group=self.group, date=self.today)
        hw = Homework.objects.create(group=self.group, title='Homework', mentor=mentor)
        sub = HomeworkSubmission.objects.create(homework=hw, student=self.student, status='full')
        test = MockTest.objects.create(group=self.group, subject='Test', type='monthly')
        result = MockTestResult.objects.create(test=test, student=self.student, score='85')
        archived = move_group_to_archive(self.group, self.user)
        restored = restore_group_from_archive(archived.pk, self.user)['group']
        payment.refresh_from_db(); att.refresh_from_db(); tx.refresh_from_db()
        hw.refresh_from_db(); sub.refresh_from_db(); test.refresh_from_db(); result.refresh_from_db()
        self.assertEqual(restored.pk, self.group.pk)
        self.assertEqual(restored.custom_days, [1, 4])
        self.assertEqual(restored.group_type, 'advanced')
        self.assertEqual(restored.start_date, self.joined.date())
        self.assertEqual(restored.special_lesson_days.count(), 1)
        self.assertEqual(restored.canceled_lesson_days.get().reason, 'Holiday')
        self.assertEqual(restored.additional_mentors.get().mentor_id, mentor.pk)
        self.assertEqual(payment.amount, Decimal('120000.25'))
        self.assertEqual(payment.paid_amount, Decimal('50000.25'))
        self.assertEqual(payment.refund_amount, Decimal('1000.25'))
        self.assertTrue(payment.is_verified)
        self.assertEqual(payment.verified_by_id, self.user.pk)
        self.assertEqual(att.student_id, self.student.pk)
        self.assertEqual(att.group_id, restored.pk)
        self.assertEqual(tx.student_id, self.student.pk)
        self.assertEqual(tx.group_id, restored.pk)
        self.assertEqual(FinanceTransaction.objects.count(), 1)
        self.assertEqual(hw.group_id, restored.pk)
        self.assertEqual(sub.student_id, self.student.pk)
        self.assertEqual(sub.status, 'full')
        self.assertEqual(test.group_id, restored.pk)
        self.assertEqual(result.student_id, self.student.pk)

    def test_multi_group_student_keeps_other_group_and_both_invoices(self):
        other_group = Group.objects.create(name='G2', branch=self.branch)
        GroupEnrollment.objects.create(student=self.student, group=other_group)
        for group in (self.group, other_group):
            Payment.objects.create(student=self.student, group=group, amount=100000,
                                   month=self.today.replace(day=1))
        archived = move_group_to_archive(self.group, self.user)
        self.assertTrue(Student.objects.filter(pk=self.student.pk).exists())
        self.assertEqual(Payment.objects.filter(student=self.student).count(), 1)
        restore_group_from_archive(archived.pk, self.user)
        self.assertEqual(Payment.objects.filter(student=self.student).count(), 2)
        self.assertEqual(GroupEnrollment.objects.filter(student=self.student, is_active=True).count(), 2)

    def test_student_restored_before_group_reconnects_without_duplicate_invoice(self):
        Payment.objects.create(student=self.student, group=self.group, amount=100000)
        archived_group = move_group_to_archive(self.group, self.user)
        restore_student_from_archive(ArchivedStudent.objects.get().pk, self.user)
        restore_group_from_archive(archived_group.pk, self.user)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(Payment.objects.get().group_id, self.group.pk)

    def test_failed_group_restore_keeps_all_archives_and_rolls_back_rows(self):
        Payment.objects.create(student=self.student, group=self.group, amount=100000)
        archived = move_group_to_archive(self.group, self.user)
        with patch('archivebase.services.restore_payments', side_effect=RuntimeError('failure')):
            with self.assertRaises(RuntimeError):
                restore_group_from_archive(archived.pk, self.user)
        self.assertTrue(ArchivedGroup.objects.filter(pk=archived.pk).exists())
        self.assertEqual(ArchivedStudent.objects.count(), 1)
        self.assertFalse(Group.objects.filter(pk=self.group.pk).exists())
        self.assertFalse(Student.objects.filter(pk=self.student.pk).exists())

    def test_departed_or_not_yet_joined_student_cannot_be_confirmed(self):
        enrollment = self.student.enrollments.get()
        GroupEnrollment.objects.filter(pk=enrollment.pk).update(is_active=False, left_at=timezone.now()-timedelta(days=2))
        # Neither a stale primary-group FK nor an existing draft may bypass membership.
        Attendance.objects.create(student=self.student, group=self.group, date=self.today)
        with self.assertRaises(ValidationError):
            bulk_confirm_attendance(self.group, self.today,
                                    [{'student_id': self.student.pk, 'is_present': True}], self.user)
        self.assertIsNone(Attendance.objects.get().marked_by_id)
        GroupEnrollment.objects.filter(pk=enrollment.pk).update(is_active=True, left_at=None,
                                                                joined_at=timezone.now()+timedelta(days=1))
        with self.assertRaises(ValidationError):
            bulk_confirm_attendance(self.group, self.today,
                                    [{'student_id': self.student.pk, 'is_present': True}], self.user)

    def test_historical_membership_remains_editable_before_leaving_or_freezing(self):
        past = self.today - timedelta(days=3)
        GroupEnrollment.objects.filter(student=self.student).update(is_active=False, left_at=timezone.now())
        bulk_confirm_attendance(self.group, past,
                                [{'student_id': self.student.pk, 'is_present': False}], self.user)
        self.assertFalse(Attendance.objects.get().is_present)
        GroupEnrollment.objects.filter(student=self.student).update(is_active=True, left_at=None,
            is_frozen=True, frozen_at=timezone.now()-timedelta(days=1))
        self.assertEqual(get_or_create_attendance_records(self.group, past).count(), 1)
        with self.assertRaises(ValidationError):
            bulk_confirm_attendance(self.group, self.today,
                                    [{'student_id': self.student.pk, 'is_present': True}], self.user)

    def test_mixed_invalid_payload_does_not_partially_confirm_valid_student(self):
        other = Student.objects.create(full_name='Departed', group=self.group)
        GroupEnrollment.objects.filter(student=other).update(is_active=False, left_at=timezone.now()-timedelta(days=2))
        with self.assertRaises(ValidationError):
            bulk_confirm_attendance(self.group, self.today, [
                {'student_id': self.student.pk, 'is_present': True},
                {'student_id': other.pk, 'is_present': False},
            ], self.user)
        self.assertFalse(Attendance.objects.exists())

    def test_online_create_and_patch_cannot_bypass_departed_membership(self):
        att = Attendance.objects.create(student=self.student, group=self.group, date=self.today)
        GroupEnrollment.objects.filter(student=self.student).update(is_active=False, left_at=timezone.now()-timedelta(days=2))
        client = APIClient()
        client.force_authenticate(self.user)
        for data in ({'id':att.pk, 'is_present':False},
                     {'student_id':self.student.pk, 'group_id':self.group.pk,
                      'date':str(self.today), 'is_present':False}):
            self.assertIn(client.post(reverse('attendance-list'), data, format='json').status_code, (400, 404))
        detail = reverse('attendance-detail', args=[att.pk])
        self.assertEqual(client.patch(detail, {'is_present':False}, format='json',
            QUERY_STRING=f'group_id={self.group.pk}&date={self.today}').status_code, 400)
        att.refresh_from_db()
        self.assertTrue(att.is_present)
        self.assertIsNone(att.marked_by_id)

    def test_restore_does_not_send_registration_or_homework_notifications(self):
        Student.objects.filter(pk=self.student.pk).update(telegram_id='123456')
        Homework.objects.create(group=self.group, title='Existing homework')
        archived = move_group_to_archive(self.group, self.user)
        with patch('telegram_bot.signals.send_telegram_message_async') as welcome, \
             patch('telegram_bot.utils.send_homework_notification_async') as homework, \
             self.captureOnCommitCallbacks(execute=True):
            restore_group_from_archive(archived.pk, self.user)
        welcome.assert_not_called()
        homework.assert_not_called()

    def test_old_snapshot_format_still_restores_invoice(self):
        from .services import json_serializable_convert
        from django.forms.models import model_to_dict
        payment = Payment.objects.create(student=self.student, group=self.group, amount=100000)
        metadata = json_serializable_convert(model_to_dict(self.student))
        metadata['payments'] = [json_serializable_convert(model_to_dict(payment))]
        archived = move_student_to_archive(self.student, self.user)
        archived.metadata = metadata
        archived.save()
        with self.assertLogs('archivebase.snapshots', level='WARNING'):
            restored = restore_student_from_archive(archived.pk, self.user)
        self.assertEqual(restored.group_id, self.group.pk)
        self.assertEqual(restored.payments.get().amount, Decimal('100000'))
        self.assertTrue(restored.archive_restore_warnings)


class ArchiveBranchTests(TestCase):
    def setUp(self):
        self.a = Branch.objects.create(name='A')
        self.b = Branch.objects.create(name='B')
        self.admin = get_user_model().objects.create_user(username='admin', role='admin', branch=self.a)
        self.boss = get_user_model().objects.create_user(username='boss', role='super_admin')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.archives = {}
        for branch in (self.a, self.b):
            group = Group.objects.create(name='Group', branch=branch)
            Student.objects.create(full_name='Student', group=group)
            ag = move_group_to_archive(group, self.boss)
            self.archives[branch.pk] = (ArchivedStudent.objects.get(original_id=ag.metadata['archived_student_ids'][0]), ag)

    def test_list_detail_restore_delete_and_bulk_respect_branches(self):
        for index, resource in enumerate(('students', 'groups')):
            own = self.archives[self.a.pk][index]
            foreign = self.archives[self.b.pk][index]
            base = reverse(f'archived-{resource}-list')
            response = self.client.get(base)
            self.assertEqual([row['id'] for row in response.data['results']], [own.pk])
            detail = reverse(f'archived-{resource}-detail', args=[foreign.pk])
            self.assertEqual(self.client.get(detail).status_code, 404)
            self.assertEqual(self.client.delete(detail).status_code, 404)
            restore = reverse(f'archived-{resource}-restore', args=[foreign.pk])
            self.assertEqual(self.client.post(restore).status_code, 404)
            bulk = reverse(f'archived-{resource}-bulk-restore')
            self.assertEqual(self.client.post(bulk, {'ids':[foreign.pk]}, format='json').data['results'], [])
            delete = reverse(f'archived-{resource}-bulk-delete')
            self.client.post(delete, {'ids':[foreign.pk]}, format='json')
            self.assertTrue(type(foreign).objects.filter(pk=foreign.pk).exists())

    def test_service_access_is_checked_and_no_branch_admin_sees_nothing(self):
        foreign, group = self.archives[self.b.pk]
        with self.assertRaises(PermissionDenied):
            restore_student_from_archive(foreign.pk, self.admin)
        with self.assertRaises(PermissionDenied):
            restore_group_from_archive(group.pk, self.admin)
        self.admin.branch = None
        self.admin.save()
        self.assertEqual(self.client.get(reverse('archived-students-list')).data['count'], 0)

    def test_explicit_branch_access_and_super_admin_can_see_both(self):
        # Use the configured reverse relation, avoiding assumptions about the through-model name.
        access_model = self.admin.branch_accesses.model
        access_model.objects.create(user=self.admin, branch=self.b)
        self.assertEqual(self.client.get(reverse('archived-students-list')).data['count'], 2)
        self.client.force_authenticate(self.boss)
        self.assertEqual(self.client.get(reverse('archived-groups-list')).data['count'], 2)

    def test_ambiguous_legacy_branch_name_is_super_admin_only(self):
        Branch.objects.create(name=self.a.name)
        ArchivedStudent.objects.create(original_id=1000, full_name='Legacy', branch_name=self.a.name, metadata={})
        response = self.client.get(reverse('archived-students-list'))
        self.assertEqual(response.data['count'], 1)
