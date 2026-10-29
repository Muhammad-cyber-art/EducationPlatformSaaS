from django.test import TestCase
from django.contrib.auth import get_user_model
from branches.models import Branch
from groups.models import Group, Student
from finance.models import Payment, EmployeePayment, StaffProfile, FinanceTransaction
from finance.utils import aggregate_attendance_refunds, floor_amount
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


class CategoryFinanceAuditTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name="Audit Branch")
        self.super_admin = User.objects.create_user(username='audit_super', password='pw', role='super_admin')
        self.mentor = User.objects.create_user(username='audit_mentor', password='pw', role='mentor', branch=self.branch)
        self.payment_month = timezone.now().date().replace(day=1)

    def test_category_a_organic_full_and_partial_payout(self):
        """Kategoriya A: Oddiy talaba to'liq va qisman to'lov holati"""
        group = Group.objects.create(
            name="Organic Group",
            branch=self.branch,
            mentor=self.mentor,
            monthly_price=Decimal('400000')
        )
        profile = StaffProfile.objects.create(
            user=self.mentor,
            salary_type='student_count',
            per_student_amount=Decimal('230000')
        )
        s1 = Student.objects.create(full_name="Organic 1", group=group, status="regular")
        GroupEnrollment.objects.get_or_create(student=s1, group=group, defaults={'is_active': True})

        # 1. To'liq to'lov (400,000 UZS)
        p1 = Payment.objects.create(
            student=s1, group=group, month=self.payment_month,
            amount=Decimal('400000'), paid_amount=Decimal('400000'), is_paid=True
        )

        sal_full = profile.calculate_salary_for_month(self.payment_month)
        self.assertEqual(sal_full, Decimal('230000'))

        # 2. Qisman to'lov (100,000 UZS)
        p1.paid_amount = Decimal('100000')
        p1.is_paid = False
        p1.save()
        if hasattr(profile, '_salary_memo'):
            del profile._salary_memo

        sal_part = profile.calculate_salary_for_month(self.payment_month)
        self.assertLessEqual(sal_part, Decimal('100000'))
        self.assertGreater(sal_part, Decimal('50000'))

    def test_category_b_privileged_attendance_based(self):
        """Kategoriya B: Imtiyozli (kelajak.uz) davomatga asoslangan to'lov"""
        from finance.utils import calculate_attendance_based_mentor_share, floor_amount
        group = Group.objects.create(
            name="Privileged Group",
            branch=self.branch,
            mentor=self.mentor,
            monthly_price=Decimal('400000'),
            days='odd'
        )
        s = Student.objects.create(full_name="Privileged Student", group=group, status="discount")
        GroupEnrollment.objects.get_or_create(student=s, group=group, defaults={'is_active': True})
        Student.objects.filter(id=s.id).update(joined_at=self.payment_month)
        GroupEnrollment.objects.filter(student=s, group=group).update(joined_at=self.payment_month)

        lesson_dates = group.get_lesson_dates(self.payment_month.year, self.payment_month.month)
        total_l = len(lesson_dates)
        self.assertGreater(total_l, 0)

        for d in lesson_dates[:8]:
            Attendance.objects.create(student=s, group=group, date=d, is_present=True, marked_by=self.mentor)

        t_base = Decimal('240000')
        mentor_share = calculate_attendance_based_mentor_share(
            student=s, group=group, month_date=self.payment_month,
            per_student_amount=t_base, ignore_today_check=True
        )
        expected_raw = (t_base / Decimal(str(total_l))) * Decimal('8')
        self.assertEqual(mentor_share, floor_amount(expected_raw))

    def test_category_c_teacher_agreed_isolation(self):
        """Kategoriya C: O'qituvchi kelishgan - O'qituvchi ulushi har doim 0 UZS, markaz 100% oladi"""
        from finance.utils import get_teacher_negotiated_center_fee
        group = Group.objects.create(
            name="Teacher Agreed Group",
            branch=self.branch,
            mentor=self.mentor,
            monthly_price=Decimal('400000')
        )
        profile = StaffProfile.objects.create(
            user=self.mentor,
            salary_type='student_count',
            per_student_amount=Decimal('230000')
        )

        # Markazning operatsion ulushi: 400,000 - 230,000 = 170,000 UZS
        center_fee = get_teacher_negotiated_center_fee(group)
        self.assertEqual(center_fee, Decimal('170000'))

        s = Student.objects.create(
            full_name="Agreed Student",
            group=group,
            status="teacher_negotiated",
            custom_fee=center_fee
        )
        GroupEnrollment.objects.get_or_create(student=s, group=group, defaults={'is_active': True})

        Payment.objects.create(
            student=s,
            group=group,
            month=self.payment_month,
            amount=center_fee,
            paid_amount=center_fee,
            is_paid=True,
            marked_by=self.super_admin
        )

        # 1. O'qituvchi oyligi 0 bo'lishi shart
        salary = profile.calculate_salary_for_month(self.payment_month)
        self.assertEqual(salary, Decimal('0'))

        # 2. O'qituvchi jami daromadi 0 bo'lishi shart (status leakage yo'q!)
        income = profile.calculate_monthly_income(self.payment_month)
        self.assertEqual(income, Decimal('0'))

        # 3. Kutilayotgan o'qituvchi oyligi 0 bo'lishi shart
        exp_salary = profile.calculate_expected_monthly_income(self.payment_month)
        self.assertEqual(exp_salary, Decimal('0'))


