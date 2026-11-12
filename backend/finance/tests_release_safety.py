from decimal import Decimal
from unittest.mock import patch
from unittest import skipUnless
from io import StringIO

from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase
from django.db import connection
from django.core.management import call_command, CommandError
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from branches.models import Branch
from finance.models import FinanceTransaction, Payment
from finance.services import confirm_student_payment
from groups.models import Group, Student


class ReleasePaymentSafetyTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name='Release audit')
        self.group = Group.objects.create(name='Course', branch=self.branch, monthly_price=400000)
        self.student = Student.objects.create(full_name='Student', group=self.group)
        self.admin = get_user_model().objects.create_user(username='release-admin', role='admin', branch=self.branch)
        self.month = timezone.localdate().replace(day=1)
        self.payment = Payment.objects.create(student=self.student, group=self.group, month=self.month, amount=200000)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_stale_instance_cannot_restore_old_tariff(self):
        Payment.objects.filter(pk=self.payment.pk).update(amount=225000)
        self.payment.apply_payment(self.admin, Decimal('100000'))
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.amount, Decimal('225000'))
        self.assertEqual(self.payment.remaining_amount, Decimal('125000'))

    @patch('groups.models.Student.calculate_refund_amount', return_value=0)
    def test_prorated_invoice_is_settled_without_reverting_to_course_price(self, _refund):
        confirm_student_payment(self.admin, self.payment, {'amount': '200000'})
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.amount, Decimal('200000'))
        self.assertTrue(self.payment.is_paid)
        self.assertEqual(FinanceTransaction.objects.get().amount, Decimal('200000'))

    def test_ignore_refund_preserves_proration(self):
        confirm_student_payment(self.admin, self.payment, {'ignore_refund': True})
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.paid_amount, Decimal('200000'))
        self.assertEqual(self.payment.amount, Decimal('200000'))

    def test_explicit_full_month_still_accepts_full_tariff(self):
        confirm_student_payment(self.admin, self.payment, {'pay_full_month': True, 'amount': '400000'})
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.amount, Decimal('400000'))
        self.assertEqual(self.payment.paid_amount, Decimal('400000'))

    @patch('groups.models.Student.calculate_refund_amount', return_value=25000)
    def test_existing_refund_is_not_subtracted_twice(self, _refund):
        Payment.objects.filter(pk=self.payment.pk).update(amount=175000, refund_amount=25000)
        confirm_student_payment(self.admin, self.payment, {'amount': '175000'})
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.amount, Decimal('175000'))
        self.assertTrue(self.payment.is_paid)

    def test_invalid_amount_never_becomes_a_full_payment(self):
        for amount in ('garbage', 'NaN', 'Infinity', '-1', '0', ''):
            with self.subTest(amount=amount), self.assertRaises(ValueError):
                confirm_student_payment(self.admin, self.payment, {'amount': amount})
        self.assertFalse(FinanceTransaction.objects.exists())
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.paid_amount, 0)

    def test_profile_cannot_generate_invoice_for_unrelated_group(self):
        unrelated = Group.objects.create(name='Unrelated', branch=self.branch, monthly_price=900000)
        response = self.client.post(reverse('generate-single-student-payment'),
                                    {'student_id': self.student.pk, 'group_id': unrelated.pk})
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Payment.objects.filter(group=unrelated).exists())

    def test_closed_invoice_is_not_reopened_by_stale_confirmation(self):
        Payment.objects.filter(pk=self.payment.pk).update(is_paid=True, paid_amount=200000)
        confirm_student_payment(self.admin, self.payment, {'amount': '400000', 'pay_full_month': True})
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.amount, Decimal('200000'))
        self.assertEqual(self.payment.paid_amount, Decimal('200000'))
        self.assertFalse(FinanceTransaction.objects.exists())

    def test_rejoining_preserves_existing_partial_invoice(self):
        from groups.models import GroupEnrollment
        from groups.services import enroll_student_to_group
        self.payment.apply_payment(self.admin, Decimal('50000'))
        GroupEnrollment.objects.filter(student=self.student, group=self.group).delete()
        enroll_student_to_group(self.group, self.student.pk)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.amount, Decimal('200000'))
        self.assertEqual(self.payment.paid_amount, Decimal('50000'))
        self.assertEqual(Payment.objects.filter(student=self.student, group=self.group).count(), 1)

    def test_rejoining_creates_missing_current_invoice(self):
        from groups.models import GroupEnrollment
        from groups.services import enroll_student_to_group
        self.payment.delete()
        GroupEnrollment.objects.filter(student=self.student, group=self.group).update(is_active=False, left_at=timezone.now())
        enroll_student_to_group(self.group, self.student.pk)
        self.assertEqual(Payment.objects.filter(student=self.student, group=self.group, month=self.month).count(), 1)

    def test_profile_cannot_generate_invoice_in_another_branch(self):
        branch = Branch.objects.create(name='Private branch')
        other = Group.objects.create(name='Private', branch=branch, monthly_price=900000)
        from groups.models import GroupEnrollment
        GroupEnrollment.objects.create(student=self.student, group=other)
        response = self.client.post(reverse('generate-single-student-payment'),
                                    {'student_id': self.student.pk, 'group_id': other.pk})
        self.assertEqual(response.status_code, 403, response.data)
        self.assertFalse(Payment.objects.filter(group=other).exists())

    def test_read_only_audit_rejects_negative_amount_without_changing_rows(self):
        Payment.objects.filter(pk=self.payment.pk).update(amount=-1)
        before = list(Payment.objects.values())
        with self.assertRaises(CommandError):
            call_command('audit_financial_integrity', stdout=StringIO())
        self.assertEqual(list(Payment.objects.values()), before)

    def test_read_only_audit_accepts_valid_invoices(self):
        output = StringIO()
        call_command('audit_financial_integrity', stdout=output)
        self.assertIn('0 issue(s)', output.getvalue())


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL concurrent writes')
class FirstInvoiceConcurrencyTests(TransactionTestCase):
    def test_simultaneous_first_installments_create_one_invoice_and_two_receipts(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections
        branch = Branch.objects.create(name='First invoice race')
        group = Group.objects.create(name='Course', branch=branch, monthly_price=400000)
        student = Student.objects.create(full_name='Concurrent student', group=group)
        user = get_user_model().objects.create_user(username='race-admin', role='admin', branch=branch)
        month = timezone.localdate().replace(day=1)
        barrier = Barrier(2)

        def worker(amount):
            close_old_connections()
            try:
                admin = get_user_model().objects.get(pk=user.pk)
                barrier.wait(timeout=10)
                invoice, _ = Payment.objects.get_or_create(
                    student_id=student.pk, group_id=group.pk, month=month, defaults={'amount': 400000},
                )
                confirm_student_payment(admin, invoice, {'amount': str(amount), 'is_partial_payment': True})
                return invoice.pk
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(worker, amount) for amount in (100000, 150000)]
            ids = [future.result(timeout=25) for future in futures]
        self.assertEqual(ids[0], ids[1])
        self.assertEqual(Payment.objects.get().paid_amount, Decimal('250000'))
        self.assertEqual(FinanceTransaction.objects.count(), 2)


