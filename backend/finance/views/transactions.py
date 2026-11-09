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


class FinanceTransactionViewSet(viewsets.ModelViewSet):
    """Markaziy moliya daftari (Ledger)"""
    queryset = FinanceTransaction.objects.select_related(
        'marked_by', 'branch', 'cancelled_by', 'student', 'group'
    ).all()
    serializer_class = FinanceTransactionSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    pagination_class = StandardResultsSetPagination

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'transaction_type': ['exact'],
        'category': ['exact'],
        'branch': ['exact'],
        'status': ['exact'],           # NEW: cancelled / completed filter
        'record_type': ['exact'],      # NEW: payment / reversal / refund filter
        'date': ['exact', 'gte', 'lte']
    }
    search_fields = ['title', 'description', 'payer_name']

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if user.role == 'admin':
            allowed_branches = [user.branch_id] if user.branch_id else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            safe_branches = [int(b) for b in allowed_branches if b is not None]
            qs = qs.filter(branch_id__in=safe_branches)
        elif user.role != 'super_admin':
            return FinanceTransaction.objects.none()

        if self.request.query_params.get('exclude_reversals') == 'true':
            qs = qs.exclude(record_type='reversal')

        group_param = self.request.query_params.get('group') or self.request.query_params.get('group_id')
        if group_param:
            try:
                gid = int(group_param)
                from groups.models import Group
                p_ids = list(Payment.objects.filter(group_id=gid).values_list('id', flat=True)[:3000])
                group_q = Q(group_id=gid)
                grp = Group.objects.filter(id=gid).first()
                if grp:
                    group_q |= Q(group_name=grp.name)
                if p_ids:
                    p_qs = Q()
                    for pid in p_ids:
                        p_qs |= Q(related_id__startswith=f"STP-{pid}-") | Q(related_id=f"STP-{pid}")
                    group_q |= p_qs
                qs = qs.filter(group_q)
            except (ValueError, TypeError):
                qs = qs.filter(Q(group_name__icontains=group_param) | Q(description__icontains=group_param))

        method_param = self.request.query_params.get('payment_method') or self.request.query_params.get('method')
        if method_param:
            qs = qs.filter(Q(payment_method__iexact=method_param) | Q(description__icontains=method_param))

        return qs

    def perform_create(self, serializer):
        branch = serializer.validated_data.get('branch') or self.request.user.branch
        serializer.save(marked_by=self.request.user, branch=branch)




class AdminExpenseViewSet(viewsets.ModelViewSet):
    """
    Adminlar tomonidan kiritiladigan mayda harajatlar.
    Bu harajatlar asosiy moliya balansiga qo'shilmaydi.
    """
    queryset = AdminExpense.objects.all().select_related('branch', 'marked_by')
    serializer_class = AdminExpenseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['branch', 'date']
    search_fields = ['title', 'description']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Payment.objects.none()
        qs = super().get_queryset()
        
        # Branch filteri (query param orqali)
        branch_id = self.request.query_params.get('branch_id')
        
        if user.role == 'super_admin':
            return qs.filter(branch_id=branch_id) if branch_id else qs
            
        if user.role == 'admin':
            # Admin faqat o'z filialidagi harajatlarni ko'radi
            allowed_branches = [user.branch.id] if user.branch else []
            if hasattr(user, 'branch_accesses'):
                allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
            
            qs = qs.filter(branch_id__in=allowed_branches)
            return qs.filter(branch_id=branch_id) if branch_id else qs
            
        return qs.none()

    def perform_create(self, serializer):
        # Filialni avtomatik aniqlash (agar berilmagan bo'lsa)
        user = self.request.user
        branch = serializer.validated_data.get('branch')
        if not branch and user.role == 'admin':
            branch = user.branch
            
        serializer.save(marked_by=user, branch=branch)

