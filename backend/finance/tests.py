from django.test import TestCase
from django.contrib.auth import get_user_model
from branches.models import Branch
from groups.models import Group, Student
from finance.models import Payment, EmployeePayment, StaffProfile, FinanceTransaction
from finance.utils import aggregate_attendance_refunds
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.utils import timezone
from decimal import Decimal
from homework_attends.models import Attendance
from groups.models import GroupEnrollment
from finance.services import _safe_attendance_stats_for_branch

User = get_user_model()

class FinanceModelTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Tashkent")
        self.super_admin = User.objects.create_user(username='super', password='pw', role='super_admin')
        self.mentor = User.objects.create_user(username='mentor1', password='pw', role='mentor', branch=self.branch)
        self.group = Group.objects.create(name="G1", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('100000'))
        self.student = Student.objects.create(full_name="S1", group=self.group)
        self.payment_month = timezone.now().date().replace(day=1)

    def test_payment_mark_as_paid_creates_transaction(self):
        payment = Payment.objects.create(
            student=self.student,
            group=self.group,
            month=self.payment_month,
            amount=self.group.monthly_price
        )
        self.assertFalse(payment.is_paid)
        
        payment.mark_as_paid(self.super_admin)
        
        self.assertTrue(payment.is_paid)
        self.assertEqual(payment.marked_by, self.super_admin)
        
        # Check FinanceTransaction (bo'lib-to'lov yozuvlari INS prefiksi bilan)
        transaction = FinanceTransaction.objects.filter(related_id__startswith=f"STP-{payment.id}").first()
        self.assertIsNotNone(transaction)
        self.assertEqual(transaction.amount, payment.amount)
        self.assertEqual(transaction.transaction_type, 'income')
        self.assertEqual(transaction.category, 'student_fee')
        self.assertEqual(payment.paid_amount, payment.amount)

    def test_partial_payment_flow(self):
        payment = Payment.objects.create(
            student=self.student,
            group=self.group,
            month=self.payment_month,
            amount=Decimal('100000'),
        )
        payment.apply_payment(self.super_admin, Decimal('40000'), is_full_amount=False)
        payment.refresh_from_db()
        self.assertFalse(payment.is_paid)
        self.assertTrue(payment.is_partial)
        self.assertEqual(payment.paid_amount, Decimal('40000'))
        self.assertEqual(payment.remaining_amount, Decimal('60000'))

        payment.apply_payment(self.super_admin, Decimal('60000'))
        payment.refresh_from_db()
        self.assertTrue(payment.is_paid)
        self.assertFalse(payment.is_partial)
        self.assertEqual(payment.paid_amount, Decimal('100000'))

    def test_mentor_commission_calculation(self):
        # Create a paid payment for the student so income is calculated
        payment = Payment.objects.create(
            student=self.student,
            group=self.group,
            month=self.payment_month,
            amount=self.group.monthly_price,
            paid_amount=self.group.monthly_price,
            is_paid=True,
            marked_by=self.super_admin
        )
        
        # Create staff profile for mentor
        profile = StaffProfile.objects.create(
            user=self.mentor,
            salary_type='percentage',
            commission_percentage=Decimal('50')
        )
        
        income = profile.calculate_monthly_income(self.payment_month)
        self.assertEqual(income, Decimal('100000'))
        
        salary = profile.calculate_salary_for_month(self.payment_month)
        self.assertEqual(salary, Decimal('50000'))

