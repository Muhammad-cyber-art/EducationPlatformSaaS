"""Failure injection: a failed request must not poison subsequent work."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import Mock, patch

from django.db import OperationalError, transaction
from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from branches.models import Branch
from config.middleware import RateLimitMiddleware
from groups.importer import extract_from_image_ocr
from groups.ocr import OCRBusy
from telegram_bot.utils import _send_message_sync


class FailureView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        mode = request.query_params.get('mode')
        if mode == 'database':
            raise OperationalError('private database host and password')
        if mode == 'validation':
            raise ValidationError({'field': 'invalid'})
        if mode == 'crash':
            with transaction.atomic():
                Branch.objects.create(name='Must roll back')
                raise RuntimeError('private implementation detail')
        return Response({'ok': True, 'count': Branch.objects.count()})


class RequestRecoveryTests(TestCase):
    def test_failure_rolls_back_and_next_request_succeeds(self):
        view = FailureView.as_view()
        response = view(APIRequestFactory().get('/', {'mode': 'crash'}))
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data['code'], 'internal_error')
        self.assertNotIn('private', str(response.data))
        self.assertEqual(response['X-Error-ID'], response.data['error_id'])
        self.assertFalse(Branch.objects.exists())
        healthy = view(APIRequestFactory().get('/'))
        self.assertEqual(healthy.status_code, 200)
        self.assertEqual(healthy.data, {'ok': True, 'count': 0})

    def test_database_failure_is_retryable_and_validation_stays_400(self):
        view = FailureView.as_view()
        response = view(APIRequestFactory().get('/', {'mode': 'database'}))
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response['Retry-After'], '5')
        self.assertNotIn('password', str(response.data))
        response = view(APIRequestFactory().get('/', {'mode': 'validation'}))
        self.assertEqual(response.status_code, 400)
        self.assertIn('field', response.data)


class ResourceRecoveryTests(SimpleTestCase):
    def test_parallel_images_reject_overload_and_slot_recovers(self):
        started, release = Event(), Event()

        def decode(_):
            started.set()
            if not release.wait(5):
                raise RuntimeError('Test did not release decoder')
            return []

        with patch('groups.importer._extract_from_image_ocr', side_effect=decode) as decoder:
            with ThreadPoolExecutor(max_workers=1) as pool:
                first = pool.submit(extract_from_image_ocr, b'first')
                try:
                    self.assertTrue(started.wait(5))
                    with self.assertRaises(OCRBusy):
                        extract_from_image_ocr(b'second')
                    self.assertEqual(decoder.call_count, 1)
                finally:
                    release.set()
                self.assertEqual(first.result(timeout=5), [])
            self.assertEqual(extract_from_image_ocr(b'third'), [])

    def test_image_error_releases_slot(self):
        with patch('groups.importer._extract_from_image_ocr', side_effect=[ValueError('bad file'), []]):
            with self.assertRaises(ValueError):
                extract_from_image_ocr(b'bad')
            self.assertEqual(extract_from_image_ocr(b'good'), [])

    def test_telegram_retry_after_cannot_block_worker_indefinitely(self):
        response = Mock(status_code=429, text='rate limited')
        response.json.return_value = {'parameters': {'retry_after': 86400}}
        with patch('telegram_bot.utils.requests.post', return_value=response) as post, patch('telegram_bot.utils.time.sleep') as sleep:
            self.assertIs(_send_message_sync('1', 'message', bot_token='test-token'), response)
        self.assertEqual(post.call_count, 1)
        sleep.assert_not_called()

    def test_telegram_short_wait_has_bounded_attempts(self):
        response = Mock(status_code=429, text='rate limited')
        response.json.return_value = {'parameters': {'retry_after': 3}}
        with patch('telegram_bot.utils.requests.post', return_value=response) as post, patch('telegram_bot.utils.time.sleep') as sleep:
            self.assertIs(_send_message_sync('1', 'message', bot_token='test-token'), response)
        self.assertEqual(post.call_count, 3)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [3, 3])

    def test_telegram_long_wait_is_scheduled_without_sleeping(self):
        from celery.exceptions import Retry
        from telegram_bot.tasks import send_telegram_message_task
        response = Mock(status_code=429, text='rate limited')
        response.json.return_value = {'parameters': {'retry_after': 3600}}
        with patch('telegram_bot.tasks._send_message_sync', return_value=response), patch.object(send_telegram_message_task, 'retry', side_effect=Retry()) as retry:
            with self.assertRaises(Retry):
                send_telegram_message_task.run('1', 'message', bot_token='test-token')
        self.assertEqual(retry.call_args.kwargs['countdown'], 3600)

    def test_cache_outage_does_not_crash_login(self):
        request = APIRequestFactory().post('/api/login/', {})
        with patch('django.core.cache.cache.add', side_effect=TimeoutError('cache offline')):
            self.assertIsNone(RateLimitMiddleware(lambda request: None).process_request(request))
