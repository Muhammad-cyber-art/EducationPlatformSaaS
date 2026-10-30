from collections import defaultdict
from datetime import date
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from finance.models import AttendanceAuditLog, MentorGroupSalaryConfig, Payment, StaffProfile
from finance.utils import (
    calculate_attendance_based_mentor_share,
    calculate_attendance_based_student_payment,
    floor_amount,
    normalize_month,
)
from groups.models import Group, GroupEnrollment, Student
from homework_attends.models import Attendance, AttendanceEditLog


WEEKDAY_UZ = {
    0: "Dushanba",
    1: "Seshanba",
    2: "Chorshanba",
    3: "Payshanba",
    4: "Juma",
    5: "Shanba",
    6: "Yakshanba",
}


def _get_group_mentor_salary_config(group):
    """Guruh uchun mentorning maosh konfiguratsiyasini qaytaradi (type va stavka)"""
    mentor = getattr(group, "mentor", None)
    if not mentor or not hasattr(mentor, "staff_profile"):
        return {
            "type": "NONE",
            "type_label": "Biriktirilmagan",
            "commission_percentage": Decimal("0"),
            "per_student_amount": Decimal("0"),
            "display_rate": "0 UZS",
        }

    profile = mentor.staff_profile
    group_config = MentorGroupSalaryConfig.objects.filter(mentor=mentor, group=group).first()

    salary_type = group_config.salary_type if group_config else getattr(profile, "salary_type", "fixed")
    commission_pct = (group_config.commission_percentage if group_config else getattr(profile, "commission_percentage", 0)) or Decimal("0")
    per_student_amt = (group_config.per_student_amount if group_config else getattr(profile, "per_student_amount", 0)) or Decimal("0")

    if salary_type == "percentage":
        return {
            "type": "PERCENTAGE",
            "type_label": "Foiz asosida",
            "commission_percentage": Decimal(str(commission_pct)),
            "per_student_amount": Decimal("0"),
            "display_rate": f"{commission_pct}%",
        }
    elif salary_type == "student_count":
        return {
            "type": "FIXED_PER_STUDENT",
            "type_label": "Har bir o'quvchi uchun",
            "commission_percentage": Decimal("0"),
            "per_student_amount": Decimal(str(per_student_amt)),
            "display_rate": f"{int(per_student_amt):,} UZS",
        }
    else:
        return {
            "type": "FIXED",
            "type_label": "Oylik sobit (Fixed)",
            "commission_percentage": Decimal("0"),
            "per_student_amount": Decimal("0"),
            "display_rate": "Sobit oylik",
        }


