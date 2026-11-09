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


class EmployeePaymentFilter(django_filters.FilterSet):
    employee_role = django_filters.CharFilter(field_name='employee__role')
    employee_branch = django_filters.NumberFilter(field_name='employee__branch_id')

    class Meta:
        model = EmployeePayment
        fields = {
            'is_paid': ['exact'],
            'month': ['exact', 'gte', 'lte'],
            'employee': ['exact'],
        }


class EmployeePaymentViewSet(viewsets.ModelViewSet):
    """Xodimlar maoshlarini boshqarish"""
    queryset = EmployeePayment.objects.select_related('employee', 'employee__branch', 'marked_by').all()
    serializer_class = EmployeePaymentSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = EmployeePaymentFilter
    search_fields = ['employee__first_name', 'employee__last_name', 'employee__username']
    ordering_fields = ['month', 'salary_base']
    ordering = ['-month']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return EmployeePayment.objects.none()
        qs = super().get_queryset()
        if user.role == 'admin':
            return qs.filter(employee__branch=user.branch)
        elif user.role != 'super_admin':
            return qs.filter(employee=user)
        return qs

    def get_serializer_context(self):
        """OPTIMIZATSIYA: Serializer uchun batch-prefetched ma'lumotlarni tayyorlash"""
        context = super().get_serializer_context()
        # Faqat list, retrieve, kpi va paid_students uchun prefetch qilish
        if self.action not in ('list', 'retrieve', 'kpi', 'paid_students'):
            return context
        # Lite mode flagini context ga qo'shamiz
        context['lite'] = getattr(self, '_lite_mode', False)
        try:
            queryset = self.filter_queryset(self.get_queryset())
            if self.action == 'list':
                page = self.paginate_queryset(queryset)
                items = page if page is not None else list(queryset)
            elif self.kwargs.get(getattr(self, 'lookup_url_kwarg', None) or getattr(self, 'lookup_field', None) or 'pk'):
                items = [self.get_object()]
            else:
                items = []

            if not items:
                return context

            # 1. Unique (employee_id, month) juftliklarini yig'ish
            employee_months = set()
            employee_ids = set()
            for ep in items:
                employee_months.add((ep.employee_id, str(ep.month)))
                employee_ids.add(ep.employee_id)
            
            # --- START BATCH PREFETCH UNPAID HISTORY ---
            if self.action in ('retrieve', 'kpi', 'paid_students'):
                # Faqat bitta employee uchun o'tgan to'lanmagan oylarni ham qo'shamiz
                unpaid_qs = EmployeePayment.objects.filter(
                    employee_id=items[0].employee_id, 
                    is_paid=False
                )
                for up in unpaid_qs:
                    employee_months.add((up.employee_id, str(up.month)))
            # --- END BATCH PREFETCH UNPAID HISTORY ---

            # 2. Har bir xodim uchun guruhlar (mentor/admin)
            from django.contrib.auth import get_user_model
            User = get_user_model()
            employees = {u.id: u for u in User.objects.filter(id__in=employee_ids).select_related('branch', 'staff_profile')}

            mentor_ids = [
                uid for uid, u in employees.items() 
                if u.role == 'mentor' and (
                    not hasattr(u, 'staff_profile') or u.staff_profile.salary_type != 'fixed'
                )
            ]
            admin_branch_ids = list(set(
                u.branch_id for uid, u in employees.items()
                if u.role == 'admin' and u.branch_id and (
                    not hasattr(u, 'staff_profile') or u.staff_profile.salary_type != 'fixed'
                )
            ))

            # Guruhlarni yig'ish
            groups_qs = Group.objects.none()
            if mentor_ids:
                groups_qs = groups_qs | Group.objects.filter(mentor_id__in=mentor_ids)
            if admin_branch_ids:
                groups_qs = groups_qs | Group.objects.filter(branch_id__in=admin_branch_ids)
            groups_qs = groups_qs.select_related('branch', 'mentor').prefetch_related(
                'special_lesson_days', 'canceled_lesson_days'
            )

            employee_groups = {}  # employee_id -> [Group]
            group_by_id = {}
            for g in groups_qs:
                group_by_id[g.id] = g
                if g.mentor_id in employee_ids:
                    employee_groups.setdefault(g.mentor_id, []).append(g)
            for uid, u in employees.items():
                if u.role == 'admin' and u.branch_id:
                    for g in groups_qs:
                        if g.branch_id == u.branch_id and g.id not in [
                            gg.id for gg in employee_groups.get(uid, [])
                        ]:
                            employee_groups.setdefault(uid, []).append(g)

            # 3. Lesson dates cache (har guruh va har oy uchun aniq saqlanadi)
            lesson_dates_cache = {}
            for g in groups_qs:
                for (eid, month_str) in employee_months:
                    if eid in employee_groups and g.id in [
                        gg.id for gg in employee_groups.get(eid, [])
                    ]:
                        parts = month_str.split('-')
                        y, m = int(parts[0]), int(parts[1])
                        cache_key = (g.id, y, m)
                        if cache_key not in lesson_dates_cache:
                            ldates = g.get_lesson_dates(y, m)
                            lesson_dates_cache[cache_key] = ldates
                            # Faqat ko'rilayotgan oylik (asosiy item) bo'lsagina legacy g.id kalitiga yozamiz
                            if items and y == items[0].month.year and m == items[0].month.month:
                                lesson_dates_cache[g.id] = ldates

            # 4. Payments batch (OY BO'YICHA IZOLYATSIYA - oylar aro to'lovlar aralashib ketmasligi uchun)
            payment_conditions = Q()
            for eid, month_str in employee_months:
                parts = month_str.split('-')
                month_date = f"{parts[0]}-{parts[1]}-01"
                g_ids = [g.id for g in employee_groups.get(eid, [])]
                if g_ids:
                    payment_conditions |= Q(group_id__in=g_ids, month=month_date)

            payment_map_by_month = {}  # (y, m) -> {(student_id, group_id): p}
            payment_map_global = {}    # fallback va composite kalit
            if payment_conditions != Q():
                for p in Payment.objects.filter(
                    payment_conditions
                ).select_related('student'):
                    if p.month:
                        ym = (p.month.year, p.month.month)
                        payment_map_by_month.setdefault(ym, {})[(p.student_id, p.group_id)] = p
                        payment_map_global[(p.student_id, p.group_id, ym[0], ym[1])] = p
                    payment_map_global[(p.student_id, p.group_id)] = p

            # 5. Extra transactions batch (OY BO'YICHA IZOLYATSIYA)
            extras_map_by_month = {}  # (y, m) -> {(student_id, group_id): Decimal}
            extras_map_global = {}
            if payment_conditions != Q():
                extra_conditions = Q(category='student_extra')
                date_conds = Q()
                for eid, month_str in employee_months:
                    parts = month_str.split('-')
                    date_conds |= Q(date__year=int(parts[0]), date__month=int(parts[1]))
                extra_conditions &= date_conds
                for tx in FinanceTransaction.objects.filter(extra_conditions).values(
                    'student_id', 'group_id', 'transaction_type', 'amount', 'date'
                ):
                    key = (tx['student_id'], tx['group_id'])
                    amt = Decimal(str(tx['amount'] or 0))
                    d = tx.get('date')
                    if d:
                        ym = (d.year, d.month)
                        cur_month_map = extras_map_by_month.setdefault(ym, {})
                        if tx['transaction_type'] == 'income':
                            cur_month_map[key] = cur_month_map.get(key, Decimal('0')) + amt
                        else:
                            cur_month_map[key] = cur_month_map.get(key, Decimal('0')) - amt
                    if tx['transaction_type'] == 'income':
                        extras_map_global[key] = extras_map_global.get(key, Decimal('0')) + amt
                    else:
                        extras_map_global[key] = extras_map_global.get(key, Decimal('0')) - amt

            # 6. Attendance cache (har oy va har guruh uchun)
            all_group_ids = list(group_by_id.keys())
            attendance_cache = {}
            if all_group_ids:
                for month_str in set(m for _, m in employee_months):
                    parts = month_str.split('-')
                    y, m = int(parts[0]), int(parts[1])
                    for row in Attendance.objects.filter(
                        group_id__in=all_group_ids,
                        date__year=y,
                        date__month=m,
                        is_present=True,
                    ).filter(
                        Q(marked_by__isnull=False) | Q(is_manually_adjusted=True)
                    ).values('group_id', 'student_id'):
                        k_month = (row['group_id'], row['student_id'], y, m)
                        attendance_cache[k_month] = attendance_cache.get(k_month, 0) + 1
                        k_legacy = (row['group_id'], row['student_id'])
                        attendance_cache[k_legacy] = attendance_cache.get(k_legacy, 0) + 1

            # 7. Enrollment cache — FAQAT FAOL o'quvchilar (is_active=True)
            enrollment_cache = {}
            _join_dates = {}
            if all_group_ids:
                # --- N+1 FIX: Dastlab barcha guruhlar uchun bo'sh dictionary ochamiz ---
                for gid in all_group_ids:
                    enrollment_cache[gid] = {}
                
                for enr in GroupEnrollment.objects.filter(
                    group_id__in=all_group_ids,
                    is_active=True
                ).select_related('student'):
                    if enr.student:
                        enrollment_cache[enr.group_id][enr.student.id] = enr.student
                    if enr.joined_at:
                        _join_dates[(enr.student_id, enr.group_id)] = enr.joined_at.date()
            enrollment_cache['_join_dates'] = _join_dates

            # Legacy old_students_fk (eski tizimdan qolgan o'quvchilar)
            # Guruhdan chiqarilgan (is_active=False enrollment bor) o'quvchilarni filtrlaymiz
            _inactive_student_group_pairs = set(
                GroupEnrollment.objects.filter(
                    group_id__in=all_group_ids,
                    is_active=False
                ).values_list('student_id', 'group_id')
            )
            for st in Student.objects.filter(
                group_id__in=all_group_ids,
                is_active=True,
                is_archived=False
            ).only('id', 'custom_fee', 'status', 'full_name', 'joined_at', 'group_id', 'phone', 'is_frozen', 'color'):
                gid = st.group_id
                if (st.id, gid) in _inactive_student_group_pairs:
                    continue
                enrollment_cache[gid][st.id] = st

            # 8. Salary configs
            _salary_configs = {}
            if mentor_ids:
                for sc in MentorGroupSalaryConfig.objects.filter(
                    mentor_id__in=mentor_ids, group_id__in=all_group_ids
                ):
                    _salary_configs[(sc.mentor_id, sc.group_id)] = sc
            enrollment_cache['_salary_configs'] = _salary_configs

            # 9. Advances batch
            from finance.models import EmployeeAdvance
            current_month = timezone.localdate().replace(day=1)
            advances_map = {}
            for adv in EmployeeAdvance.objects.filter(
                employee_id__in=employee_ids, month=current_month
            ).order_by('-created_at'):
                key = (adv.employee_id, str(adv.month))
                advances_map.setdefault(key, []).append(adv)

            context['employee_prefetch'] = {
                'employee_groups': employee_groups,
                'payment_map_by_month': payment_map_by_month,
                'extras_map_by_month': extras_map_by_month,
                'payment_map': payment_map_global,
                'extras_map': extras_map_global,
                'lesson_dates_cache': lesson_dates_cache,
                'attendance_cache': attendance_cache,
                'enrollment_cache': enrollment_cache,
                'advances_map': advances_map,
            }
        except Exception as e:
            logger.error(f"EmployeePayment prefetch error: {e}")
        return context

    def retrieve(self, request, *args, **kwargs):
        """Lite mode support: ?lite=true bo'lsa og'ir hisob-kitoblar o'tkazib yuboriladi"""
        self._lite_mode = request.query_params.get('lite', 'false').lower() == 'true'
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='kpi')
    def kpi(self, request, pk=None):
        """Og'ir KPI ma'lumotlarini alohida qaytaradi (progressive loading uchun)"""
        payment = self.get_object()
        self._lite_mode = False  # KPI uchun to'liq hisob
        context = self.get_serializer_context()
        context['lite'] = False
        temp_s = EmployeePaymentSerializer(payment, context=context)
        return Response({
            'id': payment.id,
            'salary_base': float(payment.salary_base or 0),
            'groups_income': temp_s.get_groups_income(payment),
            'groups_income_expected': temp_s.get_groups_income_expected(payment),
            'calculated_commission': temp_s.get_calculated_commission(payment),
            'calculated_commission_expected': temp_s.get_calculated_commission_expected(payment),
            'calculated_per_student': temp_s.get_calculated_per_student(payment),
            'mentor_groups': temp_s.get_mentor_groups(payment),
        })

    @action(detail=False, methods=['get'], url_path='current')
    def current(self, request):
        """Get the current month's employee payment for the logged-in user."""
        today = timezone.localdate()
        current_month = today.replace(day=1)
        qs = self.get_queryset().filter(month=current_month)
        payment = qs.first()
        if payment:
            return Response(EmployeePaymentSerializer(payment).data)
        return Response({"detail": "Current month payment not found."}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        payment = self.get_object()
        if payment.is_paid:
            return Response({"detail": "Allaqachon to'langan"}, status=400)
        
        if request.user.role != 'super_admin':
            return Response({"detail": "Faqat super admin tasdiqlay oladi"}, status=403)
            
        bonus = request.data.get('bonus', 0)
        deductions = request.data.get('deductions', 0)
        commission_basis = str(request.data.get('commission_basis', 'paid')).lower()
        if commission_basis not in ['paid', 'expected']:
            commission_basis = 'paid'
        
        payment.mark_as_paid(
            super_admin_user=request.user,
            bonus=bonus,
            deductions=deductions,
            commission_basis=commission_basis
        )
            
        return Response({"status": "success", "data": EmployeePaymentSerializer(payment).data})

    @action(detail=True, methods=['post'], url_path='recalculate')
    def recalculate(self, request, pk=None):
        """Xodim maoshini qayta hisoblash (masalan, o'quvchilar soni o'zgarganda)"""
        payment = self.get_object()
        if payment.is_paid:
            return Response({"error": "To'langan maoshni qayta hisoblab bo'lmaydi"}, status=400)
        
        # Optional: commission_basis parameter for recalculation
        commission_basis = str(request.data.get('commission_basis', 'paid')).lower()
        if commission_basis not in ['paid', 'expected']:
            commission_basis = 'paid'
        
        try:
            payment.recalculate_salary(commission_basis=commission_basis)
            payment.save()
            return Response({
                "status": "success",
                "message": "Maosh muvaffaqiyatli qayta hisoblandi",
                "data": EmployeePaymentSerializer(payment).data
            })
        except Exception as e:
            logger.error(f"Recalculate error: {e}")
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['post'], url_path='add-advance')
    def add_advance(self, request, pk=None):
        """Ushbu oydagi maosh uchun avans qo'shish"""
        payment = self.get_object()
        amount = request.data.get('amount')
        description = request.data.get('description', '')

        if not amount:
            return Response({"error": "Avans summasini kiritish shart"}, status=400)

        try:
            with transaction.atomic():
                EmployeeAdvance.objects.create(
                    employee=payment.employee,
                    month=payment.month,
                    amount=Decimal(str(amount)),
                    description=description,
                    marked_by=request.user
                )

            return Response({
                "status": "success",
                "message": "Avans muvaffaqiyatli qo'shildi",
                "data": EmployeePaymentSerializer(payment).data
            })
        except Exception as e:
            logger.error(f"Add advance error: {e}")
            return Response({"error": str(e)}, status=400)

    @action(detail=True, methods=['get'], url_path='paid-students')
    def paid_students(self, request, pk=None):
        """
        Xodimning ushbu oydagi to'lovni amalga oshirgan barcha o'quvchilari ro'yxati va ulushlari.
        N+1 muammosi oldi olingan (barcha guruhlar, to'lovlar va davomatlar context orqali prefetch qilinadi).
        """
        try:
            payment = self.get_object()
            self._lite_mode = False
            context = self.get_serializer_context()
            context['lite'] = False
            temp_s = EmployeePaymentSerializer(payment, context=context)
            mentor_groups = temp_s.get_mentor_groups(payment)

            from collections import defaultdict
            from homework_attends.models import Attendance
            from finance.models import AttendanceAuditLog
            from groups.models import Group

            all_paid_students = []
            groups_summary = []
            total_paid_collected = Decimal('0')
            total_mentor_share = Decimal('0')
            total_center_margin = Decimal('0')
            total_lessons_planned = 0
            total_lessons_attended = 0

            status_counts = {
                'discount': 0,
                'low_income': 0,
                'negotiated': 0,
                'teacher_negotiated': 0,
                'regular': 0,
                'archived': 0,
            }

            profile = getattr(payment.employee, 'staff_profile', None)
            default_salary_type = profile.salary_type if profile else 'fixed'

            # 1. Guruhlarning rejadagi dars kunlari (Context prefetch keshidan olish)
            group_ids = [g.get('id') for g in mentor_groups if g.get('id')]
            pf = context.get('employee_prefetch', {})
            lesson_dates_cache = pf.get('lesson_dates_cache', {})
            group_dates_map = {}
            missing_gids = []
            for gid in group_ids:
                cache_key = (gid, payment.month.year, payment.month.month)
                if cache_key in lesson_dates_cache:
                    group_dates_map[gid] = lesson_dates_cache[cache_key]
                elif gid in lesson_dates_cache and isinstance(lesson_dates_cache[gid], list):
                    dates = lesson_dates_cache[gid]
                    if dates and dates[0].year == payment.month.year and dates[0].month == payment.month.month:
                        group_dates_map[gid] = dates
                    else:
                        missing_gids.append(gid)
                else:
                    missing_gids.append(gid)
            if missing_gids:
                for grp in Group.objects.filter(id__in=missing_gids).prefetch_related('special_lesson_days', 'canceled_lesson_days'):
                    dates = grp.get_lesson_dates(payment.month.year, payment.month.month)
                    group_dates_map[grp.id] = dates
                    lesson_dates_cache[(grp.id, payment.month.year, payment.month.month)] = dates

            # 2. Barcha o'quvchilar ro'yxati (to'laganlar + barcha maxsus maqomdagilar)
            candidates_map = {}
            for g in mentor_groups:
                gid = g.get('id')
                g_name = g.get('name')
                g_price = g.get('monthly_price')
                for s in g.get('paid_students', []):
                    s['group_id'] = gid
                    s['group_name'] = g_name
                    s['group_monthly_price'] = g_price
                    candidates_map[(s.get('id'), gid)] = s

                # Guruhning BARCHA o'quvchilarini (to'lamaganlarni ham) qo'shamiz
                for unp in g.get('unpaid_students', []):
                    key = (unp.get('id'), gid)
                    if key not in candidates_map:
                        unp['group_id'] = gid
                        unp['group_name'] = g_name
                        unp['group_monthly_price'] = g_price
                        candidates_map[key] = unp

            student_ids = list({sid for sid, gid in candidates_map.keys() if sid})

            # 3. 1 ta SQL so'rov bilan barcha talabalarning davomatini olish (Indekslangan date__range)
            import calendar
            from datetime import date
            _, last_day = calendar.monthrange(payment.month.year, payment.month.month)
            month_start = date(payment.month.year, payment.month.month, 1)
            month_end = date(payment.month.year, payment.month.month, last_day)

            att_map = defaultdict(list)
            if student_ids and group_ids:
                att_qs = Attendance.objects.filter(
                    student_id__in=student_ids,
                    group_id__in=group_ids,
                    date__range=(month_start, month_end),
                ).filter(
                    Q(marked_by__isnull=False) | Q(is_manually_adjusted=True)
                ).values('student_id', 'group_id', 'date', 'is_present', 'is_manually_adjusted')
                for a in att_qs:
                    att_map[(a['student_id'], a['group_id'])].append(a)

            # 4. 1 ta SQL so'rov bilan barcha audit loglarini olish (Zero N+1)
            audit_map = {}
            if student_ids and group_ids:
                audit_qs = AttendanceAuditLog.objects.filter(
                    student_id__in=student_ids,
                    group_id__in=group_ids,
                    month=payment.month,
                ).select_related('modified_by').order_by('-created_at')
                for al in audit_qs:
                    key = (al.student_id, al.group_id)
                    if key not in audit_map:
                        audit_map[key] = {
                            'id': al.id,
                            'modified_by': al.modified_by.get_full_name() or al.modified_by.username if al.modified_by else "Admin",
                            'created_at': al.created_at.strftime("%Y-%m-%d %H:%M") if al.created_at else None,
                            'previous_attended_count': al.previous_attended_count,
                            'new_attended_count': al.new_attended_count,
                            'previous_teacher_share': float(al.previous_teacher_share or 0),
                            'new_teacher_share': float(al.new_teacher_share or 0),
                            'previous_state_receivable': float(al.previous_state_receivable or 0),
                            'new_state_receivable': float(al.new_state_receivable or 0),
                            'reason_for_change': al.reason_for_change or "",
                        }

            # 5. Guruhlar xulosasi va o'quvchilarni boyitish
            total_paid_collected = Decimal('0')
            total_mentor_share = Decimal('0')
            total_center_margin = Decimal('0')
            total_estimated_state_receivable = Decimal('0')
            total_estimated_center_margin = Decimal('0')
            total_lessons_planned = 0
            total_lessons_attended = 0

            for g in mentor_groups:
                g_paid = g.get('paid_students', [])
                g_unpaid = g.get('unpaid_students', [])
                g_real_paid = [s for s in g_paid if s.get('financial_status') != 'discount']
                g_discount = [s for s in g_paid if s.get('financial_status') == 'discount']
                g_debtors = [s for s in g_unpaid if s.get('financial_status') != 'discount']

                g_total_paid = sum(Decimal(str(s.get('actual', 0))) for s in g_real_paid)
                g_total_share = sum(Decimal(str(s.get('mentor_share', 0))) for s in g_paid)
                g_est_state = sum(Decimal(str(s.get('actual', 0))) for s in g_discount)

                groups_summary.append({
                    'id': g.get('id'),
                    'name': g.get('name'),
                    'monthly_price': g.get('monthly_price'),
                    'paid_students_count': len(g_real_paid),
                    'discount_students_count': len(g_discount),
                    'debtors_count': len(g_debtors),
                    'total_students_count': g.get('students_count', 0),
                    'total_paid_amount': float(g_total_paid),
                    'total_mentor_share': float(g_total_share),
                    'total_estimated_state_receivable': float(g_est_state),
                })

            for (sid, gid), s in candidates_map.items():
                lesson_dates = group_dates_map.get(gid, [])
                st_atts = att_map.get((sid, gid), [])
                attended_dates = {
                    a['date'] for a in st_atts 
                    if a['is_present']
                }
                n_attended = len(attended_dates)
                n_total = len(lesson_dates) if lesson_dates else 1
                if n_attended > n_total:
                    n_total = n_attended
                has_manual = any(a.get('is_manually_adjusted') for a in st_atts)
                att_rate = round((n_attended / n_total * 100), 1) if n_total > 0 else 0.0

                fin_status = s.get('financial_status', 'regular')
                is_discount = fin_status == 'discount'
                is_teacher_neg = fin_status == 'teacher_negotiated'

                paid_amt = Decimal(str(s.get('actual', 0.0) or s.get('paid_amount', 0.0)))
                mentor_share_amt = Decimal(str(s.get('mentor_share', 0.0)))
                contract_amt = Decimal(str(s.get('contract_amount', 0.0) or s.get('group_monthly_price', 0.0)))

                is_debtor = bool(paid_amt == 0 and not is_discount)
                is_partial = bool(paid_amt > 0 and paid_amt < contract_amt and not is_discount)

                if is_discount:
                    raw_daily = contract_amt / Decimal(str(n_total)) if n_total > 0 else Decimal('0')
                    state_receivable = round(raw_daily * Decimal(str(n_attended)))
                    if state_receivable > contract_amt:
                        state_receivable = contract_amt
                    est_center_margin = max(Decimal('0'), state_receivable - mentor_share_amt)
                    total_estimated_state_receivable += state_receivable
                    total_estimated_center_margin += est_center_margin
                    center_margin = None
                    student_paid_amount = 0.0
                    student_state_receivable = None
                else:
                    state_receivable = paid_amt
                    center_margin = max(Decimal('0'), state_receivable - mentor_share_amt)
                    total_paid_collected += paid_amt
                    total_center_margin += center_margin
                    est_center_margin = None
                    student_paid_amount = float(paid_amt)
                    student_state_receivable = float(paid_amt)

                total_mentor_share += mentor_share_amt
                total_lessons_planned += n_total
                total_lessons_attended += n_attended

                if fin_status in status_counts:
                    status_counts[fin_status] += 1
                else:
                    status_counts['regular'] += 1

                sal_type = s.get('salary_type') or default_salary_type
                sal_rate = s.get('salary_rate', 0.0)
                if sal_type == 'percentage':
                    rate_display = f"{sal_rate}%"
                    type_label = "Foizli ulush"
                elif sal_type == 'student_count':
                    rate_display = f"{int(sal_rate):,} UZS / o'quvchi".replace(",", " ")
                    type_label = "Har bir o'quvchi uchun"
                else:
                    rate_display = "Fiksatsiyalangan"
                    type_label = "Belgilangan oylik"

                st_audit = audit_map.get((sid, gid))

                all_paid_students.append({
                    'id': sid,
                    'name': s.get('name'),
                    'phone': s.get('phone', ''),
                    'status': fin_status,
                    'status_label': s.get('financial_status_label', "Oddiy"),
                    'group_id': gid,
                    'group_name': s.get('group_name') or "Guruh",
                    'group_monthly_price': float(s.get('group_monthly_price') or 0),
                    'custom_fee': float(s.get('negotiated_price')) if s.get('negotiated_price') is not None else None,
                    'contract_amount': float(contract_amt),
                    'paid_amount': student_paid_amount,
                    'mentor_share': float(mentor_share_amt),
                    'expected': float(s.get('expected', 0.0)),
                    'n_total': n_total,
                    'n_attended': n_attended,
                    'attendance_rate': att_rate,
                    'has_manual_adjustment': has_manual,
                    'state_receivable_amount': student_state_receivable,
                    'estimated_state_receivable': float(state_receivable) if is_discount else None,
                    'center_gross_margin': float(center_margin) if center_margin is not None else None,
                    'estimated_center_margin': float(est_center_margin) if est_center_margin is not None else None,
                    'salary_type': sal_type,
                    'salary_rate': float(sal_rate),
                    'teacher_rate_display': rate_display,
                    'teacher_salary_type_label': type_label,
                    'paid_at': s.get('paid_at'),
                    'payment_method': "Davlat puli" if is_discount else (s.get('payment_method') or ("To'lanmagan" if is_debtor else "Kassa")),
                    'is_attendance_based': is_discount,
                    'mentor_salary_excluded': is_teacher_neg,
                    'refund_amount': float(s.get('refund_amount', 0.0)),
                    'refund_ignored': s.get('refund_ignored', False),
                    'is_debtor': is_debtor,
                    'is_partial': is_partial,
                    'remaining_debt': float(max(Decimal('0'), contract_amt - paid_amt)) if not is_discount else 0.0,
                    'last_audit_log': st_audit,
                })

            employee_name = f"{payment.employee.first_name} {payment.employee.last_name}".strip() or payment.employee.username

            month_name_uz = {
                1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel", 5: "May", 6: "Iyun",
                7: "Iyul", 8: "Avgust", 9: "Sentabr", 10: "Oktabr", 11: "Noyabr", 12: "Dekabr"
            }
            month_display = f"{month_name_uz.get(payment.month.month, '')} {payment.month.year}" if payment.month else ""

            # Xodimning boshqa to'lov oylari (foydalanuvchi oylar aro qulay o'tishi uchun)
            other_payments = EmployeePayment.objects.filter(
                employee_id=payment.employee_id
            ).order_by('-month')

            available_months = [
                {
                    'id': op.id,
                    'month': str(op.month),
                    'month_display': f"{month_name_uz.get(op.month.month, '')} {op.month.year}" if op.month else str(op.month),
                    'is_paid': op.is_paid,
                    'is_current': op.id == payment.id,
                }
                for op in other_payments
            ]

            return Response({
                'payment_id': payment.id,
                'employee_id': payment.employee_id,
                'employee_name': employee_name,
                'employee_role': payment.employee.role,
                'month': str(payment.month),
                'month_display': month_display,
                'available_months': available_months,
                'salary_type': default_salary_type,
                'salary_base': float(payment.salary_base or 0),
                'total_students_count': len(all_paid_students),
                'total_debtors_count': sum(1 for st in all_paid_students if st.get('is_debtor')),
                'total_paid_amount': float(total_paid_collected),
                'total_mentor_share': float(total_mentor_share),
                'total_center_margin': float(total_center_margin),
                'total_estimated_state_receivable': float(total_estimated_state_receivable),
                'total_estimated_center_margin': float(total_estimated_center_margin),
                'total_lessons_planned': total_lessons_planned,
                'total_lessons_attended': total_lessons_attended,
                'overall_attendance_rate': round(total_lessons_attended / total_lessons_planned * 100, 1) if total_lessons_planned > 0 else 0.0,
                'status_counts': status_counts,
                'groups': groups_summary,
                'students': all_paid_students,
            })
        except Exception as e:
            logger.error(f"paid_students error: {e}", exc_info=True)
            return Response({'detail': f"To'langan o'quvchilar ro'yxatini yuklashda xatolik: {str(e)}"}, status=400)

    @action(detail=True, methods=['get'], url_path='student-calculation-detail')
    def student_calculation_detail(self, request, pk=None):
        """
        Alohida o'quvchi uchun to'liq arifmetik hisob-kitob tafsiloti (formulalar, amallar, davomat).
        Frontend keshlaydi, N+1 so'rovlar yuzaga kelmaydi.
        """
        payment = self.get_object()
        student_id = request.query_params.get('student_id')
        group_id = request.query_params.get('group_id')

        if not student_id:
            return Response({'detail': "student_id parametri talab qilinadi."}, status=400)

        from finance.services import build_student_calculation_detail_dict
        try:
            detail = build_student_calculation_detail_dict(payment, student_id, group_id)
            return Response(detail)
        except Exception as e:
            logger.error(f"student_calculation_detail error: {e}", exc_info=True)
            return Response({'detail': str(e)}, status=400)



