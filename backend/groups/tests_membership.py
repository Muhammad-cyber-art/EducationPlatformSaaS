from contextlib import nullcontext
from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from branches.models import Branch
from finance.models import FinanceTransaction, Payment
from finance.services import build_cashier_desk_dict, generate_monthly_payments, handle_custom_payment
from groups.models import Group, GroupEnrollment, Student
from groups.services import enroll_student_to_group, transfer_student_to_group, unenroll_student_from_group
from homework_attends.models import Attendance
from homework_attends.services import get_or_create_attendance_records
from homework_attends.tasks import _create_attendance_for_current_schema
from tenants.models import Tenant


class MembershipRegressionTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.tomorrow = self.today + timedelta(days=1)
        self.branch = Branch.objects.create(name='Membership branch')
        self.admin = get_user_model().objects.create_user(username='membership-admin', role='super_admin')
        self.groups = [Group.objects.create(
            name=name, branch=self.branch, monthly_price=Decimal('300000'),
            custom_days=list(range(7)),
        ) for name in ('English', 'Math', 'Physics')]
        self.student = Student.objects.create(full_name='Multi-course student', group=self.groups[0])
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def join(self, group, create_payment=True):
        return self.client.post(reverse('group-enroll-student', kwargs={'pk': group.pk}), {
            'student_id': self.student.pk, 'create_payment': create_payment,
        }, format='json')

    def test_join_api_preserves_existing_membership_attendance_and_invoice(self):
        old_enrollment = self.student.enrollments.get(group=self.groups[0])
        old_attendance = Attendance.objects.create(student=self.student, group=self.groups[0], date=self.today)
        invoice = Payment.objects.create(student=self.student, group=self.groups[0],
                                         month=self.today.replace(day=1), amount=Decimal('300000'))
        self.assertEqual(self.join(self.groups[1]).status_code, 201)
        self.assertEqual(self.join(self.groups[1]).status_code, 200)
        old_enrollment.refresh_from_db()
        old_attendance.refresh_from_db()
        invoice.refresh_from_db()
        self.student.refresh_from_db()
        self.assertTrue(old_enrollment.is_active)
        self.assertIsNone(old_enrollment.left_at)
        self.assertEqual(self.student.group_id, self.groups[0].pk)
        self.assertEqual(old_attendance.group_id, self.groups[0].pk)
        self.assertEqual(invoice.amount, Decimal('300000'))
        self.assertEqual(self.student.enrollments.filter(is_active=True).count(), 2)
        self.assertEqual(Payment.objects.filter(student=self.student, group=self.groups[1]).count(), 1)

    def test_both_courses_survive_tomorrow_generation_and_http_reads(self):
        self.assertEqual(self.join(self.groups[1], create_payment=False).status_code, 201)
        before = list(self.student.enrollments.order_by('pk').values())
        self.assertEqual(_create_attendance_for_current_schema(), 2)
        self.assertEqual(_create_attendance_for_current_schema(), 0)
        for group in self.groups[:2]:
            records = get_or_create_attendance_records(group, self.tomorrow)
            record = records.get(student=self.student)
            self.assertEqual(record.student_full_name, self.student.full_name)
            self.assertEqual(record.group_name, group.name)
        self.assertEqual(list(self.student.enrollments.order_by('pk').values()), before)

    def test_rejoin_clears_departure_date_and_retains_other_course(self):
        left_at = timezone.now() - timedelta(days=3)
        enrollment = GroupEnrollment.objects.create(student=self.student, group=self.groups[1],
                                                   is_active=False, left_at=left_at)
        self.assertEqual(self.join(self.groups[1], create_payment=False).status_code, 200)
        enrollment.refresh_from_db()
        self.assertTrue(enrollment.is_active)
        self.assertIsNone(enrollment.left_at)
        self.assertEqual(_create_attendance_for_current_schema(), 2)

    def test_legacy_primary_membership_survives_join(self):
        self.student.enrollments.all().delete()
        # Simulate a pre-M2M record without triggering synchronization signals.
        Student.objects.filter(pk=self.student.pk).update(group=self.groups[0], branch=self.branch)
        enroll_student_to_group(self.groups[1], self.student.pk, create_payment=False)
        self.assertEqual(set(self.student.enrollments.values_list('group_id', flat=True)),
                         {group.pk for group in self.groups[:2]})

    def test_partial_save_with_stale_primary_group_does_not_reactivate_membership(self):
        stale = Student.objects.get(pk=self.student.pk)
        enrollment = self.student.enrollments.get(group=self.groups[0])
        GroupEnrollment.objects.filter(pk=enrollment.pk).update(is_active=False, left_at=timezone.now())
        Student.objects.filter(pk=self.student.pk).update(group=None)
        stale.full_name = 'Updated name'
        stale.save(update_fields=['full_name'])
        enrollment.refresh_from_db()
        self.assertFalse(enrollment.is_active)
        self.assertIsNotNone(enrollment.left_at)

    def test_explicit_transfer_preserves_unrelated_course(self):
        unrelated = GroupEnrollment.objects.create(student=self.student, group=self.groups[2])
        transfer_student_to_group(self.student, self.groups[1].pk, self.admin, 'Course change',
                                  from_group_id=self.groups[0].pk)
        unrelated.refresh_from_db()
        self.assertTrue(unrelated.is_active)
        self.assertFalse(self.student.enrollments.filter(group=self.groups[0]).exists())
        self.assertTrue(self.student.enrollments.filter(group=self.groups[1], is_active=True).exists())

    def test_unenroll_one_course_keeps_student_active_elsewhere(self):
        GroupEnrollment.objects.create(student=self.student, group=self.groups[1])
        result = unenroll_student_from_group(self.groups[0], self.student.pk, self.admin)
        self.assertEqual(result, 'active_elsewhere')
        self.student.refresh_from_db()
        self.assertTrue(self.student.is_active)
        self.assertFalse(self.student.is_archived)
        self.assertTrue(self.student.enrollments.filter(group=self.groups[1], is_active=True).exists())
        self.assertEqual(_create_attendance_for_current_schema(), 1)

    def test_nightly_generation_obeys_freeze_departure_and_legacy_rules(self):
        self.student.enrollments.filter(group=self.groups[0]).update(
            is_frozen=True, frozen_at=timezone.now())
        GroupEnrollment.objects.create(student=self.student, group=self.groups[1],
                                       is_active=True, left_at=timezone.now() - timedelta(days=1))
        legacy = Student.objects.create(full_name='Legacy', branch=self.branch)
        Student.objects.filter(pk=legacy.pk).update(group=self.groups[2])
        self.assertEqual(_create_attendance_for_current_schema(), 1)
        self.assertEqual(Attendance.objects.get().student_id, legacy.pk)
        self.assertEqual(self.student.enrollments.count(), 2)

    def test_attendance_command_uses_same_membership_rules(self):
        GroupEnrollment.objects.create(student=self.student, group=self.groups[1])
        call_command('create_attendance', stdout=StringIO())
        self.assertEqual(Attendance.objects.filter(student=self.student, date=self.tomorrow).count(), 2)

    def test_nightly_generation_skips_archived_inactive_and_unscheduled_groups(self):
        GroupEnrollment.objects.create(student=self.student, group=self.groups[1])
        GroupEnrollment.objects.create(student=self.student, group=self.groups[2])
        Group.objects.filter(pk=self.groups[0].pk).update(is_archived=True)
        Group.objects.filter(pk=self.groups[1].pk).update(is_faol=False)
        Group.objects.filter(pk=self.groups[2].pk).update(
            custom_days=[(self.tomorrow.weekday() + 1) % 7])
        self.assertEqual(_create_attendance_for_current_schema(), 0)
        self.assertEqual(self.student.enrollments.count(), 3)

    def test_nightly_generation_retains_finance_save_signals(self):
        Student.objects.filter(pk=self.student.pk).update(status='discount')
        with patch('finance.signals.update_attendance_based_payments') as recalculate:
            self.assertEqual(_create_attendance_for_current_schema(), 1)
        self.assertEqual(recalculate.call_count, 1)
        self.assertEqual(recalculate.call_args.args[2], self.tomorrow)

    def test_legacy_cleanup_cannot_delete_valid_courses_or_invoices(self):
        GroupEnrollment.objects.create(student=self.student, group=self.groups[1])
        invoice = Payment.objects.create(student=self.student, group=self.groups[1],
                                         month=self.today.replace(day=1), amount=Decimal('300000'))
        with self.assertRaisesMessage(CommandError, 'Cleanup disabled'):
            call_command('cleanup_transferred_enrollments', stdout=StringIO())
        tenant = Tenant.objects.create(name='Audit', schema_name='tenant_membership_audit')
        with patch('groups.management.commands.cleanup_transferred_enrollments.tenant_schema_context',
                   return_value=nullcontext()):
            call_command('cleanup_transferred_enrollments', tenant=tenant.schema_name,
                         dry_run=True, stdout=StringIO())
        self.assertEqual(self.student.enrollments.count(), 2)
        invoice.refresh_from_db()
        self.assertEqual(invoice.amount, Decimal('300000'))

    def test_monthly_generation_bills_each_course_once_without_creating_cash(self):
        Group.objects.filter(pk=self.groups[1].pk).update(monthly_price=Decimal('500000'))
        self.assertEqual(self.join(self.groups[1], create_payment=False).status_code, 201)
        next_month = (self.today.replace(day=28) + timedelta(days=4)).replace(day=1)
        self.assertEqual(generate_monthly_payments(next_month), 2)
        self.assertEqual(generate_monthly_payments(next_month), 0)
        invoices = Payment.objects.filter(student=self.student, month=next_month)
        self.assertEqual(dict(invoices.values_list('group_id', 'amount')), {
            self.groups[0].pk: Decimal('300000'), self.groups[1].pk: Decimal('500000'),
        })
        self.assertFalse(FinanceTransaction.objects.exists())
        desk = build_cashier_desk_dict(self.branch.pk, month_date=next_month)
        self.assertEqual(desk['summary']['total_debt_amount'], 800000)
        self.assertEqual(desk['summary']['total_collected_month'], 0)
        self.assertEqual(desk['summary']['total_students'], 1)

    def test_cashier_installment_only_pays_selected_course(self):
        self.assertEqual(self.join(self.groups[1], create_payment=False).status_code, 201)
        month = self.today.replace(day=1)
        first = Payment.objects.create(student=self.student, group=self.groups[0], month=month,
                                       amount=Decimal('300000'))
        second = Payment.objects.create(student=self.student, group=self.groups[1], month=month,
                                        amount=Decimal('500000'))
        response = self.client.post(reverse('student-payment-cashier-pay'), {
            'payment_id': second.pk, 'amount': '100000', 'is_partial_payment': True,
            'payment_method': 'cash',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.paid_amount, Decimal('0'))
        self.assertEqual(first.remaining_amount, Decimal('300000'))
        self.assertEqual(second.paid_amount, Decimal('100000'))
        self.assertEqual(second.remaining_amount, Decimal('400000'))
        self.assertEqual(FinanceTransaction.objects.get().amount, Decimal('100000'))
        desk = build_cashier_desk_dict(self.branch.pk, month_date=month)
        self.assertEqual(desk['summary']['total_debt_amount'], 700000)
        self.assertEqual(desk['summary']['total_collected_month'], 100000)

    def test_cross_branch_cashier_receipt_belongs_to_paid_group_branch(self):
        other_branch = Branch.objects.create(name='Second branch')
        Group.objects.filter(pk=self.groups[1].pk).update(branch=other_branch)
        self.assertEqual(self.join(self.groups[1], create_payment=False).status_code, 201)
        payment = Payment.objects.create(student=self.student, group=self.groups[1],
                                         month=self.today.replace(day=1), amount=Decimal('300000'))
        cashier = get_user_model().objects.create_user(
            username='second-branch-cashier', role='admin', branch=other_branch)
        self.client.force_authenticate(cashier)
        response = self.client.post(reverse('student-payment-cashier-pay'), {
            'payment_id': payment.pk, 'amount': '100000', 'is_partial_payment': True,
            'payment_method': 'cash',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.student.refresh_from_db()
        self.assertEqual(self.student.branch_id, self.branch.pk)
        receipt = FinanceTransaction.objects.get()
        self.assertEqual(receipt.group_id, self.groups[1].pk)
        self.assertEqual(receipt.branch_id, other_branch.pk)
        self.assertEqual(receipt.marked_by_id, cashier.pk)
        self.assertEqual(receipt.amount, Decimal('100000'))

    def test_cross_branch_payment_adjustment_keeps_original_group_branch(self):
        other_branch = Branch.objects.create(name='Adjustment branch')
        Group.objects.filter(pk=self.groups[1].pk).update(branch=other_branch)
        self.assertEqual(self.join(self.groups[1], create_payment=False).status_code, 201)
        payment = Payment.objects.create(student=self.student, group=self.groups[1],
                                         month=self.today.replace(day=1), amount=Decimal('100000'))
        # Match the API's fresh relation after changing the group's branch.
        payment.refresh_from_db()
        payment.apply_payment(self.admin, Decimal('100000'))
        self.assertEqual(FinanceTransaction.objects.get().branch_id, other_branch.pk)
        response = self.client.patch(reverse('student-payment-detail', kwargs={'pk': payment.pk}),
                                     {'amount': '120000'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        transactions = FinanceTransaction.objects.filter(student=self.student)
        self.assertEqual(transactions.count(), 2)
        self.assertEqual(set(transactions.values_list('branch_id', flat=True)), {other_branch.pk})
        self.assertEqual(sum(transactions.values_list('amount', flat=True)), Decimal('120000'))

    def test_cross_branch_extra_payment_uses_selected_group_branch(self):
        other_branch = Branch.objects.create(name='Extra payment branch')
        Group.objects.filter(pk=self.groups[1].pk).update(branch=other_branch)
        self.assertEqual(self.join(self.groups[1], create_payment=False).status_code, 201)
        receipt, salary_updated = handle_custom_payment(self.admin, {
            'student': self.student.pk, 'group': self.groups[1].pk,
            'amount': Decimal('50000'), 'transaction_type': 'income',
        })
        self.assertFalse(salary_updated)
        self.assertEqual(receipt.branch_id, other_branch.pk)
        self.assertEqual(receipt.category, 'student_extra')
