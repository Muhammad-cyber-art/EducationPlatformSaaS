import base64
import json
import logging

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import ClientLead
from .serializers import (
    ClientLeadSerializer,
    SyncPushRequestSerializer,
)

logger = logging.getLogger(__name__)


class SyncEngineAPIView(APIView):
    """
    Offline-First sinxronizatsiya markazi:
    - POST: Client outbox navbatini qabul qiladi (Push)
    - GET:  O'zgargan ma'lumotlarni paketlab (chunked) uzatadi (Pull)

    BUG FIX-lar:
    1. `from datetime import datetime` import o'chirildi — foydalanilmaydi, chalkashlik chiqaradi.
    2. batch_size int() konvertatsiyasida ValueError ushlanadi.
    3. cursor decode qilishda xato bo'lganda 400 o'rniga log yozib bo'sh natija qaytariladi.
    4. assigned_to — faqat login qilgan foydalanuvchini saqlaydi (request.user.is_authenticated
       allaqachon IsAuthenticated permission tomonidan tekshirilgan, shuning uchun shart keraksiz).
    5. 'name' maydoni uchun fallback "Noma'lum" o'rniga bo'sh string — data integrity yaxshilandi.
    """
    permission_classes = [IsAuthenticated]
    BATCH_SIZE = 500  # Standart bo'lak hajmi

    def post(self, request):
        """
        PUSH: Klientdan kelgan mutatsiyalarni atomik tranzaksiyada qabul qilish.
        Last-Write-Wins (LWW) tamoyili asosida konfliktlar hal qilinadi.
        """
        serializer = SyncPushRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        mutations = serializer.validated_data['mutations']
        applied_queue_ids = []
        conflicts = []

        # Butun paket yagona atomik tranzaksiyada bajariladi
        try:
            with transaction.atomic():
                for item in mutations:
                    queue_id = item['queue_id']
                    action = item['action']
                    entity = item['entity']
                    payload = item['data']

                    # 1. ATTENDANCE SINXRONIZATSIYASI
                    if entity == 'attendance':
                        group_id = payload.get('group_id')
                        date_str = payload.get('date')
                        attendances_payload = payload.get('attendances', [])
                        if group_id and date_str and attendances_payload:
                            try:
                                from groups.models import Group
                                from homework_attends.services import bulk_confirm_attendance
                                group = Group.objects.filter(id=group_id).first()
                                if group:
                                    req_date = (
                                        parse_datetime(str(date_str)).date()
                                        if 'T' in str(date_str)
                                        else timezone.datetime.strptime(str(date_str), '%Y-%m-%d').date()
                                    )
                                    bulk_confirm_attendance(group, req_date, attendances_payload, request.user)
                                    applied_queue_ids.append(queue_id)
                                else:
                                    logger.warning(f"[SyncEngine] Guruh topilmadi: {group_id}")
                                    applied_queue_ids.append(queue_id)
                            except Exception as att_err:
                                logger.exception(f"[SyncEngine] Davomat sinxronlashda xato: {att_err}")
                                # Serverda kutilmagan xatolik yuz bersa, outboxdan o'chirmaymiz (keyinroq retry bo'ladi)
                        else:
                            applied_queue_ids.append(queue_id)
                        continue

                    # Hozircha faqat 'leads' va 'attendance' entity qo'llab-quvvatlanadi
                    if entity != 'leads':
                        applied_queue_ids.append(queue_id)  # Noma'lum entity — ACK berib o'tamiz
                        continue

                    record_id = payload.get('id')
                    if not record_id:
                        logger.warning(f"[SyncEngine] Mutatsiyada 'id' yo'q: queue_id={queue_id}")
                        applied_queue_ids.append(queue_id)
                        continue

                    # BUG FIX: parse_datetime timezone-aware qilinadi (TypeError oldini olish)
                    raw_ts = str(payload.get('updated_at', ''))
                    client_updated_at = parse_datetime(raw_ts) if raw_ts else None
                    if client_updated_at is None:
                        client_updated_at = timezone.now()
                    elif timezone.is_naive(client_updated_at):
                        client_updated_at = timezone.make_aware(client_updated_at, timezone.get_current_timezone())

                    # Race condition oldini olish uchun qatorni qulflaymiz (select_for_update)
                    existing = ClientLead.objects.select_for_update().filter(pk=record_id).first()

                    if existing:
                        # Last-Write-Wins (LWW): Agar mijozdagi vaqt serverdagidan yangi yoki teng bo'lsa
                        if client_updated_at >= existing.updated_at:
                            if action == 'delete' or payload.get('is_deleted', False):
                                existing.is_deleted = True
                                existing.updated_at = client_updated_at
                                existing.save(skip_updated_at=True)
                            else:
                                # Maydonlarni xavfsiz yangilash
                                updateable_fields = ['name', 'phone', 'email', 'status', 'notes']
                                for field in updateable_fields:
                                    if field in payload and payload[field] is not None:
                                        setattr(existing, field, payload[field])
                                existing.is_deleted = bool(payload.get('is_deleted', False))
                                existing.updated_at = client_updated_at
                                existing.save(skip_updated_at=True)
                            applied_queue_ids.append(queue_id)
                        else:
                            # Serverdagi ma'lumot yangiroq — Server Wins, serverning to'liq holatini qaytaramiz
                            conflicts.append({
                                'queue_id': queue_id,
                                'record_id': str(record_id),
                                'reason': 'server_wins',
                                'server_record': ClientLeadSerializer(existing).data,
                                'server_updated_at': existing.updated_at.isoformat(),
                            })
                            applied_queue_ids.append(queue_id)
                    else:
                        # Yangi yozuv yaratish (skip_updated_at=True bilan mijoz vaqti saqlanadi)
                        try:
                            new_lead = ClientLead(
                                id=record_id,
                                name=payload.get('name') or '',
                                phone=payload.get('phone') or '',
                                email=payload.get('email') or None,
                                status=payload.get('status', 'new'),
                                notes=payload.get('notes') or '',
                                assigned_to=request.user,
                                updated_at=client_updated_at,
                                is_deleted=bool(payload.get('is_deleted', False)),
                            )
                            new_lead.save(skip_updated_at=True)
                            applied_queue_ids.append(queue_id)
                        except Exception as e:
                            logger.error(f"[SyncEngine] Yangi yozuv yaratishda xato: {e}, id={record_id}")
                            applied_queue_ids.append(queue_id)

        except Exception as e:
            logger.exception(f"[SyncEngine] Push operatsiyasida kritik xato: {e}")
            return Response(
                {'error': 'Server xatosi. Keyinroq qayta urinib ko\'ring.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'success': True,
            'server_time': timezone.now().isoformat(),
            'applied_queue_ids': applied_queue_ids,
            'conflicts': conflicts,
        }, status=status.HTTP_200_OK)

    def get(self, request):
        """
        PULL: Serverdan yangilanishlarni (delta) yoki dastlabki bazani bo'laklab tortib olish.
        Keyset cursor pagination (updated_at + id) yordamida brauzer qotib qolishi oldi olinadi.
        """
        last_pulled_at_str = request.query_params.get('last_pulled_at')
        cursor_str = request.query_params.get('cursor')

        # BUG FIX: batch_size noto'g'ri qiymat bo'lganda 500 ga qaytariladi
        try:
            batch_size = min(int(request.query_params.get('batch_size', self.BATCH_SIZE)), 1000)
        except (ValueError, TypeError):
            batch_size = self.BATCH_SIZE

        queryset = ClientLead.objects.all()

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