class StaffProfileViewSet(viewsets.ModelViewSet):
    """Xodimlar profili va maosh sozlamalari. 

    Lookup: user_id bo'yicha ishlaydi (frontend employee_id yuboradi).
    Serializer `id` maydoni ham user.id ni qaytaradi.
    """
    queryset = StaffProfile.objects.select_related('user').all()
    serializer_class = StaffProfileSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    lookup_field = 'user_id'

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['user__role', 'user__branch']
    search_fields = ['user__first_name', 'user__last_name', 'user__username']

    def get_queryset(self):
        # Moliya bo'limiga faqat super_admin kira oladi, shuning uchun barcha filiallarni ko'radi
        from django.db.models import Prefetch
        from django.utils import timezone
        from finance.models import EmployeePayment, MentorGroupSalaryConfig
        
        current_month = timezone.localdate().replace(day=1)
        qs = self.queryset.select_related('user__branch').prefetch_related(
            Prefetch(
                'user__salary_payments',
                queryset=EmployeePayment.objects.filter(month=current_month),
                to_attr='current_payments'
            ),
            Prefetch(
                'user__group_salary_configs',
                to_attr='prefetched_group_configs'
            )
        )
        return qs

    @action(detail=False, methods=['get', 'patch', 'delete'], url_path='by-user/(?P<user_id>[^/.]+)')
    def by_user(self, request, user_id=None):
        """Frontendga qulay: user_id orqali StaffProfile CRUD."""
        profile = get_object_or_404(self.get_queryset(), user_id=user_id)
        self.check_object_permissions(request, profile)
        if request.method == 'GET':
            return Response(StaffProfileSerializer(profile).data)
        if request.method == 'PATCH':
            serializer = StaffProfileSerializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        if request.method == 'DELETE':
            profile.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_create(self, serializer):
        """Profile yaratishda xavfsizlikni tekshirish."""
        user_to_assign = serializer.validated_data.get('user')
        if self.request.user.role == 'admin':
            if user_to_assign.branch != self.request.user.branch:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Siz faqat o'z filialingiz xodimlari uchun profil yarata olasiz.")
        serializer.save()



