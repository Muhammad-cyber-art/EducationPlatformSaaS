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


class FinanceDashboardView(APIView):
    """Moliya dashboardi statistikasi"""
    permission_classes = [IsAuthenticated, HasModulePermission] 
    module_name = 'finance'
    serializer_class = FinanceDashboardSerializer

    def get(self, request):
        try:
            month, year = _parse_month_year(request.query_params)
            data = get_finance_dashboard_stats(request.user, month, year)
            return Response(data)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            logger.exception("Dashboard error")
            return Response({
                "total_income": 0.0,
                "total_expense": 0.0,
                "net_profit": 0.0,
                "total_debt": 0.0,
                "pending_income": 0.0,
                "total_attendance_refunds": 0.0,
                "total_attendance_refunds_paid": 0.0,
                "refund_share_percent": 0.0,
                "income_trend": 0.0,
                "expense_trend": 0.0,
                "profit_trend": 0.0,
                "branches": [],
                "top_groups": [],
                "stats": {
                    "students": 0,
                    "mentors": 0,
                    "groups": 0,
                    "admins": 0,
                    "attendance_today": {"absent": 0, "total": 0}
                },
                "warning": "Dashboard ma'lumotlari vaqtincha to'liq emas"
            }, status=200)



class BranchFinanceDetailView(APIView):
    """Filial bo'yicha batafsil moliya"""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    serializer_class = BranchFinanceDetailSerializer

    def get(self, request, branch_id):
        try:
            # Moliya bo'limiga faqat super_admin kira oladi, shuning uchun barcha filiallarni ko'radi
            month, year = _parse_month_year(request.query_params)
            data = get_branch_finance_stats(branch_id, month, year)
            return Response(data)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            logger.exception("Branch stats error")
            return Response({
                "branch": {"id": int(branch_id), "name": "Noma'lum filial"},
                "stats": {
                    "mentors": 0, "admins": 0, "groups": 0, "students": 0,
                    "attendance_today": {"absent": 0, "total": 0}
                },
                "finance": {
                    "expected_income": 0.0, "received_income": 0.0,
                    "pending_income": 0.0,
                    "refunds": 0.0, "attendance_refunds": 0.0,
                    "attendance_refunds_paid": 0.0, "refund_share_percent": 0.0,
                    "real_revenue": 0.0, "expenses": 0.0, "net_profit": 0.0
                },
                "groups": [],
                "warning": "Filial statistikasi vaqtincha to'liq emas"
            }, status=200)



class AbsentTodayStudentsView(APIView):
    """Bugun darsga kelmagan o'quvchilar ro'yxati"""
    permission_classes = [IsAuthenticated]
    serializer_class = AbsentStudentSerializer

    def get(self, request, branch_id):
        try:
            user = request.user
            # Permission check
            if user.role == 'admin':
                allowed_branches = [user.branch_id] if user.branch_id else []
                if hasattr(user, 'branch_accesses'):
                    allowed_branches.extend(
                        user.branch_accesses.values_list('branch_id', flat=True)
                    )
                # None bo'lishi mumkin bo'lgan qiymatlarni int'ga o'girish xavfsiz
                safe_branches = [int(b) for b in allowed_branches if b is not None]
                if int(branch_id) not in safe_branches:
                    return Response({"error": "Ruxsat yo'q"}, status=403)

            today = timezone.localdate()
            search = request.query_params.get('search', '').strip()
            export_mode = request.query_params.get('export', 'json')

            # "Absent" ro'yxati student kesimida: agar student bugun hech bo'lmasa bitta guruhda
            # kelgan bo'lsa, u kelmaganlar ro'yxatiga tushmasligi kerak.
            base_qs = Attendance.objects.filter(group__branch_id=branch_id, date=today)
            present_ids = base_qs.filter(
                is_present=True,
                student__isnull=False
            ).values_list('student_id', flat=True).distinct()

            queryset = base_qs.filter(is_present=False).exclude(
                student_id__in=present_ids
            ).select_related('student', 'group')

            if search:
                # Snapshot fieldlarda ham qidirish (student o'chirilgan bo'lsa ham ishlaydi)
                queryset = queryset.filter(
                    Q(student__full_name__icontains=search) |
                    Q(student__phone__icontains=search) |
                    Q(group__name__icontains=search) |
                    Q(student_full_name__icontains=search) |
                    Q(group_name__icontains=search)
                )

            # 1. Takrorlanmasligi uchun avval barchasini Python'da filterlaymiz
            # Bu yerda recordlar soni kunlik hisobda bo'lgani uchun tez ishlaydi
            seen_students = set()
            unique_results = []
            for att in queryset:
                student_id = att.student_id
                if student_id is None:
                    continue

                if student_id in seen_students:
                    continue
                seen_students.add(student_id)

                if att.student is not None:
                    name = att.student.full_name
                    phone = att.student.phone or ""
                else:
                    name = att.student_full_name or ""
                    phone = ""

                if att.group is not None:
                    group_name = att.group.name
                else:
                    group_name = att.group_name or ""

                unique_results.append({
                    "id": student_id,
                    "name": name,
                    "phone": phone,
                    "group": group_name,
                })

            if export_mode == 'excel':
                branch = Branch.objects.get(id=branch_id)
                # Export ga ham filterlangan (takrorlanmagan) listni beramiz
                return export_absent_students_to_excel(unique_results, branch.name)

            paginator = HeavyResultsSetPagination()
            # unique_results oddiy python list bo'lsa ham DRF Paginator bemalol ishlaydi
            paginated_results = paginator.paginate_queryset(unique_results, request, view=self)

            return paginator.get_paginated_response(paginated_results)

        except Exception:
            logger.exception(
                "AbsentTodayStudentsView xatosi. branch_id=%s", branch_id
            )
            return Response(
                {"error": "Server xatosi yuz berdi. Iltimos, keyinroq urinib ko'ring."},
                status=500
            )




