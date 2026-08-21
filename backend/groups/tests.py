from django.test import TestCase
from django.contrib.auth import get_user_model
from branches.models import Branch
from groups.models import Group, Student, MentorGroupAssignment
from permissions.models import StaffPermission
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

User = get_user_model()

class GroupModelTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Tashkent")
        self.mentor = User.objects.create_user(username='mentor1', password='pw', role='mentor', branch=self.branch)
        self.admin = User.objects.create_user(username='admin1', password='pw', role='admin', branch=self.branch)

    def test_group_creation(self):
        group = Group.objects.create(
            name="Math 101",
            branch=self.branch,
            mentor=self.mentor,
            admin=self.admin,
            monthly_price=100000
        )
        self.assertEqual(str(group), f"Math 101 | Mentor: mentor1 | Kun: Toq kunlar") # default days='odd'

    def test_student_auto_branch(self):
        group = Group.objects.create(name="Biology", branch=self.branch, monthly_price=50000)
        student = Student.objects.create(full_name="Ivanov", group=group)
        # Branch should be auto-assigned in save() method
        self.assertEqual(student.branch.id, self.branch.id)

class GroupAPITests(APITestCase):
    def setUp(self):
        self.branch1 = Branch.objects.create(name="B1")
        self.branch2 = Branch.objects.create(name="B2")
        
        self.super_admin = User.objects.create_user(username='super', password='pw', role='super_admin')
        self.admin1 = User.objects.create_user(username='adm1', password='pw', role='admin', branch=self.branch1)
        self.mentor1 = User.objects.create_user(username='men1', password='pw', role='mentor', branch=self.branch1)
        self.mentor2 = User.objects.create_user(username='men2', password='pw', role='mentor', branch=self.branch1)
        
        self.group1 = Group.objects.create(name="G1", branch=self.branch1, mentor=self.mentor1, admin=self.admin1)

    def test_assign_additional_mentor(self):
        self.client.force_authenticate(user=self.admin1)
        url = reverse('group-assign-additional-mentor', kwargs={'pk': self.group1.pk})
        
        # Admin assigns mentor2 as additional mentor
        data = {'mentor': self.mentor2.id}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(MentorGroupAssignment.objects.filter(group=self.group1, mentor=self.mentor2).exists())

    def test_mentor_access_own_group(self):
        self.client.force_authenticate(user=self.mentor1)
        url = reverse('group-detail', kwargs={'pk': self.group1.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_mentor_cannot_access_other_group(self):
        group2 = Group.objects.create(name="G2", branch=self.branch2)
        self.client.force_authenticate(user=self.mentor1)
        url = reverse('group-detail', kwargs={'pk': group2.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND) # get_queryset filters it out

    def test_student_transfer_group(self):
        self.client.force_authenticate(user=self.admin1)
        student = Student.objects.create(full_name="S1", group=self.group1)
        new_group = Group.objects.create(name="G3", branch=self.branch1)
        
        url = reverse('student-transfer-group', kwargs={'pk': student.pk})
        data = {'new_group_id': new_group.id}
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        student.refresh_from_db()
        self.assertEqual(student.group.id, new_group.id)

    def test_superadmin_student_edit_restriction(self):
        """Testing the restriction identified in permissions.py"""
        student = Student.objects.create(full_name="S1", group=self.group1)
        self.client.force_authenticate(user=self.super_admin)
        url = reverse('student-detail', kwargs={'pk': student.pk})
        
        # GET should work
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # PATCH should succeed since super_admin has full access
        response = self.client.patch(url, {'full_name': 'New Name'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_mentor_can_delete_own_student_with_legacy_group_fk(self):
        """
        Mentor students moduliga ruxsat olgan bo'lsa,
        student faqat legacy `student.group` orqali biriktirilgan bo'lsa ham o'chira olishi kerak.
        """
        StaffPermission.objects.create(
            user=self.mentor1,
            permissions={"students": ["view", "create", "edit", "delete"]}
        )
        student = Student.objects.create(full_name="Legacy Student", group=self.group1)

        self.client.force_authenticate(user=self.mentor1)
        url = reverse('student-detail', kwargs={'pk': student.pk})
        response = self.client.delete(url, {'reason': 'Test delete'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