class EmployeeAdvanceViewSet(viewsets.ModelViewSet):
    """Xodimlar uchun avanslar"""
    queryset = EmployeeAdvance.objects.select_related('employee', 'marked_by').all()
    serializer_class = EmployeeAdvanceSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'

    def get_queryset(self):
        # Moliya bo'limiga faqat super_admin kira oladi, shuning uchun barcha filiallarni ko'radi
        return self.queryset

    def perform_create(self, serializer):
        # Avanslar alohida EmployeeAdvance jadvalida; yakuniy summa total_advances orqali ayiriladi
        serializer.save(marked_by=self.request.user)

# --- Statistics Views ---


class MentorGroupSalaryConfigViewSet(viewsets.ModelViewSet):
    """
    Mentorlar uchun guruhga xos maosh konfiguratsiyalari.
    Super admin va adminlar (faqat o'z filialidagi mentorlar uchun) ishlata oladi.
    """
    queryset = MentorGroupSalaryConfig.objects.select_related('mentor', 'group', 'mentor__branch', 'group__branch').all()
    serializer_class = MentorGroupSalaryConfigSerializer
    permission_classes = [IsAuthenticated, HasModulePermission]
    module_name = 'finance'
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['mentor__first_name', 'mentor__last_name', 'mentor__username', 'group__name']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        try:
            user = self.request.user
            qs = super().get_queryset()
            
            # Mentor filterini qo'llash (safe usulda)
            mentor_id = self.request.query_params.get('mentor')
            if mentor_id:
                try:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    # Foydalanuvchi mavjud va mentor ekanligini tekshiramiz
                    if User.objects.filter(id=mentor_id, role='mentor').exists():
                        qs = qs.filter(mentor_id=mentor_id)
                    else:
                        # Agar mentor bo'lmasa, bo'sh queryset qaytaramiz
                        return qs.none()
                except (ValueError, TypeError):
                    # Noto'g'ri ID bo'lsa, bo'sh qaytaramiz
                    return qs.none()
            
            # Guruh filterini qo'llash
            group_id = self.request.query_params.get('group')
            if group_id:
                qs = qs.filter(group_id=group_id)
            
            # Salary type filterini qo'llash
            salary_type = self.request.query_params.get('salary_type')
            if salary_type:
                qs = qs.filter(salary_type=salary_type)
            
            # Ruxsatlarni tekshiramiz
            if user.role == 'super_admin':
                return qs
                
            if user.role == 'admin':
                # Admin faqat o'z filialidagi mentorlar uchun konfiguratsiyalarni ko'radi
                allowed_branches = [user.branch.id] if user.branch else []
                if hasattr(user, 'branch_accesses'):
                    allowed_branches.extend(user.branch_accesses.values_list('branch_id', flat=True))
                return qs.filter(mentor__branch_id__in=allowed_branches)
                
            return qs.none()
        except Exception as e:
            logger.exception(f"MentorGroupSalaryConfigViewSet get_queryset error: {e}")
            return MentorGroupSalaryConfig.objects.none()

    def perform_create(self, serializer):
        try:
            # Xavfsizlikni tekshirish: admin faqat o'z filialidagi mentorlar uchun konfiguratsiya yaratishi mumkin
            user = self.request.user
            mentor = serializer.validated_data.get('mentor')
            group = serializer.validated_data.get('group')
            
            if user.role == 'admin':
                if (mentor and mentor.branch != user.branch) or (group and group.branch != user.branch):
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Siz faqat o'z filialingizdagi mentorlar va guruhlar uchun konfiguratsiya yaratishingiz mumkin.")
            
            serializer.save()
        except Exception as e:
            logger.exception(f"MentorGroupSalaryConfigViewSet perform_create error: {e}")
            raise