class MonthlyBranchTrendsView(APIView):
    """Filiallar bo'yicha oylik tushum/chiqim trendi."""
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    serializer_class = SuccessSerializer

    def get(self, request):
        try:
            month, year = _parse_month_year(request.query_params)
            months_back = request.query_params.get('months_back', 6)
            data = get_monthly_branch_trends(request.user, month, year, months_back)
            return Response(data)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception:
            logger.exception("Monthly branch trends error")
            return Response({"months": [], "branches": []}, status=200)



from drf_spectacular.utils import extend_schema
@extend_schema(request=None, responses={200: SuccessSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_monthly_payments(request):
    try:
        count = generate_monthly_payments()
        return Response({'success': True, 'count': count}, status=200)
    except Exception as e:
        return Response({'success': False, 'message': str(e)}, status=500)



@extend_schema(responses={200: PaymentStatisticsSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_statistics_view(request):
    """Har bir guruh uchun to'lov statistikasi (N+1 optimallashtirilgan)"""
    from django.utils import timezone
    from django.db.models import Count, Q

    branch_id = request.query_params.get('branch_id')
    today = timezone.localdate()
    month_start = today.replace(day=1)

    # OPTIMIZATSIYA: annotate bilan student count ni birga olish
    groups_qs = Group.objects.filter(is_faol=True).select_related('branch').annotate(
        st_count=Count('enrollments', filter=Q(enrollments__is_active=True))
    )
    if branch_id:
        groups_qs = groups_qs.filter(branch_id=branch_id)

    # OPTIMIZATSIYA: Barcha to'lovlarni BIR so'rovda guruhlab olish
    all_group_ids = list(groups_qs.values_list('id', flat=True))
    payment_stats = {}
    if all_group_ids:
        stats_qs = Payment.objects.filter(
            group_id__in=all_group_ids, month=month_start
        ).values('group_id', 'is_paid').annotate(cnt=Count('id'))
        for row in stats_qs:
            gid = row['group_id']
            if gid not in payment_stats:
                payment_stats[gid] = {'paid': 0, 'unpaid': 0}
            if row['is_paid']:
                payment_stats[gid]['paid'] = row['cnt']
            else:
                payment_stats[gid]['unpaid'] = row['cnt']

    groups_data = []
    for group in groups_qs:
        students_count = group.st_count
        ps = payment_stats.get(group.id, {'paid': 0, 'unpaid': 0})
        paid_count = ps['paid']
        unpaid_count = ps['unpaid']
        no_payment = max(0, students_count - paid_count - unpaid_count)

        groups_data.append({
            "id": group.id,
            "name": group.name,
            "students_count": students_count,
            "paid_count": paid_count,
            "unpaid_count": unpaid_count + no_payment,
            "payment_rate": round((paid_count / students_count * 100) if students_count > 0 else 0, 1)
        })

    total_groups = len(groups_data)
    total_students = sum(g['students_count'] for g in groups_data)
    total_paid = sum(g['paid_count'] for g in groups_data)
    total_unpaid = sum(g['unpaid_count'] for g in groups_data)
    avg_rate = round((total_paid / total_students * 100) if total_students > 0 else 0, 1)

    return Response({
        "groups": groups_data,
        "statistics": {
            "total_groups": total_groups,
            "total_students": total_students,
            "total_paid": total_paid,
            "total_unpaid": total_unpaid,
            "completion_rate": avg_rate
        }
    })

