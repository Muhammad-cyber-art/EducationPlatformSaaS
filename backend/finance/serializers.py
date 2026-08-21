from decimal import Decimal

from authenticatsiya.models import UserModel
from drf_spectacular.utils import extend_schema_field
from groups.models import Branch, Group, Student
from rest_framework import serializers

from finance.utils import floor_amount

from .models import (
    AdminExpense,
    EmployeeAdvance,
    EmployeePayment,
    FinanceTransaction,
    MentorGroupSalaryConfig,
    Payment,
    StaffProfile,
)


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name"]


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source="student.full_name")
    group_name = serializers.ReadOnlyField(source="group.name")
    branch_name = serializers.ReadOnlyField(source="group.branch.name")
    payment_method_display = serializers.CharField(
        source="get_payment_method_display", read_only=True
    )
    marked_by_name = serializers.SerializerMethodField()
    lessons_count = serializers.SerializerMethodField()
    daily_price = serializers.SerializerMethodField()
    absences_count = serializers.SerializerMethodField()
    attended_count = serializers.SerializerMethodField()
    refund_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "student",
            "student_name",
            "group",
            "group_name",
            "branch_name",
            "amount",
            "paid_amount",
            "remaining_amount",
            "is_partial",
            "month",
            "is_paid",
            "paid_at",
            "created_at",
            "refund_amount",
            "refund_ignored",
            "notes",
            "payment_method",
            "payment_method_display",
            "receipt_image",
            "is_verified",
            "marked_by",
            "marked_by_name",
            "lessons_count",
            "daily_price",
            "absences_count",
            "attended_count",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "paid_at",
            "paid_amount",
            "is_partial",
            "remaining_amount",
        ]

    def get_marked_by_name(self, obj):
        if obj.marked_by:
            return obj.marked_by.get_full_name() or obj.marked_by.username
        return None

    def get_remaining_amount(self, obj):
        return float(obj.remaining_amount)

    def _get_lesson_dates(self, obj):
        """Cache'dan lesson dates olish (N+1 muammosini oldini olish)"""
        cache = self.context.get('lesson_dates_cache')
        if cache is not None:
            key = (obj.group_id, obj.month.year, obj.month.month)
            if key in cache:
                return cache[key]
        try:
            return obj.group.get_lesson_dates(obj.month.year, obj.month.month)
        except Exception:
            return []

    def get_lessons_count(self, obj) -> int:
        return len(self._get_lesson_dates(obj))

    def get_daily_price(self, obj) -> float:
        try:
            from finance.utils import floor_amount

            lessons = self._get_lesson_dates(obj)
            lessons_count = len(lessons)
            if lessons_count > 0:
                base_price = (
                    obj.student.custom_fee
                    if obj.student.custom_fee is not None
                    and obj.student.status
                    in ["low_income", "negotiated", "discount", "teacher_negotiated"]
                    else obj.group.monthly_price
                )
                return float(floor_amount(float(base_price) / lessons_count))
            return 0
        except Exception:
            return 0

    def get_absences_count(self, obj) -> int:
        try:
            return obj.student.get_absences_count(
                obj.month.year, obj.month.month, group=obj.group
            )
        except Exception:
            return 0

    def get_attended_count(self, obj) -> int:
        try:
            from django.utils import timezone
            from homework_attends.models import Attendance

            today = timezone.localdate()
            lesson_dates = self._get_lesson_dates(obj)
            active_lesson_dates = [d for d in lesson_dates if d <= today]
            return Attendance.objects.filter(
                student=obj.student,
                group=obj.group,
                date__year=obj.month.year,
                date__month=obj.month.month,
                date__in=active_lesson_dates,
                is_present=True,
                marked_by__isnull=False,
            ).count()
        except Exception:
            return 0

    def get_refund_amount(self, obj) -> float:
        # Discount va Negotiated uchun refund ishlatilmaydi
        if obj.student and obj.student.status in ["discount", "negotiated"]:
            return 0
        if obj.is_paid:
            return float(obj.refund_amount) if obj.refund_amount else 0
        try:
            return float(
                obj.student.calculate_refund_amount(
                    obj.month.year, obj.month.month, group=obj.group
                )
            )
        except Exception:
            return 0