def get_privileged_students_summary(
    branch_id=None,
    month=None,
    group_id=None,
    search=None,
    page=1,
    page_size=20,
    status=None,
):
    """
    Maxsus / Imtiyozli va Kelishilgan narxdagi talabalar ro'yxati va real vaqtda hisoblangan moliyaviy ko'rsatkichlar.
    """
    if month is None:
        month = timezone.localdate().replace(day=1)
    else:
        month = normalize_month(month)

    if status and status in ["discount", "negotiated"]:
        target_statuses = [status]
    else:
        target_statuses = ["discount", "negotiated"]

    enrollments_qs = GroupEnrollment.objects.filter(
        is_active=True,
        student__status__in=target_statuses,
        student__is_active=True,
        student__is_archived=False,
    ).select_related("student", "group", "group__mentor", "group__branch")

    if branch_id:
        enrollments_qs = enrollments_qs.filter(group__branch_id=branch_id)

    if group_id:
        enrollments_qs = enrollments_qs.filter(group_id=group_id)

    if search:
        search = str(search).strip()
        enrollments_qs = enrollments_qs.filter(
            Q(student__full_name__icontains=search)
            | Q(student__phone__icontains=search)
            | Q(group__name__icontains=search)
        )

    enrollments_qs = enrollments_qs.order_by("student__full_name")

    total_count = enrollments_qs.count()

    # Pagination hisoblash
    try:
        page = max(1, int(page))
        page_size = max(1, min(100, int(page_size)))
    except (TypeError, ValueError):
        page = 1
        page_size = 20

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_enrollments = list(enrollments_qs[start_idx:end_idx])

    # Keshlar va guruh dars kunlari
    group_lesson_dates = {}
    items = []

    # N+1 muammosini oldini olish uchun bulk prefetch
    student_ids = [e.student_id for e in paginated_enrollments]
    group_ids = list({e.group_id for e in paginated_enrollments})
    mentor_ids = list({e.group.mentor_id for e in paginated_enrollments if e.group.mentor_id})

    # 1. Salary configs bulk prefetch
    configs_map = {}
    if mentor_ids and group_ids:
        for cfg in MentorGroupSalaryConfig.objects.filter(mentor_id__in=mentor_ids, group_id__in=group_ids):
            configs_map[(cfg.mentor_id, cfg.group_id)] = cfg

    # 2. Staff profiles bulk prefetch
    profiles_map = {}
    if mentor_ids:
        for p in StaffProfile.objects.filter(user_id__in=mentor_ids):
            profiles_map[p.user_id] = p

    # 3. Attendance records bulk prefetch (1 query per page)
    att_map = defaultdict(list)
    if student_ids and group_ids:
        attendances = Attendance.objects.filter(
            student_id__in=student_ids,
            group_id__in=group_ids,
            date__year=month.year,
            date__month=month.month,
        ).values("student_id", "group_id", "date", "is_present", "is_manually_adjusted", "marked_by_id")

        for a in attendances:
            att_map[(a["student_id"], a["group_id"])].append(a)

    # 4. Audit logs bulk prefetch (1 query per page)
    audit_logs_map = {}
    if student_ids and group_ids:
        logs = AttendanceAuditLog.objects.filter(
            student_id__in=student_ids,
            group_id__in=group_ids,
            month=month,
        ).select_related("modified_by")
        for log in logs:
            audit_logs_map[(log.student_id, log.group_id)] = log

    total_state_receivable = Decimal("0")
    total_teacher_earned = Decimal("0")
    total_center_margin = Decimal("0")
    total_lessons_planned = 0
    total_lessons_attended = 0

    for enr in paginated_enrollments:
        student = enr.student
        group = enr.group
        gid = group.id

        if gid not in group_lesson_dates:
            group_lesson_dates[gid] = group.get_lesson_dates(month.year, month.month)
        lesson_dates = group_lesson_dates[gid]
        n_total = len(lesson_dates)

        course_fee = Decimal(str(student.custom_fee if student.custom_fee is not None else (group.monthly_price or 0)))

        # O'qituvchi konfiguratsiyasi (In-memory, zero N+1)
        mentor_id = group.mentor_id
        cfg = configs_map.get((mentor_id, gid)) if mentor_id else None
        prof = profiles_map.get(mentor_id) if mentor_id else None

        if cfg:
            if cfg.salary_type == "percentage":
                salary_cfg = {
                    "type": "PERCENTAGE",
                    "type_label": "Foizli ulush",
                    "commission_percentage": cfg.commission_percentage,
                    "per_student_amount": Decimal("0"),
                    "display_rate": f"{cfg.commission_percentage}%",
                }
            elif cfg.salary_type == "student_count":
                salary_cfg = {
                    "type": "FIXED_PER_STUDENT",
                    "type_label": "Har bir o'quvchi uchun",
                    "commission_percentage": Decimal("0"),
                    "per_student_amount": cfg.per_student_amount,
                    "display_rate": f"{int(cfg.per_student_amount):,} UZS".replace(",", " "),
                }
            else:
                salary_cfg = {
                    "type": "FIXED_SALARY",
                    "type_label": "Fiksatsiyalangan oylik",
                    "commission_percentage": Decimal("0"),
                    "per_student_amount": Decimal("0"),
                    "display_rate": "Fiksatsiyalangan",
                }
        elif prof:
            if prof.salary_type == "percentage":
                salary_cfg = {
                    "type": "PERCENTAGE",
                    "type_label": "Foizli ulush",
                    "commission_percentage": prof.commission_percentage,
                    "per_student_amount": Decimal("0"),
                    "display_rate": f"{prof.commission_percentage}%",
                }
            elif prof.salary_type == "student_count":
                salary_cfg = {
                    "type": "FIXED_PER_STUDENT",
                    "type_label": "Har bir o'quvchi uchun",
                    "commission_percentage": Decimal("0"),
                    "per_student_amount": prof.per_student_amount,
                    "display_rate": f"{int(prof.per_student_amount):,} UZS".replace(",", " "),
                }
            else:
                salary_cfg = {
                    "type": "FIXED_SALARY",
                    "type_label": "Fiksatsiyalangan oylik",
                    "commission_percentage": Decimal("0"),
                    "per_student_amount": Decimal("0"),
                    "display_rate": "Fiksatsiyalangan",
                }
        else:
            salary_cfg = {
                "type": "FIXED_PER_STUDENT",
                "type_label": "Standart stavka",
                "commission_percentage": Decimal("0"),
                "per_student_amount": Decimal("230000"),
                "display_rate": "230 000 UZS",
            }

        # Davomat soni (In-memory, zero N+1)
        att_list = att_map.get((student.id, gid), [])
        attended_dates = {
            a["date"]
            for a in att_list
            if a["is_present"] and (a["marked_by_id"] is not None or a.get("is_manually_adjusted")) and a["date"] in lesson_dates
        }
        n_attended = min(n_total, len(attended_dates))
        has_manual = any(a.get("is_manually_adjusted") for a in att_list)

        # Moliyaviy ko'rsatkichlar (In-memory, zero N+1)
        raw_daily = course_fee / Decimal(str(n_total)) if n_total > 0 else Decimal("0")
        state_receivable = floor_amount(raw_daily * Decimal(str(n_attended)))
        if state_receivable > course_fee:
            state_receivable = course_fee

        teacher_earned = Decimal("0")
        if salary_cfg["type"] == "PERCENTAGE":
            teacher_earned = state_receivable * (salary_cfg["commission_percentage"] / Decimal("100"))
        elif salary_cfg["type"] == "FIXED_PER_STUDENT":
            if n_total > 0:
                raw_per_lesson = salary_cfg["per_student_amount"] / Decimal(str(n_total))
                teacher_earned = raw_per_lesson * Decimal(str(n_attended))
                if teacher_earned > salary_cfg["per_student_amount"]:
                    teacher_earned = salary_cfg["per_student_amount"]
        teacher_earned = floor_amount(teacher_earned)

        center_margin = max(Decimal("0"), state_receivable - teacher_earned)

        total_state_receivable += state_receivable
        total_teacher_earned += teacher_earned
        total_center_margin += center_margin
        total_lessons_planned += n_total
        total_lessons_attended += n_attended

        # Oxirgi audit log (In-memory, zero N+1)
        last_log = audit_logs_map.get((student.id, gid))

        items.append({
            "student_id": student.id,
            "student_name": student.full_name,
            "student_phone": student.phone or "",
            "student_status": student.status,
            "student_status_label": student.get_status_display(),
            "custom_fee": float(student.custom_fee) if student.custom_fee is not None else None,
            "group_id": group.id,
            "group_name": group.name,
            "branch_id": group.branch_id,
            "branch_name": group.branch.name if group.branch else "",
            "mentor_id": group.mentor_id,
            "mentor_name": group.mentor.get_full_name() if group.mentor else "Biriktirilmagan",
            "course_fee": float(course_fee),
            "n_total": n_total,
            "n_attended": n_attended,
            "attended_count": n_attended,
            "teacher_salary_type": salary_cfg["type"],
            "teacher_salary_type_label": salary_cfg["type_label"],
            "teacher_base_rate": float(salary_cfg["commission_percentage"] if salary_cfg["type"] == "PERCENTAGE" else salary_cfg["per_student_amount"]),
            "teacher_rate_display": salary_cfg["display_rate"],
            "earned_teacher_share": float(teacher_earned),
            "state_receivable_amount": float(state_receivable),
            "center_gross_margin": float(center_margin),
            "attendance_rate": round((n_attended / n_total * 100) if n_total > 0 else 0, 1),
            "has_manual_adjustment": has_manual,
            "last_audit_log": {
                "id": last_log.id,
                "modified_by": last_log.modified_by.get_full_name() or last_log.modified_by.username if last_log and last_log.modified_by else None,
                "created_at": last_log.created_at.strftime("%Y-%m-%d %H:%M") if last_log else None,
                "reason": last_log.reason_for_change if last_log else None,
                "previous_count": last_log.previous_attended_count if last_log else None,
                "new_count": last_log.new_attended_count if last_log else None,
            } if last_log else None,
        })

    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

    return {
        "results": items,
        "meta": {
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "month": month.strftime("%Y-%m"),
        },
        "summary": {
            "total_students": total_count,
            "total_state_receivable": float(total_state_receivable),
            "total_teacher_earned": float(total_teacher_earned),
            "total_center_margin": float(total_center_margin),
            "total_lessons_planned": total_lessons_planned,
            "total_lessons_attended": total_lessons_attended,
            "overall_attendance_rate": round((total_lessons_attended / total_lessons_planned * 100) if total_lessons_planned > 0 else 0, 1),
        },
    }


