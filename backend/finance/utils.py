# finance/utils.py
import decimal
import math
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone


def normalize_month(value: date) -> date:
    """
    Har qanday sanani o'sha oyning 1-kuniga keltiradi
    """
    if not value:
        return None
    return value.replace(day=1)


def _auto_floor_precision(amount):
    """
    Summa kattaligiga qarab optimal yaxlitlash aniqligini tanlaydi.

    Maqsad:
      - Har bir summa uchun nisbiy xatolik ~0.1-1% oralig'ida bo'lsin
      - Kichik summalar ham toza ko'rinsin (9,327 → 9,300)
      - Katta summalarda mayda-chuyda raqamlar bo'lmasin (3,453,270 → 3,450,000)

    Jadval:
      < 10,000      → 100    (max ~1%   xatolik)
      10k - 100k    → 500    (max ~0.5% xatolik)
      100k - 1M     → 1,000  (max ~0.1% xatolik)
      1M - 10M      → 5,000  (max ~0.05% xatolik)
      > 10M         → 10,000 (max ~0.1%  xatolik)
    """
    amount = abs(amount)
    if amount < 10_000:
        return 100
    elif amount < 100_000:
        return 500
    elif amount < 1_000_000:
        return 1_000
    elif amount < 10_000_000:
        return 5_000
    else:
        return 10_000


