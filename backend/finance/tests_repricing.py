from datetime import date, datetime
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from branches.models import Branch
from finance.models import FinanceTransaction, Payment
from finance.services import build_cashier_desk_dict
from groups.models import Group, GroupEnrollment, Student
from homework_attends.models import Attendance


def _billing_date(value=None, timezone=None):
    from django.utils.timezone import localtime
    return localtime(value, timezone).date() if value is not None else date(2026, 11, 30)


@patch('finance.repricing.timezone.localdate', side_effect=_billing_date)
class GroupPriceChangeTests(TestCase):
    def setUp(self):
        self.month = date(2026, 11, 1)
        self.branch = Branch.objects.create(name='Tariff branch')
        self.group = Group.objects.create(name='Tariff course', branch=self.branch, monthly_price=400000,
                                          custom_days=list(range(7)))
        self.student = Student.objects.create(full_name='Tariff student', group=self.group)
        GroupEnrollment.objects.filter(student=self.student).update(
            joined_at=timezone.make_aware(datetime(2026, 11, 1, 12)))
        self.admin = get_user_model().objects.create_user(username='tariff-admin', role='admin', branch=self.branch)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def invoice(self, **values):
        defaults = {'amount': 400000, 'month': self.month}
        defaults.update(values)
        return Payment.objects.create(student=self.student, group=self.group, **defaults)

    def change_price(self, value):
        response = self.client.patch(reverse('group-detail', kwargs={'pk': self.group.pk}),
                                     {'monthly_price': str(value)}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data['billing_update']

    def test_unpaid_invoice_and_cashier_move_from_400_to_450(self, _clock):
        payment = self.invoice()
        summary = self.change_price(450000)
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('450000'))
        self.assertEqual(payment.remaining_amount, Decimal('450000'))
        self.assertEqual(summary['updated_count'], 1)
        desk = build_cashier_desk_dict(self.branch.pk, month_date=self.month)
        self.assertEqual(desk['rosters'][self.group.pk]['students'][0]['expected_amount'], 450000)
        self.assertFalse(FinanceTransaction.objects.exists())

    def test_partial_receipt_and_approval_are_preserved_while_debt_increases(self, _clock):
        payment = self.invoice()
        payment.apply_payment(self.admin, Decimal('100000'))
        Payment.objects.filter(pk=payment.pk).update(is_verified=True, verified_by=self.admin)
        FinanceTransaction.objects.filter(student=self.student).update(is_verified=True)
        before = list(FinanceTransaction.objects.values())
        self.change_price(450000)
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('450000'))
        self.assertEqual(payment.paid_amount, Decimal('100000'))
        self.assertEqual(payment.remaining_amount, Decimal('350000'))
        self.assertTrue(payment.is_partial)
        self.assertTrue(payment.is_verified)
        self.assertEqual(list(FinanceTransaction.objects.values()), before)

    def test_fully_paid_and_historical_invoices_are_unchanged(self, _clock):
        payment = self.invoice()
        payment.apply_payment(self.admin, Decimal('400000'))
        past = self.invoice(month=date(2026, 10, 1))
        future = self.invoice(month=date(2026, 12, 1))
        before = list(FinanceTransaction.objects.values())
        summary = self.change_price(450000)
        for invoice in (payment, past, future):
            invoice.refresh_from_db()
            self.assertEqual(invoice.amount, Decimal('400000'))
        self.assertEqual(summary['paid_preserved_count'], 1)
        self.assertEqual(summary['updated_count'], 0)
        self.assertEqual(list(FinanceTransaction.objects.values()), before)

    def test_individual_contract_price_is_not_replaced(self, _clock):
        self.student.status = 'negotiated'
        self.student.custom_fee = Decimal('300000')
        self.student.save()
        payment = self.invoice(amount=300000)
        summary = self.change_price(450000)
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('300000'))
        self.assertEqual(summary['individual_preserved_count'], 1)

    def test_midmonth_proration_is_preserved(self, _clock):
        GroupEnrollment.objects.filter(student=self.student).update(
            joined_at=timezone.make_aware(datetime(2026, 11, 11, 12)))
        payment = self.invoice(amount=266667)
        self.change_price(450000)
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('300000'))

    def test_recorded_refund_scales_with_tariff_without_cash_changes(self, _clock):
        payment = self.invoice(amount=300000, refund_amount=100000, refund_ignored=False)
        self.change_price(450000)
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('337500'))
        self.assertEqual(payment.refund_amount, Decimal('112500'))
        self.assertFalse(FinanceTransaction.objects.exists())

    def test_ignored_refund_does_not_become_active(self, _clock):
        payment = self.invoice(amount=400000, refund_amount=100000, refund_ignored=True)
        self.change_price(450000)
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('450000'))
        self.assertEqual(payment.refund_amount, Decimal('100000'))
        self.assertTrue(payment.refund_ignored)

    def test_grant_invoice_uses_new_attendance_rate(self, _clock):
        self.student.status = 'discount'
        self.student.save()
        Attendance.objects.bulk_create([
            Attendance(student=self.student, group=self.group, date=date(2026, 11, day),
                       is_present=True, marked_by=self.admin) for day in (1, 2, 3)
        ])
        payment = self.invoice(amount=40000, is_auto_discount=True)
        self.change_price(450000)
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('45000'))

    def test_unmatched_manual_amount_is_reported_instead_of_guessed(self, _clock):
        payment = self.invoice(amount=123456, notes='Verified special arrangement')
        summary = self.change_price(450000)
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('123456'))
        self.assertEqual(summary['unmatched_count'], 1)
        self.assertEqual(summary['unmatched_students'][0]['student_id'], self.student.pk)

    def test_inactive_frozen_and_other_course_memberships_are_untouched(self, _clock):
        payment = self.invoice()
        GroupEnrollment.objects.filter(student=self.student).update(is_frozen=True)
        other = Group.objects.create(name='Other', branch=self.branch, monthly_price=400000)
        other_payment = Payment.objects.create(student=self.student, group=other, month=self.month, amount=400000)
        self.change_price(450000)
        payment.refresh_from_db()
        other_payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('400000'))
        self.assertEqual(other_payment.amount, Decimal('400000'))

    def test_model_save_also_reprices_but_partial_save_cannot_apply_unsaved_tariff(self, _clock):
        payment = self.invoice()
        self.group.monthly_price = Decimal('450000')
        self.group.name = 'Renamed'
        self.group.save(update_fields=['name'])
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('400000'))
        self.group.save(update_fields=['monthly_price'])
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('450000'))

    def test_price_and_invoices_roll_back_together_on_failure(self, _clock):
        payment = self.invoice()
        other = Student.objects.create(full_name='Second student', group=self.group)
        second = Payment.objects.create(student=other, group=self.group, month=self.month, amount=400000)
        save = Payment.save

        def fail_second(instance, *args, **kwargs):
            if instance.pk == second.pk:
                raise RuntimeError('reprice failed')
            return save(instance, *args, **kwargs)

        with patch.object(Payment, 'save', new=fail_second):
            with self.assertRaises(RuntimeError):
                self.group.monthly_price = Decimal('450000')
                self.group.save()
        self.group.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(self.group.monthly_price, Decimal('400000'))
        self.assertEqual(payment.amount, Decimal('400000'))
        second.refresh_from_db()
        self.assertEqual(second.amount, Decimal('400000'))
        self.assertIsNone(payment.notes)

    def test_same_price_retry_does_not_change_receipts_or_double_apply(self, _clock):
        payment = self.invoice()
        self.change_price(450000)
        payment.refresh_from_db()
        notes = payment.notes
        self.assertIsNone(self.change_price(450000))
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('450000'))
        self.assertEqual(payment.notes, notes)

    def test_price_decrease_can_settle_partial_invoice_without_refunding_cash(self, _clock):
        payment = self.invoice()
        payment.apply_payment(self.admin, Decimal('100000'))
        before = list(FinanceTransaction.objects.values())
        self.change_price(90000)
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal('90000'))
        self.assertEqual(payment.paid_amount, Decimal('100000'))
        self.assertTrue(payment.is_paid)
        self.assertFalse(payment.is_partial)
        self.assertEqual(payment.remaining_amount, 0)
        self.assertEqual(list(FinanceTransaction.objects.values()), before)
