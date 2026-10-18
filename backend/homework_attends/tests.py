from django.test import TestCase
from django.contrib.auth import get_user_model
from branches.models import Branch
from groups.models import Group, Student
from homework_attends.models import Homework, HomeworkSubmission, Attendance, MockTest
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.utils import timezone
from unittest.mock import patch

User = get_user_model()

class HomeworkAttendsTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Tashkent")
        self.super_admin = User.objects.create_user(username='super', password='pw', role='super_admin')
        self.mentor = User.objects.create_user(username='mentor1', password='pw', role='mentor', branch=self.branch)
        self.group = Group.objects.create(name="G1", branch=self.branch, mentor=self.mentor, custom_days=[0, 1, 2, 3, 4, 5, 6])
        self.student1 = Student.objects.create(full_name="S1", group=self.group)
        self.student2 = Student.objects.create(full_name="S2", group=self.group)

    def test_homework_creation_triggers_submission_creation(self):
        self.client.force_authenticate(user=self.mentor)
        url = reverse('homework-list')
        data = {
            'title': 'New Homework',
            'group': self.group.id,
            'description': 'Solve ex 1'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify 2 submissions were created
        self.assertEqual(HomeworkSubmission.objects.filter(homework__title='New Homework').count(), 2)

    def test_attendance_auto_generation_on_get(self):
        self.client.force_authenticate(user=self.mentor)
        # We have 0 attendance records initially
        self.assertEqual(Attendance.objects.count(), 0)
        
        url = reverse('attendance-list')
        response = self.client.get(url, {'group_id': self.group.id})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should have created 2 records for student1 and student2
        self.assertEqual(Attendance.objects.count(), 2)
        self.assertEqual(len(response.data), 2)

    @patch('telegram_bot.tasks.send_attendance_notifications_task.delay')
    def test_confirm_attendance(self, mock_notify_task):
        self.client.force_authenticate(user=self.mentor)
        url = reverse('attendance-confirm-attendance')
        today = str(timezone.localdate())
        
        data = {
            'group_id': self.group.id,
            'date': today,
            'attendances': [
                {'student_id': self.student1.id, 'is_present': True},
                {'student_id': self.student2.id, 'is_present': False}
            ]
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Attendance.objects.get(student=self.student1, date=today).is_present)
        self.assertFalse(Attendance.objects.get(student=self.student2, date=today).is_present)
        
        # Verify notifications task was queued
        self.assertEqual(mock_notify_task.call_count, 1)

    def test_mock_test_bulk_results(self):
        self.client.force_authenticate(user=self.mentor)
        url = reverse('mock-test-list')
        data = {
            'subject': 'Math',
            'type': 'Monthly',
            'group': self.group.id
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify 2 result records created
        mock_test = MockTest.objects.get(subject='Math')
        self.assertEqual(mock_test.results.count(), 2)

    def test_student_monthly_attendance_endpoint(self):
        self.client.force_authenticate(user=self.super_admin)
        url = reverse('attendance-student-monthly')
        today = timezone.localdate()
        response = self.client.get(url, {
            'student_id': self.student1.id,
            'year': today.year,
            'month': today.month
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['student_id'], self.student1.id)
        self.assertIn('stats', response.data)
        self.assertIn('days', response.data)
        self.assertIn('attendance_rate', response.data['stats'])

    def test_student_monthly_multi_group_and_deleted_group_access(self):
        from groups.models import GroupEnrollment
        branch2 = Branch.objects.create(name="Samarkand")
        admin2 = User.objects.create_user(username='admin2', password='pw', role='admin', branch=branch2)
        mentor2 = User.objects.create_user(username='mentor2', password='pw', role='mentor', branch=branch2)
        group2 = Group.objects.create(name="G2", branch=branch2, mentor=mentor2, custom_days=[0, 1, 2, 3, 4, 5, 6])

        # student1 is in self.group (Branch 1) and group2 (Branch 2)
        GroupEnrollment.objects.create(student=self.student1, group=group2, is_active=True)

        # Delete Group 1 (which was student1's original group)
        self.group.delete()

        # student1's group and branch should have auto-synced to group2
        self.student1.refresh_from_db()
        self.assertEqual(self.student1.group_id, group2.id)
        self.assertEqual(self.student1.branch_id, branch2.id)

        # Admin of Branch 2 must be able to view student1's attendance without 403
        self.client.force_authenticate(user=admin2)
        url = reverse('attendance-student-monthly')
        today = timezone.localdate()
        response = self.client.get(url, {
            'student_id': self.student1.id,
            'year': today.year,
            'month': today.month
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Mentor of Group 2 must be able to view student1's attendance without 403
        self.client.force_authenticate(user=mentor2)
        response = self.client.get(url, {
            'student_id': self.student1.id,
            'year': today.year,
            'month': today.month
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Former mentor of deleted group cannot view it
        self.client.force_authenticate(user=self.mentor)
        response = self.client.get(url, {
            'student_id': self.student1.id,
            'year': today.year,
            'month': today.month
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