def floor_amount(value, precision=1000):
    """
    Har qanday pul miqdorini eng yaqin past <precision> ga yaxlitlaydi (floor).

    Parametrlar:
        value:     Yaxlitlanadigan son (int, float, Decimal, str)
        precision: Yaxlitlash aniqligi (default: 1000 — eski kod bilan mos)
                   Agar None bo'lsa → _auto_floor_precision orqali avtomatik tanlanadi

    Misollar (precision=1000, default):
        350548  → 350000
        125750  → 125000
        999     → 0
        1001    → 1000
        300000  → 300000  (o'zgarmaydi)

    Misollar (precision=None, adaptiv):
        9,327       → 9,300   (precision=100)
        45,327      → 45,000  (precision=500)
        345,327     → 345,000 (precision=1,000)
        3,453,270   → 3,450,000 (precision=5,000)
        34,532,700  → 34,530,000 (precision=10,000)

    Barcha to'lov hisoblashlarida ishlatiladi:
      - Student to'lovlari
      - Refund summasi
      - Mentor / admin oylik maoshi
      - Qo'shimcha to'lovlar
    """
    if value is None:
        return Decimal("0")
    try:
        amount = Decimal(str(value))
        if precision is None:
            precision = _auto_floor_precision(amount)
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
        active_lesson_dates = [d for d in lesson_dates if d <= today]
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
        "date__year": month_date.year,
        "date__month": month_date.month,
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
    student, group, month_date, per_student_amount, commission_percentage=None, ignore_today_check=False
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

    # Join date aniqlash
    join_date = None
    enrollment = (
        GroupEnrollment.objects.filter(student=student, group=group)
        .only("joined_at")
        .first()
    )
    if enrollment and enrollment.joined_at:
        join_date = enrollment.joined_at.date()
    elif student.joined_at:
        join_date = student.joined_at.date()

    # Step 2: Guruh dars kunlari shu oyda
    full_month_lessons = group.get_lesson_dates(month_date.year, month_date.month)
    
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
        active_lesson_dates = [d for d in lesson_dates if d <= today]
    else:
        active_lesson_dates = lesson_dates

    # Kelgan darslar sonini hisoblash
    attendance_filters = {
        "student": student,
        "group": group,
        "date__year": month_date.year,
        "date__month": month_date.month,
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
        # 1) Refund: faqat regular / low_income uchun ishlaydi.
        #    discount/negotiated uchun refund yo'q (davomat o'zi hisoblab beradi).
        #    teacher_negotiated uchun 0.
        # ----------------------------------------------------------
        refund_for_expected = Decimal("0")
        if not is_discount and not is_negotiated and not is_teacher_negotiated:
            try:
                raw_refund = student.calculate_refund_amount(
                    month_date.year, month_date.month, group=group
                )
                refund_for_expected = floor_amount(Decimal(str(raw_refund)))
            except Exception:
                refund_for_expected = Decimal("0")

        # ----------------------------------------------------------
        # 2) Actual / Expected bazalar
        # ----------------------------------------------------------
        # BUG FIX: extra_amount ni guruh tushumidan olib tashladik.
        # Qo'shimcha to'lov kurs to'lovi emas, u mentor oyligi yoki guruh daromadiga kirmasligi kerak.
        net_actual = (base_actual or Decimal("0"))

        # Expected for frontend:
        #   teacher_negotiated → 0 (mentor uchun)
        #   discount/negotiated → attendance asosida
        #   regular/low_income  → CONTRACT AMOUNT (refund chiqarmaymiz! frontend uchun kerak)
        if is_teacher_negotiated:
            net_expected = Decimal("0")
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

            if is_discount:
                if is_percentage:
                    mentor_share_paid += net_actual * commission_pct
                    mentor_share_expected += net_expected * commission_pct
                elif is_student_count:
                    mentor_fee = calculate_attendance_based_mentor_share(
                        student, group, month_date, per_student_rate, ignore_today_check=ignore_today_check
                    )
                    mentor_share_paid += mentor_fee
                    mentor_share_expected += mentor_fee  # discount uchun paid == expected (davomat asosida)
            else:
                # regular / low_income / negotiated
                # paid share: haqiqiy to'langan asosida
                # expected share: FULL CONTRACT (REFUND HISOBGA OLINMASIN!)
                expected_base = (contract_amount or Decimal("0"))

                if is_percentage:
                    mentor_share_paid += net_actual * commission_pct
                    mentor_share_expected += expected_base * commission_pct
                elif is_student_count:
                    if net_actual > 0:
                        mentor_share_paid += per_student_rate
                    # per_student: refund ta'sir qilmaydi (har student uchun sobit)
                    mentor_share_expected += per_student_rate

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

                if profile and profile.user.role == "mentor":
                    if is_percentage:
                        mentor_share_paid += paid_amount * commission_pct
                        mentor_share_expected += contract_amount * commission_pct
                    elif is_student_count:
                        if paid_amount > 0 or is_paid:
                            mentor_share_paid += per_student_rate
                        mentor_share_expected += per_student_rate

    return {
        "group_id": group.id,
        "actual_revenue": floor_amount(actual_revenue, precision=None),
        "expected_revenue": floor_amount(expected_revenue, precision=None),
        "mentor_share_paid": floor_amount(mentor_share_paid, precision=None),
        "mentor_share_expected": floor_amount(mentor_share_expected, precision=None),
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

        # To'lov endi yangi guruhda saqlangan
        p = full_payment_map.get((student.id, to_group.id))
        paid_amount = Decimal(str(p.paid_amount or 0)) if p else Decimal("0")
        is_fully_paid = p.is_paid if p else False
        payment_amount = Decimal(str(p.amount or 0)) if p else Decimal("0")
        custom_fee = (
            Decimal(str(student.custom_fee))
            if student.custom_fee is not None
            else Decimal("0")
        )

        # ═══════════════════════════════════════════════════════════════════
        # A) O'quvchi MENTOR GURUHIDAN KETDI (transfer OUT)
        #    Oddiy hisob: payment yangi guruhda → mentor 0 olgan
        #    Tuzatish: transfer sanasigacha bo'lgan to'g'ri ulushni QO'SHAMIZ
        # ═══════════════════════════════════════════════════════════════════
        if from_group.id in mentor_group_ids_set and from_before:
            is_pct, pct, is_cnt, per_st = _commission(from_group.id)
            if not is_pct and not is_cnt:
                pass  # fixed — above checked
            else:
                pre_count = len(from_before)
                total_from = max(len(from_dates), 1)
                total_to = max(len(to_dates), 1)
                # negotiated uchun: barcha birliqlar yig'indisi (from_before + to_after)
                # — ikkala mentor ulushi yig'indig'i 100% bo'lishi uchun
                total_units_from = max(total_units, 1)

                if student.status == "discount":
                    # Davomat yangi guruh nomida saqlangan, lekin sanalar eski guruh kunlari.
                    # fee_base: GroupTransfer snapshot yoki custom_fee yoki from_group narxi
                    present_before = Attendance.objects.filter(
                        student=student,
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
                    # Kunlik narx: to'lov guruhining jami dars kunlariga bo'linadi
                    daily = fee_base / Decimal(str(total_to))
                    earned = daily * Decimal(str(present_before))
                    if is_pct:
                        net_adjustment += earned * pct
                    elif is_cnt:
                        net_adjustment += (per_st / Decimal(str(total_to))) * Decimal(str(present_before))

                else:
                    # regular / low_income / negotiated → dars kunlari proportsiyasi
                    proportion = Decimal(str(pre_count)) / Decimal(str(total_units))
                    if is_pct:
                        if commission_basis == "paid":
                            if paid_amount > 0 or is_fully_paid:
                                actual = payment_amount if is_fully_paid else paid_amount
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
                        if commission_basis == "paid":
                            if paid_amount > 0 or is_fully_paid:
                                net_adjustment += per_st * proportion
                        else:
                            net_adjustment += per_st * proportion

        # ═══════════════════════════════════════════════════════════════════
        # B) O'quvchi MENTOR GURUHIGA KELDI (transfer IN)
        #    Oddiy hisob: barcha davomat yangi guruhda → mentor TO'LIQ olgan
        #    Tuzatish: transfer sanasigacha bo'lgan ortiqcha ulushni AYIRAMIZ
        # ═══════════════════════════════════════════════════════════════════
        if to_group.id in mentor_group_ids_set:
            is_pct, pct, is_cnt, per_st = _commission(to_group.id)
            if not is_pct and not is_cnt:
                pass
            else:
                total_to = max(len(to_dates), 1)
                # negotiated uchun: Case A bilan bir xil denominator (total_units)
                total_units_to = max(total_units, 1)

                if student.status == "discount":
                    # Yangi guruh nomida saqlangan lekin transfer sanasidan OLDINGI davomat
                    present_before_new = Attendance.objects.filter(
                        student=student,
                        group=to_group,
                        date__lt=t_date,
                        is_present=True,
                        marked_by__isnull=False,
                    ).count()
                    if present_before_new > 0:
                        if custom_fee > 0:
                            fee_base = custom_fee
                        elif transfer.new_group_fee > 0:
                            fee_base = Decimal(str(transfer.new_group_fee))
                        else:
                            fee_base = Decimal(str(to_group.monthly_price))
                        daily = fee_base / Decimal(str(total_to))
                        over = daily * Decimal(str(present_before_new))
                        if is_pct:
                            net_adjustment -= over * pct
                        elif is_cnt:
                            net_adjustment -= (per_st / Decimal(str(total_to))) * Decimal(str(present_before_new))

                else:
                    # regular / low_income / negotiated
                    # Ortiqcha proportsiya = eski guruh dars kunlari / jami dars birliklari
                    pre_count_units = len(from_before)
                    over_proportion = Decimal(str(pre_count_units)) / Decimal(str(total_units))
                    if is_pct:
                        if commission_basis == "paid":
                            if paid_amount > 0 or is_fully_paid:
                                actual = payment_amount if is_fully_paid else paid_amount
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
                        if commission_basis == "paid":
                            if paid_amount > 0 or is_fully_paid:
                                net_adjustment -= per_st * over_proportion
                        else:
                            net_adjustment -= per_st * over_proportion

    return floor_amount(net_adjustment)
