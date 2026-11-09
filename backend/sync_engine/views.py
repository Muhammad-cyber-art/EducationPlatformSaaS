import base64
import json
import logging

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import ClientLead
from .serializers import (
    ClientLeadSerializer,
    SyncPushRequestSerializer,
)

logger = logging.getLogger(__name__)


class SyncEngineAPIView(APIView):
    """Bounded offline sync with per-operation commits and durable retry receipts."""
    permission_classes = [IsAuthenticated]
    BATCH_SIZE = 500  # Standart bo'lak hajmi

    def post(self, request):
        from django.http import Http404
        from django.core.exceptions import ValidationError as ModelValidationError
        from rest_framework.exceptions import APIException
        from .services import apply_mutation

        serializer = SyncPushRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        applied, conflicts, errors = [], [], []
        for item in serializer.validated_data['mutations']:
            try:
                result = apply_mutation(request.user, serializer.validated_data['client_id'], item)
                applied.append(item['queue_id'])
                if result.get('conflict'):
                    conflicts.append({'queue_id': item['queue_id'], **result['conflict']})
            except (APIException, Http404, ModelValidationError, ValueError) as exc:
                errors.append({
                    'queue_id': item['queue_id'],
                    'detail': str(exc), 'retryable': False,
                })
            except Exception:
                logger.exception('Sync mutation failed: queue_id=%s', item['queue_id'])
                errors.append({
                    'queue_id': item['queue_id'],
                    'detail': "Server xatosi. Keyinroq qayta urinib ko'ring.", 'retryable': True,
                })
        return Response({
            'success': not errors, 'server_time': timezone.now().isoformat(),
            'applied_queue_ids': applied, 'conflicts': conflicts, 'errors': errors,
        })

    def get(self, request):
        """
        PULL: Serverdan yangilanishlarni (delta) yoki dastlabki bazani bo'laklab tortib olish.
        Keyset cursor pagination (updated_at + id) yordamida brauzer qotib qolishi oldi olinadi.
        """
        last_pulled_at_str = request.query_params.get('last_pulled_at')
        cursor_str = request.query_params.get('cursor')

        # BUG FIX: batch_size noto'g'ri qiymat bo'lganda 500 ga qaytariladi
        try:
            batch_size = max(1, min(int(request.query_params.get('batch_size', self.BATCH_SIZE)), 1000))
        except (ValueError, TypeError):
            batch_size = self.BATCH_SIZE

        queryset = ClientLead.objects.all()
        if request.user.role != 'super_admin':
            queryset = queryset.filter(assigned_to=request.user)

        # 1. Delta-sync: faqat oxirgi sinxronizatsiyadan keyingi yozuvlar
        if last_pulled_at_str:
            last_pulled_at = parse_datetime(last_pulled_at_str)
            if last_pulled_at:
                if timezone.is_naive(last_pulled_at):
                    last_pulled_at = timezone.make_aware(last_pulled_at, timezone.get_current_timezone())
                queryset = queryset.filter(updated_at__gt=last_pulled_at)

        total_count = queryset.count()

        # Tartiblash: Keyset pagination uchun aniq deterministik tartib
        queryset = queryset.order_by('updated_at', 'id')

        # 2. Cursor orqali keyingi qismga o'tish (Offset o'rniga Keyset — O(1) tezlik)
        if cursor_str:
            try:
                decoded_cursor = json.loads(base64.b64decode(cursor_str.encode()).decode())
                cursor_updated_at = parse_datetime(decoded_cursor['updated_at'])
                cursor_id = decoded_cursor['id']

                if cursor_updated_at:
                    if timezone.is_naive(cursor_updated_at):
                        cursor_updated_at = timezone.make_aware(cursor_updated_at, timezone.get_current_timezone())
                    queryset = queryset.filter(
                        Q(updated_at__gt=cursor_updated_at) |
                        Q(updated_at=cursor_updated_at, id__gt=cursor_id)
                    )
                else:
                    raise ValueError("cursor_updated_at parse failed")
            except Exception as e:
                logger.warning(f"[SyncEngine] Yaroqsiz cursor: {e}")
                # BUG FIX: xato cursor bo'lganda 400 o'rniga boshidan yuboramiz
                cursor_str = None

        # batch_size + 1 ta olamiz, keyingi sahifa bor-yo'qligini bilish uchun
        records = list(queryset[:batch_size + 1])
        has_more = len(records) > batch_size

        if has_more:
            current_batch = records[:batch_size]
            last_item = current_batch[-1]
            next_cursor_payload = {
                'updated_at': last_item.updated_at.isoformat(),
                'id': str(last_item.id),
            }
            next_cursor = base64.b64encode(
                json.dumps(next_cursor_payload).encode()
            ).decode()
        else:
            current_batch = records
            next_cursor = None

        serializer = ClientLeadSerializer(current_batch, many=True)

        return Response({
            'items': serializer.data,
            'has_more': has_more,
            'next_cursor': next_cursor,
            'total_count': total_count,
            'server_time': timezone.now().isoformat(),
        }, status=status.HTTP_200_OK)