class EmployeePaymentSerializer(serializers.ModelSerializer):
    employee_first_name = serializers.ReadOnlyField(source="employee.first_name")
    employee_last_name = serializers.ReadOnlyField(source="employee.last_name")
    employee_role = serializers.ReadOnlyField(source="employee.role")
    employee_id = serializers.ReadOnlyField(source="employee.id")
    staff_profile_id = serializers.ReadOnlyField(source="employee.staff_profile.id")
    employee_branch = serializers.SerializerMethodField()
    karta = serializers.SerializerMethodField()
    salary_type = serializers.SerializerMethodField()
    fixed_salary = serializers.SerializerMethodField()
    commission_percentage = serializers.SerializerMethodField()
    per_student_amount = serializers.SerializerMethodField()
    groups_income = serializers.SerializerMethodField()
    calculated_commission = serializers.SerializerMethodField()
    calculated_commission_expected = serializers.SerializerMethodField()
    groups_income_expected = serializers.SerializerMethodField()
    calculated_per_student = serializers.SerializerMethodField()
    mentor_groups = serializers.SerializerMethodField()
    attendance_based_salary = serializers.SerializerMethodField()
    total_advances = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True
    )
    advances_history = serializers.SerializerMethodField()
    payment_history = serializers.SerializerMethodField()

    marked_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EmployeePayment
        fields = [
            "id",
            "employee_id",
            "staff_profile_id",
            "employee_first_name",
            "employee_last_name",
            "employee_role",
            "employee_branch",
            "month",
            "salary_base",
            "bonus",
            "deductions",
            "total_amount",
            "karta",
            "salary_type",
            "fixed_salary",
            "commission_percentage",
            "per_student_amount",
            "groups_income",
            "groups_income_expected",
            "calculated_commission",
            "calculated_commission_expected",
            "calculated_per_student",
            "mentor_groups",
            "attendance_based_salary",
            "total_advances",
            "advances_history",
            "payment_history",
            "is_paid",
            "paid_at",
            "marked_by",
            "marked_by_name",
        ]
        read_only_fields = ["id", "employee_id", "total_amount", "paid_at", "marked_by"]

    def _get_prefetch(self):
        """Prefetch context ma'lumotlarini olish (helper)"""
        return self.context.get('employee_prefetch')

    def _get_prefetched_groups(self, obj):
        """Prefetch orqali olingan guruhlarni qaytarish"""
        pf = self._get_prefetch()
        if pf and obj.employee_id in pf.get('employee_groups', {}):
            return pf['employee_groups'][obj.employee_id]
        return None

    def _get_prefetched_payment_map(self):
        pf = self._get_prefetch()
        return pf.get('payment_map', {}) if pf else None

    def _get_prefetched_extras_map(self):
        pf = self._get_prefetch()
        return pf.get('extras_map', {}) if pf else None

    def _is_lite(self) -> bool:
        """Lite mode: og'ir hisob-kitoblarni o'tkazib yuborish (tez yuklash uchun)"""
        return bool(self.context.get('lite', False))

    def get_marked_by_name(self, obj) -> str:
        try:
            if obj.marked_by:
                return obj.marked_by.get_full_name() or obj.marked_by.username
            return None
        except Exception:
            return None

    def get_employee_branch(self, obj) -> int:
        try:
            return obj.employee.branch.id if obj.employee.branch else None
        except:
            return None

    def get_karta(self, obj) -> str:
        try:
            return (
                obj.employee.staff_profile.karta
                if hasattr(obj.employee, "staff_profile")
                else None
            )
        except:
            return None

    def get_salary_type(self, obj) -> str:
        try:
            return (
                obj.employee.staff_profile.salary_type
                if hasattr(obj.employee, "staff_profile")
                else None
            )
        except:
            return None

    def get_fixed_salary(self, obj) -> float:
        try:
            if hasattr(obj.employee, "staff_profile"):
                return float(obj.employee.staff_profile.fixed_salary)
            return None
        except:
            return None

    def get_commission_percentage(self, obj) -> float:
        try:
            if hasattr(obj.employee, "staff_profile"):
                return float(obj.employee.staff_profile.commission_percentage)
            return None
        except:
            return None

    def get_per_student_amount(self, obj) -> float:
        try:
            if hasattr(obj.employee, "staff_profile"):
                return float(obj.employee.staff_profile.per_student_amount)
            return None
        except:
            return None

    def get_groups_income(self, obj) -> int:
        if self._is_lite():
            return 0
        import logging

        logger = logging.getLogger(__name__)
        try:
            # All necessary imports at top of function
            from decimal import Decimal

            from groups.models import Group

            from finance.models import FinanceTransaction, Payment
            from finance.utils import calculate_attendance_based_student_payment, floor_amount

            if not obj.month:
                logger.warning(f"groups_income: month missing for obj {obj.id}")
                return 0
                
            if hasattr(obj.employee, 'staff_profile') and obj.employee.staff_profile.salary_type == 'fixed':
                return 0
                
            if obj.employee.role == "admin":
                # Admin uchun real tushum: to'liq student-by-student hisoblash (calculate_monthly_income logic)
                if not obj.employee.branch:
                    logger.warning(
                        f"groups_income: admin has no branch for obj {obj.id}"
                    )
                    return 0

                total = Decimal("0")
                processed_pairs = set()

                # === OPTIMIZATSIYA: Prefetch context'dan foydalanish ===
                prefetched_groups = self._get_prefetched_groups(obj)
                prefetched_pm = self._get_prefetched_payment_map()
                prefetched_em = self._get_prefetched_extras_map()
                pf = self._get_prefetch()
                enrollment_cache = pf.get('enrollment_cache', {}) if pf else None
                lesson_dates_cache = pf.get('lesson_dates_cache', {}) if pf else None
                attendance_cache = pf.get('attendance_cache', {}) if pf else None

                if prefetched_groups is not None and prefetched_pm is not None:
                    branch_groups = prefetched_groups
                    payment_map = prefetched_pm
                    extra_map = prefetched_em or {}
                else:
                    branch_groups = list(Group.objects.filter(branch=obj.employee.branch).prefetch_related(
                        "students", "old_students_fk", "enrollments", "enrollments__student", "special_lesson_days", "canceled_lesson_days"
                    ))
                    payment_map = {}
                    payment_qs = Payment.objects.filter(
                        group__in=branch_groups,
                        month__year=obj.month.year,
                        month__month=obj.month.month,
                    ).select_related("student")
                    for p in payment_qs:
                        key = (p.student_id, p.group_id)
                        payment_map[key] = p
                    extra_map = {}
                    branch_group_ids = [g.id for g in branch_groups]
                    extra_qs = FinanceTransaction.objects.filter(
                        category="student_extra",
                        date__year=obj.month.year,
                        date__month=obj.month.month,
                        group_id__in=branch_group_ids,
                    ).values("student_id", "group_id", "transaction_type", "amount")
                    for tx in extra_qs:
                        key = (tx["student_id"], tx["group_id"])
                        amt = Decimal(str(tx["amount"] or 0))
                        if tx["transaction_type"] == "income":
                            extra_map[key] = extra_map.get(key, Decimal("0")) + amt
                        else:
                            extra_map[key] = extra_map.get(key, Decimal("0")) - amt

                for group in branch_groups:
                    # Enrollment cache'dan foydalanish
                    all_students_map = {}
                    if enrollment_cache is not None and group.id in enrollment_cache:
                        all_students_map = dict(enrollment_cache[group.id])
                    else:
                        for enr in group.enrollments.filter(is_active=True).select_related("student"):
                            if enr.student:
                                all_students_map[enr.student.id] = enr.student
                        _unenrolled = set(group.enrollments.filter(is_active=False).values_list('student_id', flat=True))
                        for st in group.old_students_fk.filter(is_active=True, is_archived=False):
                            if st.id not in _unenrolled:
                                all_students_map[st.id] = st

                    for student in all_students_map.values():
                        key = (student.id, group.id)
                        if key in processed_pairs:
                            continue
                        processed_pairs.add(key)

                        if student.status == "teacher_negotiated":
                            p = payment_map.get(key)
                            base_amount = Decimal("0")
                            if p:
                                base_amount = Decimal(str(p.paid_amount or 0))
                            net_amount = base_amount + extra_map.get(key, Decimal("0"))
                            if net_amount != 0:
                                total += net_amount
                            continue

                        if student.status in ["discount", "negotiated"]:
                            p = payment_map.get(key)
                            base_amount = Decimal("0")
                            if student.status == "discount":
                                base_amount = calculate_attendance_based_student_payment(
                                    student, group, obj.month,
                                    lesson_dates_cache=lesson_dates_cache,
                                    enrollment_cache=enrollment_cache,
                                    attendance_cache=attendance_cache,
                                )
                            else:
                                if p:
                                    base_amount = Decimal(str(p.paid_amount or 0))
                            net_amount = base_amount + extra_map.get(key, Decimal("0"))
                            if net_amount != 0:
                                total += net_amount
                            continue

                        p = payment_map.get(key)
                        base_amount = Decimal("0")
                        if p and p.is_paid:
                            base_amount = Decimal(str(p.amount or 0))
                        net_amount = base_amount + extra_map.get(key, Decimal("0"))
                        if net_amount != 0 or (p and p.is_paid):
                            total += net_amount

                # Add revenue from deleted students
                if prefetched_pm is not None:
                    deleted_payments = [p for p in prefetched_pm.values() if getattr(p, 'student_id', None) is None]
                else:
                    deleted_payments = [p for p in payment_qs if p.student_id is None]

                for p in deleted_payments:
                    if p.is_paid:
                        total += Decimal(str(p.amount or 0))

                result = int(floor_amount(total, precision=None))
                return result

            # Mentor uchun
            if not hasattr(obj.employee, "staff_profile"):
                logger.warning(
                    f"groups_income: staff_profile missing for mentor obj {obj.id}"
                )
                return 0
            profile = obj.employee.staff_profile
            inc = profile.calculate_monthly_income(obj.month)
            result = int(floor_amount(inc, precision=None))
            return result
        except Exception as e:
            logger.error(f"groups_income error: {e}", exc_info=True)
            return 0

    def get_calculated_commission(self, obj) -> float:
        if self._is_lite():
            return None
        try:
            from finance.utils import floor_amount

            if not obj.month or not hasattr(obj.employee, "staff_profile"):
                return None
            profile = obj.employee.staff_profile
            if profile.salary_type not in ["percentage", "student_count"]:
                return None
            pf = self._get_prefetch()
            sal = profile.calculate_salary_for_month(obj.month, commission_basis="paid", prefetch_cache=pf)
            return int(floor_amount(sal, precision=None))
        except:
            return None

    def get_groups_income_expected(self, obj) -> int:
        if self._is_lite():
            return 0
        import logging

        logger = logging.getLogger(__name__)
        try:
            # All necessary imports at top
            from decimal import Decimal

            from groups.models import Group

            from finance.models import FinanceTransaction
            from finance.utils import (
                calculate_attendance_based_student_payment,
                floor_amount,
            )

            if not obj.month:
                logger.warning(
                    f"groups_income_expected: month missing for obj {obj.id}"
                )
                return 0
                
            if hasattr(obj.employee, 'staff_profile') and obj.employee.staff_profile.salary_type == 'fixed':
                return 0
                
            if obj.employee.role == "admin":
                if not obj.employee.branch:
                    logger.warning(
                        f"groups_income_expected: admin has no branch for obj {obj.id}"
                    )
                    return 0

                total = Decimal("0")
                processed_pairs = set()

                # === OPTIMIZATSIYA: Prefetch context'dan foydalanish ===
                prefetched_groups = self._get_prefetched_groups(obj)
                prefetched_em = self._get_prefetched_extras_map()
                pf = self._get_prefetch()
                enrollment_cache = pf.get('enrollment_cache', {}) if pf else None
                lesson_dates_cache = pf.get('lesson_dates_cache', {}) if pf else None
                attendance_cache = pf.get('attendance_cache', {}) if pf else None

                if prefetched_groups is not None and prefetched_em is not None:
                    branch_groups = prefetched_groups
                    extra_map = prefetched_em
                else:
                    branch_groups = list(Group.objects.filter(branch=obj.employee.branch))
                    branch_group_ids = [g.id for g in branch_groups]
                    extra_map = {}
                    extra_qs = FinanceTransaction.objects.filter(
                        category="student_extra",
                        date__year=obj.month.year,
                        date__month=obj.month.month,
                        group_id__in=branch_group_ids,
                    ).values("student_id", "group_id", "transaction_type", "amount")
                    for tx in extra_qs:
                        key = (tx["student_id"], tx["group_id"])
                        amt = Decimal(str(tx["amount"] or 0))
                        if tx["transaction_type"] == "income":
                            extra_map[key] = extra_map.get(key, Decimal("0")) + amt
                        else:
                            extra_map[key] = extra_map.get(key, Decimal("0")) - amt

                for group in branch_groups:
                    all_students_map = {}
                    if enrollment_cache is not None and group.id in enrollment_cache:
                        all_students_map = dict(enrollment_cache[group.id])
                    else:
                        for enr in group.enrollments.filter(is_active=True).select_related("student"):
                            if enr.student:
                                all_students_map[enr.student.id] = enr.student
                        _unenrolled = set(group.enrollments.filter(is_active=False).values_list('student_id', flat=True))
                        for st in group.old_students_fk.filter(is_active=True, is_archived=False):
                            if st.id not in _unenrolled:
                                all_students_map[st.id] = st

                    for student in all_students_map.values():
                        key = (student.id, group.id)
                        if key in processed_pairs:
                            continue
                        processed_pairs.add(key)

                        if student.status == "discount":
                            total += calculate_attendance_based_student_payment(
                                student, group, obj.month,
                                lesson_dates_cache=lesson_dates_cache,
                                enrollment_cache=enrollment_cache,
                                attendance_cache=attendance_cache,
                            )
                            total += extra_map.get(key, Decimal("0"))
                            continue

                        if student.status in [
                            "negotiated",
                            "teacher_negotiated",
                            "low_income",
                        ]:
                            base = Decimal(
                                str(student.custom_fee or group.monthly_price or 0)
                            )
                            total += base
                            total += extra_map.get(key, Decimal("0"))
                            continue

                        total += Decimal(str(group.monthly_price or 0))
                        total += extra_map.get(key, Decimal("0"))

                # Add expected revenue from deleted students
                prefetched_pm = self._get_prefetched_payment_map()
                if prefetched_pm is not None:
                    deleted_payments = [p for p in prefetched_pm.values() if getattr(p, 'student_id', None) is None]
                    for p in deleted_payments:
                        total += Decimal(str(p.amount or 0))

                result = int(floor_amount(total, precision=None))
                logger.info(
                    f"groups_income_expected (admin): calculated {result} for obj {obj.id}"
                )
                return result

            # Mentor uchun (percentage, student_count, fixed)
            if not hasattr(obj.employee, "staff_profile"):
                logger.warning(
                    f"groups_income_expected: staff_profile missing for mentor obj {obj.id}"
                )
                return 0
            profile = obj.employee.staff_profile
            pf = self._get_prefetch()
            inc = profile.calculate_expected_monthly_income(obj.month, prefetch_cache=pf)
            result = int(floor_amount(inc))
            logger.info(
                f"groups_income_expected (mentor): calculated {result} for obj {obj.id}"
            )
            return result
        except Exception as e:
            logger.error(f"groups_income_expected error: {e}", exc_info=True)
            return 0

    def get_calculated_commission_expected(self, obj) -> float:
        if self._is_lite():
            return None
        import logging

        logger = logging.getLogger(__name__)
        try:
            from finance.utils import floor_amount

            if not obj.month or not hasattr(obj.employee, "staff_profile"):
                logger.warning(
                    f"calculated_commission_expected: month or staff_profile missing for obj {obj.id}"
                )
                return None
            profile = obj.employee.staff_profile
            if profile.salary_type not in ["percentage", "student_count"]:
                logger.warning(
                    f"calculated_commission_expected: salary_type is {profile.salary_type} for obj {obj.id}"
                )
                return None
            pf = self._get_prefetch()
            sal = profile.calculate_salary_for_month(
                obj.month, commission_basis="expected", prefetch_cache=pf
            )
            result = int(floor_amount(sal))
            logger.info(
                f"calculated_commission_expected: calculated {result} for obj {obj.id}"
            )
            return result
        except Exception as e:
            logger.error(f"calculated_commission_expected error: {e}", exc_info=True)
            return None

    @extend_schema_field(serializers.DictField())
    def get_attendance_based_salary(self, obj) -> dict:
        if self._is_lite():
            return None
        try:
            if not obj.month or not hasattr(obj.employee, "staff_profile"):
                return None
            profile = obj.employee.staff_profile
            if profile.salary_type == 'fixed':
                return None
            salary, details = profile.calculate_attendance_based_salary(obj.month)
            return {"salary": int(salary), "details": details}
        except:
            return None

    def get_calculated_per_student(self, obj) -> float:
        if self._is_lite():
            return None
        try:
            if not obj.month or not hasattr(obj.employee, "staff_profile"):
                return None
            profile = obj.employee.staff_profile
            if profile.salary_type != "student_count":
                return None
            pf = self._get_prefetch()
            sal = profile.calculate_salary_for_month(obj.month, commission_basis="paid", prefetch_cache=pf)
            return int(floor_amount(sal))
        except:
            return None

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_mentor_groups(self, obj) -> list:
        if self._is_lite():
            return []
        try:
            from finance.utils import calculate_group_revenue_and_mentor_share

            if not obj.month or not hasattr(obj.employee, "staff_profile"):
                return []

            profile = obj.employee.staff_profile
            
            if profile.salary_type == 'fixed':
                return []

            # === OPTIMIZATSIYA: Prefetch context'dan foydalanish ===
            pf = self._get_prefetch()
            prefetched_groups = self._get_prefetched_groups(obj)
            prefetched_pm = self._get_prefetched_payment_map()
            prefetched_em = self._get_prefetched_extras_map()
            enrollment_cache = pf.get('enrollment_cache', {}) if pf else None
            lesson_dates_cache = pf.get('lesson_dates_cache', {}) if pf else None
            attendance_cache = pf.get('attendance_cache', {}) if pf else None

            if prefetched_groups is not None and prefetched_pm is not None:
                mentor_groups = prefetched_groups
                payment_map = prefetched_pm
                extra_map = prefetched_em or {}
            else:
                if obj.employee.role == "mentor":
                    groups_qs = Group.objects.filter(mentor=obj.employee)
                elif obj.employee.role == "admin" and obj.employee.branch:
                    groups_qs = Group.objects.filter(branch=obj.employee.branch)
                else:
                    return []
                mentor_groups = list(
                    groups_qs.select_related("branch").prefetch_related(
                        "students", "old_students_fk", "enrollments", "enrollments__student", "special_lesson_days", "canceled_lesson_days"
                    )
                )
                if not mentor_groups:
                    return []
                group_ids = [g.id for g in mentor_groups]
                _all_payments = Payment.objects.filter(
                    group_id__in=group_ids,
                    month__year=obj.month.year,
                    month__month=obj.month.month,
                ).select_related("student")
                payment_map = {(p.student_id, p.group_id): p for p in _all_payments}
                extra_map = {}
                extra_qs = FinanceTransaction.objects.filter(
                    category="student_extra",
                    date__year=obj.month.year,
                    date__month=obj.month.month,
                    group_id__in=group_ids,
                ).values("student_id", "group_id", "transaction_type", "amount")
                for tx in extra_qs:
                    key = (tx["student_id"], tx["group_id"])
                    amt = Decimal(str(tx["amount"] or 0))
                    if tx["transaction_type"] == "income":
                        extra_map[key] = extra_map.get(key, Decimal("0")) + amt
                    else:
                        extra_map[key] = extra_map.get(key, Decimal("0")) - amt

            groups_data = []
            for group in mentor_groups:
                group_result = calculate_group_revenue_and_mentor_share(
                    group=group,
                    month_date=obj.month,
                    profile=profile,
                    payment_map=payment_map,
                    extra_map=extra_map,
                    lesson_dates_cache=lesson_dates_cache,
                    attendance_cache=attendance_cache,
                    enrollment_cache=enrollment_cache,
                )

                # Guruhdagi talabalar sonini hisoblash (enrollment cache)
                all_students_map = {}
                if enrollment_cache is not None and group.id in enrollment_cache:
                    all_students_map = dict(enrollment_cache[group.id])
                else:
                    for enr in group.enrollments.filter(is_active=True).select_related("student"):
                        if enr.student:
                            all_students_map[enr.student.id] = enr.student
                    _unenrolled = set(group.enrollments.filter(is_active=False).values_list('student_id', flat=True))
                    for st in group.old_students_fk.filter(is_active=True, is_archived=False):
                        if st.id not in _unenrolled:
                            all_students_map[st.id] = st

                groups_data.append(
                    {
                        "id": group.id,
                        "name": group.name,
                        "monthly_price": float(group.monthly_price),
                        "students_count": len(all_students_map),
                        "paid_students_count": len(group_result["paid_students"]),
                        "monthly_income": int(group_result["actual_revenue"]),
                        "real_income": int(group_result["actual_revenue"]),
                        "expected_income": int(group_result["expected_revenue"]),
                        "mentor_share_paid": int(group_result["mentor_share_paid"]),
                        "mentor_share_expected": int(
                            group_result["mentor_share_expected"]
                        ),
                        "paid_students": group_result["paid_students"],
                        "unpaid_students": group_result["unpaid_students"],
                    }
                )
            return groups_data
        except Exception as e:
            import logging

            logging.getLogger(__name__).error(f"get_mentor_groups error: {e}")
            import traceback

            traceback.print_exc()
            return []

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_advances_history(self, obj) -> list:
        if self.context.get('view') and self.context['view'].action == 'list':
            return []
        
        # === OPTIMIZATSIYA: Prefetch advance map'dan foydalanish ===
        pf = self._get_prefetch()
        if pf is not None:
            key = (obj.employee_id, str(obj.month))
            advances = pf.get('advances_map', {}).get(key, [])
            return EmployeeAdvanceSerializer(advances, many=True).data

        from .models import EmployeeAdvance
        qs = EmployeeAdvance.objects.filter(
            employee=obj.employee, month=obj.month
        ).order_by("-created_at")
        return EmployeeAdvanceSerializer(qs, many=True).data

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_payment_history(self, obj) -> list:
        if self.context.get('view') and self.context['view'].action == 'list':
            return []

        history = (
            EmployeePayment.objects.filter(employee=obj.employee)
            .select_related("employee__staff_profile", "marked_by")
            .order_by("-month", "-id")
        )

        # === LITE MODE: Og'ir hisob-kitobsiz, batch advances query ===
        if self._is_lite():
            from .models import EmployeeAdvance
            history_list = list(history)
            # Barcha avanslarni BITTA queryda olamiz
            all_adv = list(EmployeeAdvance.objects.filter(
                employee=obj.employee
            ).values('month', 'amount', 'created_at'))
            adv_by_month = {}
            for a in all_adv:
                adv_by_month.setdefault(a['month'], []).append(a)

            result = []
            for p in history_list:
                profile = getattr(p.employee, 'staff_profile', None)
                month_adv = adv_by_month.get(p.month, [])
                if p.is_paid and p.paid_at:
                    total_adv = sum(
                        float(a['amount']) for a in month_adv
                        if a['created_at'] <= p.paid_at
                    )
                else:
                    total_adv = sum(float(a['amount']) for a in month_adv)

                salary = float(p.salary_base or 0)
                bonus_v = float(p.bonus or 0)
                ded = float(p.deductions or 0)
                raw = salary + bonus_v - ded - total_adv
                total = float(floor_amount(Decimal(str(raw)), precision=None))

                marked_by_name = None
                if p.marked_by:
                    marked_by_name = p.marked_by.get_full_name() or p.marked_by.username

                result.append({
                    'id': p.id,
                    'month': p.month,
                    'salary_base': salary,
                    'bonus': bonus_v,
                    'deductions': ded,
                    'total_advances': total_adv,
                    'total_amount': total,
                    'is_paid': p.is_paid,
                    'paid_at': p.paid_at,
                    'salary_type': profile.salary_type if profile else None,
                    'commission_percentage': float(profile.commission_percentage) if profile else None,
                    'per_student_amount': float(profile.per_student_amount) if profile else None,
                    'calculated_commission': None,
                    'calculated_commission_expected': None,
                    'calculated_per_student': None,
                    'marked_by_name': marked_by_name,
                })
            return result
        # === FULL MODE: Hisob-kitoblar bilan ===
        pf = self._get_prefetch()
        result = []
        for p in history:
            profile = getattr(p.employee, "staff_profile", None)
            salary_type = profile.salary_type if profile else None
            commission_pct = float(profile.commission_percentage) if profile else None
            per_student_amount = float(profile.per_student_amount) if profile else None

            # Foizli to'lanmagan oylar uchun live hisob
            calculated_commission = None
            calculated_commission_expected = None
            calculated_per_student = None
            if profile and p.month:
                try:
                    if salary_type == "percentage":
                        calculated_commission = (
                            int(
                                floor_amount(
                                    profile.calculate_salary_for_month(
                                        p.month, commission_basis="paid", prefetch_cache=pf
                                    )
                                )
                            )
                            if not p.is_paid
                            else None
                        )
                        calculated_commission_expected = (
                            int(
                                floor_amount(
                                    profile.calculate_salary_for_month(
                                        p.month, commission_basis="expected", prefetch_cache=pf
                                    )
                                )
                            )
                            if not p.is_paid
                            else None
                        )
                    elif salary_type == "student_count":
                        calculated_per_student = (
                            int(
                                floor_amount(
                                    profile.calculate_salary_for_month(
                                        p.month, commission_basis="paid", prefetch_cache=pf
                                    )
                                )
                            )
                            if not p.is_paid
                            else None
                        )
                        calculated_commission_expected = (
                            int(
                                floor_amount(
                                    profile.calculate_salary_for_month(
                                        p.month, commission_basis="expected", prefetch_cache=pf
                                    )
                                )
                            )
                            if not p.is_paid
                            else None
                        )
                except Exception:
                    pass

            marked_by_name = None
            if p.marked_by:
                marked_by_name = p.marked_by.get_full_name() or p.marked_by.username

            result.append(
                {
                    "id": p.id,
                    "month": p.month,
                    "salary_base": float(p.salary_base)
                    if p.salary_base is not None
                    else 0,
                    "bonus": float(p.bonus) if p.bonus else 0,
                    "deductions": float(p.deductions) if p.deductions else 0,
                    "total_advances": float(p.total_advances),
                    "total_amount": float(p.total_amount),
                    "is_paid": p.is_paid,
                    "paid_at": p.paid_at,
                    "salary_type": salary_type,
                    "commission_percentage": commission_pct,
                    "per_student_amount": per_student_amount,
                    "calculated_commission": calculated_commission,
                    "calculated_commission_expected": calculated_commission_expected,
                    "calculated_per_student": calculated_per_student,
                    "marked_by_name": marked_by_name,
                }
            )
        return result


