from django.test import TestCase
from django.contrib.auth import get_user_model
from branches.models import Branch
from authenticatsiya.models import BranchAccess
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

User = get_user_model()

class AuthModelTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Test Branch")
        self.super_admin = User.objects.create_user(
            username='superadmin',
            password='password123',
            role='super_admin'
        )
        self.admin = User.objects.create_user(
            username='adminuser',
            password='password123',
            role='admin',
            branch=self.branch
        )
        self.mentor = User.objects.create_user(
            username='mentoruser',
            password='password123',
            role='mentor',
            branch=self.branch
        )

    def test_user_roles(self):
        """Test user role methods"""
        self.assertTrue(self.super_admin.is_super_admin())
        self.assertTrue(self.admin.is_admin())
        self.assertTrue(self.mentor.is_mentor())
        
        self.assertFalse(self.admin.is_super_admin())
        self.assertFalse(self.mentor.is_admin())

    def test_branch_access(self):
        """Test BranchAccess creation and unique constraint"""
        access = BranchAccess.objects.create(
            user=self.mentor,
            branch=self.branch,
            access_level='view',
            granted_by=self.super_admin
        )
        self.assertEqual(str(access), f"mentoruser → Test Branch (view)")
        
        # Test unique constraint
        with self.assertRaises(Exception):
            BranchAccess.objects.create(
                user=self.mentor,
                branch=self.branch,
                access_level='edit'
            )

class AuthAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Tashkent")
        self.branch2 = Branch.objects.create(name="Samarkand")
        
        self.super_admin = User.objects.create_user(
            username='superadmin', password='password123', role='super_admin'
        )
        self.admin = User.objects.create_user(
            username='admin1', password='password123', role='admin', branch=self.branch
        )
        self.mentor = User.objects.create_user(
            username='mentor1', password='password123', role='mentor', branch=self.branch
        )
        
        # Give admin access to branch2
        BranchAccess.objects.create(user=self.admin, branch=self.branch2, access_level='admin', granted_by=self.super_admin)

    def test_login(self):
        url = reverse('login')
        data = {'username': 'admin1', 'password': 'password123'}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_register_permissions(self):
        # Login as admin
        self.client.force_authenticate(user=self.admin)
        url = reverse('user-list') # router basename='user'
        
        # Admin trying to create another admin (should fail)
        data = {
            'username': 'newadmin',
            'password': 'password123',
            'role': 'admin',
            'branch_id': self.branch.id
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Admin creating mentor (should succeed)
        data['role'] = 'mentor'
        data['username'] = 'newmentor'
        # Need to provide email as it might be required in RegisterSerializer
        data['email'] = 'newmentor@example.com'
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_register_branch_isolation(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('user-list')
        
        # Branch 3 which admin doesn't have access to
        branch3 = Branch.objects.create(name="Bukhara")
        
        data = {
            'username': 'mentor3',
            'password': 'password123',
            'email': 'm3@ex.com',
            'role': 'mentor',
            'branch_id': branch3.id
        }
        # Should succeed but auto-assign to admin's primary branch because they lack access to branch3
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_user = User.objects.get(username='mentor3')
        self.assertEqual(new_user.branch.id, self.admin.branch.id)

    def test_user_list_filtering(self):
        # Super admin sees everyone
        self.client.force_authenticate(user=self.super_admin)
        url = reverse('users-list') 
        response = self.client.get(url)
        # UsersListView only returns mentors for non-superadmin, 
        # but for superadmin it returns all users.
        # We have super_admin, admin, mentor = 3 users
        self.assertEqual(len(response.data.get('results', response.data)), 3)
        
        # Admin sees mentors in their branches
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(url)
        # Should see mentor1 (in Tashkent)
        self.assertEqual(len(response.data.get('results', response.data)), 1)
        
        # If we add a mentor in Samarkand, they should see them too (since admin has access to branch2)
        User.objects.create_user(username='sam_mentor', password='pw', role='mentor', branch=self.branch2)
        response = self.client.get(url)
        self.assertEqual(len(response.data.get('results', response.data)), 2) # mentor1 and sam_mentor
