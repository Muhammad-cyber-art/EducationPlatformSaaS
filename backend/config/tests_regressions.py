"""Security, accounting and query-budget regressions for the backend audit."""
import uuid
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, TransactionTestCase
from unittest import skipUnless
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from authenticatsiya.models import BranchAccess
from authenticatsiya.serializers import BranchAccessSerializer
from authenticatsiya.views import RegisterViewSet, BranchAccessViewSet
from branches.models import Branch
from finance.models import Payment, FinanceTransaction, AdminExpense
from finance.services import confirm_student_payment
from finance.views import offline_finance_bundle, generate_single_student_payment
from groups.models import Group, GroupEnrollment, Student
from groups.serializers import StudentNestedSerializer, StudentSerializer
from homework_attends.models import Attendance, Homework, HomeworkSubmission
from homework_attends.views.attendance import AttendanceViewSet
from reports.queries import monthly_branch_totals
from reports.services import generate_daily_full_report
from reports.services_new.monthly import MonthlyAttendanceReport, MonthlyFinanceReport
from reports.views import DailyReportExportView, MonthlyFinanceExportView
from sync_engine.models import SyncOperation
from sync_engine.views import SyncEngineAPIView

User = get_user_model()


class BackendRegressionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.b1 = Branch.objects.create(name='Allowed')
        cls.b2 = Branch.objects.create(name='Forbidden')
        cls.owner = User.objects.create_user(username='owner', password='test-password', role='super_admin')
        cls.admin = User.objects.create_user(username='admin', password='test-password', role='admin', branch=cls.b1)
        cls.mentor = User.objects.create_user(username='mentor', password='test-password', role='mentor', branch=cls.b1)
        cls.g1 = Group.objects.create(name='G1', branch=cls.b1, mentor=cls.mentor, monthly_price=500000, custom_days=list(range(7)))
        cls.g2 = Group.objects.create(name='G2', branch=cls.b2, monthly_price=500000, custom_days=list(range(7)))
        cls.student = Student.objects.create(full_name='Allowed student', group=cls.g1, branch=cls.b1)
        cls.foreign = Student.objects.create(full_name='Forbidden student', group=cls.g2, branch=cls.b2)
        GroupEnrollment.objects.get_or_create(student=cls.student, group=cls.g1)
        cls.month = timezone.localdate().replace(day=1)

    def request(self, view, method, path, data=None, user=None, **kwargs):
        request = getattr(APIRequestFactory(), method)(path, data, format='json')
        if user:
            force_authenticate(request, user=user)
        return view(request, **kwargs)

    def test_sync_pull_returns_success_with_delta_parameters(self):
        response = self.request(
            SyncEngineAPIView.as_view(), 'get', '/api/v1/sync/',
            {'batch_size': 500, 'last_pulled_at': timezone.now().isoformat()},
            user=self.admin,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['items'], [])
        self.assertFalse(response.data['has_more'])
        self.assertIsNone(response.data['next_cursor'])
        self.assertEqual(response.data['total_count'], 0)
        self.assertIn('server_time', response.data)

    def test_offline_bundle_authenticates_jwt_and_reads_branch_query(self):
        token = RefreshToken.for_user(self.admin).access_token
        request = APIRequestFactory().get(
            '/api/finance/offline-bundle/', {'branch_id': self.b1.pk},
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        response = offline_finance_bundle(request)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(set(response.data['cashier_desks']), {str(self.b1.pk)})
        self.assertEqual([b['id'] for b in response.data['branches']], [self.b1.pk])

    def test_finance_function_endpoints_require_authentication_and_correct_method(self):
        for view, method in [(offline_finance_bundle, 'get'), (generate_single_student_payment, 'post')]:
            with self.subTest(view=view.__name__):
                response = self.request(view, method, '/')
                self.assertEqual(response.status_code, 401)
        self.assertEqual(self.request(offline_finance_bundle, 'post', '/', user=self.admin).status_code, 405)
        self.assertEqual(self.request(generate_single_student_payment, 'get', '/', user=self.admin).status_code, 405)

    def test_offline_bundle_denies_foreign_branch_and_mentor(self):
        response = self.request(offline_finance_bundle, 'get', '/', {'branch_id': self.b2.pk}, self.admin)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.request(offline_finance_bundle, 'get', '/', user=self.mentor).status_code, 403)

    def test_offline_bundle_handles_invalid_branch_ids(self):
        for value in ['bad', '0', '-1', str(10 ** 30), '']:
            with self.subTest(value=value):
                response = self.request(offline_finance_bundle, 'get', '/', {'branch_id': value}, self.admin)
                self.assertEqual(response.status_code, 400)
        response = self.request(offline_finance_bundle, 'get', '/', {'branch_id': 987654321}, self.owner)
        self.assertEqual(response.status_code, 404)

    def test_offline_bundle_admin_without_branches_receives_empty_data(self):
        self.admin.branch = None
        self.admin.save(update_fields=['branch'])
        response = self.request(offline_finance_bundle, 'get', '/', user=self.admin)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['branches'], [])
        self.assertEqual(response.data['student_payments'], [])
        self.assertEqual(response.data['cashier_desks'], {})

    def test_generate_student_payment_uses_drf_request_and_preserves_access_errors(self):
        response = self.request(generate_single_student_payment, 'post', '/', user=self.admin)
        self.assertEqual(response.status_code, 400)
        response = self.request(generate_single_student_payment, 'post', '/',
                                {'student_id': self.foreign.pk}, self.admin)
        self.assertEqual(response.status_code, 403)
        response = self.request(generate_single_student_payment, 'post', '/',
                                {'student_id': 987654321}, self.admin)
        self.assertEqual(response.status_code, 404)
        response = self.request(generate_single_student_payment, 'post', '/',
                                {'student_id': self.student.pk}, self.admin)
        self.assertEqual(response.status_code, 200, response.data)

    def push(self, items, user=None, client_id=None):
        return self.request(SyncEngineAPIView.as_view(), 'post', '/api/v1/sync/', {
            'client_id': str(client_id or uuid.UUID(int=1)), 'mutations': items,
        }, user=user or self.admin)

    def item(self, entity='admin_expense', action='create', data=None, queue_id='1'):
        return {'queue_id': queue_id, 'entity': entity, 'action': action, 'data': data or {
            'title': 'Paper', 'amount': '2000', 'branch': self.b1.pk,
        }}

    def payment(self, student=None, group=None, **kwargs):
        return Payment.objects.create(student=student or self.student, group=group or self.g1,
                                      month=self.month, amount=500000, **kwargs)

    def test_mentor_cannot_promote_self(self):
        response = self.request(RegisterViewSet.as_view({'patch': 'partial_update'}), 'patch', '/',
                                {'role': 'super_admin'}, self.mentor, pk=self.mentor.pk)
        self.assertEqual(response.status_code, 400)
        self.mentor.refresh_from_db()
        self.assertEqual(self.mentor.role, 'mentor')

    def test_admin_cannot_promote_mentor(self):
        response = self.request(RegisterViewSet.as_view({'patch': 'partial_update'}), 'patch', '/',
                                {'role': 'super_admin'}, self.admin, pk=self.mentor.pk)
        self.assertEqual(response.status_code, 400)

    def test_owner_can_change_role(self):
        response = self.request(RegisterViewSet.as_view({'patch': 'partial_update'}), 'patch', '/',
                                {'role': 'admin'}, self.owner, pk=self.mentor.pk)
        self.assertEqual(response.status_code, 200)

    def test_branch_access_partial_update(self):
        access = BranchAccess.objects.create(user=self.mentor, branch=self.b1, access_level='view', granted_by=self.admin)
        response = self.request(BranchAccessViewSet.as_view({'patch': 'partial_update'}), 'patch', '/',
                                {'access_level': 'edit'}, self.admin, pk=access.pk)
        self.assertEqual(response.status_code, 200, response.data)

    def test_branch_access_partial_update_rejects_foreign_branch(self):
        access = BranchAccess.objects.create(user=self.mentor, branch=self.b1, access_level='view', granted_by=self.admin)
        response = self.request(BranchAccessViewSet.as_view({'patch': 'partial_update'}), 'patch', '/',
                                {'branch_id': self.b2.pk}, self.admin, pk=access.pk)
        self.assertEqual(response.status_code, 403)
        access.refresh_from_db()
        self.assertEqual(access.branch_id, self.b1.pk)

    def test_expense_is_saved_and_attributed(self):
        response = self.push([self.item()])
        self.assertEqual(response.data['applied_queue_ids'], ['1'], response.data)
        self.assertEqual(AdminExpense.objects.get().marked_by_id, self.admin.pk)

    def test_duplicate_expense_is_not_reapplied(self):
        self.push([self.item()])
        response = self.push([self.item()])
        self.assertEqual(response.data['applied_queue_ids'], ['1'])
        self.assertEqual(AdminExpense.objects.count(), 1)
        self.assertEqual(SyncOperation.objects.count(), 1)

    def test_same_queue_id_on_distinct_clients(self):
        self.push([self.item()], client_id=uuid.UUID(int=1))
        self.push([self.item()], client_id=uuid.UUID(int=2))
        self.assertEqual(AdminExpense.objects.count(), 2)

    def test_changed_replay_payload_is_rejected(self):
        self.push([self.item()])
        changed = self.item()
        changed['data']['amount'] = '999'
        response = self.push([changed])
        self.assertEqual(response.data['applied_queue_ids'], [])
        self.assertEqual(AdminExpense.objects.count(), 1)

    def test_replay_after_changing_logged_in_user_is_rejected(self):
        self.push([self.item()], user=self.admin)
        response = self.push([self.item()], user=self.owner)
        self.assertEqual(response.data['applied_queue_ids'], [])
        self.assertEqual(AdminExpense.objects.count(), 1)

    def test_mentor_cannot_sync_expenses(self):
        response = self.push([self.item()], user=self.mentor)
        self.assertEqual(response.data['applied_queue_ids'], [])
        self.assertFalse(AdminExpense.objects.exists())
        self.assertFalse(SyncOperation.objects.exists())

    def test_admin_cannot_sync_foreign_branch(self):
        item = self.item()
        item['data']['branch'] = self.b2.pk
        response = self.push([item])
        self.assertEqual(response.data['applied_queue_ids'], [])
        self.assertFalse(AdminExpense.objects.exists())

    def test_failure_is_not_acknowledged_and_other_items_commit(self):
        with patch('sync_engine.services._execute', side_effect=[RuntimeError('failure'), {}]):
            response = self.push([self.item(queue_id='1'), self.item(queue_id='2')])
        self.assertEqual(response.data['applied_queue_ids'], ['2'])
        self.assertTrue(response.data['errors'][0]['retryable'])
        self.assertEqual(list(SyncOperation.objects.values_list('queue_id', flat=True)), ['2'])

    def test_sync_batch_limit(self):
        response = self.push([self.item(queue_id=str(i)) for i in range(101)])
        self.assertEqual(response.status_code, 400)
        self.assertFalse(SyncOperation.objects.exists())

    def test_invalid_amount_and_unknown_entity_are_not_acknowledged(self):
        item = self.item()
        item['data']['amount'] = '-10'
        response = self.push([item, self.item(entity='unknown', queue_id='2')])
        self.assertEqual(response.data['applied_queue_ids'], [])
        self.assertEqual(len(response.data['errors']), 2)

    def test_negotiated_payment_confirmation(self):
        self.student.status = 'negotiated'
        self.student.custom_fee = 500000
        self.student.save()
        payment = self.payment()
        result = confirm_student_payment(self.admin, payment, {'amount': '200000', 'is_partial_payment': True})
        self.assertEqual(result.paid_amount, Decimal('200000'))
        self.assertEqual(FinanceTransaction.objects.get(student=self.student).amount, Decimal('200000'))

    def test_payment_failure_rolls_back_preliminary_changes(self):
        payment = self.payment()
        with patch.object(Payment, 'apply_payment', side_effect=ValueError('rejected')):
            with self.assertRaises(ValueError):
                confirm_student_payment(self.admin, payment, {'amount': '500000', 'pay_full_month': True})
        payment.refresh_from_db()
        self.assertEqual(payment.paid_amount, 0)
        self.assertFalse(payment.refund_ignored)
        self.assertFalse(FinanceTransaction.objects.exists())

    def test_partial_payment_retry_does_not_charge_twice(self):
        payment = self.payment()
        item = self.item('cashier_payment', 'pay', {
            'payment_id': payment.pk, 'amount': '100000', 'is_partial_payment': True,
        })
        self.assertEqual(self.push([item]).data['applied_queue_ids'], ['1'])
        self.assertEqual(self.push([item]).data['applied_queue_ids'], ['1'])
        payment.refresh_from_db()
        self.assertEqual(payment.paid_amount, 100000)
        self.assertEqual(FinanceTransaction.objects.count(), 1)

    def test_mentor_and_foreign_admin_cannot_sync_payments(self):
        payment = self.payment(student=self.foreign, group=self.g2)
        item = self.item('cashier_payment', 'pay', {'payment_id': payment.pk, 'amount': '100000'})
        for user in (self.admin, self.mentor):
            self.assertEqual(self.push([item], user=user).data['applied_queue_ids'], [])
        payment.refresh_from_db()
        self.assertEqual(payment.paid_amount, 0)

    def test_anonymous_attendance_is_rejected(self):
        response = self.request(AttendanceViewSet.as_view({'get': 'list'}), 'get', '/', {'group_id': self.g1.pk})
        self.assertEqual(response.status_code, 401)

    def test_foreign_attendance_sync_is_rejected(self):
        response = self.push([self.item('attendance', 'confirm', {
            'group_id': self.g2.pk, 'date': str(timezone.localdate()),
            'attendances': [{'student_id': self.foreign.pk, 'is_present': True}],
        })], user=self.mentor)
        self.assertEqual(response.data['applied_queue_ids'], [])
        self.assertFalse(Attendance.objects.exists())

    def test_attendance_rejects_students_from_another_group(self):
        response = self.push([self.item('attendance', 'confirm', {
            'group_id': self.g1.pk, 'date': str(timezone.localdate()),
            'attendances': [{'student_id': self.foreign.pk, 'is_present': True}],
        })], user=self.mentor)
        self.assertEqual(response.data['applied_queue_ids'], [])
        self.assertFalse(SyncOperation.objects.exists())

    def test_submission_scope_and_status_validation(self):
        homework = Homework.objects.create(title='Foreign homework', group=self.g2)
        sub = HomeworkSubmission.objects.create(homework=homework, student=self.foreign)
        response = self.push([self.item('homework_submission', 'update', {'submission_id': sub.pk, 'status': 'full'})], user=self.mentor)
        self.assertEqual(response.data['applied_queue_ids'], [])
        sub.refresh_from_db()
        self.assertEqual(sub.status, 'not_submitted')

    def test_daily_report_scopes_and_batches_homework(self):
        today = timezone.localdate()
        Attendance.objects.bulk_create([
            Attendance(student=self.student, group=self.g1, date=today, is_present=True),
            Attendance(student=self.foreign, group=self.g2, date=today, is_present=True),
        ])
        homework = Homework.objects.create(title='Homework', group=self.g1)
        HomeworkSubmission.objects.create(homework=homework, student=self.student, status='full')
        with CaptureQueriesContext(connection) as queries:
            workbook = generate_daily_full_report(today, user=self.admin)
        rows = list(workbook.active.values)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1][3], 'Allowed student')
        self.assertEqual(rows[1][5], 'Homework')
        self.assertLessEqual(len(queries), 2)

    def test_report_includes_additional_permitted_branch(self):
        BranchAccess.objects.create(user=self.admin, branch=self.b2, access_level='admin', granted_by=self.owner)
        Attendance.objects.bulk_create([Attendance(student=self.foreign, group=self.g2, date=timezone.localdate())])
        workbook = generate_daily_full_report(user=self.admin)
        self.assertEqual(len(list(workbook.active.values)), 2)

    def test_monthly_cash_and_remaining_debt(self):
        self.payment(paid_amount=200000, is_partial=True)
        for amount, verified, state in [(200000, True, 'completed'), (9000, False, 'completed'), (7000, True, 'cancelled')]:
            FinanceTransaction.objects.create(branch=self.b1, student=self.student, group=self.g1,
                transaction_type='income', category='student_fee', amount=amount,
                is_verified=verified, status=state, date=timezone.localdate(), title='Receipt')
        with self.assertNumQueries(3):
            totals = monthly_branch_totals(self.month.year, self.month.month)
        self.assertEqual(totals[self.b1.pk]['inc_fees'], 200000)
        self.assertEqual(totals[self.b1.pk]['debt'], 300000)

    def test_new_monthly_reports_generate(self):
        attendance = MonthlyAttendanceReport(self.admin, self.month.year, self.month.month).generate()
        finance = MonthlyFinanceReport(self.owner, self.month.year, self.month.month).generate()
        self.assertIsNotNone(attendance.active)
        self.assertIn('Umumiy Statistika', finance.sheetnames)

    def test_export_endpoints_return_readable_excel(self):
        from io import BytesIO
        from openpyxl import load_workbook
        for view, user in ((DailyReportExportView, self.admin), (MonthlyFinanceExportView, self.owner)):
            response = self.request(view.as_view(), 'get', '/', user=user)
            self.assertEqual(response.status_code, 200)
            try:
                content = b''.join(response.streaming_content)
                workbook = load_workbook(BytesIO(content), read_only=True)
                self.assertGreater(len(workbook.sheetnames), 0)
                workbook.close()
            finally:
                # APIRequestFactory bypasses Django's test-client signal handling.
                # Close the file without firing request_finished inside TestCase's transaction.
                response.file_to_stream.close()

    def test_invalid_month_is_a_validation_error(self):
        response = self.request(MonthlyFinanceExportView.as_view(), 'get', '/', {'month': '13'}, self.owner)
        self.assertEqual(response.status_code, 400)

    def test_student_list_query_count_does_not_grow_per_student(self):
        def serialize():
            with CaptureQueriesContext(connection) as queries:
                data = StudentNestedSerializer(Student.objects.filter(branch=self.b1).select_related('group', 'branch'),
                    many=True, context={'exclude_heavy_fields': True}).data
            return data, len(queries)
        _, one_count = serialize()
        students = [Student(full_name=f'Batch {i}', branch=self.b1, group=self.g1) for i in range(49)]
        Student.objects.bulk_create(students)
        GroupEnrollment.objects.bulk_create([GroupEnrollment(student=s, group=self.g1) for s in students])
        data, fifty_count = serialize()
        self.assertEqual(len(data), 50)
        self.assertEqual(fifty_count, one_count)

    def test_student_snapshot_matches_financial_profile(self):
        self.payment(paid_amount=200000)
        FinanceTransaction.objects.create(branch=self.b1, student=self.student, transaction_type='income',
            category='student_fee', amount=200000, date=timezone.localdate(), title='Receipt')
        data = StudentNestedSerializer(self.student, context={'exclude_heavy_fields': True}).data
        self.assertEqual(data['finance_profile']['balance'], self.student.finance_profile.balance)

    def test_rotated_refresh_token_cannot_be_reused(self):
        token = str(RefreshToken.for_user(self.admin))
        response = self.request(TokenRefreshView.as_view(), 'post', '/', {'refresh': token})
        self.assertEqual(response.status_code, 200)
        replay = self.request(TokenRefreshView.as_view(), 'post', '/', {'refresh': token})
        self.assertEqual(replay.status_code, 401)

    def test_expired_blacklist_entries_are_cleaned(self):
        from datetime import timedelta
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        from tenants.tasks import cleanup_expired_tokens
        refresh = RefreshToken.for_user(self.admin)
        token = OutstandingToken.objects.get(jti=refresh['jti'])
        token.expires_at = timezone.now() - timedelta(days=1)
        token.save(update_fields=['expires_at'])
        BlacklistedToken.objects.create(token=token)
        cleanup_expired_tokens()
        self.assertFalse(OutstandingToken.objects.filter(pk=token.pk).exists())

    def test_homework_notification_captures_schema(self):
        from tenants.context import set_current_tenant, clear_current_tenant
        from telegram_bot.utils import send_homework_notification_async
        set_current_tenant(SimpleNamespace(schema_name='tenant_one', telegram_bot_token='token', name='One'))
        try:
            with patch('telegram_bot.tasks.send_homework_notification_task.apply_async') as enqueue:
                with self.captureOnCommitCallbacks(execute=True):
                    send_homework_notification_async(123)
                self.assertEqual(enqueue.call_args.kwargs['kwargs']['schema_name'], 'tenant_one')
        finally:
            clear_current_tenant()

    def test_message_uses_queue_after_commit(self):
        from telegram_bot.utils import send_telegram_message_async
        with patch('telegram_bot.tasks.send_telegram_message_task.apply_async') as enqueue:
            with self.captureOnCommitCallbacks(execute=True):
                send_telegram_message_async('1', 'Hello', bot_token='explicit-token')
                enqueue.assert_not_called()
            enqueue.assert_called_once()


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL row locks')
class PostgresConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.branch = Branch.objects.create(name='Concurrency')
        self.user = User.objects.create_user(username='concurrent_admin', password='pw', role='admin', branch=self.branch)
        self.group = Group.objects.create(name='Concurrent group', branch=self.branch, monthly_price=500000)
        self.student = Student.objects.create(full_name='Concurrent student', group=self.group, branch=self.branch,
                                              status='negotiated', custom_fee=500000)
        self.payment = Payment.objects.create(student=self.student, group=self.group,
                                               month=timezone.localdate().replace(day=1), amount=500000)

    def run_concurrently(self, items):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections
        from sync_engine.services import apply_mutation
        barrier = Barrier(2)
        user_id = self.user.pk

        def worker(item):
            close_old_connections()
            try:
                user = User.objects.get(pk=user_id)
                barrier.wait(timeout=5)
                return apply_mutation(user, uuid.UUID(int=1), item)
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(worker, item) for item in items]
            return [future.result(timeout=15) for future in futures]

    def test_simultaneous_replay_commits_once(self):
        item = {'entity': 'admin_expense', 'action': 'create', 'queue_id': 'one',
                'data': {'title': 'Concurrent', 'amount': '1000', 'branch': self.branch.pk}}
        self.run_concurrently([item, item])
        self.assertEqual(AdminExpense.objects.count(), 1)
        self.assertEqual(SyncOperation.objects.count(), 1)

    def test_simultaneous_installments_are_not_lost(self):
        items = [{'entity': 'student_payment', 'action': 'pay', 'queue_id': str(index),
                  'data': {'payment_id': self.payment.pk, 'amount': str(amount), 'is_partial_payment': True}}
                 for index, amount in enumerate((100000, 150000))]
        self.run_concurrently(items)
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.paid_amount, 250000)
        self.assertEqual(FinanceTransaction.objects.count(), 2)

    def test_tenant_migrations_create_local_receipts_and_token_blacklist(self):
        from django.core.management import call_command
        from io import StringIO
        from tenants.utils import reset_search_path
        schema = 'tenant_audit_migrations'
        with connection.cursor() as cursor:
            cursor.execute(f'CREATE SCHEMA {schema}')
        try:
            call_command('migrate_tenant_schema', schema, verbosity=0, stdout=StringIO())
            with connection.cursor() as cursor:
                cursor.execute('SELECT to_regclass(%s), to_regclass(%s)', [
                    f'{schema}.sync_engine_syncoperation', f'{schema}.token_blacklist_outstandingtoken',
                ])
                receipt, tokens = cursor.fetchone()
            self.assertIsNotNone(receipt)
            self.assertIsNotNone(tokens)
        finally:
            reset_search_path()
            with connection.cursor() as cursor:
                cursor.execute(f'DROP SCHEMA {schema} CASCADE')