def get_privileged_student_attendance_history(student_id: int, group_id: int = None, month: date = None):
    """
    Bitta imtiyozli talabaning tanlangan oydagi barcha dars sessiyalari va audit jurnali.
    """
    month = normalize_month(month) or timezone.localdate().replace(day=1)
    student = Student.objects.select_related("branch").get(id=student_id)

    if not group_id:
        enrollment = GroupEnrollment.objects.filter(student_id=student_id, is_active=True).first()
        if enrollment:
            group_id = enrollment.group_id
        elif student.group_id:
            group_id = student.group_id
        else:
            raise ValidationError("O'quvchi birorta ham guruhga biriktirilmagan.")

    group = Group.objects.select_related("mentor", "branch").get(id=group_id)

    lesson_dates = group.get_lesson_dates(month.year, month.month)
    n_total = len(lesson_dates)

    salary_cfg = _get_group_mentor_salary_config(group)
    course_fee = Decimal(str(student.custom_fee if student.custom_fee is not None else (group.monthly_price or 0)))

    attendances = Attendance.objects.filter(
        student=student,
        group=group,
        date__in=lesson_dates,
    ).select_related("marked_by")
    att_by_date = {att.date: att for att in attendances}

    sessions = []
    n_attended = 0
    today = timezone.localdate()

    for idx, d in enumerate(lesson_dates, start=1):
        att = att_by_date.get(d)
        is_present = bool(att.is_present and (att.marked_by_id is not None or att.is_manually_adjusted)) if att else False
        is_manual = att.is_manually_adjusted if att else False
        marked_by_name = (att.marked_by.get_full_name() or att.marked_by.username) if (att and att.marked_by) else None
        updated_at = att.updated_at.strftime("%Y-%m-%d %H:%M") if att else None

        if is_present:
            n_attended += 1

        sessions.append({
            "lesson_number": idx,
            "date": d.strftime("%Y-%m-%d"),
            "day_name": WEEKDAY_UZ.get(d.weekday(), ""),
            "is_past": d <= today,
            "is_present": is_present,
            "is_manually_adjusted": is_manual,
            "marked_by": marked_by_name,
            "updated_at": updated_at,
        })

    # Moliyaviy ko'rsatkichlar
    state_receivable = calculate_attendance_based_student_payment(
        student=student,
        group=group,
        month_date=month,
        ignore_today_check=True,
    )

    teacher_earned = Decimal("0")
    if salary_cfg["type"] == "PERCENTAGE":
        teacher_earned = state_receivable * (salary_cfg["commission_percentage"] / Decimal("100"))
    elif salary_cfg["type"] == "FIXED_PER_STUDENT":
        if n_total > 0:
            raw_per_lesson = salary_cfg["per_student_amount"] / Decimal(str(n_total))
            teacher_earned = raw_per_lesson * Decimal(str(n_attended))
            if teacher_earned > salary_cfg["per_student_amount"]:
                teacher_earned = salary_cfg["per_student_amount"]
    teacher_earned = floor_amount(teacher_earned)

    center_margin = max(Decimal("0"), state_receivable - teacher_earned)

    # Audit loglar tarixi
    logs = AttendanceAuditLog.objects.filter(
        student=student, group=group, month=month
    ).select_related("modified_by").order_by("-created_at")

    audit_logs_data = [
        {
            "id": log.id,
            "created_at": log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "modified_by": log.modified_by.get_full_name() or log.modified_by.username if log.modified_by else "Tizim",
            "previous_count": log.previous_attended_count,
            "new_count": log.new_attended_count,
            "previous_teacher_share": float(log.previous_teacher_share),
            "new_teacher_share": float(log.new_teacher_share),
            "previous_state_receivable": float(log.previous_state_receivable),
            "new_state_receivable": float(log.new_state_receivable),
            "reason": log.reason_for_change,
        }
        for log in logs
    ]

    return {
        "student": {
            "id": student.id,
            "full_name": student.full_name,
            "phone": student.phone or "",
            "status": student.status,
            "status_label": student.get_status_display(),
        },
        "group": {
            "id": group.id,
            "name": group.name,
            "branch_id": group.branch_id,
            "branch_name": group.branch.name if group.branch else "",
            "mentor_name": group.mentor.get_full_name() if group.mentor else "Biriktirilmagan",
            "course_fee": float(course_fee),
        },
        "month": month.strftime("%Y-%m"),
        "metrics": {
            "n_total": n_total,
            "n_attended": n_attended,
            "attendance_rate": round((n_attended / n_total * 100) if n_total > 0 else 0, 1),
            "teacher_salary_type": salary_cfg["type"],
            "teacher_rate_display": salary_cfg["display_rate"],
            "earned_teacher_share": float(teacher_earned),
            "state_receivable_amount": float(state_receivable),
            "center_gross_margin": float(center_margin),
        },
        "sessions": sessions,
        "audit_logs": audit_logs_data,
    }