class InvoiceConstraintMigrationTests(TransactionTestCase):
    def test_duplicate_legacy_invoices_block_migration_without_deleting_money(self):
        from django.db.migrations.executor import MigrationExecutor
        executor = MigrationExecutor(connection)
        previous = [('finance', '0034_attendanceauditlog')]
        latest = [('finance', '0035_unique_student_group_month_bill')]
        executor.migrate(previous)
        duplicate = None
        try:
            branch = Branch.objects.create(name='Legacy invoice audit')
            group = Group.objects.create(name='Course', branch=branch, monthly_price=400000)
            student = Student.objects.create(full_name='Legacy student', group=group)
            values = {'student': student, 'group': group, 'month': timezone.localdate().replace(day=1),
                      'amount': 400000, 'paid_amount': 100000}
            Payment.objects.create(**values)
            duplicate = Payment.objects.create(**values)
            before = list(Payment.objects.order_by('pk').values())
            output = StringIO()
            with self.assertRaises(CommandError):
                call_command('audit_financial_integrity', stdout=output)
            self.assertIn('DUPLICATE', output.getvalue())
            with self.assertRaisesRegex(RuntimeError, 'Duplicate monthly invoices'):
                MigrationExecutor(connection).migrate(latest)
            self.assertEqual(list(Payment.objects.order_by('pk').values()), before)
        finally:
            if duplicate:
                duplicate.delete()
            MigrationExecutor(connection).migrate(latest)
