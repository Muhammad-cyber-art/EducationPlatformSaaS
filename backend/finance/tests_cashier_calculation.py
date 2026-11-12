from datetime import date, datetime
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from branches.models import Branch
from finance.cashier_calculation import build_cashier_calculation
from finance.models import FinanceTransaction, Payment
from groups.models import CanceledLessonDay, Group, GroupEnrollment, SpecialLessonDay, Student
from homework_attends.models import Attendance


class CashierCalculationTests(TestCase):
    def setUp(self):
        self.month = date(2026, 11, 1)
        self.today = date(2026, 11, 30)
        self.branch = Branch.objects.create(name='Arithmetic')
        self.group = Group.objects.create(name='English', branch=self.branch, monthly_price=600000,
                                          custom_days=list(range(7)))
        self.student = Student.objects.create(full_name='Arithmetic student', group=self.group)
        self.enrollment = self.student.enrollments.get(group=self.group)
        self.set_joined(1)
        self.user = get_user_model().objects.create_user(username='arithmetic-admin', role='super_admin')

    def set_joined(self, day):
        GroupEnrollment.objects.filter(pk=self.enrollment.pk).update(
            joined_at=timezone.make_aware(datetime(2026, 11, day)))
        self.enrollment.refresh_from_db()

    def explain(self, amount, paid=0, **fields):
        payment = Payment.objects.create(student=self.student, group=self.group, month=self.month,
                                         amount=amount, paid_amount=paid, **fields)
        calculation = build_cashier_calculation(self.student, self.group, self.month, payment,
                                                self.enrollment, payment.amount,
                                                payment.remaining_amount, today=self.today)
        # Every displayed operation must reconcile to the actual stored invoice.
        for previous, current in zip(calculation['steps'], calculation['steps'][1:]):
            self.assertEqual(Decimal(previous['after']), Decimal(current['before']))
        self.assertEqual(Decimal(calculation['steps'][-1]['after']), payment.remaining_amount)
        payment.refresh_from_db()
        self.assertEqual(payment.amount, Decimal(str(amount)))
        self.assertEqual(payment.paid_amount, Decimal(str(paid)))
        self.assertFalse(FinanceTransaction.objects.exists())
        return calculation

    def test_midmonth_join_and_partial_payment_show_exact_arithmetic(self):
        self.set_joined(11)
        calculation = self.explain(400000, paid=100000)
        steps = {step['code']: step for step in calculation['steps']}
        self.assertEqual(steps['joined_midmonth']['formula'],
                         'yaxlitlash(600 000 ÷ 30 × 20) = 400 000 UZS')
        self.assertEqual(steps['paid']['formula'], 'max(0, 400 000 − 100 000) = 300 000 UZS')
        self.assertEqual(calculation['remaining_amount'], '300000')
        self.assertNotIn('recorded_difference', steps)

    def test_individual_fee_is_separate_from_previous_payment(self):
        self.student.status = 'low_income'
        self.student.custom_fee = Decimal('400000')
        self.student.save()
        calculation = self.explain(400000, paid=50000)
        self.assertEqual(calculation['steps'][1]['code'], 'individual')
        self.assertEqual(Decimal(calculation['steps'][1]['difference']), Decimal('-200000'))
        self.assertEqual(Decimal(calculation['remaining_amount']), Decimal('350000'))
        self.assertFalse(calculation['warnings'])

    def test_recorded_refund_is_not_subtracted_twice(self):
        calculation = self.explain(500000, paid=100000, refund_amount=100000, refund_ignored=False)
        refund = next(step for step in calculation['steps'] if step['code'] == 'refund')
        self.assertEqual(refund['formula'], '600 000 − 100 000 = 500 000 UZS')
        self.assertEqual(Decimal(calculation['remaining_amount']), Decimal('400000'))

    def test_unknown_historical_difference_is_not_claimed_as_discount(self):
        calculation = self.explain(320000)
        steps = {step['code']: step for step in calculation['steps']}
        self.assertEqual(steps['recorded_difference']['formula'], '600 000 − 280 000 = 320 000 UZS')
        self.assertNotIn('joined_midmonth', steps)
        self.assertNotIn('attendance', steps)
        self.assertTrue(calculation['warnings'])

    def test_round_only_after_multiplication(self):
        self.group.monthly_price = Decimal('100000')
        self.group.save()
        self.set_joined(11)
        calculation = self.explain(66667)
        step = next(step for step in calculation['steps'] if step['code'] == 'joined_midmonth')
        self.assertEqual(step['formula'], 'yaxlitlash(100 000 ÷ 30 × 20) = 66 667 UZS')

    def test_canceled_and_special_days_match_proration_calendar(self):
        self.group.custom_days = [0, 2, 4]
        self.group.save()
        CanceledLessonDay.objects.create(group=self.group, date=date(2026, 11, 4))
        SpecialLessonDay.objects.create(group=self.group, date=date(2026, 11, 5))
        self.set_joined(16)
        calculation = self.explain(323077)
        self.assertEqual(calculation['context']['total_lessons'], 13)
        self.assertEqual(calculation['context']['canceled_dates'], ['2026-11-04'])
        self.assertEqual(calculation['context']['special_dates'], ['2026-11-05'])
        self.assertNotIn('2026-11-04', [row['date'] for row in calculation['lessons']])
        self.assertTrue(any(step['code'] == 'joined_midmonth' for step in calculation['steps']))

    def test_grant_explains_state_amount_and_zero_student_debt(self):
        self.student.status = 'discount'
        self.student.save()
        for day in range(1, 11):
            Attendance.objects.create(student=self.student, group=self.group,
                                      date=date(2026, 11, day), is_present=True, marked_by=self.user)
        # Attendance signals may already have issued the one monthly invoice.
        payment, _ = Payment.objects.update_or_create(student=self.student, group=self.group, month=self.month,
                                                      defaults={'amount': 200000, 'is_auto_discount': True})
        calculation = build_cashier_calculation(self.student, self.group, self.month, payment,
                                                self.enrollment, payment.amount, 0, today=self.today)
        steps = {step['code']: step for step in calculation['steps']}
        self.assertEqual(steps['attendance']['formula'], 'yaxlitlash(600 000 ÷ 30 × 10) = 200 000 UZS')
        self.assertEqual(Decimal(steps['grant']['after']), Decimal('0'))
        self.assertEqual(len([row for row in calculation['lessons'] if row['state'] == 'present']), 10)

    def test_api_preserves_zero_invoice_and_returns_each_groups_own_calculation(self):
        Payment.objects.create(student=self.student, group=self.group, month=self.month, amount=0)
        other = Group.objects.create(name='Math', branch=self.branch, monthly_price=900000)
        GroupEnrollment.objects.create(student=self.student, group=other)
        Payment.objects.create(student=self.student, group=other, month=self.month, amount=700000)
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get(reverse('student-payment-cashier-student-detail'), {
            'student_id': self.student.pk, 'group_id': self.group.pk, 'month': '2026-11',
        })
        self.assertEqual(response.status_code, 200, response.data)
        groups = {row['group_id']: row for row in response.data['all_active_groups']}
        self.assertEqual(groups[self.group.pk]['expected_amount'], 0)
        self.assertEqual(Decimal(groups[self.group.pk]['calculation']['expected_amount']), 0)
        self.assertEqual(Decimal(groups[other.pk]['calculation']['expected_amount']), 700000)
        self.assertEqual(groups[other.pk]['calculation']['group_name'], 'Math')

    def test_partial_payment_is_not_presented_as_course_discount(self):
        calculation = self.explain(600000, paid=200000)
        self.assertEqual(Decimal(calculation['reduction_amount']), 0)
        self.assertEqual(Decimal(calculation['remaining_amount']), 400000)
        self.assertNotIn('recorded_difference', [step['code'] for step in calculation['steps']])

    def test_no_invoice_is_labeled_as_an_estimate(self):
        calculation = build_cashier_calculation(self.student, self.group, self.month, None,
                                                self.enrollment, 600000, 600000, today=self.today)
        self.assertEqual(calculation['source'], 'estimate')
        self.assertFalse(Payment.objects.exists())
