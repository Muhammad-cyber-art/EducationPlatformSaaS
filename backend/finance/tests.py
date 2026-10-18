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
        self.g1 = Group.objects.create(name="G1", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('100000'), days='everyday')
        self.g2 = Group.objects.create(name="G2", branch=self.branch, mentor=self.mentor, monthly_price=Decimal('120000'), days='everyday')
        self.s1 = Student.objects.create(full_name="S1", group=self.g1)
        self.s2 = Student.objects.create(full_name="S2", group=self.g1)

        # Use get_or_create because Student.save() already creates g1 enrollment
        GroupEnrollment.objects.get_or_create(student=self.s1, group=self.g1, defaults={'is_active': True})
        GroupEnrollment.objects.create(student=self.s1, group=self.g2, is_active=True)
        GroupEnrollment.objects.get_or_create(student=self.s2, group=self.g1, defaults={'is_active': True})

        today = timezone.localdate()
        if today.weekday() == 6:
            self.today = today - timezone.timedelta(days=1)
        else:
            self.today = today

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

    def test_student_history_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('student-payment-student-history', kwargs={'student_id': self.s1.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['student']['id'], self.s1.id)
        self.assertIn('monthly_payments', response.data)
        self.assertIn('ledger_transactions', response.data)

    def test_student_wallet_balance_reflects_payment_without_waiting_kassa_verify(self):
        from finance.models import StudentFinanceProfile
        # Create student and invoice
        month = timezone.now().date().replace(day=1)
        st = Student.objects.create(full_name="WalletTest", group=self.g1, branch=self.branch)
        profile, _ = StudentFinanceProfile.objects.get_or_create(student=st)
        p = Payment.objects.create(
            student=st,
            group=self.g1,
            month=month,
            amount=Decimal('200000')
        )
        # Initially billed 200,000, so balance is -200,000
        self.assertEqual(profile.balance, Decimal('-200000'))

        # Admin accepts payment in cash (unverified in central kassa yet)
        p.apply_payment(self.admin, Decimal('200000'), method='cash')
        p.refresh_from_db()
        self.assertTrue(p.is_paid)
        self.assertFalse(p.is_verified)

        # Student's wallet balance MUST now be 0 (no debt!), even though is_verified is False
        self.assertEqual(profile.total_paid_all_time, Decimal('200000'))
        self.assertEqual(profile.balance, Decimal('0'))

    def test_payment_update_creates_ledger_adjustment_preserving_history(self):
        # Create and pay a payment
        month = timezone.now().date().replace(day=1)
        p = Payment.objects.create(
            student=self.s1,
            group=self.g1,
            month=month,
            amount=Decimal('100000')
        )
        p.apply_payment(self.admin, Decimal('100000'), method='cash')
        p.refresh_from_db()
        self.assertTrue(p.is_paid)

        # Super admin edits payment amount from 100,000 to 120,000 via API
        super_admin = User.objects.create_user(username='super_test_user', password='pw', role='super_admin')
        self.client.force_authenticate(user=super_admin)
        url = reverse('student-payment-detail', kwargs={'pk': p.pk})
        response = self.client.patch(url, {'amount': '120000'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        p.refresh_from_db()
        self.assertEqual(p.amount, Decimal('120000'))
        self.assertEqual(p.paid_amount, Decimal('120000'))

        # Check that original transaction was not mutated, and an ADJ transaction of +20,000 was created
        txs = FinanceTransaction.objects.filter(student=self.s1, category='student_fee', status='completed')
        total_tx_amount = sum(t.amount for t in txs)
        self.assertEqual(total_tx_amount, Decimal('120000'))
        self.assertTrue(any('-ADJ-' in t.related_id for t in txs))

    def test_branch_cashier_desk_isolation_and_hierarchical_data(self):
        b2 = Branch.objects.create(name="Samarkand")
        admin_b1 = self.admin
        self.client.force_authenticate(user=admin_b1)

        # Admin of Branch 1 requesting Branch 2 desk MUST be 403 Forbidden
        url = reverse('student-payment-cashier-desk')
        resp = self.client.get(f"{url}?branch_id={b2.id}")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # Admin of Branch 1 requesting their branch desk should succeed
        resp2 = self.client.get(f"{url}?branch_id={self.branch.id}")
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        data = resp2.json()
        self.assertIn('branch', data)
        self.assertIn('teachers', data)
        self.assertIn('debtors', data)
        self.assertIn('all_groups', data)
        self.assertEqual(data['branch']['branch_id'], self.branch.id)

    def test_multi_group_student_accounting_and_cashier_pay(self):
        g2 = Group.objects.create(name="English G2", branch=self.branch, monthly_price=Decimal('300000'))
        GroupEnrollment.objects.create(student=self.s1, group=g2, is_active=True)

        self.client.force_authenticate(user=self.admin)
        month_str = timezone.now().date().replace(day=1).strftime("%Y-%m-%d")

        detail_url = reverse('student-payment-cashier-student-detail')
        resp = self.client.get(f"{detail_url}?student_id={self.s1.id}&group_id={self.g1.id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        detail_data = resp.json()
        self.assertGreaterEqual(len(detail_data['all_active_groups']), 2)

        pay_url = reverse('student-payment-cashier-pay')
        pay_resp = self.client.post(pay_url, {
            'student_id': self.s1.id,
            'group_id': g2.id,
            'month': month_str,
            'amount': '300000',
            'payment_method': 'cash',
            'is_receiptless': True,
            'notes': 'Kassadan tolandi'
        })
        self.assertEqual(pay_resp.status_code, status.HTTP_200_OK)
        tx = FinanceTransaction.objects.filter(student=self.s1, group=g2, status='completed').first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.amount, Decimal('300000'))
        self.assertEqual(tx.payment_method, 'cash')
        self.assertEqual(tx.branch, self.branch)
