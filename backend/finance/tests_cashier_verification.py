from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from branches.models import Branch
from finance.models import FinanceTransaction, Payment
from finance.services import build_cashier_desk_dict
from groups.models import Group, Student


class CashierVerificationTests(TestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name='Verification branch')
        self.group = Group.objects.create(name='English', branch=self.branch, monthly_price=300000,
                                          custom_days=list(range(7)))
        self.student = Student.objects.create(full_name='Receipt student', group=self.group)
        self.payment = Payment.objects.create(student=self.student, group=self.group,
                                             month=timezone.localdate().replace(day=1), amount=300000)
        users = get_user_model()
        self.admin = users.objects.create_user(username='cashier', role='admin', branch=self.branch)
        self.super_admin = users.objects.create_user(username='owner', role='super_admin')
        self.client = APIClient()
        self.client.force_authenticate(self.super_admin)

    def row(self):
        return build_cashier_desk_dict(self.branch.pk)['rosters'][self.group.pk]['students'][0]

    def verify(self):
        response = self.client.post(reverse('student-payment-verify', kwargs={'pk': self.payment.pk}))
        self.assertEqual(response.status_code, 200, response.data)

    def test_unpaid_student_is_not_marked_as_awaiting_approval(self):
        self.assertEqual(self.row()['verification_status'], 'unpaid')
        self.assertFalse(self.row()['is_verified'])

    def test_partial_receipt_changes_from_pending_to_verified_without_changing_debt(self):
        self.payment.apply_payment(self.admin, Decimal('100000'))
        self.assertEqual(self.row()['verification_status'], 'pending')
        self.assertEqual(self.row()['remaining_amount'], 200000)
        self.verify()
        row = self.row()
        self.assertEqual(row['verification_status'], 'verified')
        self.assertTrue(row['is_verified'])
        self.assertFalse(row['is_paid'])
        self.assertEqual(row['paid_amount'], 100000)
        self.assertEqual(row['remaining_amount'], 200000)

    def test_next_installment_needs_new_approval_and_preserves_old_receipt(self):
        self.payment.apply_payment(self.admin, Decimal('100000'))
        self.verify()
        approved = FinanceTransaction.objects.get()
        self.payment.refresh_from_db()
        self.payment.apply_payment(self.admin, Decimal('200000'))
        row = self.row()
        self.assertTrue(row['is_paid'])
        self.assertFalse(row['is_verified'])
        self.assertEqual(row['verification_status'], 'pending')
        self.payment.refresh_from_db()
        self.assertIsNone(self.payment.verified_at)
        self.assertIsNone(self.payment.verified_by_id)
        approved.refresh_from_db()
        self.assertTrue(approved.is_verified)
        self.assertEqual(FinanceTransaction.objects.filter(is_verified=False).count(), 1)
        self.verify()
        self.assertEqual(self.row()['verification_status'], 'verified')
        self.assertFalse(FinanceTransaction.objects.filter(is_verified=False).exists())

    def test_drawer_exposes_same_approval_state_as_roster(self):
        self.payment.apply_payment(self.admin, Decimal('300000'))
        for expected in ('pending', 'verified'):
            if expected == 'verified':
                self.verify()
            response = self.client.get(reverse('student-payment-cashier-student-detail'), {
                'student_id': self.student.pk, 'group_id': self.group.pk,
            })
            self.assertEqual(response.status_code, 200, response.data)
            group = response.data['all_active_groups'][0]
            self.assertEqual(group['verification_status'], expected)
            self.assertEqual(group['is_verified'], expected == 'verified')

    def test_admin_cannot_approve_receipt(self):
        self.payment.apply_payment(self.admin, Decimal('100000'))
        self.client.force_authenticate(self.admin)
        response = self.client.post(reverse('student-payment-verify', kwargs={'pk': self.payment.pk}))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.row()['verification_status'], 'pending')

    def test_legacy_stale_verified_flag_does_not_hide_pending_installment(self):
        self.payment.apply_payment(self.admin, Decimal('100000'))
        # Older deployments did not clear the invoice flag on new installments.
        Payment.objects.filter(pk=self.payment.pk).update(is_verified=True)
        self.assertEqual(self.row()['verification_status'], 'pending')
        response = self.client.get(reverse('student-payment-cashier-student-detail'), {
            'student_id': self.student.pk, 'group_id': self.group.pk,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['all_active_groups'][0]['verification_status'], 'pending')
        self.verify()
        self.assertEqual(self.row()['verification_status'], 'verified')
