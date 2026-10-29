import logging
from datetime import date
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from groups.models import GroupEnrollment, Student
from finance.privileged_service import (
    get_privileged_students_summary,
    get_privileged_student_attendance_history,
    update_privileged_attendance,
)
from finance.utils import normalize_month

logger = logging.getLogger(__name__)


class IsPrivilegedFinanceAuthorized(permissions.BasePermission):
    """
    Maxsus / Imtiyozli o'quvchilar moduliga kirish ruxsati:
    - SuperAdmin
    - Admin (faqat o'z filialidagi talabalar uchun)
    - Chief Accountant / Bosh hisobchi (finance moduli ruxsatiga ega xodimlar)
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        role = getattr(request.user, "role", None)
        if role in ["super_admin", "admin"]:
            return True

        # Staff permissions orqali 'finance' ruxsati tekshiriladi
        try:
            staff_perm = getattr(request.user, "staff_permissions", None)
            if staff_perm and staff_perm.permissions:
                finance_perm = staff_perm.permissions.get("finance", {})
                if finance_perm.get("view", False):
                    return True
        except Exception:
            pass

        return False


def _resolve_month(raw_month):
    """
    Query param yoki request body dan kelgan oyni xavfsiz sana (date) obyektiga aylantiradi.
    Formatlar: 'YYYY-MM', 'YYYY-MM-DD', yoki None (joriy oy).
    """
    if not raw_month:
        return timezone.localdate().replace(day=1)
    return normalize_month(raw_month)


class PrivilegedStudentsListView(APIView):
    """
    GET /api/v1/finance/privileged-students/
    GET /api/finance/privileged-students/

    Imtiyozli (davlat granti / kelajak.uz) o'quvchilar ro'yxati va real vaqtda hisoblangan
    moliyaviy ko'rsatkichlar (Davlat qarzi, O'qituvchi ulushi, Markaz marjasi).
    """

    permission_classes = [IsPrivilegedFinanceAuthorized]

    def get(self, request):
        try:
            month = _resolve_month(request.query_params.get("month"))
        except (ValueError, TypeError) as e:
            return Response(
                {"detail": f"Oy formati noto'g'ri. Format: YYYY-MM bo'lishi kerak. Xatolik: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        branch_id = request.query_params.get("branch_id")
        if request.user.role == "admin":
            # Admin xavfsizligi: faqat o'z filialini ko'ra oladi
            branch_id = request.user.branch_id
        elif branch_id:
            try:
                branch_id = int(branch_id)
            except (ValueError, TypeError):
                branch_id = None

        group_id = request.query_params.get("group_id")
        if group_id:
            try:
                group_id = int(group_id)
            except (ValueError, TypeError):
                group_id = None

        search = request.query_params.get("search", "").strip() or None

        try:
            page = int(request.query_params.get("page", 1))
            page_size = int(request.query_params.get("page_size", 20))
        except (ValueError, TypeError):
            page = 1
            page_size = 20

        data = get_privileged_students_summary(
            branch_id=branch_id,
            month=month,
            group_id=group_id,
            search=search,
            page=page,
            page_size=page_size,
        )

        return Response(data, status=status.HTTP_200_OK)


class PrivilegedStudentAttendanceHistoryView(APIView):
    """
    GET /api/v1/finance/privileged-students/{id}/attendance-history/
    GET /api/finance/privileged-students/{id}/attendance-history/

    O'quvchining tanlangan oy bo'yicha barcha rejalashtirilgan darslari, Face ID/qo'lda kiritilgan
    davomat holatlari va audit o'zgarishlar tarixi.
    """

    permission_classes = [IsPrivilegedFinanceAuthorized]

    def get(self, request, id):
        student = get_object_or_404(Student, id=id)

        # Admin faqat o'z filialidagi o'quvchini ko'ra oladi
        if request.user.role == "admin" and student.branch_id != request.user.branch_id:
            return Response(
                {"detail": "Siz faqat o'z filialingizdagi o'quvchi ma'lumotlarini ko'ra olasiz."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            month = _resolve_month(request.query_params.get("month"))
        except (ValueError, TypeError) as e:
            return Response(
                {"detail": f"Oy formati noto'g'ri. Format: YYYY-MM bo'lishi kerak. Xatolik: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        group_id = request.query_params.get("group_id")
        if group_id:
            try:
                group_id = int(group_id)
            except (ValueError, TypeError):
                group_id = None

        data = get_privileged_student_attendance_history(
            student_id=student.id,
            group_id=group_id,
            month=month,
        )

        return Response(data, status=status.HTTP_200_OK)


class PrivilegedStudentAttendanceOverrideView(APIView):
    """
    PATCH /api/v1/finance/privileged-students/{id}/attendance-override/
    PATCH /api/finance/privileged-students/{id}/attendance-override/

    Admin tomonidan imtiyozli o'quvchi davomatini qo'lda tahrirlash (override).
    Moliyaviy hisob-kitoblar (O'qituvchi maoshi va Davlat to'lovi) atomik tarzda qayta hisoblanadi
    va firibgarlikning oldini olish uchun AttendanceAuditLog jurnaliga yoziladi.
    """

    permission_classes = [IsPrivilegedFinanceAuthorized]

    def patch(self, request, id):
        student = get_object_or_404(Student, id=id)

        # Admin faqat o'z filialidagi o'quvchini tahrirlashi mumkin
        if request.user.role == "admin" and student.branch_id != request.user.branch_id:
            return Response(
                {"detail": "Siz faqat o'z filialingizdagi o'quvchini tahrirlashingiz mumkin."},
                status=status.HTTP_403_FORBIDDEN,
            )

        raw_month = request.data.get("month")
        try:
            month = _resolve_month(raw_month)
        except (ValueError, TypeError) as e:
            return Response(
                {"detail": f"Oy formati noto'g'ri. Format: YYYY-MM bo'lishi kerak. Xatolik: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        group_id = request.data.get("group_id")
        if not group_id:
            # Agar group_id berilmagan bo'lsa, o'quvchining faol guruhini topamiz
            enrollment = GroupEnrollment.objects.filter(student=student, is_active=True).first()
            if not enrollment:
                return Response(
                    {"detail": "O'quvchi birorta ham faol guruhga biriktirilmagan."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            group_id = enrollment.group_id
        else:
            try:
                group_id = int(group_id)
            except (ValueError, TypeError):
                return Response(
                    {"detail": "group_id butun son bo'lishi kerak."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        new_attended_count = request.data.get("new_attended_count")
        session_overrides = request.data.get("session_overrides")
        reason_for_change = request.data.get("reason_for_change", "").strip()

        if new_attended_count is None and not session_overrides:
            return Response(
                {"detail": "Kamida bitta parametr taqdim etilishi shart: 'new_attended_count' yoki 'session_overrides'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = update_privileged_attendance(
                student_id=student.id,
                group_id=group_id,
                month=month,
                new_attended_count=new_attended_count,
                session_overrides=session_overrides,
                admin_user=request.user,
                reason_for_change=reason_for_change,
            )
            return Response(result, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response(
                {"detail": e.message if hasattr(e, "message") else str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.exception("Error updating privileged attendance for student %s: %s", student.id, e)
            return Response(
                {"detail": f"Tizimda xatolik yuz berdi: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
