import logging
import traceback
from decimal import Decimal
from django.utils import timezone
from django.db import transaction, models
from django.db.models import Sum, Q, F, Count
from django.shortcuts import get_object_or_404
from django_filters import rest_framework as django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions, filters, status, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import APIException, PermissionDenied
from django.http import Http404
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from finance.models import (
    Payment, FinanceTransaction, EmployeePayment, 
    StaffProfile, EmployeeAdvance, AdminExpense, MentorGroupSalaryConfig
)
from finance.serializers import (
    PaymentSerializer, FinanceTransactionSerializer, 
    EmployeePaymentSerializer, StaffProfileSerializer, 
    EmployeeAdvanceSerializer, FinanceDashboardSerializer,
    BranchFinanceDetailSerializer, SuccessSerializer, 
    AbsentStudentSerializer, PaymentStatisticsSerializer,
    AdminExpenseSerializer, MentorGroupSalaryConfigSerializer
)
from permissions.permissions import HasModulePermission
from finance.services import (
    generate_monthly_payments, handle_custom_payment,
    confirm_student_payment, get_finance_dashboard_stats,
    get_branch_finance_stats, process_absence_refunds,
    get_monthly_branch_trends
)
from finance.exports import export_absent_students_to_excel
from groups.models import Student, Group, Branch, GroupEnrollment
from homework_attends.models import Attendance
from .base import _parse_month_year, StandardResultsSetPagination, HeavyResultsSetPagination

logger = logging.getLogger(__name__)



