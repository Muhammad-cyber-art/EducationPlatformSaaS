import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from archivebase.services import move_student_to_archive, restore_student_from_archive
from branches.models import Branch
from groups.models import Group, GroupEnrollment, Student
from groups.services import transfer_student_to_group
from homework_attends.models import Attendance
from homework_attends.services import attendance_members, bulk_confirm_attendance


class DatedRosterTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.past = self.today - timedelta(days=3)
        self.joined = timezone.now() - timedelta(days=60)
        self.branch = Branch.objects.create(name='Dated branch')
        self.user = get_user_model().objects.create_user(username='dated-owner', role='super_admin')
        self.group = Group.objects.create(name='Original', branch=self.branch, monthly_price=300000,
                                          custom_days=list(range(7)))
        self.student = Student.objects.create(full_name='Original member', group=self.group)
        Student.objects.filter(pk=self.student.pk).update(joined_at=self.joined)
        self.student.enrollments.update(joined_at=self.joined)
        self.student.refresh_from_db()
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def roster(self, group=None, day=None):
        response = self.client.get(reverse('attendance-roster'), {
            'group_id': (group or self.group).pk, 'date': str(day or self.past),
        })
        self.assertEqual(response.status_code, 200, response.data)
        return {row['id']: row for row in response.data['students']}

    def test_past_roster_shows_later_join_read_only_and_keeps_past_members_editable(self):
        recent = Student.objects.create(full_name='Joined later', group=self.group)
        self.student.enrollments.update(is_active=False, left_at=timezone.now())
        result = self.roster()
        self.assertTrue(result[self.student.pk]['can_mark'])
        self.assertFalse(result[self.student.pk]['is_current_member'])
        self.assertFalse(result[recent.pk]['can_mark'])
        self.assertTrue(result[recent.pk]['is_current_member'])
        self.assertIn('qo‘shilgan', result[recent.pk]['attendance_unavailable_reason'])

    def test_stale_draft_after_departure_is_read_only(self):
        self.student.enrollments.update(is_active=False, left_at=timezone.now()-timedelta(days=2))
        Attendance.objects.create(student=self.student, group=self.group, date=self.today)
        self.assertFalse(self.roster(day=self.today)[self.student.pk]['can_mark'])

    def test_current_freeze_does_not_block_valid_earlier_date(self):
        self.student.enrollments.update(is_frozen=True, frozen_at=timezone.now()-timedelta(days=1))
        row = self.roster()[self.student.pk]
        self.assertTrue(row['can_mark'])
        self.assertFalse(row['is_frozen'])
        self.assertFalse(self.roster(day=self.today)[self.student.pk]['can_mark'])

    def test_new_student_creation_is_visible_in_group_and_past_roster_without_past_attendance(self):
        response = self.client.post(reverse('student-list'), {
            'full_name': 'Newly created member', 'group': self.group.pk,
            'branch_id': self.branch.pk, 'create_payment': False,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        student_id = response.data['id']
        self.assertTrue(GroupEnrollment.objects.filter(student_id=student_id, group=self.group, is_active=True).exists())
        group_response = self.client.get(reverse('group-students', kwargs={'pk': self.group.pk}))
        self.assertEqual(group_response.status_code, 200)
        self.assertIn(student_id, [row['id'] for row in group_response.data])
        self.assertFalse(self.roster()[student_id]['can_mark'])
        self.assertTrue(self.roster()[student_id]['is_current_member'])
        self.assertTrue(self.roster(day=self.today)[student_id]['can_mark'])
        self.assertFalse(Attendance.objects.filter(student_id=student_id, date=self.past).exists())

    def test_transfer_moves_history_and_its_trusted_membership_start(self):
        target = Group.objects.create(name='Target', branch=self.branch, custom_days=list(range(7)))
        GroupEnrollment.objects.create(student=self.student, group=target, is_frozen=True,
                                       frozen_at=timezone.now(), is_active=False, left_at=timezone.now())
        Attendance.objects.create(student=self.student, group=self.group, date=self.past,
                                  marked_by=self.user, is_present=True)
        transfer_student_to_group(self.student, target.pk, self.user, 'Move', from_group_id=self.group.pk)
        enrollment = self.student.enrollments.get(group=target)
        self.assertEqual(enrollment.joined_at, self.joined)
        self.assertIsNone(enrollment.left_at)
        self.assertFalse(enrollment.is_frozen)
        self.assertTrue(self.roster(group=target)[self.student.pk]['can_mark'])
        bulk_confirm_attendance(target, self.past, [{'student_id': self.student.pk, 'is_present': False}], self.user)
        self.assertFalse(Attendance.objects.get(student=self.student, group=target, date=self.past).is_present)

    def test_modern_archive_restore_keeps_dated_membership(self):
        archived = move_student_to_archive(self.student, self.user)
        restored = restore_student_from_archive(archived.pk, self.user)
        self.assertEqual(restored.enrollments.get(group=self.group).joined_at, self.joined)
        self.assertTrue(self.roster()[restored.pk]['can_mark'])

    def test_legacy_archive_without_enrollments_uses_original_join_date(self):
        archived = move_student_to_archive(self.student, self.user)
        archived.metadata.pop('enrollments', None)
        archived.save(update_fields=['metadata'])
        restored = restore_student_from_archive(archived.pk, self.user)
        self.assertEqual(restored.enrollments.get(group=self.group).joined_at, self.joined)
        self.assertTrue(self.roster()[restored.pk]['can_mark'])

    def test_legacy_restore_preserves_freeze_instead_of_activating_current_attendance(self):
        Student.objects.filter(pk=self.student.pk).update(is_frozen=True, frozen_at=timezone.now()-timedelta(days=1))
        self.student.refresh_from_db()
        archived = move_student_to_archive(self.student, self.user)
        archived.metadata.pop('enrollments', None)
        archived.save(update_fields=['metadata'])
        restored = restore_student_from_archive(archived.pk, self.user)
        self.assertTrue(restored.enrollments.get(group=self.group).is_frozen)
        self.assertFalse(attendance_members(self.group, self.today).filter(pk=restored.pk).exists())
        self.assertTrue(self.roster()[restored.pk]['can_mark'])

    def test_legacy_primary_enrollment_without_timestamp_uses_original_student_date(self):
        archived = move_student_to_archive(self.student, self.user)
        archived.metadata['enrollments'][0].pop('joined_at', None)
        archived.save(update_fields=['metadata'])
        restored = restore_student_from_archive(archived.pk, self.user)
        self.assertEqual(restored.enrollments.get(group=self.group).joined_at, self.joined)
        self.assertTrue(self.roster()[restored.pk]['can_mark'])

    def test_roster_enforces_branch_scope(self):
        other = Branch.objects.create(name='Other branch')
        user = get_user_model().objects.create_user(username='other-dated-admin', role='admin', branch=other)
        self.client.force_authenticate(user)
        response = self.client.get(reverse('attendance-roster'), {'group_id': self.group.pk, 'date': str(self.today)})
        self.assertEqual(response.status_code, 403)

    def test_sync_reports_exact_invalid_member_without_error_detail_repr_or_partial_writes(self):
        recent = Student.objects.create(full_name='Recent member', group=self.group)
        response = self.client.post('/api/v1/sync/', {'client_id': str(uuid.uuid4()), 'mutations': [{
            'queue_id': 'dated-1', 'entity': 'attendance', 'action': 'confirm', 'data': {
                'group_id': self.group.pk, 'date': str(self.past), 'attendances': [
                    {'student_id': self.student.pk, 'is_present': True},
                    {'student_id': recent.pk, 'is_present': True},
                ],
            },
        }]}, format='json')
        self.assertEqual(response.status_code, 200)
        failure = response.data['errors'][0]
        self.assertIn(recent.full_name, failure['detail'])
        self.assertNotIn('ErrorDetail(', failure['detail'])
        self.assertIn(str(self.past), failure['detail'])
        self.assertEqual(len(failure['invalid_students']), 1)
        self.assertEqual(response.data['applied_queue_ids'], [])
        self.assertFalse(Attendance.objects.exists())

    def test_foreign_student_name_is_not_exposed_by_validation(self):
        foreign_group = Group.objects.create(name='Foreign', branch=self.branch)
        foreign = Student.objects.create(full_name='Private unrelated name', group=foreign_group)
        response = self.client.post(reverse('attendance-confirm-attendance'), {
            'group_id': self.group.pk, 'date': str(self.today),
            'attendances': [{'student_id': foreign.pk, 'is_present': True}],
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertNotIn(foreign.full_name, str(response.data))
        self.assertNotIn('ErrorDetail(', response.content.decode())
