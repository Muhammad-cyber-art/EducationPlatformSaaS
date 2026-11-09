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
        self.assertEqual(str(group), f"Math 101 | Mentor: mentor1 | Kun: Du, Chor, Ju") # default custom_days=[0, 2, 4]

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
        # Eski guruh enrollmenti butunlay uzilgan (o'chirilgan) bo'lishi kerak
        self.assertFalse(student.enrollments.filter(group=self.group1).exists())
        # Yangi guruh enrollmenti esa faol bo'lishi kerak
        self.assertTrue(student.enrollments.filter(group=new_group, is_active=True).exists())

    def test_student_edit_group_disconnects_old_enrollment(self):
        student = Student.objects.create(full_name="S2", group=self.group1)
        new_group = Group.objects.create(name="G4", branch=self.branch1)
        
        # O'quvchi profilida guruhi yangi guruhga almashtiriladi
        student.group = new_group
        student.save()
        
        # Eski guruh enrollmenti uzilgan (o'chirilgan) bo'lishi kerak
        self.assertFalse(student.enrollments.filter(group=self.group1).exists())
        # Yangi guruh enrollmenti faol bo'lishi kerak
        self.assertTrue(student.enrollments.filter(group=new_group, is_active=True).exists())

    def test_student_clear_group_disconnects_enrollment(self):
        student = Student.objects.create(full_name="S3", group=self.group1)
        self.assertTrue(student.enrollments.filter(group=self.group1).exists())
        
        # O'quvchining guruhi bo'shatiladi (guruhdan chiqariladi)
        student.group = None
        student.save()
        
        # Eski guruh enrollmenti uzilgan bo'lishi kerak
        self.assertFalse(student.enrollments.filter(group=self.group1).exists())

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


    def test_import_file_csv_success(self):
        """CSV fayl orqali o'quvchilarni muvaffaqiyatli import qilish testi"""
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.force_authenticate(user=self.super_admin)
        url = reverse('student-import-file')

        csv_data = "Ism,Familiya,Telefon\nAlisher,Navoiy,+998 (90) 111-22-33\nBobur,Zahiriddin,998912345678\n"
        uploaded_file = SimpleUploadedFile("students.csv", csv_data.encode('utf-8'), content_type="text/csv")

        response = self.client.post(url, {'file': uploaded_file, 'branch_id': self.branch1.id}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['created_count'], 2)
        # Student.save() telefonni 9 xonali qilib saqlaydi (masalan: 901112233)
        self.assertTrue(Student.objects.filter(phone__in=["+998901112233", "901112233"]).exists())
        self.assertTrue(Student.objects.filter(phone__in=["+998912345678", "912345678"]).exists())

    def test_import_file_duplicate_and_invalid(self):
        """Dublikat va noto'g'ri telefonli qatorlar failed_students ga tushishi kerak"""
        from django.core.files.uploadedfile import SimpleUploadedFile

        # Oldindan 1 ta o'quvchi yaratamiz
        Student.objects.create(full_name="Mavjud Talaba", phone="+998901234567", branch=self.branch1)

        self.client.force_authenticate(user=self.super_admin)
        url = reverse('student-import-file')

        csv_data = "Ism,Familiya,Telefon\nEski,Talaba,+998901234567\nNoma'lum,Xato,12345\nYangi,O'quvchi,935556677\n"
        uploaded_file = SimpleUploadedFile("mixed.csv", csv_data.encode('utf-8'), content_type="text/csv")

        response = self.client.post(url, {'file': uploaded_file, 'branch_id': self.branch1.id}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['created_count'], 1)
        self.assertEqual(data['failed_count'], 2)
        self.assertEqual(len(data['failed_students']), 2)
