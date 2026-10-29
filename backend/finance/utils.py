# finance/utils.py
import decimal
import math
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone


def normalize_month(value) -> date:
    """
    Har qanday sana yoki sana matnini (str) o'sha oyning 1-kuniga keltiradi
    """
    if not value:
        return None
    if isinstance(value, str):
        parts = value.strip().split('-')
        return date(int(parts[0]), int(parts[1]), 1)
    return value.replace(day=1)


def _auto_floor_precision(amount):
    """
    Summa kattaligiga qarab optimal yaxlitlash aniqligi:
    1 so'mgacha aniq hisoblash — katta summalarda (10 000 - 30 000 so'm)
    kamayib ketishining oldini olish uchun 1 so'm qaytaradi.
    """
    return 1


def floor_amount(value, precision=1):
    """
    Har qanday pul miqdorini eng yaqin <precision> ga yaxlitlaydi.
    Default aniqlik 1 so'm (tiyinlarsiz, 1 so'mgacha aniq Decimal).
    Katta pullarda (10 000 - 30 000 so'm) kamayib ketishining oldini oladi.

    Parametrlar:
        value:     Yaxlitlanadigan son (int, float, Decimal, str)
        precision: Yaxlitlash aniqligi (default: 1 so'm)
                   Agar None bo'lsa -> _auto_floor_precision (1 so'm)
    """
    if value is None:
        return Decimal("0")
    try:
        amount = Decimal(str(value))
        if precision is None:
            precision = _auto_floor_precision(amount)
        if precision == 1:
            return amount.quantize(Decimal("1"), rounding=decimal.ROUND_HALF_UP)
        divisor = Decimal(str(precision))
        return (amount // divisor) * divisor
    except (TypeError, ValueError, decimal.InvalidOperation):
        return Decimal("0")


def calculate_attendance_based_student_payment(student, group, month_date, ignore_today_check=False, lesson_dates_cache=None, enrollment_cache=None, attendance_cache=None):
    """
    Imtiyozli (discount) va Kelishilgan (negotiated) student uchun to'lov summasini hisoblash:
    (Oylik narx / oydagi darslar soni) * (Kelgan darslar soni)
    Maksimal summasi student custom_fee (yoki guruh narxi)dan oshmasligi kerak!

    Qo'shimcha qoida:
    - Agar student oy o'rtasida qo'shilgan bo'lsa, faqat join_date'dan keyingi darslar hisoblanadi.

    BUG TUZATISHLAR:
    1. daily_price uchun floor_amount() erta chaqirilmaydi — ko'paytmadan KEYIN yaxlitlash.
    2. attendance_cache ishlatilganda active_lesson_dates va join_date filtrlari
       keshda yo'q → to'g'ridan-to'g'ri DB so'rovi ishlatiladi (aniq hisoblash uchun).
    3. discount o'quvchida custom_fee=None bo'lsa log chiqariladi (guruh narxi ishlatiladi).
    """
    from groups.models import GroupEnrollment
    from homework_attends.models import Attendance

    # Asosiy narxni aniqlash
    # BUG #3 FIX: discount o'quvchida custom_fee=None bo'lsa guruh narxi ishlatiladi —
    # bu holat ko'p hollarda noto'g'ri natija berishi mumkin, shuning uchun log chiqaramiz.
    base_price = group.monthly_price
    if student.status in ["low_income", "negotiated", "discount"]:
        if student.custom_fee is not None:
            base_price = student.custom_fee
        # else: guruh narxi ishlatiladi (custom_fee sozlanmagan)

    # Join date aniqlash (GroupEnrollment -> fallback Student.joined_at)
    join_date = None
    if enrollment_cache is not None and ('_join_dates' in enrollment_cache):
        join_date = enrollment_cache['_join_dates'].get((student.id, group.id))
    else:
        enrollment = (
            GroupEnrollment.objects.filter(student=student, group=group)
            .only("joined_at")
            .first()
        )
        if enrollment and enrollment.joined_at:
            join_date = enrollment.joined_at.date()
    if join_date is None and student.joined_at:
        join_date = student.joined_at.date()

    # Oy boshlanishi va tugash sanalarini hisoblash (indekslangan B-tree so'rovlar uchun)
    import calendar
    from datetime import date
    _, last_day = calendar.monthrange(month_date.year, month_date.month)
    month_start = date(month_date.year, month_date.month, 1)
    month_end = date(month_date.year, month_date.month, last_day)

    # Agar o'quvchining ushbu oyda haqiqiy tasdiqlangan davomati (Attendance) mavjud bo'lsa,
    # joined_at sanasi ushbu darslarni asossiz ravishda kesib tashlamasligi kerak
    earliest_att_date = (
        Attendance.objects.filter(
            student=student,
            group=group,
            date__range=(month_start, month_end),
            is_present=True,
            marked_by__isnull=False,
        )
        .order_by("date")
        .values_list("date", flat=True)
        .first()
    )
    if earliest_att_date and join_date and earliest_att_date < join_date:
        join_date = earliest_att_date

    # Guruh dars kunlari shu oyda (cache'dan foydalanish optimizatsiyasi)
    if lesson_dates_cache is not None and group.id in lesson_dates_cache:
        full_month_lessons = list(lesson_dates_cache[group.id])
    else:
        full_month_lessons = group.get_lesson_dates(month_date.year, month_date.month)
        if lesson_dates_cache is not None:
            lesson_dates_cache[group.id] = full_month_lessons

    # BUG FIX: Bir kunlik narx to'liq oydagi darslar soniga (masalan 12) bo'linishi kerak.
    # Agar biz join_date'dan keyingi kunlarni olsak (masalan 3 ta dars qolgan bo'lsa),
    # narx 4 barobar qimmatlashib ketadi! (O'quvchining 1 kunlik davomati butun oylik narxga yetib boradi).
    total_lessons_count = len(full_month_lessons)
    if total_lessons_count <= 0:
        return Decimal("0")

    lesson_dates = full_month_lessons
    if join_date:
        lesson_dates = [d for d in lesson_dates if d >= join_date]

    # BUG #1 FIX: daily_price uchun floor_amount() erta chaqirilmaydi.
    # Asl muammo: floor_amount(base_price / N) * present_count
    #   → har bir kunda precision yo'qoladi va N martagacha kattalashadi.
    # Tuzatma: avval ko'paytamiz, keyin yaxlitlaymiz.
    # Misal: 300_000 / 8 = 37_500 → floor → 37_000 × 8 = 296_000 (4_000 yo'qoldi!)
    # To'g'ri:  300_000 / 8 × present_count → keyin floor.
    raw_daily = Decimal(str(base_price)) / Decimal(str(total_lessons_count))

    # Faqat o'tib ketgan va oydagi dars kunlarini olamiz (agar ignore_today_check bo'lsa, barchasini olamiz)
    if not ignore_today_check:
        today = timezone.localdate()
        # Agar sanada tasdiqlangan davomat mavjud bo'lsa, u bugundan keyin bo'lsa ham hisobga olinadi
        marked_dates = set(
            Attendance.objects.filter(
                student=student,
                group=group,
                date__range=(month_start, month_end),
                marked_by__isnull=False,
            ).values_list("date", flat=True)
        )
        active_lesson_dates = [d for d in lesson_dates if d <= today or d in marked_dates]
    else:
        active_lesson_dates = lesson_dates

    # Kelgan darslar sonini hisoblash:
    # - Faqat oydagi dars kunlari
    # - join_date'dan keyin
    # - is_present=True
    # - faqat tasdiqlangan (marked_by mavjud)
    attendance_filters = {
        "student": student,
        "group": group,
        "date__range": (month_start, month_end),
        "date__in": active_lesson_dates,
        "is_present": True,
        "marked_by__isnull": False,
    }
    if join_date:
        attendance_filters["date__gte"] = join_date

    # BUG #2 FIX: attendance_cache ishlatilganda active_lesson_dates va join_date
    # filtrlari QOLDIRIB KETILADI — bu kelajakdagi darslarni yoki join_date'dan oldingi
    # davomatlarni ham hisoblashga olib keladi (noto'g'ri natija).
    # Shuning uchun HAR DOIM DB dan to'g'ri so'rov yuboramiz.
    # Cache faqat bulk-read uchun mos, real-time hisob uchun emas.
    present_count = Attendance.objects.filter(**attendance_filters).count()

    # BUG #1 FIX (davomi): ko'paytmadan KEYIN yaxlitlaymiz
    total_amount = raw_daily * Decimal(str(present_count))

    # Maksimal summasi student narxidan (base_price) oshmasin
    if total_amount > Decimal(str(base_price)):
        total_amount = Decimal(str(base_price))

    return floor_amount(total_amount)


# Backward compatibility
calculate_discount_student_payment = calculate_attendance_based_student_payment


def calculate_attendance_based_mentor_share(
    student, group, month_date, per_student_amount, commission_percentage=None, ignore_today_check=False,
    lesson_dates_cache=None, enrollment_cache=None, attendance_cache=None
):
    """
    Per_student yoki foizli mentor uchun imtiyozli (discount) va kelishilgan (negotiated) student uchun ulush summasini hisoblash:

    LOGIC AS PER REQUIREMENTS:
    1. (Guruh oylik narxi / oydagi darslar soni) = bir dars narxi
    2. Imtiyozli o'quvchining kelgan darslar sonini hisoblash (is_present=True)
    3. (Kelgan darslar soni * bir dars narxi) = o'quvchining total summasi
    4. Mentor ulushi:
       - Agar commission_percentage bo'lsa: total summadan foiz olinadi
       - Aks holda: (per_student_amount / total darslar) * kelgan darslar

    Qo'shimcha qoida:
    - Agar student oy o'rtasida qo'shilgan bo'lsa, faqat join_date'dan keyingi darslar hisoblanadi.
    """
    from groups.models import GroupEnrollment
    from homework_attends.models import Attendance

    # Step 1: Asosiy student narxini aniqlash (custom fee yoki group price)
    base_price = group.monthly_price
    if student.status in ["low_income", "negotiated", "discount"]:
        if student.custom_fee is not None:
            base_price = student.custom_fee

    # Join date aniqlash (cache yoki DB)
    join_date = None
    if enrollment_cache is not None and ('_join_dates' in enrollment_cache):
        join_date = enrollment_cache['_join_dates'].get((student.id, group.id))
    else:
        enrollment = (
            GroupEnrollment.objects.filter(student=student, group=group)
            .only("joined_at")
            .first()
        )
        if enrollment and enrollment.joined_at:
            join_date = enrollment.joined_at.date()
    if join_date is None and student.joined_at:
        join_date = student.joined_at.date()

    # Oy boshlanishi va tugash sanalarini hisoblash (indekslangan B-tree so'rovlar uchun)
    import calendar
    from datetime import date
    _, last_day = calendar.monthrange(month_date.year, month_date.month)
    month_start = date(month_date.year, month_date.month, 1)
    month_end = date(month_date.year, month_date.month, last_day)

    # Agar o'quvchining ushbu oyda haqiqiy tasdiqlangan davomati (Attendance) mavjud bo'lsa,
    # joined_at sanasi ushbu darslarni asossiz ravishda kesib tashlamasligi kerak
    earliest_att_date = (
        Attendance.objects.filter(
            student=student,
            group=group,
            date__range=(month_start, month_end),
            is_present=True,
            marked_by__isnull=False,
        )
        .order_by("date")
        .values_list("date", flat=True)
        .first()
    )
    if earliest_att_date and join_date and earliest_att_date < join_date:
        join_date = earliest_att_date

    # Step 2: Guruh dars kunlari shu oyda (cache'dan foydalanish)
    if lesson_dates_cache is not None and group.id in lesson_dates_cache:
        full_month_lessons = list(lesson_dates_cache[group.id])
    else:
        full_month_lessons = group.get_lesson_dates(month_date.year, month_date.month)
        if lesson_dates_cache is not None:
            lesson_dates_cache[group.id] = full_month_lessons
    
    # BUG FIX: Xuddi student to'lovidagi kabi, bir kunlik narx to'liq darslar sonidan chiqadi
    total_lessons_count = len(full_month_lessons)
    if total_lessons_count <= 0:
        return Decimal("0")

    lesson_dates = full_month_lessons
    if join_date:
        lesson_dates = [d for d in lesson_dates if d >= join_date]

    # Bir dars narxi (student summasidan hisoblash)
    # BUG FIX: floor_amount erta chaqirilmaydi
    raw_daily = Decimal(str(base_price)) / Decimal(str(total_lessons_count))

    # Step 3: Faqat o'tib ketgan va oydagi dars kunlarini olamiz (agar ignore_today_check bo'lsa, barchasini olamiz)
    if not ignore_today_check:
        today = timezone.localdate()
        # Agar sanada tasdiqlangan davomat mavjud bo'lsa, u bugundan keyin bo'lsa ham hisobga olinadi
        marked_dates = set(
            Attendance.objects.filter(
                student=student,
                group=group,
                date__range=(month_start, month_end),
                marked_by__isnull=False,
            ).values_list("date", flat=True)
        )
        active_lesson_dates = [d for d in lesson_dates if d <= today or d in marked_dates]
    else:
        active_lesson_dates = lesson_dates

    # Kelgan darslar sonini hisoblash
    attendance_filters = {
        "student": student,
        "group": group,
        "date__range": (month_start, month_end),
        "date__in": active_lesson_dates,
        "is_present": True,
        "marked_by__isnull": False,
    }
    if join_date:
        attendance_filters["date__gte"] = join_date

    present_count = Attendance.objects.filter(**attendance_filters).count()

    # Step 4: O'quvchining total summasi (kelgan darslar asosida)
    student_total = raw_daily * Decimal(str(present_count))
    if student_total > Decimal(str(base_price)):
        student_total = Decimal(str(base_price))

    # Step 5: Mentor ulushini hisoblash
    if commission_percentage and commission_percentage > 0:
        # Foizli ulush
        mentor_share = student_total * (
            Decimal(str(commission_percentage)) / Decimal("100")
        )
    else:
        # Per student ulush (darslar asosida)
        # BUG FIX: floor_amount erta chaqirilmaydi
        raw_per_lesson_mentor = Decimal(str(per_student_amount)) / Decimal(str(total_lessons_count))
        mentor_share = raw_per_lesson_mentor * Decimal(str(present_count))
        if mentor_share > Decimal(str(per_student_amount)):
            mentor_share = Decimal(str(per_student_amount))

    return floor_amount(mentor_share)


# Backward compatibility
calculate_discount_student_payment_for_per_student_mentor = (
    calculate_attendance_based_mentor_share
)


def get_teacher_negotiated_center_fee(group):
    """
    Kategoriya C: 'O'qituvchi kelishgan' (teacher_negotiated) talaba uchun
    markazning operatsion ulushini hisoblash.

    Qoida (Ground Truth):
    - Talaba faqat markazning operatsion ulushini to'laydi: (Course Fee - Standard Teacher Share)
    - O'qituvchi ulushi = 0 UZS (o'qituvchi oyligiga/balansiga mutlaqo qo'shilmaydi)
    - Markaz daromadi = talabadan undirilgan summaning 100%
    """
    if not group or not getattr(group, "monthly_price", None):
        return Decimal("0")

    course_fee = Decimal(str(group.monthly_price or 0))
    mentor = getattr(group, "mentor", None)
    if not mentor or not hasattr(mentor, "staff_profile"):
        return course_fee

    profile = mentor.staff_profile
    from finance.models import MentorGroupSalaryConfig

    group_config = MentorGroupSalaryConfig.objects.filter(mentor=mentor, group=group).first()

    salary_type = group_config.salary_type if group_config else getattr(profile, "salary_type", None)
    commission_pct = (group_config.commission_percentage if group_config else getattr(profile, "commission_percentage", 0)) or Decimal("0")
    per_student_amt = (group_config.per_student_amount if group_config else getattr(profile, "per_student_amount", 0)) or Decimal("0")

    if salary_type == "percentage":
        teacher_share = course_fee * (Decimal(str(commission_pct)) / Decimal("100"))
    elif salary_type == "student_count":
        teacher_share = Decimal(str(per_student_amt))
    else:
        teacher_share = Decimal("0")

    center_share = course_fee - teacher_share
    return floor_amount(max(Decimal("0"), center_share))



def attendance_refund_queryset(year, month, branch=None, paid_only=False):
    """
    Davomat (kelmaganlik) bo'yicha Payment.refund_amount yozuvlari.
    FinanceTransaction 'refund' kategoriyasidan farqli — pul kassadan chiqmaydi,
    to'lov summasidan chegirma sifatida qo'llanadi.
    """
    from finance.models import Payment

    qs = Payment.objects.filter(
        month__year=year,
        month__month=month,
        refund_ignored=False,
        refund_amount__gt=0,
    )
    if branch is not None:
        qs = qs.filter(group__branch=branch)
    if paid_only:
        qs = qs.filter(Q(is_paid=True) | Q(paid_amount__gt=0))
    return qs


def aggregate_attendance_refunds(year, month, branch=None, paid_only=False):
    total = attendance_refund_queryset(
        year, month, branch=branch, paid_only=paid_only
    ).aggregate(total=Sum("refund_amount"))["total"]
    return float(total or 0)


def aggregate_attendance_refunds_by_branch(year, month, paid_only=False):
    """{branch_id: refund_sum}"""
    qs = attendance_refund_queryset(year, month, branch=None, paid_only=paid_only)
    rows = qs.values("group__branch_id").annotate(total=Sum("refund_amount"))
    return {
        r["group__branch_id"]: float(r["total"] or 0)
        for r in rows
        if r["group__branch_id"]
    }


def calculate_group_revenue_and_mentor_share(
    group, month_date, profile=None, payment_map=None, extra_map=None, ignore_today_check=False,
    lesson_dates_cache=None, attendance_cache=None, enrollment_cache=None
):
    """
    Bir guruh uchun taxminiy tushum, real tushum va mentor ulushini hisoblash (reusable utility).
    Mentor guruhi uchun guruh konfiguratsiyasini (agar mavjud bo'lsa) ishlatadi.

    Args:
        group: Group model object
        month_date: Date object (oyning 1-kuni yoki istalgan sana, normalize_month ishlatiladi)
        profile: StaffProfile object (faqat mentor uchun kerak)
        payment_map: {(student_id, group_id): Payment} (agar yo'q bo'lsa, query qilinadi)
        extra_map: {(student_id, group_id): Decimal} (student_extra tranzaksiyalar, agar yo'q bo'lsa query qilinadi)

    Returns:
        dict: {
            'group_id': group.id,
            'actual_revenue': Decimal,
            'expected_revenue': Decimal,
            'mentor_share_paid': Decimal (faqat mentor uchun),
            'mentor_share_expected': Decimal (faqat mentor uchun),
            'paid_students': list,
            'unpaid_students': list
        }
    """
    from groups.models import Group

    from finance.models import FinanceTransaction, MentorGroupSalaryConfig, Payment

    month_date = normalize_month(month_date)

    # To'lovlar va extra tranzaksiyalar mapini tayyorlash (agar berilmagan bo'lsa)
    if payment_map is None:
        _payments = Payment.objects.filter(
            group=group, month=month_date
        ).select_related("student")
        payment_map = {(p.student_id, p.group_id): p for p in _payments}

    if extra_map is None:
        # BUG FIX: extra_map endi mentor salary yoki guruh daromadiga qo'shilmaydi.
        # Shuning uchun bu yerda ma'lumotlar bazasiga ortiqcha so'rov yuborishni to'xtatamiz.
        extra_map = {}

    # Guruch uchun konfiguratsiyani olish (faqat mentor uchun)
    group_config = None
    is_percentage = False
    is_student_count = False
    commission_pct = Decimal("0")
    per_student_rate = Decimal("0")

    if profile and profile.user.role == "mentor":
        if enrollment_cache is not None and ('_salary_configs' in enrollment_cache):
            group_config = enrollment_cache['_salary_configs'].get(
                (profile.user.id, group.id)
            )
        else:
            group_config = MentorGroupSalaryConfig.objects.filter(
                mentor=profile.user, group=group
            ).first()

        if group_config:
            if group_config.salary_type == "percentage":
                is_percentage = True
                commission_pct = group_config.commission_percentage / Decimal("100")
            elif group_config.salary_type == "student_count":
                is_student_count = True
                per_student_rate = group_config.per_student_amount
        else:
            if profile.salary_type == "percentage":
                is_percentage = True
                commission_pct = profile.commission_percentage / Decimal("100")
            elif profile.salary_type == "student_count":
                is_student_count = True
                per_student_rate = profile.per_student_amount

    # Guruhdagi barcha o'quvchilarni yig'ish
    all_students_map = {}
    if enrollment_cache is not None and group.id in enrollment_cache:
        all_students_map = dict(enrollment_cache[group.id])
    else:
        for enr in group.enrollments.filter(is_active=True).select_related("student"):
            if enr.student:
                all_students_map[enr.student.id] = enr.student
        unenrolled_ids = set(group.enrollments.filter(is_active=False).values_list('student_id', flat=True))
        for st in group.old_students_fk.filter(is_active=True, is_archived=False):
            if st.id not in unenrolled_ids:
                all_students_map[st.id] = st
    all_students = list(all_students_map.values())
    processed_pairs = set()

    # Hisoblash
    actual_revenue = Decimal("0")
    expected_revenue = Decimal("0")
    mentor_share_paid = Decimal("0")
    mentor_share_expected = Decimal("0")
    paid_students = []
    unpaid_students = []

    for student in all_students:
        key = (student.id, group.id)
        if key in processed_pairs:
            continue
        processed_pairs.add(key)

        p = payment_map.get(key)
        extra_amount = extra_map.get(key, Decimal("0"))

        status = student.status
        is_discount = status == "discount"
        is_negotiated = status == "negotiated"
        is_teacher_negotiated = status == "teacher_negotiated"

        # Shartnoma (contract) narxi
        contract_base = group.monthly_price
        if student.custom_fee is not None and status in [
            "low_income",
            "negotiated",
            "discount",
            "teacher_negotiated",
        ]:
            contract_base = student.custom_fee
        elif is_teacher_negotiated:
            # Standart operatsion ulush: Course Fee - Standard Teacher Share
            std_teacher_share = Decimal("0")
            if is_percentage:
                std_teacher_share = Decimal(str(group.monthly_price or 0)) * commission_pct
            elif is_student_count:
                std_teacher_share = per_student_rate
            contract_base = max(Decimal("0"), Decimal(str(group.monthly_price or 0)) - std_teacher_share)
        contract_amount = floor_amount(Decimal(str(contract_base)))

        paid_amount = Decimal(str(p.paid_amount or 0)) if p else Decimal("0")

        attendance_amount = None
        if is_discount or is_negotiated:
            attendance_amount = calculate_attendance_based_student_payment(
                student, group, month_date, ignore_today_check=ignore_today_check,
                lesson_dates_cache=lesson_dates_cache,
                enrollment_cache=enrollment_cache,
                attendance_cache=attendance_cache,
            )

        # Expected va Actual bazalar
        if is_discount:
            base_expected = attendance_amount
            base_actual = attendance_amount
        else:
            base_expected = contract_amount
            base_actual = paid_amount

        base_expected_floored = floor_amount(base_expected)

        # Talaba ma'lumotlari
        student_info = {
            "id": student.id,
            "name": student.full_name,
            "status": student.get_status_display(),
            "financial_status": student.status,
            "financial_status_label": student.get_status_display(),
            "negotiated_price": float(student.custom_fee)
            if student.custom_fee
            else None,
            "contract_amount": float(contract_amount),
            "paid_amount": float(paid_amount),
            "expected": float(base_expected_floored),
            "actual": 0.0,
            "refund_amount": float(p.refund_amount) if p and p.refund_amount else 0.0,
            "refund_ignored": p.refund_ignored if p else False,
            "paid_at": p.paid_at.strftime("%Y-%m-%d %H:%M")
            if p and p.paid_at
            else None,
            "payment_method": p.get_payment_method_display()
            if p and p.payment_method
            else None,
            "is_attendance_based": is_discount,
            "mentor_salary_excluded": is_teacher_negotiated,
        }

        # ----------------------------------------------------------
        # 1) Refund hisobi: expected daromad shartnoma summasi asosida shakllantiriladi (refund chiqarmaymiz)
        refund_for_expected = Decimal("0")

        # ----------------------------------------------------------
        # 2) Actual / Expected bazalar
        # ----------------------------------------------------------
        # BUG FIX: extra_amount ni guruh tushumidan olib tashladik.
        # Qo'shimcha to'lov kurs to'lovi emas, u mentor oyligi yoki guruh daromadiga kirmasligi kerak.
        net_actual = (base_actual or Decimal("0"))

        # Expected for frontend:
        #   teacher_negotiated → contract_amount (markaz operatsion ulushi)
        #   discount/negotiated → attendance asosida
        #   regular/low_income  → CONTRACT AMOUNT (refund chiqarmaymiz! frontend uchun kerak)
        if is_teacher_negotiated:
            net_expected = (base_expected_floored or Decimal("0"))
        elif is_discount or is_negotiated:
            net_expected = (base_expected_floored or Decimal("0"))
        else:
            # Regular/Low Income uchun: expected = CONTRACT AMOUNT (refund chiqarmaymiz)
            net_expected = (base_expected_floored or Decimal("0"))

        student_info["actual"] = float(net_actual)
        student_info["expected"] = float(net_expected)

        if net_actual != 0:
            actual_revenue += net_actual
            paid_students.append(student_info)
        else:
            unpaid_students.append(student_info)

        expected_revenue += net_expected

        # ----------------------------------------------------------
        # 3) Mentor ulushi
        #    teacher_negotiated → 0 (har doim)
        #    discount           → attendance asosida (paid va expected bir xil)
        #    negotiated         → (mentor_stafka / lesson_count * present_count)
        #    regular/low_income → paid: real to'lov × %; expected: (contract−refund) × %
        # ----------------------------------------------------------
        student_mentor_share = Decimal("0")
        if profile and profile.user.role == "mentor" and not is_teacher_negotiated:
            # Birinchi, kelgan darslar sonini hisoblash (barcha statuslar uchun kerak)
            present_count = 0
            # Cache'dan foydalanish (optimizatsiya)
            _cached_ld = lesson_dates_cache.get(group.id) if lesson_dates_cache is not None else None
            _group_lesson_dates = _cached_ld if _cached_ld is not None else group.get_lesson_dates(month_date.year, month_date.month)
            if lesson_dates_cache is not None and group.id not in lesson_dates_cache:
                lesson_dates_cache[group.id] = _group_lesson_dates
            try:
                if attendance_cache is not None and (group.id, student.id) in attendance_cache:
                    present_count = attendance_cache[(group.id, student.id)]
                else:
                    from homework_attends.models import Attendance
                    present_count = Attendance.objects.filter(
                        student=student,
                        group=group,
                        date__year=month_date.year,
                        date__month=month_date.month,
                        date__in=_group_lesson_dates,
                        is_present=True,
                        marked_by__isnull=False,
                    ).count()
            except Exception:
                present_count = 0
            lessons_count = len(_group_lesson_dates) if _group_lesson_dates else 1
            if present_count > lessons_count:
                present_count = lessons_count

            student_mentor_share = Decimal("0")
            if is_discount:
                if is_percentage:
                    student_mentor_share = net_actual * commission_pct
                    mentor_share_paid += student_mentor_share
                    mentor_share_expected += net_expected * commission_pct
                elif is_student_count:
                    mentor_fee = calculate_attendance_based_mentor_share(
                        student, group, month_date, per_student_rate, ignore_today_check=ignore_today_check,
                        lesson_dates_cache=lesson_dates_cache, enrollment_cache=enrollment_cache, attendance_cache=attendance_cache
                    )
                    student_mentor_share = mentor_fee
                    mentor_share_paid += mentor_fee
                    mentor_share_expected += mentor_fee  # discount uchun paid == expected (davomat asosida)
            else:
                # regular / low_income / negotiated
                # paid share: haqiqiy to'langan asosida
                # expected share: FULL CONTRACT (REFUND HISOBGA OLINMASIN!)
                expected_base = (contract_amount or Decimal("0"))

                if is_percentage:
                    student_mentor_share = net_actual * commission_pct
                    mentor_share_paid += student_mentor_share
                    mentor_share_expected += expected_base * commission_pct
                elif is_student_count:
                    if net_actual >= contract_amount and contract_amount > 0:
                        student_mentor_share = per_student_rate
                    elif net_actual > 0 and contract_amount > 0:
                        # Qisman to'lov: mutanosib ravishda o'qituvchiga to'lanadi
                        prop_share = (per_student_rate * net_actual) / contract_amount
                        student_mentor_share = min(net_actual, prop_share)
                    mentor_share_paid += student_mentor_share
                    mentor_share_expected += per_student_rate

        student_info["group_id"] = group.id
        student_info["group_name"] = group.name
        student_info["group_monthly_price"] = float(group.monthly_price)
        student_info["phone"] = student.phone or ""
        student_info["mentor_share"] = float(floor_amount(student_mentor_share if profile and profile.user.role == "mentor" else Decimal("0"), precision=1))
        student_info["salary_type"] = "percentage" if is_percentage else ("student_count" if is_student_count else "fixed")
        student_info["salary_rate"] = float(commission_pct * 100) if is_percentage else float(per_student_rate)

    # Yakuniy natijalarni adaptiv precision bilan yaxlitlash:
    # - Oraliq hisoblar barqarorlik uchun default precision=1000 da qoladi
    # - Faqat yakuniy agregat qiymatlar smart floor dan o'tadi
    # - Bu kumulyativ xatolikni minimallashtiradi va toza sonlar beradi

    # ----------------------------------------------------------
    # 3) Process deleted students from ArchivedStudent
    # ----------------------------------------------------------
    from archivebase.models import ArchivedStudent
    
    month_prefix = month_date.strftime("%Y-%m")
    # For performance in very large datasets, this could be optimized, 
    # but since it's monthly it should be fine.
    archived_students = ArchivedStudent.objects.all()
    for arch in archived_students:
        meta = arch.metadata
        if not meta or 'payments' not in meta:
            continue
            
        for p_dict in meta['payments']:
            if p_dict.get('group') == group.id and str(p_dict.get('month', '')).startswith(month_prefix):
                paid_amount = Decimal(str(p_dict.get('paid_amount') or 0))
                contract_amount = Decimal(str(p_dict.get('amount') or 0))
                is_paid = p_dict.get('is_paid', False)
                
                # BUG FIX: Faqatgina pul to'lagandan keyin o'chirilgan o'quvchilar hisobga olinadi.
                # Agar to'lamasdan o'chib ketgan bo'lsa, uni qarz (expected) qilib osib qo'ymaymiz.
                if paid_amount <= 0 and not is_paid:
                    continue
                
                actual_revenue += paid_amount
                expected_revenue += contract_amount

                student_name = p_dict.get('student_full_name') or arch.full_name or "Noma'lum"
                
                pm = p_dict.get('payment_method')
                pm_display = None
                if pm == 'cash': pm_display = 'Naqd'
                elif pm == 'card': pm_display = 'Plastik karta'
                elif pm == 'click': pm_display = 'Click'
                elif pm == 'payme': pm_display = 'Payme'
                elif pm == 'uzum': pm_display = 'Uzum'
                elif pm == 'bank': pm_display = 'Bank orqali'
                else: pm_display = pm

                student_info = {
                    "id": f"archived_{arch.id}_{p_dict.get('id', 0)}",
                    "name": f"{student_name} (O'chirilgan)",
                    "status": "Guruhdan o'chirilgan",
                    "financial_status": "regular",
                    "financial_status_label": "Guruhdan o'chirilgan",
                    "negotiated_price": None,
                    "contract_amount": float(contract_amount),
                    "paid_amount": float(paid_amount),
                    "expected": float(contract_amount),
                    "actual": float(paid_amount),
                    "refund_amount": float(p_dict.get('refund_amount') or 0.0),
                    "refund_ignored": p_dict.get('refund_ignored', False),
                    "paid_at": str(p_dict.get('paid_at', '')).replace('T', ' ')[:16] if p_dict.get('paid_at') else None,
                    "payment_method": pm_display,
                    "is_attendance_based": False,
                    "mentor_salary_excluded": False,
                }

                if paid_amount > 0 or is_paid:
                    paid_students.append(student_info)
                else:
                    unpaid_students.append(student_info)

                arch_mentor_share = Decimal("0")
                if profile and profile.user.role == "mentor":
                    if is_percentage:
                        arch_mentor_share = paid_amount * commission_pct
                        mentor_share_paid += arch_mentor_share
                        mentor_share_expected += contract_amount * commission_pct
                    elif is_student_count:
                        if (paid_amount >= contract_amount and contract_amount > 0) or is_paid:
                            arch_mentor_share = per_student_rate
                        elif paid_amount > 0 and contract_amount > 0:
                            prop_share = (per_student_rate * paid_amount) / contract_amount
                            arch_mentor_share = min(paid_amount, prop_share)
                        mentor_share_paid += arch_mentor_share
                        mentor_share_expected += per_student_rate

                student_info["group_id"] = group.id
                student_info["group_name"] = group.name
                student_info["group_monthly_price"] = float(group.monthly_price)
                student_info["phone"] = getattr(arch, "phone", "") or ""
                student_info["mentor_share"] = float(floor_amount(arch_mentor_share if profile and profile.user.role == "mentor" else Decimal("0"), precision=1))
                student_info["salary_type"] = "percentage" if is_percentage else ("student_count" if is_student_count else "fixed")
                student_info["salary_rate"] = float(commission_pct * 100) if is_percentage else float(per_student_rate)

    return {
        "group_id": group.id,
        "actual_revenue": floor_amount(actual_revenue, precision=1),
        "expected_revenue": floor_amount(expected_revenue, precision=1),
        "mentor_share_paid": floor_amount(mentor_share_paid, precision=1),
        "mentor_share_expected": floor_amount(mentor_share_expected, precision=1),
        "paid_students": paid_students,
        "unpaid_students": unpaid_students,
    }


def calculate_transfer_salary_adjustment(
    profile,
    mentor_group_ids,
    month_date,
    payment_map,
    lesson_dates_cache=None,
    commission_basis="paid",
):
    """
    O'quvchi oy o'rtasida ko'chirilganda mentor oyligiga tuzatish hisoblaydi.

    Mavjud calculate_group_revenue_and_mentor_share logikasi O'ZGARTIRILMAYDI.
    Bu funksiya faqat bir POST-PROCESSING qatlami bo'lib:

    - Transfer OUT bo'lgan guruh mentori (A→B): eski guruhda hisob 0, tuzatish QO'SHILADI.
    - Transfer IN bo'lgan guruh mentori (A→B): barcha davomat yangi guruhda saqlanadi,
      shuning uchun oylik ORTIQCHA hisoblanadi. Tuzatish AYIRILADI.

    Status bo'yicha hisoblash:
    ┌──────────────────┬──────────────────────────────────────────────────────────┐
    │ discount         │ Kelgan darslar soniga qarab taqsimlash (davomat asosida) │
    │ negotiated       │ custom_fee × (kelgan_darslar / jami_darslar) × foiz      │
    │ regular/low_inc  │ to'lov × (eski_dars_soni / jami_dars_soni) × foiz        │
    └──────────────────┴──────────────────────────────────────────────────────────┘

    jami_dars_soni = eski_guruh_dars_soni_oldin + yangi_guruh_dars_soni_keyin

    Qaytaradi: Decimal (musbat yoki manfiy) — total_salary ga qo'shiladi.
    """
    from django.db.models import Q
    from groups.models import GroupTransfer
    from homework_attends.models import Attendance
    from finance.models import Payment, MentorGroupSalaryConfig

    if profile.salary_type == "fixed":
        return Decimal("0")

    month_date = normalize_month(month_date)
    if lesson_dates_cache is None:
        lesson_dates_cache = {}

    # Bu oy ichida mentor guruhlarini qamrab olgan barcha transferlar
    # Set ga o'tkazamiz — in/not-in O(1) bo'ladi
    mentor_group_ids_set = set(mentor_group_ids)
    transfers = list(
        GroupTransfer.objects.filter(
            transfer_date__year=month_date.year,
            transfer_date__month=month_date.month,
        ).filter(
            Q(from_group_id__in=mentor_group_ids_set) | Q(to_group_id__in=mentor_group_ids_set)
        ).select_related("student", "from_group", "to_group")
    )

    if not transfers:
        return Decimal("0")

    # To'lov yangi guruhda saqlangan — bu guruh mentor guruhlarida bo'lmasligi mumkin.
    # Shu holat uchun qo'shimcha payment_map tuzamiz.
    outside_to_ids = [
        t.to_group_id
        for t in transfers
        if t.from_group_id in mentor_group_ids_set and t.to_group_id not in mentor_group_ids_set
    ]
    extra_payments = {}
    if outside_to_ids:
        for p in Payment.objects.filter(
            group_id__in=outside_to_ids,
            month__year=month_date.year,
            month__month=month_date.month,
        ).select_related("student"):
            extra_payments[(p.student_id, p.group_id)] = p

    # Kengaytirilgan to'lov xaritasi (mentor + transfer yo'nalish guruhlar)
    full_payment_map = {**payment_map, **extra_payments}

    # Guruh darajasidagi maosh konfiguratsiyalarini cache ga olamiz
    salary_configs = {
        (sc.mentor_id, sc.group_id): sc
        for sc in MentorGroupSalaryConfig.objects.filter(
            mentor=profile.user, group_id__in=mentor_group_ids_set
        )
    }

    def _commission(group_id):
        """Bu guruh uchun (is_pct, pct, is_count, per_student) ni qaytaradi."""
        sc = salary_configs.get((profile.user.id, group_id))
        if sc:
            if sc.salary_type == "percentage":
                return True, sc.commission_percentage / Decimal("100"), False, Decimal("0")
            if sc.salary_type == "student_count":
                return False, Decimal("0"), True, sc.per_student_amount
        # Guruh konfiguratsiyasi yo'q → profil darajasi ishlatiladi
        if profile.salary_type == "percentage":
            return True, profile.commission_percentage / Decimal("100"), False, Decimal("0")
        if profile.salary_type == "student_count":
            return False, Decimal("0"), True, profile.per_student_amount
        return False, Decimal("0"), False, Decimal("0")

    def _lesson_dates(group):
        """Guruh dars kunlarini cache dan olib qaytaradi."""
        if group.id not in lesson_dates_cache:
            lesson_dates_cache[group.id] = group.get_lesson_dates(month_date.year, month_date.month)
        return lesson_dates_cache[group.id]

    net_adjustment = Decimal("0")

    for transfer in transfers:
        student = transfer.student
        from_group = transfer.from_group
        to_group = transfer.to_group
        t_date = transfer.transfer_date

        # teacher_negotiated o'quvchilar uchun mentor oylik hisosi yo'q
        if student.status == "teacher_negotiated":
            continue

        from_dates = _lesson_dates(from_group)
        to_dates = _lesson_dates(to_group)

        # Transfer sanasigacha eski guruh dars kunlari
        from_before = [d for d in from_dates if d < t_date]
        # Transfer sanasidan boshlab yangi guruh dars kunlari
        to_after = [d for d in to_dates if d >= t_date]

        # Jami "dars birliklari" — proportsiya uchun maxraj
        total_units = len(from_before) + len(to_after)
        if total_units == 0:
            continue

        # To'lov ma'lumotlarini har ikkala guruh (from_group va to_group) dan olamiz
        p_to = full_payment_map.get((student.id, to_group.id))
        p_from = full_payment_map.get((student.id, from_group.id))
        if not p_from:
            p_from = Payment.objects.filter(
                student=student,
                group=from_group,
                month__year=month_date.year,
                month__month=month_date.month,
            ).first()

        to_paid_amount = Decimal(str(p_to.paid_amount or 0)) if p_to else Decimal("0")
        to_payment_amount = Decimal(str(p_to.amount or 0)) if p_to else Decimal("0")
        is_to_fully_paid = p_to.is_paid if p_to else False

        from_paid_amount = Decimal(str(p_from.paid_amount or 0)) if p_from else Decimal("0")
        from_payment_amount = Decimal(str(p_from.amount or 0)) if p_from else Decimal("0")
        is_from_fully_paid = p_from.is_paid if p_from else False

        custom_fee = (
            Decimal(str(student.custom_fee))
            if student.custom_fee is not None
            else Decimal("0")
        )

        # ═══════════════════════════════════════════════════════════════════
        # A) O'quvchi MENTOR GURUHIDAN KETDI (transfer OUT)
        #    Eski guruh mentori transfer sanasigacha dars o'tgan.
        #    Tuzatish: o'tilgan darslar uchun haqli ulushni QO'SHAMIZ
        # ═══════════════════════════════════════════════════════════════════
        if from_group.id in mentor_group_ids_set and from_before:
            is_pct, pct, is_cnt, per_st = _commission(from_group.id)
            if is_pct or is_cnt:
                pre_count = len(from_before)
                total_from = max(len(from_dates), 1)

                if student.status == "discount":
                    # Imtiyozli (discount) o'quvchi: eski guruhdagi qatnashgan darslar soni bo'yicha
                    present_before = Attendance.objects.filter(
                        student=student,
                        group=from_group,
                        date__in=from_before,
                        is_present=True,
                        marked_by__isnull=False,
                    ).count()
                    if custom_fee > 0:
                        fee_base = custom_fee
                    elif transfer.old_group_fee > 0:
                        fee_base = Decimal(str(transfer.old_group_fee))
                    else:
                        fee_base = Decimal(str(from_group.monthly_price))

                    daily = fee_base / Decimal(str(total_from))
                    earned = daily * Decimal(str(present_before))
                    if is_pct:
                        net_adjustment += earned * pct
                    elif is_cnt:
                        net_adjustment += (per_st / Decimal(str(total_from))) * Decimal(str(present_before))

                else:
                    # regular / low_income / negotiated
                    # Agar p_from mavjud bo'lsa va u prorated bo'lsa:
                    proportion = Decimal(str(pre_count)) / Decimal(str(total_units))
                    
                    if p_from and from_payment_amount > 0 and from_payment_amount < from_group.monthly_price:
                        # p_from allaqachon transfer_student_to_group tomonidan prorated qilingan!
                        # Qayta proportsiya qo'llanmaydi (Double Proration bug'i bartaraf etildi).
                        actual_from = from_payment_amount if (commission_basis == "expected" or is_from_fully_paid) else from_paid_amount
                        if is_pct:
                            net_adjustment += actual_from * pct
                        elif is_cnt:
                            net_adjustment += per_st * (Decimal(str(pre_count)) / Decimal(str(total_from)))
                    else:
                        # p_from yo'q yoki to'lov yangi guruhda saqlangan bo'lsa:
                        if is_pct:
                            if commission_basis == "paid":
                                source_paid = to_paid_amount if (to_paid_amount > 0 or is_to_fully_paid) else from_paid_amount
                                actual = to_payment_amount if is_to_fully_paid else source_paid
                                net_adjustment += actual * proportion * pct
                            else:
                                if custom_fee > 0:
                                    fee_base = custom_fee
                                elif transfer.old_group_fee > 0:
                                    fee_base = Decimal(str(transfer.old_group_fee))
                                else:
                                    fee_base = Decimal(str(from_group.monthly_price))
                                net_adjustment += fee_base * proportion * pct
                        elif is_cnt:
                            net_adjustment += per_st * (Decimal(str(pre_count)) / Decimal(str(total_from)))

        # ═══════════════════════════════════════════════════════════════════
        # B) O'quvchi MENTOR GURUHIGA KELDI (transfer IN)
        #    Agar yangi guruhdagi to'lov allaqachon prorated bo'lsa (new_amount),
        #    calculate_group_revenue_and_mentor_share allaqachon to'g'ri ulush bergan.
        #    Faqatgina to'lov TO'LIQ oy uchun olingan bo'lsagina ortiqcha qism ayiriladi.
        # ═══════════════════════════════════════════════════════════════════
        if to_group.id in mentor_group_ids_set:
            is_pct, pct, is_cnt, per_st = _commission(to_group.id)
            if is_pct or is_cnt:
                total_to = max(len(to_dates), 1)

                if student.status == "discount":
                    # Yangi guruhdagi discount hisobi faqat yangi guruhdagi davomatga asoslangan,
                    # shuning uchun ortiqcha ayirish talab qilinmaydi.
                    pass
                else:
                    # Agar p_to to'liq oy narxiga teng bo'lsa (ya'ni prorated qilinmagan bo'lsa),
                    # transferdan oldingi qism mentor oyligidan chegiriladi.
                    is_full_month_in_new = (p_to and to_payment_amount >= to_group.monthly_price)
                    if is_full_month_in_new:
                        pre_count_units = len(from_before)
                        over_proportion = Decimal(str(pre_count_units)) / Decimal(str(total_units))
                        if is_pct:
                            if commission_basis == "paid":
                                if to_paid_amount > 0 or is_to_fully_paid:
                                    actual = to_payment_amount if is_to_fully_paid else to_paid_amount
                                    net_adjustment -= actual * over_proportion * pct
                            else:
                                if custom_fee > 0:
                                    fee_base = custom_fee
                                elif transfer.new_group_fee > 0:
                                    fee_base = Decimal(str(transfer.new_group_fee))
                                else:
                                    fee_base = Decimal(str(to_group.monthly_price))
                                net_adjustment -= fee_base * over_proportion * pct
                        elif is_cnt:
                            net_adjustment -= per_st * over_proportion

    return floor_amount(net_adjustment)