class PrivilegedStudentsAPITests(APITestCase):
    def setUp(self):
        from finance.models import AttendanceAuditLog
        from finance.utils import floor_amount
        from homework_attends.models import Attendance

        self.branch = Branch.objects.create(name="Tashkent Center")
        self.admin = User.objects.create_user(username="admin_user", password="password123", role="admin", branch=self.branch)
        self.super_admin = User.objects.create_user(username="super_user", password="password123", role="super_admin")
        self.mentor = User.objects.create_user(username="mentor_priv", password="password123", role="mentor", branch=self.branch)

        # 60% komissiyaga ega mentor profili
        self.mentor_profile = StaffProfile.objects.create(
            user=self.mentor,
            salary_type="percentage",
            commission_percentage=Decimal("60"),
        )

        self.group = Group.objects.create(
            name="Frontend Kelajak",
            branch=self.branch,
            mentor=self.mentor,
            monthly_price=Decimal("400000"),
            custom_days=[0, 2, 4],
        )

        self.student = Student.objects.create(
            full_name="Alisher Navoiy",
            group=self.group,
            branch=self.branch,
            status="discount",  # Privileged / State-funded
        )
        self.enrollment = GroupEnrollment.objects.filter(
            student=self.student, group=self.group
        ).first()
        if not self.enrollment:
            self.enrollment = GroupEnrollment.objects.create(
                student=self.student,
                group=self.group,
                is_active=True,
                joined_at=timezone.now().date().replace(day=1),
            )
        else:
            self.enrollment.joined_at = timezone.now().date().replace(day=1)
            self.enrollment.is_active = True
            self.enrollment.save(update_fields=["joined_at", "is_active"])

        self.payment_month = timezone.now().date().replace(day=1)
        self.lesson_dates = self.group.get_lesson_dates(self.payment_month.year, self.payment_month.month)
        self.n_total = len(self.lesson_dates)

        # Dastlab 5 ta darsga qatnashgan qilib belgilaymiz
        for d in self.lesson_dates[:5]:
            Attendance.objects.create(
                student=self.student,
                group=self.group,
                date=d,
                is_present=True,
                marked_by=self.super_admin,
            )

    def test_privileged_students_list_api(self):
        """GET /api/v1/finance/privileged-students/ hisoblangan maydonlarni qaytarishi kerak"""
        self.client.force_authenticate(user=self.admin)
        month_str = self.payment_month.strftime("%Y-%m")
        url = f"/api/v1/finance/privileged-students/?month={month_str}"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn("summary", data)
        self.assertIn("results", data)
        self.assertEqual(len(data["results"]), 1)

        row = data["results"][0]
        self.assertEqual(row["student_id"], self.student.id)
        self.assertEqual(row["student_name"], "Alisher Navoiy")
        self.assertEqual(row["group_name"], "Frontend Kelajak")
        self.assertEqual(row["n_total"], self.n_total)
        self.assertEqual(row["attended_count"], 5)
        self.assertEqual(row["teacher_salary_type"], "PERCENTAGE")
        self.assertTrue(row["teacher_rate_display"].startswith("60"))

        # Davlat qarzi = floor_amount((400,000 / n_total) * 5)
        raw_daily = Decimal("400000") / Decimal(str(self.n_total))
        expected_state_rec = int(floor_amount(raw_daily * Decimal("5")))
        self.assertEqual(int(row["state_receivable_amount"]), expected_state_rec)

        # O'qituvchi ulushi = floor_amount(Davlat qarzi * 60%)
        expected_teacher = int(floor_amount(Decimal(str(expected_state_rec)) * Decimal("0.6")))
        self.assertEqual(int(row["earned_teacher_share"]), expected_teacher)

    def test_privileged_student_attendance_history_api(self):
        """GET /api/v1/finance/privileged-students/{id}/attendance-history/ sessiyalar va auditni qaytarishi kerak"""
        self.client.force_authenticate(user=self.admin)
        month_str = self.payment_month.strftime("%Y-%m")
        url = f"/api/v1/finance/privileged-students/{self.student.id}/attendance-history/?month={month_str}"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["student"]["id"], self.student.id)
        self.assertEqual(len(data["sessions"]), self.n_total)
        # 5 ta qatnashgan
        present_count = sum(1 for s in data["sessions"] if s["is_present"])
        self.assertEqual(present_count, 5)

    def test_privileged_student_attendance_override_success(self):
        """PATCH /api/v1/finance/privileged-students/{id}/attendance-override/ moliyani qayta hisoblab audit yozishi kerak"""
        from finance.models import AttendanceAuditLog
        from finance.utils import floor_amount
        self.client.force_authenticate(user=self.admin)
        month_str = self.payment_month.strftime("%Y-%m")
        url = f"/api/v1/finance/privileged-students/{self.student.id}/attendance-override/"

        payload = {
            "month": month_str,
            "group_id": self.group.id,
            "new_attended_count": 8,
            "reason_for_change": "Kelajak.uz Face ID kechikkan, monitoring tasdiqladi",
        }
        response = self.client.patch(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertTrue(data["success"])
        self.assertEqual(data["current"]["attended_count"], 8)
        self.assertEqual(data["previous"]["attended_count"], 5)

        # Audit log tekshiruvi
        log = AttendanceAuditLog.objects.filter(student=self.student, month=self.payment_month).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.modified_by, self.admin)
        self.assertEqual(log.previous_attended_count, 5)
        self.assertEqual(log.new_attended_count, 8)
        self.assertEqual(log.reason_for_change, "Kelajak.uz Face ID kechikkan, monitoring tasdiqladi")

        # Payment tekshiruvi
        payment = Payment.objects.filter(student=self.student, group=self.group, month=self.payment_month).first()
        self.assertIsNotNone(payment)
        raw_daily = Decimal("400000") / Decimal(str(self.n_total))
        expected_rec = int(floor_amount(raw_daily * Decimal("8")))
        self.assertEqual(int(payment.amount), expected_rec)

    def test_privileged_student_attendance_override_validation_error(self):
        """N_attended > N_total bo'lganda 400 xatolik qaytishi kerak"""
        self.client.force_authenticate(user=self.admin)
        month_str = self.payment_month.strftime("%Y-%m")
        url = f"/api/v1/finance/privileged-students/{self.student.id}/attendance-override/"

        payload = {
            "month": month_str,
            "group_id": self.group.id,
            "new_attended_count": self.n_total + 10,  # Cheklovdan yuqori
            "reason_for_change": "Xato son",
        }
        response = self.client.patch(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_floor_amount_exact_precision_large_sums(self):
        """Katta pullarda (10,000 - 30,000 so'm) yetishmovchilik bo'lmasligi, 1 so'mgacha aniq Decimal hisoblanishi kerak"""
        from finance.utils import floor_amount, _auto_floor_precision

        # 1. _auto_floor_precision har doim 1 qaytarishi kerak
        self.assertEqual(_auto_floor_precision(Decimal("3450000")), 1)
        self.assertEqual(_auto_floor_precision(Decimal("15000000")), 1)

        # 2. 12,539,999 UZS floor_amount da 12,530,000 ga kesilmasdan, 1 so'mgacha aniq saqlanishi kerak
        amount = Decimal("12539999")
        self.assertEqual(floor_amount(amount), Decimal("12539999"))
        self.assertEqual(floor_amount(amount, precision=None), Decimal("12539999"))

        # 3. Kunlik to'lovlar ko'paytmasida 10,000 - 30,000 so'm yo'qolmasligi
        # Masalan: 400,000 / 12 = 33,333.33 UZS. 12 ta dars uchun = 400,000 UZS bo'lishi kerak (33,000 * 12 = 396,000 emas!)
        daily = Decimal("400000") / Decimal("12")
        total_12_lessons = floor_amount(daily * Decimal("12"))
        self.assertEqual(total_12_lessons, Decimal("400000"))