class MentorGroupSalaryConfigSerializer(serializers.ModelSerializer):
    mentor_first_name = serializers.ReadOnlyField(source="mentor.first_name")
    mentor_last_name = serializers.ReadOnlyField(source="mentor.last_name")
    mentor_full_name = serializers.SerializerMethodField()
    group_name = serializers.ReadOnlyField(source="group.name")
    salary_type_display = serializers.CharField(
        source="get_salary_type_display", read_only=True
    )

    class Meta:
        model = MentorGroupSalaryConfig
        fields = [
            "id",
            "mentor",
            "mentor_first_name",
            "mentor_last_name",
            "mentor_full_name",
            "group",
            "group_name",
            "salary_type",
            "salary_type_display",
            "commission_percentage",
            "per_student_amount",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_mentor_full_name(self, obj):
        if obj.mentor:
            return obj.mentor.get_full_name() or obj.mentor.username
        return None

    def validate_mentor(self, value):
        if value.role != "mentor":
            raise serializers.ValidationError(
                "Faqat mentorlar uchun konfiguratsiya yaratilishi mumkin"
            )
        return value

    def validate(self, data):
        # Extra validatsiya
        if data.get("salary_type") == "percentage":
            if not (0 <= data.get("commission_percentage", 0) <= 100):
                raise serializers.ValidationError(
                    {"commission_percentage": "Foiz 0-100 orasida bo'lishi kerak"}
                )
        elif data.get("salary_type") == "student_count":
            if data.get("per_student_amount", 0) < 0:
                raise serializers.ValidationError(
                    {"per_student_amount": "Summa 0 dan kam bo'lmasligi kerak"}
                )
        return data


class StaffProfileSerializer(serializers.ModelSerializer):
    id = serializers.ReadOnlyField(source="user.id")
    employee_id = serializers.ReadOnlyField(source="user.id")
    profile_id = serializers.ReadOnlyField(source="id")
    full_name = serializers.CharField(source="user.get_full_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    branch_name = serializers.CharField(source="user.branch.name", read_only=True)
    salary_display = serializers.CharField(source="get_salary_display", read_only=True)
    current_payment_id = serializers.SerializerMethodField()
    group_configs = serializers.SerializerMethodField()

    class Meta:
        model = StaffProfile
        fields = [
            "id",
            "employee_id",
            "profile_id",
            "user",
            "full_name",
            "username",
            "role",
            "branch_name",
            "salary_type",
            "fixed_salary",
            "commission_percentage",
            "per_student_amount",
            "salary_display",
            "karta",
            "current_payment_id",
            "group_configs",
        ]

    def get_current_payment_id(self, obj) -> int:
        try:
            if hasattr(obj.user, 'current_payments'):
                payments = obj.user.current_payments
                return payments[0].id if payments else None
                
            from django.utils import timezone

            current_month = timezone.localdate().replace(day=1)
            payment = EmployeePayment.objects.filter(
                employee=obj.user, month=current_month
            ).first()
            return payment.id if payment else None
        except Exception:
            return None

    def get_group_configs(self, obj):
        if obj.user.role == "mentor":
            if hasattr(obj.user, 'prefetched_group_configs'):
                configs = obj.user.prefetched_group_configs
            else:
                configs = MentorGroupSalaryConfig.objects.filter(mentor=obj.user)
            return MentorGroupSalaryConfigSerializer(configs, many=True).data
        return []


class BranchStatSerializer(serializers.Serializer):
    name = serializers.CharField()
    income = serializers.DecimalField(max_digits=15, decimal_places=2)
    expense = serializers.DecimalField(max_digits=15, decimal_places=2)
    profit = serializers.DecimalField(max_digits=15, decimal_places=2)


class GroupStatSerializer(serializers.Serializer):
    name = serializers.CharField()
    profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    student_count = serializers.IntegerField()


class FinanceDashboardSerializer(serializers.Serializer):
    total_income = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_expense = serializers.DecimalField(max_digits=15, decimal_places=2)
    net_profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_debt = serializers.DecimalField(max_digits=15, decimal_places=2)
    branches = BranchStatSerializer(many=True)
    top_groups = GroupStatSerializer(many=True)


class BranchFinanceDetailSerializer(serializers.Serializer):
    branch = serializers.DictField()
    stats = serializers.DictField()
    finance = serializers.DictField()
    groups = serializers.ListField()
    period = serializers.DictField()


class FinanceTransactionSerializer(serializers.ModelSerializer):
    marked_by_name = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    
    def get_student_name(self, obj):
        name = obj.student_name or (obj.student.full_name if obj.student else "Noma'lum")
        if not obj.student and obj.category == 'student_fee':
            if not name.endswith("(O'chirilgan)"):
                name = f"{name} (O'chirilgan)"
        return name
    branch_name = serializers.ReadOnlyField(source="branch.name")
    transaction_type_display = serializers.CharField(
        source="get_transaction_type_display", read_only=True
    )
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    payment_details = serializers.SerializerMethodField()

    class Meta:
        model = FinanceTransaction
        fields = [
            "id",
            "transaction_type",
            "transaction_type_display",
            "category",
            "category_display",
            "amount",
            "date",
            "marked_by",
            "marked_by_name",
            "cancelled_by",
            "cancelled_by_name",
            "cancelled_at",
            "branch",
            "branch_name",
            "student",
            "student_name",
            "group",
            "payer_name",
            "title",
            "description",
            "related_id",
            "created_at",
            "payment_details",
            "status",
            "record_type",
            "is_verified",
            "verified_by",
            "verified_at",
        ]
        read_only_fields = ["id", "created_at", "marked_by", "cancelled_by", "cancelled_at", "verified_by", "verified_at"]

    def get_marked_by_name(self, obj) -> str:
        if obj.marked_by:
            return obj.marked_by.get_full_name() or obj.marked_by.username
        return "Tizim"

    def get_cancelled_by_name(self, obj) -> str | None:
        if obj.cancelled_by:
            return obj.cancelled_by.get_full_name() or obj.cancelled_by.username
        return None


    def get_payment_details(self, obj):
        if obj.category == 'student_fee' and obj.related_id and obj.related_id.startswith('STP-'):
            parts = obj.related_id.split('-')
            if len(parts) >= 2:
                try:
                    payment_id = int(parts[1])
                    from finance.models import Payment
                    payment = Payment.objects.filter(id=payment_id).first()
                    if payment:
                        return {
                            'original_payment_id': payment.id,
                            'is_verified': payment.is_verified,
                            'receipt_image': payment.receipt_image.url if payment.receipt_image else None,
                            'month': payment.month.strftime('%Y-%m') if payment.month else None,
                            'payment_method': payment.payment_method,
                            'payment_method_display': payment.get_payment_method_display(),
                            'refund_amount': float(payment.refund_amount) if payment.refund_amount else 0,
                            'refund_ignored': payment.refund_ignored,
                            'is_partial': payment.is_partial,
                            'is_receiptless': payment.is_receiptless,
                            'group_name': obj.group_name or payment.group_name or (payment.group.name if payment.group else None)
                        }
                    else:
                        # Fallback for deleted students where Payment was hard-deleted by migration 0013
                        return {
                            'original_payment_id': payment_id,
                            'is_verified': obj.is_verified,
                            'receipt_image': None,
                            'month': obj.date.strftime('%Y-%m') if obj.date else None,
                            'payment_method': obj.payment_method,
                            'payment_method_display': dict(Payment.PAYMENT_METHODS).get(obj.payment_method, "Noma'lum") if obj.payment_method else "Noma'lum",
                            'refund_amount': 0,
                            'refund_ignored': False,
                            'is_partial': False,
                            'is_receiptless': False,
                            'group_name': obj.group_name
                        }
                except Exception as e:
                    import traceback
                    print(f"Exception in get_payment_details: {e}")
                    traceback.print_exc()
        return None


class CustomPaymentSerializer(serializers.Serializer):
    student = serializers.IntegerField()
    group = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = serializers.ChoiceField(
        choices=[("income", "Kirim"), ("expense", "Chiqim")], default="income"
    )
    payer_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(
        max_length=500, required=False, allow_blank=True
    )
    date = serializers.DateField(required=False)


class EmployeeAdvanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.get_full_name", read_only=True
    )
    marked_by_name = serializers.CharField(
        source="marked_by.get_full_name", read_only=True
    )

    class Meta:
        model = EmployeeAdvance
        fields = [
            "id",
            "employee",
            "employee_name",
            "month",
            "amount",
            "description",
            "date",
            "marked_by",
            "marked_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "marked_by"]


class SuccessSerializer(serializers.Serializer):
    success = serializers.BooleanField(default=True)
    message = serializers.CharField(required=False, allow_null=True)
    count = serializers.IntegerField(required=False, allow_null=True)


class AbsentStudentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    phone = serializers.CharField()
    group = serializers.CharField()


class PaymentStatisticsSerializer(serializers.Serializer):
    groups = serializers.ListField(child=serializers.DictField())
    statistics = serializers.DictField()


class AdminExpenseSerializer(serializers.ModelSerializer):
    marked_by_name = serializers.CharField(
        source="marked_by.get_full_name", read_only=True
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = AdminExpense
        fields = [
            "id",
            "title",
            "description",
            "amount",
            "date",
            "branch",
            "branch_name",
            "marked_by",
            "marked_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "marked_by", "created_at"]


class SpecialStudentFinancialSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    full_name = serializers.CharField()
    phone = serializers.CharField()
    status = serializers.CharField()
    status_display = serializers.CharField()
    group_id = serializers.IntegerField()
    group_name = serializers.CharField()
    monthly_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    custom_fee = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    expected_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    debt = serializers.DecimalField(max_digits=12, decimal_places=2)
class BranchStatSerializer(serializers.Serializer):
    name = serializers.CharField()
    income = serializers.DecimalField(max_digits=15, decimal_places=2)
    expense = serializers.DecimalField(max_digits=15, decimal_places=2)
    profit = serializers.DecimalField(max_digits=15, decimal_places=2)


class GroupStatSerializer(serializers.Serializer):
    name = serializers.CharField()
    profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    student_count = serializers.IntegerField()


class FinanceDashboardSerializer(serializers.Serializer):
    total_income = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_expense = serializers.DecimalField(max_digits=15, decimal_places=2)
    net_profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_debt = serializers.DecimalField(max_digits=15, decimal_places=2)
    pending_income = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)
    branches = BranchStatSerializer(many=True)
    top_groups = GroupStatSerializer(many=True)


class BranchFinanceDetailSerializer(serializers.Serializer):
    branch = serializers.DictField()
    stats = serializers.DictField()
    finance = serializers.DictField()
    groups = serializers.ListField()
    period = serializers.DictField()


class FinanceTransactionSerializer(serializers.ModelSerializer):
    marked_by_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    
    def get_student_name(self, obj):
        name = obj.student_name or (obj.student.full_name if obj.student else "Noma'lum")
        if not obj.student and obj.category == 'student_fee':
            if not name.endswith("(O'chirilgan)"):
                name = f"{name} (O'chirilgan)"
        return name
    branch_name = serializers.ReadOnlyField(source="branch.name")
    transaction_type_display = serializers.CharField(
        source="get_transaction_type_display", read_only=True
    )
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    payment_details = serializers.SerializerMethodField()

    class Meta:
        model = FinanceTransaction
        fields = [
            "id",
            "transaction_type",
            "transaction_type_display",
            "category",
            "category_display",
            "amount",
            "date",
            "status",
            "record_type",
            "marked_by",
            "marked_by_name",
            "branch",
            "branch_name",
            "student",
            "student_name",
            "group",
            "payer_name",
            "title",
            "description",
            "related_id",
            "created_at",
            "payment_details",
        ]
        read_only_fields = ["id", "created_at", "marked_by"]

    def get_marked_by_name(self, obj) -> str:
        if obj.marked_by:
            return obj.marked_by.get_full_name() or obj.marked_by.username
        return "Tizim"

    def get_payment_details(self, obj):
        if obj.category == 'student_fee' and obj.related_id and obj.related_id.startswith('STP-'):
            parts = obj.related_id.split('-')
            if len(parts) >= 2:
                try:
                    payment_id = int(parts[1])
                    from finance.models import Payment
                    payment = Payment.objects.filter(id=payment_id).first()
                    if payment:
                        return {
                            'original_payment_id': payment.id,
                            'is_verified': payment.is_verified,
                            'receipt_image': payment.receipt_image.url if payment.receipt_image else None,
                            'month': payment.month.strftime('%Y-%m') if payment.month else None,
                            'payment_method': payment.payment_method,
                            'payment_method_display': payment.get_payment_method_display(),
                            'refund_amount': float(payment.refund_amount) if payment.refund_amount else 0,
                            'refund_ignored': payment.refund_ignored,
                            'is_partial': payment.is_partial,
                            'is_receiptless': payment.is_receiptless,
                            'group_name': obj.group_name or payment.group_name or (payment.group.name if payment.group else None)
                        }
                    else:
                        # Fallback for deleted students where Payment was hard-deleted by migration 0013
                        return {
                            'original_payment_id': payment_id,
                            'is_verified': obj.is_verified,
                            'receipt_image': None,
                            'month': obj.date.strftime('%Y-%m') if obj.date else None,
                            'payment_method': obj.payment_method,
                            'payment_method_display': dict(Payment.PAYMENT_METHODS).get(obj.payment_method, "Noma'lum") if obj.payment_method else "Noma'lum",
                            'refund_amount': 0,
                            'refund_ignored': False,
                            'is_partial': False,
                            'is_receiptless': False,
                            'group_name': obj.group_name
                        }
                except Exception as e:
                    import traceback
                    print(f"Exception in get_payment_details ListSerializer: {e}")
                    traceback.print_exc()
        return None


class CustomPaymentSerializer(serializers.Serializer):
    student = serializers.IntegerField()
    group = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = serializers.ChoiceField(
        choices=[("income", "Kirim"), ("expense", "Chiqim")], default="income"
    )
    payer_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(
        max_length=500, required=False, allow_blank=True
    )
    date = serializers.DateField(required=False)


class EmployeeAdvanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source="employee.get_full_name", read_only=True
    )
    marked_by_name = serializers.CharField(
        source="marked_by.get_full_name", read_only=True
    )

    class Meta:
        model = EmployeeAdvance
        fields = [
            "id",
            "employee",
            "employee_name",
            "month",
            "amount",
            "description",
            "date",
            "marked_by",
            "marked_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "marked_by"]


class SuccessSerializer(serializers.Serializer):
    success = serializers.BooleanField(default=True)
    message = serializers.CharField(required=False, allow_null=True)
    count = serializers.IntegerField(required=False, allow_null=True)


class AbsentStudentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    phone = serializers.CharField()
    group = serializers.CharField()


class PaymentStatisticsSerializer(serializers.Serializer):
    groups = serializers.ListField(child=serializers.DictField())
    statistics = serializers.DictField()


class AdminExpenseSerializer(serializers.ModelSerializer):
    marked_by_name = serializers.CharField(
        source="marked_by.get_full_name", read_only=True
    )
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = AdminExpense
        fields = [
            "id",
            "title",
            "description",
            "amount",
            "date",
            "branch",
            "branch_name",
            "marked_by",
            "marked_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "marked_by", "created_at"]


class SpecialStudentFinancialSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    full_name = serializers.CharField()
    phone = serializers.CharField()
    status = serializers.CharField()
    status_display = serializers.CharField()
    group_id = serializers.IntegerField()
    group_name = serializers.CharField()
    monthly_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    custom_fee = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    expected_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    debt = serializers.DecimalField(max_digits=12, decimal_places=2)
    wallet_total_paid = serializers.DecimalField(max_digits=12, decimal_places=2)
    wallet_total_refunded = serializers.DecimalField(max_digits=12, decimal_places=2)
    last_payment_date = serializers.DateField(allow_null=True)

class SpecialStudentDashboardSummarySerializer(serializers.Serializer):
    total_expected = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_paid = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_debt = serializers.DecimalField(max_digits=15, decimal_places=2)
    students_count = serializers.IntegerField()
    status_counts = serializers.DictField(child=serializers.IntegerField(), required=False)

class SpecialStudentDashboardResponseSerializer(serializers.Serializer):
    summary = SpecialStudentDashboardSummarySerializer()
    students = SpecialStudentFinancialSerializer(many=True)