class StudentPaymentViewSet(viewsets.ModelViewSet):
    """O'quvchilar to'lovlarini boshqarish"""
    queryset = Payment.objects.select_related('student', 'group', 'marked_by').all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'is_paid': ['exact'],
        'month': ['exact'],
        'group': ['exact'],
        'student': ['exact'],
        'payment_method': ['exact'],
        'paid_at': ['exact', 'date', 'gte', 'lte', 'date__gte', 'date__lte'],
        'student__branch': ['exact']
    }
    search_fields = ['student__full_name', 'student__phone', 'group__name']
    ordering_fields = ['month', 'paid_at', 'created_at']
    ordering = ['-month', '-id']
    

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Payment.objects.none()
        qs = super().get_queryset()
        if user.role == 'admin':
            allowed_branches = [user.branch_id] if user.branch_id else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            return qs.filter(
                Q(group__branch_id__in=allowed_branches) |
                Q(student__branch_id__in=allowed_branches) |
                Q(student__enrollments__is_active=True, student__enrollments__group__branch_id__in=allowed_branches)
            ).distinct()
        elif user.role != 'super_admin':
            return Payment.objects.none()
        return qs

    def get_serializer_context(self):
        """OPTIMIZATSIYA: PaymentSerializer uchun lesson_dates cache"""
        context = super().get_serializer_context()
        if self.action not in ('list', 'retrieve'):
            return context
        try:
            # Barcha noyob (group, year, month) larni aniqlash
            queryset = self.filter_queryset(self.get_queryset())
            if self.action == 'list':
                page = self.paginate_queryset(queryset)
                items = page if page is not None else list(queryset)
            elif self.kwargs.get(getattr(self, 'lookup_url_kwarg', None) or getattr(self, 'lookup_field', None) or 'pk'):
                items = [self.get_object()]
            else:
                items = []

            group_months = set()
            for p in items:
                if p.group_id and p.month:
                    group_months.add((p.group_id, p.month.year, p.month.month))

            lesson_dates_cache = {}
            group_ids = list(set(gid for gid, _, _ in group_months))
            groups_map = {
                g.id: g for g in Group.objects.filter(id__in=group_ids).prefetch_related(
                    'special_lesson_days', 'canceled_lesson_days'
                )
            }
            for gid, year, month in group_months:
                group = groups_map.get(gid)
                if group:
                    lesson_dates_cache[(gid, year, month)] = group.get_lesson_dates(year, month)
                else:
                    lesson_dates_cache[(gid, year, month)] = []

            context['lesson_dates_cache'] = lesson_dates_cache
        except Exception as e:
            logger.error(f"StudentPayment prefetch error: {e}")
        return context

    def perform_update(self, serializer):
        """Adminlar tasdiqlangan to'lovni tahrirlaganda Ledger'ni to'g'ri yangilash"""
        instance = self.get_object()
        old_amount = instance.amount
        old_is_paid = instance.is_paid

        # Super admin bo'lmagan admin tasdiqlangan to'lovni o'zgartira olmaydi
        if instance.is_verified and self.request.user.role != 'super_admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Super admin tomonidan tasdiqlangan to'lovni faqat Super Admin o'zgartira oladi.")
        
        updated_instance = serializer.save()
        
        if old_is_paid and updated_instance.is_paid and old_amount != updated_instance.amount:
            # BUG-3 & AUDIT FIX: Ledger'dagi mavjud tranzaksiyalarni to'g'ridan-to'g'ri o'zgartirmaymiz.
            # Buning o'rniga summadagi farq (diff) uchun yangi tuzatish tranzaksiyasi (Adjustment / Reversal) yozamiz.
            import uuid
            related_id_prefix = f"STP-{updated_instance.id}-"
            _student_name = (
                updated_instance.student_full_name
                or (updated_instance.student.full_name if updated_instance.student else "Noma'lum o'quvchi")
            )
            _group_name = (
                updated_instance.group_name
                or (updated_instance.group.name if updated_instance.group else "Noma'lum guruh")
            )
            _branch = (
                (updated_instance.group.branch if updated_instance.group else None)
                or (updated_instance.student.branch if updated_instance.student else None)
                or getattr(self.request.user, 'branch', None)
            )

            # Mavjud completed tranzaksiyalar yig'indisi
            existing_tx_sum = FinanceTransaction.objects.filter(
                related_id__startswith=related_id_prefix,
                status='completed'
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

            diff = Decimal(str(updated_instance.amount)) - existing_tx_sum
            if diff != Decimal('0') and _branch:
                now = timezone.now()
                if diff > 0:
                    FinanceTransaction.objects.create(
                        related_id=f"STP-{updated_instance.id}-ADJ-{uuid.uuid4().hex[:8]}",
                        transaction_type='income',
                        category='student_fee',
                        status='completed',
                        record_type='payment',
                        amount=diff,
                        date=updated_instance.paid_at.date() if updated_instance.paid_at else timezone.localdate(),
                        marked_by=self.request.user,
                        branch=_branch,
                        student=updated_instance.student,
                        group=updated_instance.group,
                        student_name=_student_name,
                        group_name=_group_name,
                        payment_method=updated_instance.payment_method,
                        title=_student_name,
                        description=f"Tahrirlandi (+{diff} UZS): {_student_name} ({updated_instance.month})",
                        is_verified=updated_instance.is_verified,
                        verified_by=self.request.user if updated_instance.is_verified else None,
                        verified_at=now if updated_instance.is_verified else None,
                    )
                else:
                    FinanceTransaction.objects.create(
                        related_id=f"REV-{updated_instance.id}-ADJ-{uuid.uuid4().hex[:8]}",
                        transaction_type='income',
                        category='student_fee',
                        status='completed',
                        record_type='reversal',
                        amount=diff,  # manfiy summa
                        date=timezone.localdate(),
                        marked_by=self.request.user,
                        branch=_branch,
                        student=updated_instance.student,
                        group=updated_instance.group,
                        student_name=_student_name,
                        group_name=_group_name,
                        payment_method=updated_instance.payment_method,
                        title=f"Bekor qilindi/kamaytirildi: {_student_name}",
                        description=f"Tahrirlandi ({diff} UZS): {_student_name} ({updated_instance.month})",
                        is_verified=updated_instance.is_verified,
                        verified_by=self.request.user if updated_instance.is_verified else None,
                        verified_at=now if updated_instance.is_verified else None,
                    )

            updated_instance.paid_amount = updated_instance.amount
            updated_instance.save(update_fields=['paid_amount'])

    def destroy(self, request, *args, **kwargs):
        """
        To'lovni bekor qilish.

        LEDGER TAMOYILI:
        - Original income tranzaksiyasi 'cancelled' ga o'tkaziladi.
        - Reversal tranzaksiyasi XUDDI SHU 'income' kategoriyasida,
          LEKIN MANFIY summa bilan yoziladi.
        - Bu 'total_paid_all_time' (income yig'indisi) dan avtomatik ayiriladi
          va balans to'g'ri hisob qiladi.
        - Payment.amount SAQLANIB QOLADI (tarix uchun), lekin paid_amount=0 va
          is_paid=False bo'ladi, shu sababli balance hisobida 'total_billed'
          ushbu bekor qilingan invoice'ni hisobga olmaydi.
        """
        from django.db import transaction as db_transaction
        from django.utils import timezone
        import uuid

        payment = self.get_object()

        # Super admin tasdiqlagan to'lovni HECH KIM o'chira olmaydi
        if payment.is_verified:
            return Response(
                {"detail": "Super admin tomonidan tasdiqlangan to'lovni o'chirib bo'lmaydi."},
                status=status.HTTP_403_FORBIDDEN
            )

        related_id_prefix = f"STP-{payment.id}-INS-"
        transactions = FinanceTransaction.objects.filter(
            related_id__startswith=related_id_prefix,
            status='completed'
        )

        with db_transaction.atomic():
            for tx in transactions:
                # 1. Original tranzaksiyani 'cancelled' qilish
                tx.status = 'cancelled'
                tx.cancelled_by = request.user
                tx.cancelled_at = timezone.now()
                tx.save(update_fields=['status', 'cancelled_by', 'cancelled_at'])

                # 2. Reversal yozish: XUDDI income kategoriyasida, MANFIY summa bilan.
                #    total_paid_all_time faqat income tranzaksiyalarni yig'adi,
                #    shu sababli manfiy income reversal avtomatik ayiriladi.
                #    KASSA LOGIKASI: Reversal ning is_verified holati original tx ga mos bo'lishi kerak.
                #    Original tasdiqlangan bo'lsa → reversal ham tasdiqlangan (balansdan ayiriladi).
                #    Original hali tasdiqlanmagan bo'lsa → reversal ham tasdiqlanmagan.
                FinanceTransaction.objects.create(
                    transaction_type='income',          # income — balance hisobi uchun muhim!
                    category=tx.category,
                    status='completed',
                    record_type='reversal',
                    related_transaction=tx,
                    amount=-abs(tx.amount),             # Manfiy: to'langan summa ayiriladi
                    date=timezone.now().date(),
                    student=tx.student,
                    group=tx.group,
                    student_name=tx.student_name,
                    group_name=tx.group_name,
                    branch=tx.branch,
                    marked_by=request.user,
                    title=f"Bekor qilindi: {tx.title}",
                    description=f"Original tranzaksiya bekor qilindi. {tx.description}",
                    related_id=f"REV-{tx.id}-{uuid.uuid4().hex[:8]}",
                    is_verified=tx.is_verified,
                    verified_by=tx.verified_by,
                    verified_at=tx.verified_at,
                )

            # 3. Invoice'ni reset qilish (o'chirmaymiz — tarix saqlanib qolsin)
            # TUZATILDI (BUG-DESTROY-1): payment.student SET_NULL tufayli None bo'lishi mumkin.
            # Avvalgi kodda payment.student.status → AttributeError → server 500 xatosi.
            # Endi student None bo'lsa snapshot (payment.amount) yoki group narxidan foydalanamiz.
            _student = payment.student
            _group = payment.group

            if _student is not None and _student.status == "discount":
                from finance.utils import calculate_attendance_based_student_payment, normalize_month
                base_amount = calculate_attendance_based_student_payment(
                    _student, _group,
                    normalize_month(payment.month)
                )
            elif _student is not None and _student.status in ["low_income", "negotiated", "teacher_negotiated"]:
                if _student.status == "teacher_negotiated" and _student.custom_fee is None:
                    from finance.utils import get_teacher_negotiated_center_fee
                    base_amount = get_teacher_negotiated_center_fee(_group)
                else:
                    base_amount = (
                        _student.custom_fee
                        if _student.custom_fee is not None
                        else (_group.monthly_price if _group else payment.amount or 0)
                    )
            elif _student is None:
                # Student o'chirilgan — snapshot yoki group narxidan foydalanamiz
                base_amount = (
                    _group.monthly_price if _group else payment.amount or 0
                )
            else:
                base_amount = _group.monthly_price if _group else payment.amount or 0

            payment.amount = base_amount
            payment.refund_amount = 0
            payment.refund_ignored = False
            payment.paid_amount = 0
            payment.is_paid = False
            payment.is_partial = False
            payment.save(update_fields=['paid_amount', 'is_paid', 'is_partial', 'amount', 'refund_amount', 'refund_ignored'])
        return Response(status=status.HTTP_204_NO_CONTENT)


    @action(detail=False, methods=['get'], url_path='pending')
    def pending(self, request):
        """
        Kassada tasdiq kutayotgan to'lovlar ro'yxati (Super Admin uchun).
        """
        if request.user.role != 'super_admin':
            return Response({"detail": "Faqat super admin ko'ra oladi"}, status=status.HTTP_403_FORBIDDEN)
        
        # is_verified=False va qandaydir to'lov qilingan bo'lishi kerak
        qs = self.get_queryset().filter(
            is_verified=False
        ).filter(
            Q(is_paid=True) | Q(paid_amount__gt=0)
        ).order_by('-paid_at')
        
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


    @action(detail=True, methods=['post'], url_path='refund-money')
    def refund_money(self, request, pk=None):
        """
        O'quvchiga pulni haqiqatda qaytarish (Refund).
        Balansni manfiy summa bilan kamaytiradi.

        TUZATILDI (BUG-REFUND-1):
        - is_verified=True qo'shildi: refund real pul chiqimi bo'lib, darhol
          global balansga va StudentFinanceProfile.total_refunded ga aks etishi kerak.
          Ilgari is_verified=False qoldirilgan, shuning uchun refund balansda
          ko'rinmasdi va o'quvchi qarzi noto'g'ri ko'rsatilardi.
        - payment.student / payment.group None bo'lsa himoya qo'shildi.
        """
        from django.db import transaction as db_transaction
        from django.utils import timezone
        from decimal import Decimal
        import uuid
        
        payment = self.get_object()
        refund_amount = Decimal(str(request.data.get('amount', '0')))
        
        if refund_amount <= 0:
            return Response({"detail": "Refund summasi 0 dan katta bo'lishi kerak."}, status=400)
            
        if payment.paid_amount < refund_amount:
            return Response({"detail": "Refund summasi to'langan summadan oshmasligi kerak."}, status=400)

        # MUHIM: Branch tekshiruvi atomic blokdan OLDIN bajariladi.
        # Aks holda: payment.save() atomic blok ichida bajariladi, keyin branch
        # topilmasa return Response(400) chiqariladi — lekin bu rollback QILMAYDI!
        # Django atomic() faqat exception ko'tarilganda rollback qiladi.
        _student = payment.student
        _group = payment.group
        _branch = (
            (_group.branch if _group else None)
            or (_student.branch if _student else None)
        )
        if _branch is None:
            logger.error(
                "refund_money: branch aniqlanmadi, payment_id=%s", payment.id
            )
            return Response(
                {"detail": "Filial aniqlanmadi, refund bajarib bo'lmadi."},
                status=status.HTTP_400_BAD_REQUEST
            )

        _title = (
            f"Refund: {_student.full_name}"
            if _student
            else "Refund: " + (payment.student_full_name or "Noma'lum o'quvchi")
        )

        with db_transaction.atomic():
            now = timezone.now()
            payment.paid_amount -= refund_amount
            if payment.paid_amount <= 0:
                payment.paid_amount = Decimal('0')
                payment.is_paid = False
                payment.is_partial = False

                # To'lov to'liq qaytarilganda/bekor qilinganda, original kirim tranzaksiyalarini
                # 'cancelled' statusiga o'tkazamiz, shunda Super Admin kassasida to'lov o'chadi
                original_txs = FinanceTransaction.objects.filter(
                    related_id__startswith=f"STP-{payment.id}-INS-",
                    status='completed'
                )
                for otx in original_txs:
                    otx.status = 'cancelled'
                    otx.cancelled_by = request.user
                    otx.cancelled_at = now
                    otx.save(update_fields=['status', 'cancelled_by', 'cancelled_at'])
            else:
                payment.is_paid = False
                payment.is_partial = True
            payment.save()
            # TUZATILDI (BUG-REFUND-1): is_verified=True — refund real pul chiqimi,
            # darhol global balansga aks etishi kerak.
            # total_refunded() faqat is_verified=True larni hisoblaydi.
            FinanceTransaction.objects.create(
                transaction_type='expense',
                category='refund',
                status='completed',
                record_type='refund',
                amount=-refund_amount,  # Manfiy summa
                date=now.date(),
                student=_student,
                group=_group,
                student_name=payment.student_full_name or (_student.full_name if _student else None),
                group_name=payment.group_name or (_group.name if _group else None),
                branch=_branch,
                marked_by=request.user,
                title=_title,
                description=f"Pul qaytarildi. Sabab: {request.data.get('reason', '')}",
                related_id=f"STP-{payment.id}-REFUND-{uuid.uuid4().hex[:8]}",
                is_verified=True,
                verified_by=request.user,
                verified_at=now,
            )
            
        return Response({"status": "success", "message": "Pul muvaffaqiyatli qaytarildi."})


    @action(detail=False, methods=['post'], url_path='custom-payment')
    def custom_payment(self, request):
        try:
            ft, mentor_updated = handle_custom_payment(request.user, request.data)
            return Response({
                "status": "success",
                "message": "To'lov muvaffaqiyatli saqlandi",
                "mentor_salary_updated": mentor_updated,
                "data": FinanceTransactionSerializer(ft).data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        payment = self.get_object()
        # BUG-12 FIX: Agar custom_amount (qo'shimcha to'lov) bo'lsa, to'liq
        # to'langan bo'lsa ham qabul qilinadi.
        is_custom = str(request.data.get('is_custom_amount', 'false')).lower() in ['true', '1', 'yes']
        if payment.is_paid and not is_custom:
            return Response({"detail": "Ushbu to'lov allaqachon to'liq amalga oshirilgan"}, status=400)

        try:
            payload = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
            if request.FILES:
                for key in request.FILES:
                    payload[key] = request.FILES[key]
            updated_payment = confirm_student_payment(request.user, payment, payload)
            message = "To'lov muvaffaqiyatli qabul qilindi"
            if updated_payment.is_partial and not updated_payment.is_paid:
                message = (
                    f"Bo'lib to'lov qabul qilindi. "
                    f"Qolgan: {float(updated_payment.remaining_amount):,.0f} UZS"
                )
            return Response({
                "status": "success",
                "message": message,
                "data": PaymentSerializer(updated_payment).data
            })
        except Exception as e:
            import traceback
            return Response({"error": str(e), "traceback": traceback.format_exc()}, status=400)

    @action(detail=True, methods=['post'], url_path='verify')
    def verify(self, request, pk=None):
        """
        Kassa tasdiqlash: Super Admin o'quvchi to'lovini tasdiqlaydi.
        """
        from django.db import transaction as db_transaction
        from finance.services import apply_calculated_salary_to_employee_payment
        from django.http import Http404
        from finance.models import FinanceTransaction, EmployeePayment

        if request.user.role != 'super_admin':
            return Response({"detail": "Faqat super admin tasdiqlay oladi"}, status=403)

        payment = None
        try:
            payment = self.get_object()
        except Http404:
            pass

        related_id_prefix = f"STP-{pk}-INS-"
        ft = FinanceTransaction.objects.filter(related_id__startswith=related_id_prefix, status='completed').first()
        cancelled_ft = FinanceTransaction.objects.filter(related_id__startswith=related_id_prefix, status='cancelled').first()

        if not payment and not ft:
            if cancelled_ft:
                return Response(
                    {"detail": "Ushbu to'lov bekor qilingan — uni tasdiqlab bo'lmaydi."},
                    status=400
                )
            return Response(
                {"detail": "To'lov topilmadi yoki tranzaksiya mavjud emas."},
                status=404
            )

        if payment:
            if not payment.is_paid and payment.paid_amount <= 0:
                if cancelled_ft:
                    return Response(
                        {"detail": "Ushbu to'lov bekor qilingan — uni tasdiqlab bo'lmaydi."},
                        status=400
                    )
                return Response(
                    {"detail": "To'lov hali amalga oshirilmagan — tasdiqlab bo'lmaydi."},
                    status=400
                )
            if payment.is_verified and not FinanceTransaction.objects.filter(
                related_id__startswith=related_id_prefix, status='completed', is_verified=False,
            ).exists():
                return Response(
                    {"detail": "Bu to'lov allaqachon tasdiqlangan."},
                    status=400
                )
        else:
            if ft and ft.is_verified:
                return Response(
                    {"detail": "Bu to'lov allaqachon tasdiqlangan."},
                    status=400
                )

        with db_transaction.atomic():
            now = timezone.now()

            # 1. Payment darajasida tasdiqlash (agar mavjud bo'lsa)
            if payment:
                payment.is_verified = True
                payment.verified_by = request.user
                payment.verified_at = now
                payment.save(update_fields=['is_verified', 'verified_by', 'verified_at'])

            # 2. Barcha bog'liq tranzaksiyalarni tasdiqlash → global balansga tushadi
            updated_count = FinanceTransaction.objects.filter(
                related_id__startswith=related_id_prefix,
                status='completed',
                is_verified=False,
            ).update(
                is_verified=True,
                verified_by=request.user,
                verified_at=now,
            )

            # 3. Mentor maoshini real-time qayta hisoblash (tasdiqdan keyin)
            mentor_updated = False
            try:
                group = payment.group if payment else (ft.group if ft else None)
                mentor = group.mentor if group else None
                if mentor and hasattr(mentor, 'staff_profile'):
                    profile = mentor.staff_profile
                    if profile.salary_type in ['percentage', 'student_count']:
                        raw_month = payment.month if payment else (ft.date if ft else None)
                        payment_month = raw_month.replace(day=1) if raw_month else None
                        if payment_month:
                            emp_payment = EmployeePayment.objects.filter(
                                employee=mentor,
                                month=payment_month,
                                is_paid=False
                            ).first()
                            if emp_payment:
                                apply_calculated_salary_to_employee_payment(
                                    profile, payment_month, emp_payment
                                )
                                emp_payment.save()
                                mentor_updated = True
            except Exception as mentor_err:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Verify: mentor salary recalculate error: {mentor_err}")

            # update in ArchivedStudent if applicable
            if not payment:
                from archivebase.models import ArchivedStudent
                archives = ArchivedStudent.objects.all()
                for arch in archives:
                    if arch.metadata and 'payments' in arch.metadata:
                        updated = False
                        for p in arch.metadata['payments']:
                            if p.get('id') == int(pk):
                                p['is_verified'] = True
                                updated = True
                        if updated:
                            arch.save(update_fields=['metadata'])

        return Response({
            "status": "success",
            "message": (
                f"To'lov muvaffaqiyatli tasdiqlandi. "
                f"{updated_count} ta tranzaksiya global balansga qo'shildi."
            ),
            "transactions_verified": updated_count,
            "mentor_salary_updated": mentor_updated,
            "data": PaymentSerializer(payment).data if payment else {"original_payment_id": pk, "is_verified": True}
        })

    @action(detail=False, methods=['get'], url_path='student-history/(?P<student_id>[^/.]+)')
    def student_history(self, request, student_id=None):
        # BUG-9 FIX: Admin ruxsatini filial va faol guruhlar bo'yicha tekshirish
        if request.user.role == 'admin':
            allowed_branches = [request.user.branch_id] if request.user.branch_id else []
            if hasattr(request.user, 'branch_accesses'):
                allowed_branches.extend(request.user.branch_accesses.values_list('branch_id', flat=True))
            student = get_object_or_404(
                Student.objects.filter(
                    Q(branch_id__in=allowed_branches) |
                    Q(enrollments__is_active=True, enrollments__group__branch_id__in=allowed_branches)
                ).distinct(),
                id=student_id
            )
        else:
            student = get_object_or_404(Student, id=student_id)
        payments = Payment.objects.filter(student=student).order_by('-month')
        extras = FinanceTransaction.objects.filter(student=student, category='student_extra').order_by('-date')
        refunds = FinanceTransaction.objects.filter(student=student, category='refund').order_by('-date')
        ledger = FinanceTransaction.objects.filter(student=student).order_by('-date', '-created_at')
        
        return Response({
            "student": {"id": student.id, "name": student.full_name},
            "monthly_payments": PaymentSerializer(payments, many=True).data,
            "extra_transactions": FinanceTransactionSerializer(extras, many=True).data,
            "refunds": FinanceTransactionSerializer(refunds, many=True).data,
            "ledger_transactions": FinanceTransactionSerializer(ledger, many=True).data
        })

    @action(detail=False, methods=['get'], url_path='cashier-desk')
    def cashier_desk(self, request):
        """
        Filial admini (Branch Admin) uchun yuqori tezlikdagi POS Kassa API.
        O'qituvchilar -> Guruhlar -> O'quvchilar ierarxiyasini va filial kassa
        qoldig'ini N+1 so'rovlarsiz qaytaradi.
        """
        from decimal import Decimal
        from django.db.models import Sum, Count, Q
        from django.utils import timezone
        from branches.models import Branch
        from groups.models import Group, GroupEnrollment, Student
        from finance.models import FinanceTransaction, AdminExpense
        from homework_attends.models import Attendance
        from finance.utils import normalize_month

        user = request.user
        # 1. Filial ruxsatini qat'iy tekshirish (Branch-Level Isolation)
        if user.role == 'admin':
            allowed_branches = [user.branch_id] if user.branch_id else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            safe_branches = [int(b) for b in allowed_branches if b is not None]

            branch_param = request.query_params.get('branch_id')
            if branch_param:
                try:
                    target_branch_id = int(branch_param)
                except (ValueError, TypeError):
                    return Response({"detail": "Noto'g'ri branch_id parametri."}, status=status.HTTP_400_BAD_REQUEST)
                if target_branch_id not in safe_branches:
                    return Response(
                        {"detail": "Siz faqat o'zingizga biriktirilgan filial kassa ma'lumotlarini ko'ra olasiz."},
                        status=status.HTTP_403_FORBIDDEN
                    )
            else:
                target_branch_id = user.branch_id or (safe_branches[0] if safe_branches else None)
        elif user.role == 'super_admin':
            branch_param = request.query_params.get('branch_id')
            if branch_param:
                try:
                    target_branch_id = int(branch_param)
                except (ValueError, TypeError):
                    return Response({"detail": "Noto'g'ri branch_id parametri."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                first_b = Branch.objects.first()
                target_branch_id = first_b.id if first_b else None
        else:
            return Response({"detail": "Ruxsat berilmagan foydalanuvchi roli."}, status=status.HTTP_403_FORBIDDEN)

        if not target_branch_id:
            return Response({"detail": "Filial tanlanmadi yoki topilmadi."}, status=status.HTTP_404_NOT_FOUND)

        branch = Branch.objects.filter(id=target_branch_id).first()
        if not branch:
            return Response({"detail": "Filial mavjud emas."}, status=status.HTTP_404_NOT_FOUND)

        # 2. Oyni aniqlash (Default: joriy oy)
        month_param = request.query_params.get('month')
        today = timezone.localdate()
        if month_param:
            try:
                parts = month_param.split('-')
                month_date = timezone.datetime(int(parts[0]), int(parts[1]), 1).date()
            except Exception:
                month_date = today.replace(day=1)
        else:
            month_date = today.replace(day=1)

        search_query = request.query_params.get('search', '').strip().lower()

        from finance.services import build_cashier_desk_dict
        data = build_cashier_desk_dict(target_branch_id, month_date, today, search_query)
        if not data:
            return Response({"detail": "Filial mavjud emas."}, status=status.HTTP_404_NOT_FOUND)

        return Response(data)

    @action(detail=False, methods=['get'], url_path='cashier-student-detail')
    def cashier_student_detail(self, request):
        """
        O'quvchi bo'yicha drill-down ma'lumotlar:
        1. Barcha faol guruhlari va ulardagi to'lov/qarz holati (Multi-Group Accounting)
        2. Ushbu guruhdagi to'lov va davomat statistikasi
        3. Oxirgi to'lov cheklari va tranzaksiyalar tarixi
        """
        from decimal import Decimal
        from django.db.models import Count, Q
        from django.utils import timezone
        from groups.models import Student, Group, GroupEnrollment
        from finance.models import Payment, FinanceTransaction
        from homework_attends.models import Attendance
        from finance.utils import normalize_month

        student_id = request.query_params.get('student_id')
        if not student_id:
            return Response({"detail": "student_id talab qilinadi."}, status=400)

        user = request.user
        if user.role == 'admin':
            allowed_branches = [user.branch_id] if user.branch_id else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            safe_branches = [int(b) for b in allowed_branches if b is not None]
            student = get_object_or_404(
                Student.objects.filter(
                    Q(branch_id__in=safe_branches) |
                    Q(enrollments__is_active=True, enrollments__group__branch_id__in=safe_branches)
                ).distinct(),
                id=student_id
            )
        else:
            student = get_object_or_404(Student, id=student_id)

        group_id_param = request.query_params.get('group_id')
        month_param = request.query_params.get('month')
        today = timezone.localdate()
        if month_param:
            try:
                parts = month_param.split('-')
                month_date = timezone.datetime(int(parts[0]), int(parts[1]), 1).date()
            except Exception:
                month_date = today.replace(day=1)
        else:
            month_date = today.replace(day=1)

        # 1. Barcha faol enrollmentlar (Multi-Group Support)
        active_enrollments = GroupEnrollment.objects.filter(
            student=student,
            is_active=True
        ).select_related('group', 'group__branch', 'group__mentor')

        all_groups_info = []
        from finance.services import payment_verification_data, with_receipt_verification
        from finance.cashier_calculation import build_cashier_calculation
        target_group = None
        for enr in active_enrollments:
            g = enr.group
            if not g:
                continue
            if group_id_param and str(g.id) == str(group_id_param):
                target_group = g

            # Ushbu guruh bo'yicha oylik to'lov
            pmt = with_receipt_verification(Payment.objects.filter(student=student, group=g, month=month_date)).first()
            if pmt:
                g_expected = float(pmt.amount if pmt.amount is not None else (g.monthly_price or 0))
                g_paid = float(pmt.paid_amount or 0)
                if student.status == 'discount':
                    g_remaining = 0.0
                    g_is_paid = True
                    g_is_partial = False
                else:
                    g_remaining = float(pmt.remaining_amount)
                    g_is_paid = pmt.is_paid
                    g_is_partial = pmt.is_partial
                pmt_id = pmt.id
            else:
                if student.status == 'discount':
                    fee = 0.0
                elif student.status == 'teacher_negotiated':
                    if student.custom_fee is not None:
                        fee = float(student.custom_fee)
                    else:
                        from finance.utils import get_teacher_negotiated_center_fee
                        fee = float(get_teacher_negotiated_center_fee(g))
                elif student.status in ['low_income', 'negotiated'] and student.custom_fee is not None:
                    fee = float(student.custom_fee)
                else:
                    fee = float(g.monthly_price or 0)
                g_expected = float(g.monthly_price or 0) if student.status == 'discount' else fee
                g_paid = 0.0
                g_remaining = 0.0 if student.status == 'discount' else fee
                g_is_paid = (fee <= 0) or (student.status == 'discount')
                g_is_partial = False
                pmt_id = None

            all_groups_info.append({
                "group_id": g.id,
                "group_name": g.name,
                "branch_id": g.branch_id,
                "branch_name": g.branch.name if g.branch else "",
                "mentor_name": g.mentor.get_full_name() if g.mentor else "Biriktirilmagan",
                "monthly_price": float(g.monthly_price or 0),
                "payment_id": pmt_id,
                **payment_verification_data(pmt),
                "expected_amount": g_expected,
                "paid_amount": g_paid,
                "remaining_amount": g_remaining,
                "is_paid": g_is_paid,
                "is_partial": g_is_partial,
                "is_discount": (student.status == 'discount'),
                "calculation": build_cashier_calculation(
                    student, g, month_date, pmt, enr, g_expected, g_remaining, today=today,
                )
            })

        if not target_group:
            if active_enrollments.exists():
                target_group = active_enrollments.first().group
            elif getattr(student, 'primary_group', None):
                target_group = student.primary_group

        if not all_groups_info and target_group:
            pmt = with_receipt_verification(Payment.objects.filter(student=student, group=target_group, month=month_date)).first()
            if pmt:
                g_expected = float(pmt.amount if pmt.amount is not None else (target_group.monthly_price or 0))
                g_paid = float(pmt.paid_amount or 0)
                if student.status == 'discount':
                    g_remaining = 0.0
                    g_is_paid = True
                    g_is_partial = False
                else:
                    g_remaining = float(pmt.remaining_amount)
                    g_is_paid = pmt.is_paid
                    g_is_partial = pmt.is_partial
                pmt_id = pmt.id
            else:
                if student.status == 'discount':
                    fee = 0.0
                elif student.status == 'teacher_negotiated':
                    if student.custom_fee is not None:
                        fee = float(student.custom_fee)
                    else:
                        from finance.utils import get_teacher_negotiated_center_fee
                        fee = float(get_teacher_negotiated_center_fee(target_group))
                elif student.status in ['low_income', 'negotiated'] and student.custom_fee is not None:
                    fee = float(student.custom_fee)
                else:
                    fee = float(target_group.monthly_price or 0)
                g_expected = float(target_group.monthly_price or 0) if student.status == 'discount' else fee
                g_paid = 0.0
                g_remaining = 0.0 if student.status == 'discount' else fee
                g_is_paid = (fee <= 0) or (student.status == 'discount')
                g_is_partial = False
                pmt_id = None

            all_groups_info.append({
                "group_id": target_group.id,
                "group_name": target_group.name,
                "branch_id": target_group.branch_id,
                "branch_name": target_group.branch.name if target_group.branch else "",
                "mentor_name": target_group.mentor.get_full_name() if target_group.mentor else "Biriktirilmagan",
                "monthly_price": float(target_group.monthly_price or 0),
                "payment_id": pmt_id,
                **payment_verification_data(pmt),
                "expected_amount": g_expected,
                "paid_amount": g_paid,
                "remaining_amount": g_remaining,
                "is_paid": g_is_paid,
                "is_partial": g_is_partial,
                "is_discount": (student.status == 'discount'),
                "calculation": build_cashier_calculation(
                    student, target_group, month_date, pmt, None, g_expected, g_remaining, today=today,
                )
            })

        # 2. Target guruh davomat statistikasi
        attendance_stats = {"total_lessons": 0, "passed_lessons": 0, "present_count": 0, "absences": 0}
        if target_group:
            dates = target_group.get_lesson_dates(month_date.year, month_date.month)
            passed = [d for d in dates if d <= today]
            present_c = Attendance.objects.filter(
                student=student,
                group=target_group,
                date__year=month_date.year,
                date__month=month_date.month,
                is_present=True,
                marked_by__isnull=False
            ).count()
            attendance_stats = {
                "total_lessons": len(dates),
                "passed_lessons": len(passed),
                "present_count": present_c,
                "absences": max(0, len(passed) - present_c)
            }

        # 3. O'quvchining oxirgi tranzaksiyalari (Unified Ledger)
        recent_txs = FinanceTransaction.objects.filter(
            student=student
        ).select_related('marked_by', 'group', 'branch').order_by('-date', '-id')[:15]

        tx_list = []
        for tx in recent_txs:
            tx_list.append({
                "id": tx.id,
                "related_id": tx.related_id,
                "transaction_type": tx.transaction_type,
                "category": tx.category,
                "amount": float(tx.amount),
                "date": str(tx.date),
                "payment_method": tx.payment_method or "",
                "group_name": tx.group_name or (tx.group.name if tx.group else ""),
                "marked_by_name": tx.marked_by.get_full_name() or tx.marked_by.username if tx.marked_by else "",
                "title": tx.title,
                "description": tx.description,
                "is_verified": tx.is_verified,
                "status": tx.status
            })

        # 4. Cheklar tarixi (Receipt images)
        receipt_payments = Payment.objects.filter(
            student=student,
            receipt_image__isnull=False
        ).exclude(receipt_image='').order_by('-paid_at')[:5]

        receipts_list = []
        for rp in receipt_payments:
            if rp.receipt_image:
                try:
                    url = rp.receipt_image.url
                except Exception:
                    url = None
                if url:
                    receipts_list.append({
                        "payment_id": rp.id,
                        "month": rp.month.strftime("%Y-%m") if rp.month else "",
                        "group_name": rp.group_name or (rp.group.name if rp.group else ""),
                        "amount": float(rp.paid_amount or rp.amount or 0),
                        "payment_method": rp.payment_method,
                        "receipt_url": url,
                        "notes": rp.notes or "",
                        "paid_at": rp.paid_at.isoformat() if rp.paid_at else None
                    })

        return Response({
            "student": {
                "id": student.id,
                "full_name": student.full_name,
                "phone": student.phone or "",
                "parent_phone": student.parent_phone or "",
                "address": student.address or "",
                "notes": student.notes or "",
                "status": student.status,
                "status_display": student.get_status_display(),
                "is_discount": (student.status == 'discount'),
                "custom_fee": float(student.custom_fee) if student.custom_fee is not None else None,
                "branch_name": student.branch.name if student.branch else ""
            },
            "target_group_id": target_group.id if target_group else None,
            "all_active_groups": all_groups_info,
            "attendance": attendance_stats,
            "transactions": tx_list,
            "receipts": receipts_list
        })

    @action(detail=False, methods=['post'], url_path='cashier-pay')
    def cashier_pay(self, request):
        """
        Kassadan o'quvchi to'lovini qabul qilish.
        Mavjud to'lov bo'lmasa, avtomatik yaratib, atomic tarzda apply_payment chaqiradi.
        """
        from django.db import transaction as db_transaction
        from finance.services import confirm_student_payment
        from finance.utils import normalize_month
        from rest_framework.exceptions import PermissionDenied

        payment_id = request.data.get('payment_id')
        student_id = request.data.get('student_id')
        group_id = request.data.get('group_id')
        month_str = request.data.get('month')

        if not payment_id and (not student_id or not group_id):
            return Response(
                {"detail": "To'lovni amalga oshirish uchun payment_id yoki student_id va group_id talab qilinadi."},
                status=400
            )

        with db_transaction.atomic():
            if payment_id:
                payment = get_object_or_404(Payment, pk=payment_id)
            else:
                norm_month = normalize_month(month_str or timezone.localdate())
                student = get_object_or_404(Student, pk=student_id)
                group = get_object_or_404(Group, pk=group_id)

                if student.status in ["low_income", "negotiated", "teacher_negotiated"] and student.custom_fee is not None:
                    initial_fee = student.custom_fee
                elif student.status == "teacher_negotiated":
                    from finance.utils import get_teacher_negotiated_center_fee
                    initial_fee = get_teacher_negotiated_center_fee(group)
                else:
                    initial_fee = group.monthly_price or 0

                payment, _ = Payment.objects.get_or_create(
                    student=student,
                    group=group,
                    month=norm_month,
                    defaults={
                        'amount': initial_fee,
                        'paid_amount': Decimal('0'),
                        'is_paid': False,
                        'is_partial': False
                    }
                )

            # Imtiyozli (grant) o'quvchilardan kassada to'lov qabul qilinmaydi
            if payment.student and payment.student.status == 'discount':
                return Response(
                    {"detail": "Imtiyozli (grant) o'quvchidan kassada to'lov qabul qilinmaydi. To'lov davlat tomonidan qoplanadi."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Filial ruxsatini tekshirish
            _branch = (payment.group.branch if payment.group else None) or (payment.student.branch if payment.student else None)
            if request.user.role == 'admin' and _branch:
                allowed_branches = [request.user.branch_id] if request.user.branch_id else []
                if hasattr(request.user, 'branch_accesses'):
                    allowed_branches.extend(request.user.branch_accesses.values_list('branch_id', flat=True))
                safe_branches = [int(b) for b in allowed_branches if b is not None]
                if _branch.id not in safe_branches:
                    raise PermissionDenied("Siz faqat o'zingizga biriktirilgan filial to'lovlarini qabul qila olasiz.")

            is_custom = str(request.data.get('is_custom_amount', 'false')).lower() in ['true', '1', 'yes']
            if payment.is_paid and not is_custom:
                return Response({"detail": "Ushbu to'lov allaqachon to'liq amalga oshirilgan."}, status=400)

            payload = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
            if request.FILES:
                for key in request.FILES:
                    payload[key] = request.FILES[key]
            updated_payment = confirm_student_payment(request.user, payment, payload)

            msg = "To'lov muvaffaqiyatli qabul qilindi"
            if updated_payment.is_partial and not updated_payment.is_paid:
                msg = f"Bo'lib to'lov qabul qilindi. Qolgan qarz: {float(updated_payment.remaining_amount):,.0f} UZS"

            return Response({
                "status": "success",
                "message": msg,
                "data": PaymentSerializer(updated_payment).data
            })



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_single_student_payment(request):
    """
    O'quvchi profilida joriy oy uchun to'lov ma'lumotini yaratish (agar mavjud bo'lmasa).
    group_id berilsa — shu guruh uchun, berilmasa — o'quvchining barcha faol guruhlari uchun yaratadi.
    """
    try:
        student_id = request.data.get('student_id')
        group_id = request.data.get('group_id')
        if not student_id:
            return Response({"error": "student_id talab qilinadi"}, status=400)
        
        from groups.models import Group, Student, GroupEnrollment
        from finance.models import Payment
        from finance.utils import calculate_attendance_based_student_payment, floor_amount
        from finance.services import auto_pay_from_wallet
        from decimal import Decimal
        from django.utils import timezone
        
        from permissions.scopes import require_finance_access, allowed_branch_ids
        student = get_object_or_404(Student, id=student_id)
        require_finance_access(request.user, student.branch_id)
        
        month_date = timezone.localdate().replace(day=1)
        
        target_groups = []
        if group_id:
            group = get_object_or_404(Group, id=group_id)
            require_finance_access(request.user, group.branch_id)
            if not group.is_faol or not GroupEnrollment.objects.filter(
                student=student, group=group, is_active=True, left_at__isnull=True,
            ).exists():
                return Response({"error": "O'quvchi ushbu guruhda faol emas"}, status=400)
            target_groups.append(group)
        else:
            # O'quvchining barcha faol guruhlarini aniqlash (eski/uzilgan guruhlar kirmaydi)
            active_enrollments = GroupEnrollment.objects.filter(
                student=student, is_active=True, left_at__isnull=True
            ).select_related('group')
            if request.user.role != 'super_admin':
                active_enrollments = active_enrollments.filter(group__branch_id__in=allowed_branch_ids(request.user))
            target_groups = [e.group for e in active_enrollments if e.group and e.group.is_faol]
            if not target_groups and student.group and student.group.is_faol:
                if GroupEnrollment.objects.filter(student=student, group=student.group, is_active=True, left_at__isnull=True).exists():
                    target_groups = [student.group]

        if not target_groups:
            return Response({
                "error": "O'quvchi birorta ham faol guruhga biriktirilmagan"
            }, status=400)

        created_count = 0
        already_exists_count = 0
        for group in target_groups:
            if Payment.objects.filter(student=student, group=group, month=month_date).exists():
                already_exists_count += 1
                continue
                
            base_price = group.monthly_price
            if student.status in ["low_income", "negotiated", "discount", "teacher_negotiated"]:
                if student.custom_fee is not None:
                    base_price = student.custom_fee
                elif student.status == "teacher_negotiated":
                    from finance.utils import get_teacher_negotiated_center_fee
                    base_price = get_teacher_negotiated_center_fee(group)

            month_lessons = group.get_lesson_dates(month_date.year, month_date.month)

            if student.status == "discount":
                payment_amount = calculate_attendance_based_student_payment(
                    student, group, month_date
                )
                is_auto_discount = True
            else:
                is_auto_discount = False
                if group.start_date and group.start_date > month_date:
                    from groups.utils import get_lessons_in_month
                    full_sched = get_lessons_in_month(group._get_effective_days(), month_date.year, month_date.month)
                    full_count = max(1, len(full_sched))
                    daily = Decimal(str(base_price)) / Decimal(str(full_count))
                    lesson_count = len(month_lessons) if month_lessons else full_count
                    payment_amount = floor_amount(daily * Decimal(str(lesson_count)))
                else:
                    payment_amount = Decimal(str(floor_amount(base_price)))

            payment, created = Payment.objects.get_or_create(
                student=student,
                group=group,
                month=month_date,
                defaults={
                    "amount": payment_amount,
                    "is_paid": False,
                    "is_auto_discount": is_auto_discount,
                },
            )
            if created:
                created_count += 1
                auto_pay_from_wallet(student)

        if created_count > 0:
            msg = f"Joriy oy uchun {created_count} ta to'lov varaqasi yaratildi"
        elif already_exists_count > 0:
            msg = "Joriy oy uchun to'lov ma'lumoti allaqachon mavjud"
        else:
            msg = "To'lov ma'lumoti yaratilmadi"

        all_student_payments = Payment.objects.filter(student=student).order_by('-month', '-id')
        if request.user.role != 'super_admin':
            all_student_payments = all_student_payments.filter(group__branch_id__in=allowed_branch_ids(request.user))

        return Response({
            "success": True,
            "created_count": created_count,
            "message": msg,
            "payments": PaymentSerializer(all_student_payments, many=True).data
        }, status=200)
    except (APIException, Http404):
        raise
    except Exception as e:
        return Response({"error": str(e)}, status=500)



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def offline_finance_bundle(request):
    """
    Offline-First Kassa va To'lovlar bundle:
    - Bugungi daromad va xarajatlar (today stats)
    - Joriy oyning barcha to'lovlari (incomes)
    - Joriy oyning barcha chiqimlari (withdrawals)
    - Filiallar ro'yxati
    - O'quvchilarning so'nggi to'lovlari (student-payments)
    """
    from calendar import monthrange
    user = request.user
    today = timezone.localdate()
    current_month_str = today.strftime('%Y-%m')
    start_of_month = today.replace(day=1)
    _, last_day = monthrange(today.year, today.month)
    end_of_month = today.replace(day=last_day)

    from permissions.scopes import allowed_branch_ids, require_finance_access
    if user.role not in {'super_admin', 'admin'}:
        raise PermissionDenied("Moliyaviy ma'lumotlarni ko'rishga ruxsat yo'q.")
    allowed_branches = None if user.role == 'super_admin' else sorted(allowed_branch_ids(user))
    req_branch_id = request.query_params.get('branch_id')
    if req_branch_id is not None:
        try:
            req_branch_id = int(req_branch_id)
            if not 0 < req_branch_id <= 9223372036854775807:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'error': 'branch_id musbat butun son bo\u2018lishi kerak.'}, status=400)
        require_finance_access(user, req_branch_id)
        get_object_or_404(Branch, id=req_branch_id, is_active=True)

    tx_qs = FinanceTransaction.objects.select_related(
        'marked_by', 'branch', 'student', 'group'
    ).exclude(record_type='reversal')

    if allowed_branches is not None:
        tx_qs = tx_qs.filter(branch_id__in=allowed_branches)

    from groups.models import Group
    from homework_attends.models import Attendance
    from django.db.models import Count, Sum, Q

    # 1. Bugungi kassa statistikasini bevosita PostgreSQL DB darajasida hisoblash (0-RAM, o'ta tezkor)
    today_stats_agg = tx_qs.filter(date=today).exclude(status='cancelled').aggregate(
        total_income=Sum('amount', filter=Q(transaction_type='income', category='student_fee')),
        total_verified=Sum('amount', filter=Q(transaction_type='income', category='student_fee', is_verified=True)),
        total_withdrawn=Sum('amount', filter=Q(transaction_type='expense')),
    )
    total_today = today_stats_agg['total_income'] or Decimal('0')
    total_verified = today_stats_agg['total_verified'] or Decimal('0')
    total_withdrawn = today_stats_agg['total_withdrawn'] or Decimal('0')

    # 2. Oflayn kesh uchun yetarli va ixcham hajmda tranzaksiyalarni olish (Over-fetchingni bartaraf etish)
    today_incomes_qs = list(tx_qs.filter(date=today, transaction_type='income', category='student_fee')[:100])
    today_expenses_qs = list(tx_qs.filter(date=today, transaction_type='expense')[:100])

    month_incomes_qs = list(tx_qs.filter(
        date__gte=start_of_month,
        date__lte=end_of_month,
        transaction_type='income',
        category='student_fee'
    ).order_by('-date', '-id')[:150])

    month_expenses_qs = list(tx_qs.filter(
        date__gte=start_of_month,
        date__lte=end_of_month,
        transaction_type='expense'
    ).order_by('-date', '-id')[:150])

    # Tranzaksiyalardagi to'lovlarni (Payment) bitta so'rov bilan cache qilish (N+1 oldini olish)
    payment_ids = set()
    for tx in (today_incomes_qs + month_incomes_qs):
        if tx.category == 'student_fee' and tx.related_id and tx.related_id.startswith('STP-'):
            parts = tx.related_id.split('-')
            if len(parts) >= 2 and parts[1].isdigit():
                payment_ids.add(int(parts[1]))

    payments_cache = {}
    if payment_ids:
        for p in Payment.objects.filter(id__in=payment_ids).select_related('group'):
            payments_cache[p.id] = p

    tx_context = {'request': request, 'payments_cache': payments_cache}

    today_incomes = FinanceTransactionSerializer(today_incomes_qs, many=True, context=tx_context).data
    today_expenses = FinanceTransactionSerializer(today_expenses_qs, many=True, context=tx_context).data
    month_incomes = FinanceTransactionSerializer(month_incomes_qs, many=True, context=tx_context).data
    month_expenses = FinanceTransactionSerializer(month_expenses_qs, many=True, context=tx_context).data

    # 3. Filiallar
    branch_qs = Branch.objects.filter(is_active=True)
    if allowed_branches is not None:
        branch_qs = branch_qs.filter(id__in=allowed_branches)
    branches_data = [{'id': b.id, 'name': b.name} for b in branch_qs]

    # 4. O'quvchilarning so'nggi to'lovlari (student-payments)
    payment_qs = Payment.objects.select_related('student', 'group', 'marked_by').order_by('-created_at')
    if allowed_branches is not None:
        payment_qs = payment_qs.filter(student__branch_id__in=allowed_branches)
    recent_payments = list(payment_qs[:100])

    # PaymentSerializer uchun lesson_dates va attendance keshini bitta bulk so'rovda tayyorlaymiz
    group_months = set()
    pay_group_ids = set()
    for p in recent_payments:
        if p.group_id and p.month:
            group_months.add((p.group_id, p.month.year, p.month.month))
            pay_group_ids.add(p.group_id)

    lesson_dates_cache = {}
    if pay_group_ids:
        groups_map = {
            g.id: g for g in Group.objects.filter(id__in=pay_group_ids).prefetch_related(
                'special_lesson_days', 'canceled_lesson_days'
            )
        }
        for gid, year, month in group_months:
            group = groups_map.get(gid)
            if group:
                lesson_dates_cache[(gid, year, month)] = group.get_lesson_dates(year, month)
            else:
                lesson_dates_cache[(gid, year, month)] = []

    # Davomatlarni bitta so'rovda yig'ish (attended_cache va absences_cache)
    attended_cache = {}
    absences_cache = {}
    if pay_group_ids:
        att_rows = Attendance.objects.filter(
            group_id__in=pay_group_ids,
            is_present=True,
            marked_by__isnull=False
        ).values('student_id', 'group_id', 'date__year', 'date__month').annotate(cnt=Count('id'))
        for r in att_rows:
            key = (r['student_id'], r['group_id'], r['date__year'], r['date__month'])
            attended_cache[key] = r['cnt']

        for p in recent_payments:
            if p.group_id and p.month:
                l_dates = lesson_dates_cache.get((p.group_id, p.month.year, p.month.month), [])
                active_ld = [d for d in l_dates if d <= today]
                present_c = attended_cache.get((p.student_id, p.group_id, p.month.year, p.month.month), 0)
                absences_cache[(p.student_id, p.group_id, p.month.year, p.month.month)] = max(0, len(active_ld) - present_c)

    pay_context = {
        'request': request,
        'lesson_dates_cache': lesson_dates_cache,
        'attended_cache': attended_cache,
        'absences_cache': absences_cache,
    }
    student_payments = PaymentSerializer(recent_payments, many=True, context=pay_context).data

    # 5. Faol filial uchun Cashier Desk ma'lumotlari (keraksiz 3 ta filialni paralel qurmamaslik)
    from finance.services import build_cashier_desk_dict
    cashier_desks = {}
    if req_branch_id is not None:
        target_branch_ids = [req_branch_id]
    elif request.user.branch_id:
        target_branch_ids = [request.user.branch_id]
    elif allowed_branches:
        target_branch_ids = allowed_branches[:1]
    else:
        first_b = branch_qs.first()
        target_branch_ids = [first_b.id] if first_b else []

    for b_id in target_branch_ids:
        desk_data = build_cashier_desk_dict(b_id, start_of_month, today)
        if desk_data:
            cashier_desks[str(b_id)] = desk_data

    return Response({
        'current_date': str(today),
        'current_month': current_month_str,
        'today_stats': {
            'totalToday': float(total_today),
            'totalVerified': float(total_verified),
            'totalWithdrawn': float(total_withdrawn),
        },
        'today_incomes': today_incomes,
        'today_expenses': today_expenses,
        'month_incomes': month_incomes,
        'month_expenses': month_expenses,
        'branches': branches_data,
        'student_payments': student_payments,
        'cashier_desks': cashier_desks,
    })