class FinanceAPITests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Tashkent")
        self.super_admin = User.objects.create_user(username='super', password='pw', role='super_admin')
        self.admin = User.objects.create_user(username='adm1', password='pw', role='admin', branch=self.branch)
        self.mentor = User.objects.create_user(username='men1', password='pw', role='mentor', branch=self.branch)
        
        # Create necessary profiles for salary tests
        StaffProfile.objects.create(user=self.mentor, salary_type='fixed', fixed_salary=Decimal('5000000'))
        
        self.group = Group.objects.create(name="G1", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('100000'))
        self.student = Student.objects.create(full_name="S1", group=self.group)
        self.month = timezone.now().date().replace(day=1)
        self.payment = Payment.objects.create(student=self.student, group=self.group, month=self.month, amount=self.group.monthly_price)

    def test_admin_confirms_payment(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('student-payment-confirm', kwargs={'pk': self.payment.pk})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db()
        self.assertTrue(self.payment.is_paid)
        self.assertEqual(self.payment.marked_by, self.admin)

    def test_admin_confirms_partial_payment(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('student-payment-confirm', kwargs={'pk': self.payment.pk})
        response = self.client.post(url, {
            'amount': '50000',
            'is_partial_payment': 'true',
            'payment_method': 'cash',
            'ignore_refund': 'true',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.payment.refresh_from_db()
        self.assertTrue(self.payment.is_partial)
        self.assertFalse(self.payment.is_paid)
        self.assertEqual(self.payment.paid_amount, Decimal('50000'))
        self.assertEqual(self.payment.remaining_amount, Decimal('50000'))

    def test_super_admin_confirms_salary(self):
        # Create salary record
        salary = EmployeePayment.objects.create(
            employee=self.mentor,
            month=self.month,
            salary_base=Decimal('5000000')
        )
        
        self.client.force_authenticate(user=self.super_admin)
        url = reverse('employee-payment-confirm', kwargs={'pk': salary.pk})
        
        # Super admin adds bonus
        response = self.client.post(url, {'bonus': 200000})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        salary.refresh_from_db()
        self.assertTrue(salary.is_paid)
        self.assertEqual(salary.bonus, Decimal('200000'))
        self.assertEqual(salary.total_amount, Decimal('5200000'))
        
        # Check FinanceTransaction for salary
        transaction = FinanceTransaction.objects.get(related_id=f"EMP-{salary.id}")
        self.assertEqual(transaction.amount, Decimal('5200000'))
        self.assertEqual(transaction.transaction_type, 'expense')

    def test_aggregate_attendance_refunds_from_payment(self):
        """Davomat refundi Payment.refund_amount da — FinanceTransaction emas."""
        Payment.objects.filter(pk=self.payment.pk).update(
            refund_amount=Decimal('25000'),
            amount=Decimal('75000'),
            is_paid=True,
            paid_amount=Decimal('75000'),
        )
        y, m = self.month.year, self.month.month
        total = aggregate_attendance_refunds(y, m, branch=self.branch)
        self.assertEqual(total, 25000.0)
        ft_refund = FinanceTransaction.objects.filter(category='refund').count()
        self.assertEqual(ft_refund, 0)

    def test_duplicate_payment_restriction(self):
        # We removed unique_together to support soft-deleted students.
        # So we just verify that we can create a second payment without IntegrityError.
        p2 = Payment.objects.create(
            student=self.student,
            group=self.group,
            month=self.month,
            amount=self.group.monthly_price
        )
        self.assertIsNotNone(p2.id)


class FinanceAttendanceStatsTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Tashkent")
        self.mentor = User.objects.create_user(username='mentor_att', password='pw', role='mentor', branch=self.branch)
        self.g1 = Group.objects.create(name="G1", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('100000'))
        self.g2 = Group.objects.create(name="G2", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('120000'))
        self.s1 = Student.objects.create(full_name="S1", group=self.g1)
        self.s2 = Student.objects.create(full_name="S2", group=self.g1)

        # Use get_or_create because Student.save() already creates g1 enrollment
        GroupEnrollment.objects.get_or_create(student=self.s1, group=self.g1, defaults={'is_active': True})
        GroupEnrollment.objects.create(student=self.s1, group=self.g2, is_active=True)
        GroupEnrollment.objects.get_or_create(student=self.s2, group=self.g1, defaults={'is_active': True})

        self.today = timezone.localdate()

    def test_attendance_today_counts_unique_students_across_groups(self):
        # S1 is present in two groups today -> should still be counted once
        Attendance.objects.create(student=self.s1, group=self.g1, date=self.today, is_present=True)
        Attendance.objects.create(student=self.s1, group=self.g2, date=self.today, is_present=True)
        # Also mark s2 as present so absent count is 0
        Attendance.objects.create(student=self.s2, group=self.g1, date=self.today, is_present=True)

        stats = _safe_attendance_stats_for_branch(self.branch, self.today)
        self.assertEqual(stats["total"], 2)
        self.assertEqual(stats["absent"], 0)

    def test_absent_excludes_students_present_in_any_group(self):
        # S1 absent in one group, present in another -> should NOT be counted as absent
        Attendance.objects.create(student=self.s1, group=self.g1, date=self.today, is_present=False)
        Attendance.objects.create(student=self.s1, group=self.g2, date=self.today, is_present=True)
        # S2 absent only -> should be absent
        Attendance.objects.create(student=self.s2, group=self.g1, date=self.today, is_present=False)

        stats = _safe_attendance_stats_for_branch(self.branch, self.today)
        self.assertEqual(stats["total"], 2)
        self.assertEqual(stats["absent"], 1)


class FinanceAbsentStudentsEndpointTests(APITestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Tashkent")
        self.admin = User.objects.create_user(username='adm_abs', password='pw', role='admin', branch=self.branch)
        self.mentor = User.objects.create_user(username='mentor_abs', password='pw', role='mentor', branch=self.branch)
        self.g1 = Group.objects.create(name="G1", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('100000'))
        self.g2 = Group.objects.create(name="G2", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('120000'))
        self.s1 = Student.objects.create(full_name="S1", group=self.g1)
        self.s2 = Student.objects.create(full_name="S2", group=self.g1)

        # Use get_or_create because Student.save() already creates g1 enrollment
        GroupEnrollment.objects.get_or_create(student=self.s1, group=self.g1, defaults={'is_active': True})
        GroupEnrollment.objects.create(student=self.s1, group=self.g2, is_active=True)
        GroupEnrollment.objects.get_or_create(student=self.s2, group=self.g1, defaults={'is_active': True})

        self.today = timezone.localdate()

        # S1: absent in g1, present in g2 -> should not appear in absent list
        Attendance.objects.create(student=self.s1, group=self.g1, date=self.today, is_present=False)
        Attendance.objects.create(student=self.s1, group=self.g2, date=self.today, is_present=True)
        # S2: absent only -> should appear
        Attendance.objects.create(student=self.s2, group=self.g1, date=self.today, is_present=False)

    def test_absent_students_endpoint_excludes_present_elsewhere(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('absent-students-list', kwargs={'branch_id': self.branch.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data.get('results', response.data)
        returned_ids = {item["id"] for item in results}
        self.assertIn(self.s2.id, returned_ids)
        self.assertNotIn(self.s1.id, returned_ids)