def update_privileged_attendance(
    student_id: int,
    group_id: int,
    month: date,
    new_attended_count: int = None,
    session_overrides: list = None,
    admin_user = None,
    reason_for_change: str = "",
):
    """
    Idempotent, atomik va row-level lock (select_for_update) bilan himoyalangan xizmat.
    Imtiyozli talaba davomatini tahrirlaydi, moliyaviy tizimni qayta hisoblaydi va audit jurnaliga yozadi.
    """
    month = normalize_month(month) or timezone.localdate().replace(day=1)

    with transaction.atomic():
        # Row-level locking to prevent race conditions during financial recalculation
        student = Student.objects.select_for_update().get(id=student_id)
        group = Group.objects.select_for_update().get(id=group_id)

        lesson_dates = group.get_lesson_dates(month.year, month.month)
        n_total = len(lesson_dates)

        if n_total == 0:
            raise ValidationError("Ushbu oyda guruh uchun rejalashtirilgan darslar jadvali mavjud emas (N_total = 0).")

        salary_cfg = _get_group_mentor_salary_config(group)

        # 1. OLDINGI (BEFORE) KO'RSATKICHLAR
        prev_attended_qs = Attendance.objects.filter(
            student=student,
            group=group,
            date__in=lesson_dates,
            is_present=True,
            marked_by__isnull=False,
        )
        prev_attended_count = min(n_total, prev_attended_qs.count())

        prev_state_receivable = calculate_attendance_based_student_payment(
            student=student, group=group, month_date=month, ignore_today_check=True
        )

        prev_teacher_share = Decimal("0")
        if salary_cfg["type"] == "PERCENTAGE":
            prev_teacher_share = prev_state_receivable * (salary_cfg["commission_percentage"] / Decimal("100"))
        elif salary_cfg["type"] == "FIXED_PER_STUDENT":
            raw_per_lesson = salary_cfg["per_student_amount"] / Decimal(str(n_total))
            prev_teacher_share = raw_per_lesson * Decimal(str(prev_attended_count))
            if prev_teacher_share > salary_cfg["per_student_amount"]:
                prev_teacher_share = salary_cfg["per_student_amount"]
        prev_teacher_share = floor_amount(prev_teacher_share)

        if not admin_user:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            admin_user = (
                User.objects.filter(is_superuser=True).first()
                or User.objects.filter(role__in=['admin', 'superadmin', 'director']).first()
                or User.objects.first()
            )

        # 2. DAVOMATNI TAHRIRLASH
        if session_overrides and isinstance(session_overrides, list):
            # Sessiyalar kesimida aniq sanalar bo'yicha tahrirlash
            lesson_dates_set = set(lesson_dates)
            for item in session_overrides:
                date_str = item.get("date")
                is_pres = bool(item.get("is_present"))
                if not date_str:
                    continue
                parts = str(date_str).split("-")
                sess_date = date(int(parts[0]), int(parts[1]), int(parts[2]))
                if sess_date not in lesson_dates_set:
                    continue

                att, created = Attendance.objects.get_or_create(
                    student=student,
                    group=group,
                    date=sess_date,
                    defaults={
                        "is_present": is_pres,
                        "is_manually_adjusted": True,
                        "marked_by": admin_user,
                    },
                )
                if not created:
                    old_st = att.is_present
                    att.is_present = is_pres
                    att.is_manually_adjusted = True
                    att.marked_by = admin_user
                    att.save(update_fields=["is_present", "is_manually_adjusted", "marked_by", "updated_at"])

                    if old_st != is_pres and admin_user:
                        AttendanceEditLog.objects.create(
                            attendance=att,
                            changed_by=admin_user,
                            old_status=old_st,
                            new_status=is_pres,
                            reason=reason_for_change or "Maxsus o'quvchi davomati audit orqali yangilandi",
                        )
                else:
                    if admin_user:
                        AttendanceEditLog.objects.create(
                            attendance=att,
                            changed_by=admin_user,
                            old_status=False,
                            new_status=is_pres,
                            reason=reason_for_change or "Maxsus o'quvchi davomati audit orqali yangi kiritildi",
                        )
        elif new_attended_count is not None:
            # Darslar soni bo'yicha to'g'ridan-to'g'ri yangilash
            new_attended_count = int(new_attended_count)
            if new_attended_count < 0 or new_attended_count > n_total:
                raise ValidationError(f"Davomat soni 0 va {n_total} oralig'ida bo'lishi shart ($0 \\le N_{{attended}} \\le N_{{total}}$).")

            sorted_dates = sorted(lesson_dates)
            for idx, sess_date in enumerate(sorted_dates):
                is_pres = idx < new_attended_count
                att, created = Attendance.objects.get_or_create(
                    student=student,
                    group=group,
                    date=sess_date,
                    defaults={
                        "is_present": is_pres,
                        "is_manually_adjusted": True,
                        "marked_by": admin_user,
                    },
                )
                if not created and att.is_present != is_pres:
                    old_st = att.is_present
                    att.is_present = is_pres
                    att.is_manually_adjusted = True
                    att.marked_by = admin_user
                    att.save(update_fields=["is_present", "is_manually_adjusted", "marked_by", "updated_at"])

                    AttendanceEditLog.objects.create(
                        attendance=att,
                        changed_by=admin_user,
                        old_status=old_st,
                        new_status=is_pres,
                        reason=reason_for_change or "Maxsus o'quvchi davomati override qilindi",
                    )

        # 3. YANGI (AFTER) KO'RSATKICHLAR
        new_actual_attended = min(n_total, Attendance.objects.filter(
            student=student,
            group=group,
            date__in=lesson_dates,
            is_present=True,
            marked_by__isnull=False,
        ).count())

        new_state_receivable = calculate_attendance_based_student_payment(
            student=student, group=group, month_date=month, ignore_today_check=True
        )

        new_teacher_share = Decimal("0")
        if salary_cfg["type"] == "PERCENTAGE":
            new_teacher_share = new_state_receivable * (salary_cfg["commission_percentage"] / Decimal("100"))
        elif salary_cfg["type"] == "FIXED_PER_STUDENT":
            raw_per_lesson = salary_cfg["per_student_amount"] / Decimal(str(n_total))
            new_teacher_share = raw_per_lesson * Decimal(str(new_actual_attended))
            if new_teacher_share > salary_cfg["per_student_amount"]:
                new_teacher_share = salary_cfg["per_student_amount"]
        new_teacher_share = floor_amount(new_teacher_share)

        new_center_margin = max(Decimal("0"), new_state_receivable - new_teacher_share)

        # 4. MOLIYAVIY HISOB-KITOBNI RE-TRIGGER QILISH (Idempotent Payment update)
        is_discount = (student.status == "discount")
        payment, _ = Payment.objects.get_or_create(
            student=student,
            group=group,
            month=month,
            defaults={"is_auto_discount": is_discount, "amount": new_state_receivable},
        )
        payment.amount = new_state_receivable
        payment.is_auto_discount = is_discount
        payment.save(update_fields=["amount", "is_auto_discount"])

        # O'qituvchining oylik paymentlarini yangilash
        if group.mentor and hasattr(group.mentor, "staff_profile"):
            group.mentor.staff_profile._update_unpaid_payments()

        # 5. AUDIT JURNALIGA YOZISH (Billing Fraud Prevention)
        audit_log = AttendanceAuditLog.objects.create(
            student=student,
            group=group,
            month=month,
            modified_by=admin_user,
            previous_attended_count=prev_attended_count,
            new_attended_count=new_actual_attended,
            total_planned_lessons=n_total,
            previous_teacher_share=prev_teacher_share,
            new_teacher_share=new_teacher_share,
            previous_state_receivable=prev_state_receivable,
            new_state_receivable=new_state_receivable,
            reason_for_change=reason_for_change or "Admin tomonidan qo'lda tahrirlandi",
        )

        return {
            "success": True,
            "message": "Davomat muvaffaqiyatli yangilandi va moliyaviy hisob-kitoblar qayta bajarildi.",
            "audit_log_id": audit_log.id,
            "student_id": student.id,
            "student_name": student.full_name,
            "group_id": group.id,
            "group_name": group.name,
            "month": month.strftime("%Y-%m"),
            "previous": {
                "attended_count": prev_attended_count,
                "teacher_share": float(prev_teacher_share),
                "state_receivable": float(prev_state_receivable),
            },
            "current": {
                "n_total": n_total,
                "attended_count": new_actual_attended,
                "teacher_share": float(new_teacher_share),
                "state_receivable": float(new_state_receivable),
                "center_gross_margin": float(new_center_margin),
            },
            "financial_delta": {
                "delta_teacher_share": float(new_teacher_share - prev_teacher_share),
                "delta_state_receivable": float(new_state_receivable - prev_state_receivable),
            },
        }
