import calendar
import logging
import traceback
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from groups.models import Branch, Group, GroupEnrollment, Student
from homework_attends.models import Attendance

from finance.utils import (
    aggregate_attendance_refunds,
    aggregate_attendance_refunds_by_branch,
    calculate_attendance_based_student_payment,
    floor_amount,
    normalize_month,calculate_discount_student_payment
)

from .models import (
    AdminExpense,
    EmployeeAdvance,
    EmployeePayment,
    FinanceTransaction,
    Payment,
    StaffProfile,
)

logger = logging.getLogger(__name__)
User = get_user_model()


def sync_mentor_salary(group, month_date=None):
    """
    Berilgan guruh mentorining ushbu oydagi oylik-maoshini (EmployeePayment)
    bazadagi haqiqiy (real-time) o'quvchilar/to'lovlar soniga qarab qayta hisoblaydi.
    """
    if not group or not group.mentor:
        return
    
    if month_date is None:
        month_date = timezone.localdate().replace(day=1)
        
    employee_payment = EmployeePayment.objects.filter(
        employee=group.mentor,
        month=month_date,
        is_paid=False
    ).first()
    
    if employee_payment:
        employee_payment.recalculate_salary()
        employee_payment.save(update_fields=['salary_base'])


def update_attendance_based_payments(student, group, date):
    """
    Davomat o'zgarganda:
      1) Discount student uchun (faqat joriy oy): Payment.amount qayta hisoblanadi.
      2) Discount/Negotiated studentlar uchun (joriy oy): mentor maoshi qayta hisoblanadi.
    """
    from finance.models import EmployeePayment, Payment
    from finance.utils import (
        calculate_attendance_based_student_payment,
        normalize_month,
    )

    month_date = normalize_month(date)
    current_month = normalize_month(timezone.localdate())

    # 1. Discount student uchun Payment.amount ni yangilash (faqat joriy oy, to'lanmagan bo'lsa)
    if student.status == "discount" and month_date == current_month:
        try:
            payment, _ = Payment.objects.get_or_create(
                student=student,
                group=group,
                month=month_date,
                defaults={"amount": Decimal("0"), "is_paid": False},
            )
            if not payment.is_paid:
                new_amount = calculate_attendance_based_student_payment(
                    student, group, month_date
                )
                if payment.amount != new_amount:
                    payment.amount = new_amount
                    payment.save()
        except Exception as e:
            logger.error(
                "Failed to update discount payment for student %s, group %s, date %s: %s",
                student.id,
                group.id,
                date,
                e,
            )

    # 2. Mentor maoshi (discount/negotiated uchun) — to'lanmagan bo'lsa o'tgan oylarni ham yangilash (BUG M-2 FIX)
    if student.status in ["discount", "negotiated"]:
        try:
            mentor = group.mentor
            if mentor and hasattr(mentor, "staff_profile"):
                profile = mentor.staff_profile
                if profile.salary_type in ["percentage", "student_count"]:
                    # BUG M-5 FIX: Tranzaksiya qo'shildi
                    with transaction.atomic():
                        emp_payment = EmployeePayment.objects.select_for_update().filter(
                            employee=mentor, month=month_date, is_paid=False
                        ).first()
                        if emp_payment:
                            apply_calculated_salary_to_employee_payment(
                                profile, month_date, emp_payment
                            )
                            emp_payment.save()
                        else:
                            emp_payment, _ = EmployeePayment.objects.get_or_create(
                                employee=mentor,
                                month=month_date,
                                defaults={
                                    "salary_base": Decimal("0"),
                                    "is_paid": False,
                                    "attendance_deductions": {},
                                },
                            )
                            apply_calculated_salary_to_employee_payment(
                                profile, month_date, emp_payment
                            )
                            emp_payment.save()
        except Exception as e:
            logger.error(
                "Failed to update mentor salary for group %s, date %s: %s",
                group.id,
                date,
                e,
            )
    
    auto_pay_from_wallet(student)


def apply_calculated_salary_to_employee_payment(profile, month_date, emp_payment):
    """
    StaffProfile.calculate_salary_for_month natijasini EmployeePayment ga yozadi.
    """
    # BUG M-1 FIX: Davomat o'zgargan bo'lsa, yangi hisob uchun keshni tozalash kerak
    if hasattr(profile, '_salary_memo'):
        profile._salary_memo.pop((str(month_date), 'paid'), None)
        profile._salary_memo.pop((str(month_date), 'expected'), None)
        
    salary = profile.calculate_salary_for_month(month_date)
    emp_payment.salary_base = salary
    emp_payment.attendance_deductions = {}


def _to_decimal(value):
    """Safely cast any numeric-like value to Decimal."""
    if value is None:
        return Decimal("0")
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def _safe_attendance_stats_for_branch(branch, today):
    """Attendance query xato bersa ham finance statistikasi yiqilmasin."""
    try:
        from groups.utils import is_lesson_day

        weekday = today.weekday()
        if weekday == 6:  # Yakshanba, hech kim darsga kelmaydi
            return {"absent": 0, "total": 0}

        # Guruhlarni bugun darslari borlarini qidiramiz, lekin bekor qilinganlarni chiqarib tashlaymiz
        # Birinchi, special dars kunlari bor guruhlar, lekin bekor qilinmaganlar
        groups_with_special_lesson = (
            Group.objects.filter(branch=branch, special_lesson_days__date=today)
            .exclude(canceled_lesson_days__date=today)
            .values_list("id", flat=True)
        )

        # Keyin, kunlar turiga qarab darslari bor guruhlar (odd, even, everyday, custom)
        # Barcha guruhlarni olamiz va Python darajasida filterlash qilamiz
        all_branch_groups = Group.objects.filter(
            branch=branch, is_faol=True
        ).exclude(canceled_lesson_days__date=today).exclude(id__in=groups_with_special_lesson)

        groups_with_regular_lesson = [
            g.id for g in all_branch_groups if g.is_lesson_day(today)
        ]

        # Barcha bugun darslari bor guruhlar
        lesson_group_ids = list(groups_with_special_lesson) + list(
            groups_with_regular_lesson
        )

        # Endi faqat shu guruhlarda aktiv bo'lgan talabalarni olamiz
        total_active_students_qs = Student.objects.filter(
            enrollments__is_active=True, enrollments__group__id__in=lesson_group_ids
        ).distinct()

        total_students_ids = set(total_active_students_qs.values_list("id", flat=True))

        # Davomat qaydlarini olamiz
        base_attendance_qs = Attendance.objects.filter(group__branch=branch, date=today)

        # Qo'shimcha/jadvaldan tashqari darslar va amalda davomat qilingan talabalar ham statistikaga qo'shiladi
        attended_students_ids = set(
            base_attendance_qs.values_list("student_id", flat=True).distinct()
        )
        total_students_ids = total_students_ids | attended_students_ids

        # FIX: Agar bugun uchun hech qanday davomat yozuvi mavjud bo'lmasa
        # (Celery task ishlamagan yoki kechikkan), "hamma kelmadi" deb hisoblab bo'lmaydi.
        # Bu holat ayniqsa yangi kun soat 00:00-00:05 orasida ro'y beradi.
        if not base_attendance_qs.exists():
            return {"absent": 0, "total": len(total_students_ids)}

        present_ids = set(
            base_attendance_qs.filter(is_present=True)
            .values_list("student_id", flat=True)
            .distinct()
        )
        # AbsentTodayStudentsView bilan bir xil mantiq:
        # Faqat is_present=False bo'lgan va hech bo'lmasa bitta guruhda
        # ham is_present=True bo'lmagan o'quvchilarni "kelmadi" deb hisoblaymiz.
        absent_ids = set(
            base_attendance_qs.filter(is_present=False)
            .exclude(student_id__in=present_ids)
            .values_list("student_id", flat=True)
            .distinct()
        )
        # Faqat bugun darsi bor va aniq belgilangan o'quvchilar hisobga olinadi
        absent_count = len(total_students_ids & absent_ids)
        present_count = len(total_students_ids & present_ids)

        return {
            "absent": absent_count,
            "total": len(total_students_ids),
        }
    except Exception:
        logger.exception(
            "Attendance branch statistikasi xatoligi: branch_id=%s",
            getattr(branch, "id", None),
        )
        return {"absent": 0, "total": 0}


def _safe_attendance_stats_for_user(user, today):
    """Dashboard attendance hisobida fallback."""
    try:
        from groups.utils import is_lesson_day

        weekday = today.weekday()
        if weekday == 6:  # Yakshanba
            return {"absent": 0, "total": 0}

        # Foydalanuvchi roliga qarab guruhlarni olamiz
        if user.role == "admin":
            branch_filter = {"branch": user.branch}
        else:
            branch_filter = {}

        # Guruhlarni bugun darslari borlarini qidiramiz, bekor qilinganlarni chiqarib tashlaymiz
        # Guruhlarni bugun darslari borlarini qidiramiz, bekor qilinganlarni chiqarib tashlaymiz
        groups_with_special_lesson = (
            Group.objects.filter(**branch_filter, special_lesson_days__date=today)
            .exclude(canceled_lesson_days__date=today)
            .values_list("id", flat=True)
        )

        # Barcha guruhlarni olb, Python darajasida is_lesson_day() bilan tekshiramiz
        all_user_groups = Group.objects.filter(
            **branch_filter, is_faol=True
        ).exclude(canceled_lesson_days__date=today).exclude(id__in=groups_with_special_lesson)

        groups_with_regular_lesson = [
            g.id for g in all_user_groups if g.is_lesson_day(today)
        ]

        lesson_group_ids = list(groups_with_special_lesson) + list(
            groups_with_regular_lesson
        )

        # Faqat shu guruhlarda aktiv talabalar
        total_active_students_qs = Student.objects.filter(
            enrollments__is_active=True, enrollments__group__id__in=lesson_group_ids
        ).distinct()

        total_students_ids = set(total_active_students_qs.values_list("id", flat=True))

        # Davomat qaydlarini olamiz
        base_attendance_qs = Attendance.objects.filter(date=today)
        if user.role == "admin":
            base_attendance_qs = base_attendance_qs.filter(group__branch=user.branch)

        # FIX: Agar bugun uchun hech qanday davomat yozuvi mavjud bo'lmasa
        # (Celery task ishlamagan yoki kechikkan), "hamma kelmadi" deb hisoblab bo'lmaydi.
        # Bu holat ayniqsa yangi kun soat 00:00-00:05 orasida ro'y beradi.
        if not base_attendance_qs.exists():
            return {"absent": 0, "total": len(total_students_ids)}

        present_ids = set(
            base_attendance_qs.filter(is_present=True)
            .values_list("student_id", flat=True)
            .distinct()
        )
        # AbsentTodayStudentsView bilan bir xil mantiq:
        # Faqat is_present=False bo'lgan va hech bo'lmasa bitta guruhda
        # ham is_present=True bo'lmagan o'quvchilarni "kelmadi" deb hisoblaymiz.
        absent_ids = set(
            base_attendance_qs.filter(is_present=False)
            .exclude(student_id__in=present_ids)
            .values_list("student_id", flat=True)
            .distinct()
        )
        # Faqat bugun darsi bor va aniq belgilangan o'quvchilar hisobga olinadi
        absent_count = len(total_students_ids & absent_ids)
        present_count = len(total_students_ids & present_ids)

        return {
            "absent": absent_count,
            "total": len(total_students_ids),
        }
    except Exception:
        logger.exception(
            "Attendance user statistikasi xatoligi: user_id=%s",
            getattr(user, "id", None),
        )
        return {"absent": 0, "total": 0}


@transaction.atomic
def generate_monthly_payments(month_date=None):
    if month_date is None:
        month_date = timezone.localdate().replace(day=1)
    else:
        month_date = normalize_month(month_date)

    created_count = 0

    # 1. STUDENT PAYMENTS
    from groups.utils import get_lessons_in_month

    import calendar
    from datetime import date
    for group in Group.objects.filter(is_faol=True):
        # Guruhning shu oyda darslari bormi tekshiramiz
        month_lessons = group.get_lesson_dates(month_date.year, month_date.month)
        if not month_lessons:
            continue

        _, last_day = calendar.monthrange(month_date.year, month_date.month)
        month_end = date(month_date.year, month_date.month, last_day)

        # Shu oyda faol bo'lgan yoki shu oy davomida ko'chirilgan/chiqqan studentlar (ushbu guruhda muzlatilmagan)
        from groups.models import GroupEnrollment
        active_enr_ids = GroupEnrollment.objects.filter(
            group=group,
            joined_at__date__lte=month_end,
            student__is_active=True,
            student__is_archived=False,
            is_frozen=False,
        ).filter(
            Q(is_active=True, left_at__isnull=True) |
            Q(left_at__date__gte=month_date, left_at__date__lte=month_end)
        ).values_list('student_id', flat=True)

        eligible_students = group.students.filter(
            id__in=active_enr_ids
        ).distinct()

        for student in eligible_students:
            base_price = group.monthly_price
            if student.status in [
                "low_income",
                "negotiated",
                "discount",
                "teacher_negotiated",
            ]:
                if student.custom_fee is not None:
                    base_price = student.custom_fee
                elif student.status == "teacher_negotiated":
                    from finance.utils import get_teacher_negotiated_center_fee
                    base_price = get_teacher_negotiated_center_fee(group)

            if student.status == "discount":
                # Imtiyozli student uchun davomatga asoslangan hisoblash
                payment_amount = calculate_attendance_based_student_payment(
                    student, group, month_date
                )
                _, created = Payment.objects.get_or_create(
                    student=student,
                    group=group,
                    month=month_date,
                    defaults={
                        "amount": payment_amount,
                        "is_paid": False,
                        "is_auto_discount": True,
                    },
                )
            else:
                # Agar guruh oy o'rtasida boshlansa (prorated):
                if group.start_date and group.start_date > month_date:
                    full_sched = get_lessons_in_month(group._get_effective_days(), month_date.year, month_date.month)
                    full_count = max(1, len(full_sched))
                    daily = Decimal(str(base_price)) / Decimal(str(full_count))
                    payment_amount = floor_amount(daily * Decimal(str(len(month_lessons))))
                else:
                    payment_amount = Decimal(str(floor_amount(base_price)))

                _, created = Payment.objects.get_or_create(
                    student=student,
                    group=group,
                    month=month_date,
                    defaults={"amount": payment_amount, "is_paid": False},
                )
            if created:
                created_count += 1
            auto_pay_from_wallet(student)

    # 2. EMPLOYEE PAYMENTS
    profiles = StaffProfile.objects.select_related("user").filter(user__is_active=True)
    for profile in profiles:
        salary = profile.calculate_salary_for_month(month_date)
        _, created = EmployeePayment.objects.get_or_create(
            employee=profile.user,
            month=month_date,
            defaults={
                "salary_base": salary,
                "bonus": 0,
                "deductions": 0,
                "is_paid": False,
            },
        )
        if created:
            created_count += 1

    return created_count


def process_absence_refunds(month_date=None):
    """
    OLD LOGIC: Refund endi ishlatilmaydi.
    Chunki to'lov endi davomatga qarab to'ldirib boriladi.
    """
    return 0, 0


def handle_custom_payment(request_user, data):
    """O'quvchi uchun maxsus (oylikdan tashqari) to'lovni boshqarish"""
    id_student = data["student"]
    id_group = data["group"]
    amount = data["amount"]
    transaction_type = data["transaction_type"]
    payer_name = data.get("payer_name", "")
    description = data.get("description", "")
    date_val = data.get("date", timezone.localdate())

    student = get_object_or_404(Student, id=id_student)
    group = get_object_or_404(Group, id=id_group)

    branch_instance = student.branch or group.branch
    if not branch_instance and hasattr(request_user, "branch"):
        branch_instance = request_user.branch

    if not branch_instance:
        raise ValueError("Filialni aniqlab bo'lmadi.")

    final_payer = (
        payer_name if (payer_name and payer_name.strip()) else student.full_name
    )
    title_val = (
        f"Qo'shimcha to'lov: {student.full_name}"
        if transaction_type == "income"
        else f"Chiqim (Portal): {student.full_name}"
    )

    with transaction.atomic():
        ft = FinanceTransaction.objects.create(
            transaction_type=transaction_type,
            category="student_extra",
            amount=amount,
            date=date_val,
            marked_by=request_user,
            branch=branch_instance,
            student=student,
            group=group,
            student_name=student.full_name if student else None,
            group_name=group.name if group else None,
            payer_name=final_payer,
            title=title_val,
            description=description,
        )

        # Mentor oyligini qayta hisoblash keragi yo'q,
        # chunki student_extra tranzaksiyalari (qo'shimcha to'lovlar)
        # mentor oyligiga yoki guruh tushumiga kirmaydi.
        mentor_salary_updated = False

        auto_pay_from_wallet(student)

    return ft, mentor_salary_updated


def confirm_student_payment(request_user, payment, data):
    """O'quvchi to'lovini tasdiqlash va tegishli amallarni bajarish"""
    import logging

    from finance.utils import floor_amount

    logger = logging.getLogger(__name__)

    # REFUND LOGIC: To'lov miqdori qoldirilgan darslar bo'yicha hisoblanadi (Chegirma/Jarima)
    pay_full_month = str(data.get("pay_full_month", False)).lower() in [
        "true",
        "1",
        "yes",
    ]
    ignore_refund = str(data.get("ignore_refund", False)).lower() in [
        "true",
        "1",
        "yes",
    ]
    is_partial_payment = str(data.get("is_partial_payment", False)).lower() in [
        "true",
        "1",
        "yes",
    ]
    is_custom_amount = str(data.get("is_custom_amount", False)).lower() in [
        "true",
        "1",
        "yes",
    ]

    # Amount ni olish
    provided_amount = data.get("amount")
    installment_amount = None
    if provided_amount is not None and str(provided_amount).strip():
        try:
            installment_amount = Decimal(str(provided_amount).strip())
        except Exception:
            pass

    if is_custom_amount:
        # ---------------------------------------------------------------
        # CUSTOM PAYMENT: foydalanuvchi tomonidan belgilangan summa.
        #
        # BUG #4 TUZATILDI: Oldingi versiyada payment.amount = custom_summa
        # qilib qo'yilardi — bu asl shartnoma summasini yo'q qilardi va
        # remaining_amount noto'g'ri hisoblangandi.
        #
        # Tuzatma: payment.amount GA TEGMAYMIZ. Faqat refund_ignored
        # belgilaymiz. installment_amount o'zgarishsiz apply_payment ga ketadi.
        # ---------------------------------------------------------------
        if installment_amount is None:
            raise ValueError("Custom to'lov uchun summa kiritish shart")
        if installment_amount <= 0:
            raise ValueError("Custom to'lov summasi 0 dan katta bo'lishi kerak")
        # payment.amount ni O'ZGARTIRMAYMIZ — shartnoma summasi saqlanadi
        payment.refund_amount = Decimal("0")
        payment.refund_ignored = True
        # installment_amount o'zgarishsiz apply_payment ga uzatiladi
    else:
        # ---------------------------------------------------------------
        # ODDIY REJIM: to'liq / bo'lib / refund bilan
        # ---------------------------------------------------------------
        status = payment.student.status
        if status in ["low_income", "negotiated", "discount", "teacher_negotiated"]:
            base_amount = (
                payment.student.custom_fee
                if payment.student.custom_fee is not None
                else payment.group.monthly_price
            )
        else:
            base_amount = payment.group.monthly_price

        contract_amount = Decimal(str(floor_amount(base_amount)))

        if status == "discount":
            # Discount: HAR DOIM davomat asosida hisoblash.
            # payment.amount eskiriib qolgan bo'lishi mumkin (masalan, cancel dan keyin
            # 400,000 ga qaytarilgan). Davomatdan yangi hisob har doim to'g'ri bo'ladi.
            from finance.utils import calculate_attendance_based_student_payment
            final_amount = calculate_attendance_based_student_payment(
                payment.student, payment.group, payment.month
            )
            payment.refund_amount = Decimal("0")
            payment.refund_ignored = True
        elif status == "negotiated":
            # Negotiated: shartnoma summasi, attendance refund qo'llanilmaydi
            final_amount = contract_amount
            payment.refund_amount = Decimal("0")
            payment.refund_ignored = True
        else:
            # O'quvchi to'liq oylik summasini (yoki undan ortiq) to'layotgan bo'lsa,
            # dars qoldirgan bo'lsa ham hech qanday refund/chegirma qo'llanmaydi,
            # to'liq oylik to'lov qabul qilinadi va oylik muammosiz yopiladi.
            is_paying_full = (
                not is_partial_payment
                and (
                    pay_full_month
                    or (
                        installment_amount is not None
                        and (
                            installment_amount >= contract_amount
                            or (Decimal(str(payment.paid_amount or 0)) + installment_amount) >= contract_amount
                        )
                    )
                    or (ignore_refund and installment_amount is None)
                )
            )

            if is_paying_full:
                pay_full_month = True
                ignore_refund = True
                is_partial_payment = False
                final_amount = contract_amount
                payment.refund_amount = Decimal("0")
                payment.refund_ignored = True
                payment.amount = contract_amount
                current_paid = Decimal(str(payment.paid_amount or 0))
                remaining_to_contract = max(Decimal("0"), contract_amount - current_paid)
                if installment_amount is None or installment_amount >= remaining_to_contract:
                    installment_amount = remaining_to_contract if remaining_to_contract > 0 else contract_amount
            elif ignore_refund:
                final_amount = contract_amount
                if not payment.paid_amount or payment.refund_amount is None:
                    payment.refund_amount = Decimal("0")
                payment.refund_ignored = True
            elif payment.paid_amount and payment.paid_amount > 0:
                # Agar allaqachon qisman to'lov qilingan bo'lsa (davomiy to'lov), refund qayta hisoblanmaydi
                final_amount = Decimal(str(payment.amount or contract_amount))
                if payment.refund_amount is None:
                    payment.refund_amount = Decimal("0")
                payment.refund_ignored = True
            else:
                # Jarimani aniqlash
                refund_val = payment.student.calculate_refund_amount(
                    payment.month.year,
                    payment.month.month,
                    group=payment.group,
                )
                payment.refund_amount = Decimal(str(refund_val))
                payment.refund_ignored = False
                final_amount = Decimal(
                    str(max(Decimal("0"), contract_amount - Decimal(str(refund_val))))
                )

        # MUHIM: payment.amount faqat to'liq to'lash rejimida final_amount ga o'zgartiriladi.
        # Bo'lib to'lash (is_partial_payment=True) rejimida payment.amount ni O'ZGARTIRMAYMIZ.
        if not is_partial_payment:
            payment.amount = final_amount

        if payment.pk:
            payment.save()

        # Installment hisoblash — faqat oddiy rejimda
        if is_paying_full:
            # installment_amount allaqachon to'g'ri hisoblangan
            pass
        elif installment_amount is None:
            # Amount umuman berilmagan — to'liq qolgan summani to'lash
            remaining = payment.remaining_amount
            installment_amount = remaining if remaining > 0 else final_amount
        elif is_partial_payment:
            # Bo'lib to'lash: foydalanuvchi kiritgan summani SAQLAYMIZ.
            # Faqat qolgan qarz (remaining) dan oshmasligi kerak (himoya).
            remaining = payment.remaining_amount
            if remaining > 0 and installment_amount > remaining:
                installment_amount = remaining
        else:
            # To'liq to'lash (yoki davomiy to'lovni yakunlash)
            remaining = payment.remaining_amount
            if remaining > 0:
                if installment_amount > remaining:
                    installment_amount = remaining
            else:
                installment_amount = Decimal("0")


    # Yangi maydonlarni extract qilamiz:
    # payment_method va method aliaslarini qabul qilamiz hamda standartlashtiramiz
    raw_method = data.get("payment_method") or data.get("method") or "cash"
    normalized_method = str(raw_method).strip().lower()
    if normalized_method in ["click", "karta", "card", "click/karta", "click / card", "click_card"]:
        method = "click"
    elif normalized_method in ["payme"]:
        method = "payme"
    elif normalized_method in ["cash", "naqd"]:
        method = "cash"
    elif normalized_method in ["other", "boshqa"]:
        method = "other"
    else:
        method = raw_method

    # Chek faylini extract qilish: receipt_image yoki receipt
    receipt = data.get("receipt_image") or data.get("receipt")
    if not receipt and hasattr(data, "getlist"):
        receipt_list = data.getlist("receipt_image") or data.getlist("receipt")
        if receipt_list:
            receipt = receipt_list[0]

    notes = data.get("notes", "")
    raw_receiptless = data.get("is_receiptless")
    if raw_receiptless is not None:
        is_receiptless = str(raw_receiptless).lower() in ["true", "1", "yes"]
    else:
        is_receiptless = False if receipt else (method == "cash")

    # Agar haqiqiy chek fayli biriktirilgan bo'lsa, is_receiptless har doim False bo'lishi shart!
    if receipt:
        is_receiptless = False

    # Davomat ma'lumotlarini notes ga qo'shamiz
    notes_parts = []
    if notes:
        notes_parts.append(notes)

    group_name = payment.group.name if payment.group else (payment.group_name or "Guruhsiz")
    month_str = payment.month.strftime("%Y-%m") if payment.month else ""

    lesson_dates = payment.group.get_lesson_dates(
        payment.month.year, payment.month.month
    ) if payment.group else []

    # O'quvchi guruhga qo'shilgan/chiqqan sanani inobatga olish
    enrollment = payment.student.enrollments.filter(group=payment.group).first() if (payment.student and payment.group) else None
    joined_date = enrollment.joined_at.date() if (enrollment and enrollment.joined_at) else (payment.student.joined_at.date() if (payment.student and payment.student.joined_at) else None)

    student_lesson_dates = list(lesson_dates)
    if joined_date:
        student_lesson_dates = [d for d in student_lesson_dates if d >= joined_date]
    if enrollment and enrollment.left_at:
        student_lesson_dates = [d for d in student_lesson_dates if d <= enrollment.left_at.date()]

    today = timezone.localdate()
    effective_date = payment.paid_at.date() if payment.paid_at else today
    passed_lessons = [d for d in student_lesson_dates if d <= effective_date]

    # Aniq davomat hisobi: faqat ushbu guruhning haqiqiy dars kunlari va tasdiqlangan davomatlar
    present_count = Attendance.objects.filter(
        student=payment.student,
        group=payment.group,
        date__year=payment.month.year,
        date__month=payment.month.month,
        date__in=student_lesson_dates,
        is_present=True,
        marked_by__isnull=False,
    ).count() if (payment.student and payment.group and student_lesson_dates) else 0

    total_group_lessons = len(lesson_dates)
    total_student_lessons = len(student_lesson_dates)

    if total_student_lessons != total_group_lessons and total_student_lessons > 0:
        att_stat_str = f"Davomat: {present_count}/{total_student_lessons} dars (oyda jami {total_group_lessons})"
    else:
        att_stat_str = f"Davomat: {present_count}/{total_group_lessons} dars"

    # Guruh, oy va aniq davomat ma'lumotlarini to'lov izohiga aniq kiritamiz
    group_att_str = f"Guruh: {group_name} | Davr: {month_str} | {att_stat_str}"
    notes_parts.append(group_att_str)

    if is_partial_payment:
        notes_parts.append("Bo'lib to'lov")
    if is_custom_amount:
        notes_parts.append("Custom to'lov")
    notes = " | ".join(notes_parts)

    # BUG #3 FIX (qo'shimcha himoya): installment_amount == 0 bo'lsa (allaqachon
    # to'liq to'langan holat), apply_payment ga kirmay, payment holatini saqlab chiqamiz.
    # Bu apply_payment ichidagi "installment <= 0 → ValueError" dan ham himoyalaydi.
    if installment_amount is not None and Decimal(str(installment_amount)) <= 0:
        payment.save()
        return payment

    # is_full_amount ni frontend dan to'g'ridan to'g'ri olamiz (yoki fallback sifatida pay_full_month ga qaraymiz)
    is_full_amount_flag = (
        str(data.get("is_full_amount", "")).lower() in ["true", "1", "yes"]
        or (pay_full_month and not is_partial_payment)
    )

    payment.apply_payment(
        request_user,
        installment_amount,
        method=method,
        receipt=receipt,
        notes=notes,
        is_receiptless=is_receiptless,
        is_full_amount=is_full_amount_flag,
        is_custom_amount=is_custom_amount,
    )

    # Mentor oyligini qayta hisoblash
    try:
        mentor = payment.group.mentor
        if mentor and hasattr(mentor, "staff_profile"):
            profile = mentor.staff_profile
            if profile.salary_type in ["percentage", "student_count"]:
                payment_month = payment.month.replace(day=1) if payment.month else None
                if payment_month:
                    emp_payment = EmployeePayment.objects.filter(
                        employee=mentor, month=payment_month, is_paid=False
                    ).first()
                    if emp_payment:
                        apply_calculated_salary_to_employee_payment(
                            profile, payment_month, emp_payment
                        )
                        emp_payment.save()
    except Exception as salary_err:
        logger.error(f"Mentor salary recalculate error: {salary_err}")

    return payment


def get_finance_dashboard_stats(user, month, year):
    """Moliya dashboardi uchun statistikani yig'ish"""
    today = timezone.localdate()
    payment_filter = Q(month__month=month, month__year=year)
    employee_filter = Q(month__month=month, month__year=year)
    # Tasdiqlanmagan kassa pullari global balansga kirmasligi uchun is_verified=True qo'shildi
    transaction_filter = Q(date__month=month, date__year=year, is_verified=True)

    if user.role == "admin":
        payment_filter &= Q(group__branch=user.branch)
        employee_filter &= Q(employee__branch=user.branch)
        transaction_filter &= Q(branch=user.branch)

    total_income = _to_decimal(
        FinanceTransaction.objects.filter(
            transaction_filter, transaction_type="income"
        ).exclude(category='student_extra').aggregate(total=Sum("amount"))["total"]
    )
    total_expense = _to_decimal(
        FinanceTransaction.objects.filter(
            transaction_filter, transaction_type="expense"
        ).aggregate(total=Sum("amount"))["total"]
    )
    admin_exp_filter = Q(date__month=month, date__year=year)
    if user.role == "admin":
        admin_exp_filter &= Q(branch=user.branch)
    total_admin_expense = _to_decimal(
        AdminExpense.objects.filter(admin_exp_filter).aggregate(total=Sum("amount"))["total"]
    )
    total_expense += total_admin_expense
    unpaid_payments = Payment.objects.filter(payment_filter, is_paid=False)
    # TUZATILDI (BUG-N1-1): Avval loop ichida har bir payment uchun alohida
    # remaining_amount property hisoblanardi (N+1 muammo).
    # Endi bitta aggregate so'rov bilan jami qarz hisoblanadi.
    #
    # MUHIM: custom_amount rejimida paid_amount > amount bo'lishi mumkin.
    # Shuning uchun har bir payment uchun alohida max(0, amount-paid) qo'llanishi kerak.
    # Greatest(F('amount')-F('paid_amount'), Value(0)) — bu original remaining_amount ga mos.
    from django.db.models import ExpressionWrapper, DecimalField, Value
    from django.db.models.functions import Greatest
    _debt_agg = unpaid_payments.aggregate(
        total=Sum(Greatest(
            ExpressionWrapper(
                F('amount') - F('paid_amount'),
                output_field=DecimalField(max_digits=15, decimal_places=2)
            ),
            Value(Decimal('0'))
        ))
    )
    total_debt = _to_decimal(_debt_agg['total'])

    branches_data = []
    if user.role == "super_admin":
        # N+1 muammosini hal qilish: barcha filiallar uchun tranzaksiyalarni bitta so'rovda guruhlab olamiz
        branch_stats_qs = (
            FinanceTransaction.objects.filter(
                date__month=month, date__year=year, is_verified=True
            ).exclude(category='student_extra')
            .values("branch_id", "transaction_type")
            .annotate(total=Sum("amount"))
        )

        # Filiallar xaritasini yaratamiz
        all_branches = Branch.objects.all().values("id", "name")
        branch_map = {
            b["id"]: {
                "id": b["id"],
                "name": b["name"],
                "income": 0.0,
                "expense": 0.0,
                "profit": 0.0,
            }
            for b in all_branches
        }

        for stat in branch_stats_qs:
            b_id = stat["branch_id"]
            if b_id in branch_map:
                val = float(stat["total"] or 0)
                if stat["transaction_type"] == "income":
                    branch_map[b_id]["income"] = val
                else:
                    branch_map[b_id]["expense"] = val

        # Filiallar bo'yicha operatsion (admin) chiqimlarni ham xarajatlarga qo'shish
        admin_exp_branch_qs = (
            AdminExpense.objects.filter(date__month=month, date__year=year)
            .values("branch_id")
            .annotate(total=Sum("amount"))
        )
        for stat in admin_exp_branch_qs:
            b_id = stat["branch_id"]
            if b_id in branch_map:
                val = float(stat["total"] or 0)
                branch_map[b_id]["expense"] += val

        for b_id in branch_map:
            branch_map[b_id]["profit"] = (
                branch_map[b_id]["income"] - branch_map[b_id]["expense"]
            )
            branch_map[b_id]["attendance_refunds"] = 0.0

        refund_by_branch = aggregate_attendance_refunds_by_branch(year, month)
        for b_id, refund_val in refund_by_branch.items():
            if b_id in branch_map:
                branch_map[b_id]["attendance_refunds"] = refund_val

        branches_data = list(branch_map.values())

    # 1. Barcha income tranzaksiyalarini guruh bo'yicha yig'amiz (shu oydagi haqiqiy tushum)
    group_transaction_income = {}
    tx_qs = FinanceTransaction.objects.filter(
        date__month=month,
        date__year=year,
        transaction_type="income",
        is_verified=True,
    ).exclude(category='student_extra')
    if user.role == "admin":
        tx_qs = tx_qs.filter(branch=user.branch)
    
    tx_qs = tx_qs.values("group_id").annotate(total=Sum("amount"))
    for row in tx_qs:
        if row["group_id"]:
            group_transaction_income[row["group_id"]] = _to_decimal(row["total"])

    # 3. Guruhlarni olish va income ni hisoblash
    top_groups_qs = Group.objects.filter(is_faol=True)
    if user.role == "admin":
        top_groups_qs = top_groups_qs.filter(branch=user.branch)
    top_groups_qs = top_groups_qs.annotate(st_count=Count("students", distinct=True))

    # Har guruh uchun total income ni hisoblash va sort qilish
    groups_with_income = []
    for g in top_groups_qs:
        total_inc = group_transaction_income.get(g.id, Decimal("0"))
        groups_with_income.append({"group": g, "income": total_inc})

    # Eng yuqori income li 5 ta guruhni olish
    groups_with_income.sort(key=lambda x: x["income"], reverse=True)
    top_groups_data = []
    for item in groups_with_income[:5]:
        top_groups_data.append(item["group"])

    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    # Tasdiqlanmagan kassa pullari global balansga kirmasligi uchun is_verified=True qo'shildi
    prev_tx_filter = Q(date__month=prev_month, date__year=prev_year, is_verified=True)
    if user.role == "admin":
        prev_tx_filter &= Q(branch=user.branch)
    prev_income = _to_decimal(
        FinanceTransaction.objects.filter(
            prev_tx_filter, transaction_type="income"
        ).exclude(category='student_extra').aggregate(total=Sum("amount"))["total"]
    )
    prev_expense = _to_decimal(
        FinanceTransaction.objects.filter(
            prev_tx_filter, transaction_type="expense"
        ).aggregate(total=Sum("amount"))["total"]
    )

    def calc_trend(curr, prev):
        curr, prev = float(curr), float(prev)
        if prev == 0:
            return 100.0 if curr > 0 else (-100.0 if curr < 0 else 0.0)
        return round(((curr - prev) / abs(prev)) * 100, 1)

    attendance_today = _safe_attendance_stats_for_user(user, today)

    # Statistika uchun filtrlarni aniqlash (Admin uchun faqat o'z filiali)
    stats_filters = {}
    enrollment_filters = {"is_active": True}
    if user.role == "admin":
        stats_filters["branch"] = user.branch
        enrollment_filters["group__branch"] = user.branch

    # Student countni optimallashtirish: Student o'rniga Enrollmentdan sanaymiz (tezroq)
    from groups.models import GroupEnrollment

    students_count = (
        GroupEnrollment.objects.filter(**enrollment_filters)
        .values("student")
        .distinct()
        .count()
    )

    branch_for_refunds = user.branch if user.role == "admin" else None
    total_attendance_refunds = aggregate_attendance_refunds(
        year, month, branch=branch_for_refunds
    )
    total_attendance_refunds_paid = aggregate_attendance_refunds(
        year, month, branch=branch_for_refunds, paid_only=True
    )
    refund_share_percent = 0.0
    gross_student_fees = float(total_income) + total_attendance_refunds_paid
    if gross_student_fees > 0:
        refund_share_percent = round(
            (total_attendance_refunds_paid / gross_student_fees) * 100, 1
        )

    return {
        "total_income": float(total_income),
        "total_expense": float(total_expense),
        "net_profit": float(total_income - total_expense),
        "total_debt": float(total_debt),
        "total_attendance_refunds": total_attendance_refunds,
        "total_attendance_refunds_paid": total_attendance_refunds_paid,
        "refund_share_percent": refund_share_percent,
        "income_trend": calc_trend(total_income, prev_income),
        "expense_trend": calc_trend(total_expense, prev_expense),
        "profit_trend": calc_trend(
            total_income - total_expense, prev_income - prev_expense
        ),
        "branches": branches_data,
        "top_groups": [
            {
                "name": item["group"].name,
                "profit": float(item["income"]),
                "student_count": item["group"].st_count,
            }
            for item in groups_with_income[:5]
        ],
        "stats": {
            "students": students_count,
            "mentors": User.objects.filter(
                role="mentor", is_active=True, **stats_filters
            ).count(),
            "groups": Group.objects.filter(is_faol=True, **stats_filters).count(),
            "admins": User.objects.filter(
                role="admin", is_active=True, **stats_filters
            ).count(),
            "attendance_today": attendance_today,
        },
    }


def get_branch_finance_stats(branch_id, month, year):
    """Filial uchun moliya statistikasini yig'ish (Optimallashgan)"""
    try:
        from decimal import Decimal

        from finance.utils import floor_amount

        branch = get_object_or_404(Branch, id=branch_id)
        today = timezone.localdate()

        # Statistikani yig'ish
        mentors_count = User.objects.filter(
            branch=branch, role="mentor", is_active=True
        ).count()
        admins_count = User.objects.filter(
            branch=branch, role="admin", is_active=True
        ).count()
        groups_count = Group.objects.filter(branch=branch, is_faol=True).count()
        students_count = (
            Student.objects.filter(branch=branch, enrollments__is_active=True)
            .distinct()
            .count()
        )

        # 1. Barcha to'lovlarni bitta so'rovda guruhlab olamiz
        payment_qs = Payment.objects.filter(
            group__branch=branch, month__month=month, month__year=year
        )
        payment_map = {}  # key: (student_id, group_id)
        group_payment_refunds = {}  # key: group_id, value: total refund_amount
        for p in payment_qs:
            key = (p.student_id, p.group_id)
            payment_map[key] = p
            # Guruh uchun umumiy refundni hisoblash
            group_payment_refunds[p.group_id] = group_payment_refunds.get(
                p.group_id, Decimal("0")
            ) + _to_decimal(p.refund_amount)

        # 2. Barcha student_extra tranzaksiyalarini olamiz
        extra_qs = FinanceTransaction.objects.filter(
            branch=branch, category="student_extra", date__year=year, date__month=month
        )
        extra_map = {}
        for tx in extra_qs:
            key = (tx.student_id, tx.group_id)
            if key not in extra_map:
                extra_map[key] = Decimal("0")
            if tx.transaction_type == "income":
                extra_map[key] += _to_decimal(tx.amount)
            else:
                extra_map[key] -= _to_decimal(tx.amount)

        # Guruhlar bo'yicha joriy oydagi tranzaksiya tushumlarini bitta so'rovda guruhlab olamiz
        group_transaction_income = {}
        tx_income_qs = FinanceTransaction.objects.filter(
            branch=branch,
            date__month=month,
            date__year=year,
            transaction_type="income",
            is_verified=True,
        ).exclude(category='student_extra').values("group_id").annotate(total=Sum("amount"))
        for row in tx_income_qs:
            if row["group_id"]:
                group_transaction_income[row["group_id"]] = _to_decimal(row["total"])

        # 3. Guruhlar va ulardagi studentlarni olamiz
        active_groups = (
            Group.objects.filter(branch=branch, is_faol=True)
            .select_related("mentor")
            .prefetch_related("enrollments__student", "old_students_fk")
        )

        expected_income = Decimal("0")
        total_received = Decimal("0")
        total_payment_refunds = sum(
            group_payment_refunds.values(), Decimal("0")
        )  # Umumiy refund miqdori
        groups_detail = []

        for group in active_groups:
            try:
                g_expected = Decimal("0")
                g_received = group_transaction_income.get(group.id, Decimal("0"))
                g_debt = Decimal("0")
                # Barcha studentlarni olamiz
                all_students_map = {}
                for enrollment in group.enrollments.filter(is_active=True):
                    if enrollment.student:
                        all_students_map[enrollment.student.id] = enrollment.student
                
                unenrolled_ids = set(group.enrollments.filter(is_active=False).values_list('student_id', flat=True))
                for s in group.old_students_fk.filter(is_archived=False, is_active=True):
                    if s.id not in unenrolled_ids:
                        all_students_map[s.id] = s
                        
                students = list(all_students_map.values())
                student_count = len(students)
                processed_pairs = set()

                for student in students:
                    key = (student.id, group.id)
                    if key in processed_pairs:
                        continue
                    processed_pairs.add(key)

                    student_extra = extra_map.get(key, Decimal("0"))

                    if student.status == "teacher_negotiated":
                        if student.custom_fee is not None:
                            base_expected = Decimal(str(student.custom_fee))
                        else:
                            from finance.utils import get_teacher_negotiated_center_fee
                            base_expected = get_teacher_negotiated_center_fee(group)
                    elif student.status == "discount":
                        base_expected = calculate_attendance_based_student_payment(
                            student, group, date(year, month, 1)
                        )
                    elif student.status in ["negotiated", "low_income"]:
                        base_expected = Decimal(
                            str(student.custom_fee or group.monthly_price or 0)
                        )
                    else:  # regular
                        base_expected = Decimal(str(group.monthly_price or 0))
                    base_expected = floor_amount(base_expected)

                    expected_total = base_expected + student_extra
                    g_expected += expected_total

                    # Debt calculation: Payment remaining_amount if payment exists, else expected_total
                    p = payment_map.get(key)
                    if p:
                        g_debt += p.remaining_amount
                    else:
                        g_debt += expected_total

                expected_income += g_expected
                total_received += g_received

                mentor_name = group.mentor.get_full_name() if group.mentor else "Yo'q"
                g_monthly_price = float(group.monthly_price)
                g_refund_amount = float(
                    group_payment_refunds.get(group.id, Decimal("0"))
                )

                groups_detail.append(
                    {
                        "id": group.id,
                        "name": group.name,
                        "student_count": student_count,
                        "monthly_price": g_monthly_price,
                        "daily_price": round(
                            g_monthly_price
                            / max(len(group.get_lesson_dates(year, month)), 1),
                            2,
                        ),
                        "expected_income": float(g_expected),
                        "received_income": float(g_received),
                        "refund_amount": g_refund_amount,
                        "real_income": float(g_received),
                        "debt": float(g_debt),
                        "mentor": mentor_name,
                    }
                )
            except Exception:
                logger.exception("Group statistikada xatolik: group_id=%s", group.id)
                continue

        # Umumiy tranzaksiyalar
        received_income = _to_decimal(
            FinanceTransaction.objects.filter(
                branch=branch,
                date__month=month,
                date__year=year,
                transaction_type="income",
                is_verified=True,
            ).aggregate(total=Sum("amount"))["total"]
        )

        ledger_expenses = _to_decimal(
            FinanceTransaction.objects.filter(
                branch=branch,
                date__month=month,
                date__year=year,
                transaction_type="expense",
                is_verified=True,
            ).aggregate(total=Sum("amount"))["total"]
        )

        # Adminlar qilgan operatsion chiqimlar (AdminExpense)
        admin_expenses_qs = AdminExpense.objects.filter(
            branch=branch,
            date__month=month,
            date__year=year
        ).select_related('marked_by').order_by('-date', '-created_at')

        admin_expenses_total = _to_decimal(admin_expenses_qs.aggregate(total=Sum("amount"))["total"])
        total_branch_expenses = ledger_expenses + admin_expenses_total

        admin_expenses_list = [
            {
                "id": exp.id,
                "title": exp.title,
                "amount": float(exp.amount),
                "date": str(exp.date),
                "description": exp.description or "",
                "marked_by": (exp.marked_by.get_full_name() or exp.marked_by.username) if exp.marked_by else "Admin",
                "created_at": exp.created_at.strftime("%Y-%m-%d %H:%M") if exp.created_at else None,
            }
            for exp in admin_expenses_qs
        ]

        attendance_refunds = aggregate_attendance_refunds(year, month, branch=branch)
        attendance_refunds_paid = aggregate_attendance_refunds(
            year, month, branch=branch, paid_only=True
        )
        refund_share_percent = 0.0
        if float(received_income) + attendance_refunds_paid > 0:
            refund_share_percent = round(
                (
                    attendance_refunds_paid
                    / (float(received_income) + attendance_refunds_paid)
                )
                * 100,
                1,
            )

        return {
            "branch": {"id": branch.id, "name": branch.name},
            "stats": {
                "mentors": mentors_count,
                "admins": admins_count,
                "groups": groups_count,
                "students": students_count,
                "attendance_today": _safe_attendance_stats_for_branch(branch, today),
            },
            "finance": {
                "expected_income": float(expected_income),
                "received_income": float(received_income),
                "refunds": attendance_refunds,
                "total_payment_refunds": float(
                    total_payment_refunds
                ),  # Umumiy refund miqdori (Payment.refund_amount)
                "attendance_refunds": attendance_refunds,
                "attendance_refunds_paid": attendance_refunds_paid,
                "refund_share_percent": refund_share_percent,
                "real_revenue": float(received_income),
                "expenses": float(total_branch_expenses),
                "admin_expenses_total": float(admin_expenses_total),
                "ledger_expenses_total": float(ledger_expenses),
                "net_profit": float(received_income) - float(total_branch_expenses),
            },
            "admin_expenses": admin_expenses_list,
            "groups": groups_detail,
        }
    except Exception as e:
        logger.error(f"Error in get_branch_finance_stats: {str(e)}")
        logger.error(traceback.format_exc())

        # Fail-safe response: frontend sahifasi yiqilmasligi uchun
        fallback_branch = (
            Branch.objects.filter(id=branch_id).values("id", "name").first()
        )
        return {
            "branch": {
                "id": fallback_branch["id"] if fallback_branch else branch_id,
                "name": fallback_branch["name"]
                if fallback_branch
                else "Noma'lum filial",
            },
            "stats": {
                "mentors": 0,
                "admins": 0,
                "groups": 0,
                "students": 0,
                "attendance_today": {"absent": 0, "total": 0},
            },
            "finance": {
                "expected_income": 0.0,
                "received_income": 0.0,
                "refunds": 0.0,
                "attendance_refunds": 0.0,
                "attendance_refunds_paid": 0.0,
                "refund_share_percent": 0.0,
                "real_revenue": 0.0,
                "expenses": 0.0,
                "net_profit": 0.0,
            },
            "groups": [],
            "warning": "Ma'lumotlar vaqtincha to'liq emas. Server loglarini tekshiring.",
        }


def get_monthly_branch_trends(user, end_month, end_year, months_back=6):
    """
    Har oy kesimida filiallar bo'yicha tushum/chiqim trendi.
    Frontend bitta chartda barcha filiallarni ko'rsatishi uchun qaytariladi.
    """
    try:
        months_back = max(1, min(int(months_back), 24))
    except (TypeError, ValueError):
        months_back = 6

    end_month = int(end_month)
    end_year = int(end_year)

    month_points = []
    y, m = end_year, end_month
    for _ in range(months_back):
        month_points.append((y, m))
        if m == 1:
            y -= 1
            m = 12
        else:
            m -= 1
    month_points.reverse()

    if user.role == "admin" and user.branch_id:
        branches = Branch.objects.filter(id=user.branch_id)
    else:
        branches = Branch.objects.all()

    branch_rows = list(branches.values("id", "name"))
    branch_ids = [b["id"] for b in branch_rows]

    if not branch_ids:
        return {"months": [], "branches": []}

    start_year, start_month = month_points[0]
    end_year_last, end_month_last = month_points[-1]
    start_date = date(start_year, start_month, 1)
    end_day = calendar.monthrange(end_year_last, end_month_last)[1]
    end_date = date(end_year_last, end_month_last, end_day)

    # KASSA LOGIKASI: trend grafigi uchun ham faqat tasdiqlangan tranzaksiyalar
    tx_qs = FinanceTransaction.objects.filter(
        branch_id__in=branch_ids, date__gte=start_date, date__lte=end_date,
        is_verified=True,
    ).exclude(category='student_extra')
    aggregated = tx_qs.values(
        "branch_id", "date__year", "date__month", "transaction_type"
    ).annotate(total=Sum("amount"))

    bucket = {}
    for row in aggregated:
        key = (row["date__year"], row["date__month"], row["branch_id"])
        if key not in bucket:
            bucket[key] = {"income": Decimal("0"), "expense": Decimal("0")}
        tx_type = row["transaction_type"]
        bucket[key][tx_type] = _to_decimal(row["total"])

    admin_aggregated = AdminExpense.objects.filter(
        branch_id__in=branch_ids, date__gte=start_date, date__lte=end_date,
    ).values("branch_id", "date__year", "date__month").annotate(total=Sum("amount"))
    for row in admin_aggregated:
        key = (row["date__year"], row["date__month"], row["branch_id"])
        if key not in bucket:
            bucket[key] = {"income": Decimal("0"), "expense": Decimal("0")}
        bucket[key]["expense"] += _to_decimal(row["total"])

    month_payload = []
    for year, month in month_points:
        month_label = f"{year}-{str(month).zfill(2)}"
        branch_stats = []
        for branch in branch_rows:
            totals = bucket.get(
                (year, month, branch["id"]),
                {"income": Decimal("0"), "expense": Decimal("0")},
            )
            branch_stats.append(
                {
                    "branch_id": branch["id"],
                    "branch_name": branch["name"],
                    "income": float(totals["income"]),
                    "expense": float(totals["expense"]),
                    "profit": float(totals["income"] - totals["expense"]),
                }
            )

        month_payload.append({"month": month_label, "branches": branch_stats})

    return {"months": month_payload, "branches": branch_rows}


def auto_pay_from_wallet(student):
    """
    (O'CHIRILGAN) Qo'shimcha to'lov va balansdan avtomatik qirqib olish logikasi to'xtatildi.
    Bu funksiya atayin bo'sh qoldirildi, to systemni buzmaslik uchun.
    """
    return
    from django.utils import timezone
    from django.db.models import Sum, F
    from finance.models import FinanceTransaction, Payment

    extra_balance = FinanceTransaction.objects.filter(
        student=student,
        category="student_extra",
        status="completed",
        record_type__in=["payment", "reversal"]
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0")

    if extra_balance <= Decimal("0"):
        return

    unpaid_payments = Payment.objects.filter(
        student=student,
        is_paid=False,
        amount__gt=F("paid_amount")
    ).order_by("created_at")

    if not unpaid_payments.exists():
        return

    with transaction.atomic():
        for payment in unpaid_payments:
            if extra_balance <= Decimal("0"):
                break

            remaining = payment.amount - payment.paid_amount
            to_pay = min(extra_balance, remaining)

            if to_pay <= Decimal("0"):
                continue

            real_tx = FinanceTransaction.objects.create(
                transaction_type="income",
                category="student_fee",
                status="completed",
                record_type="payment",
                amount=to_pay,
                date=timezone.now().date(),
                student=student,
                group=payment.group,
                student_name=student.full_name if student else None,
                group_name=payment.group.name if payment.group else None,
                branch=student.branch or payment.group.branch,
                title=f"Avtomatik to'lov (Hamyondan): {student.full_name}",
                description=f"Hamyondagi mablag'dan {payment.month.strftime('%B %Y')} oyi uchun yechib olindi.",
                is_verified=True,
            )

            FinanceTransaction.objects.create(
                transaction_type="income",
                category="student_extra",
                status="completed",
                record_type="payment",
                amount=-to_pay,
                date=timezone.now().date(),
                student=student,
                group=None,
                student_name=student.full_name if student else None,
                group_name=None,
                branch=student.branch or payment.group.branch,
                title=f"Hamyondan yechildi: {student.full_name}",
                description=f"To'lov ({payment.month.strftime('%B %Y')}) uchun hamyondan qirqib olindi.",
                is_verified=True,
            )

            payment.paid_amount += to_pay
            if payment.paid_amount >= payment.amount:
                payment.is_paid = True
                payment.paid_at = timezone.now()
            payment.save(update_fields=["paid_amount", "is_paid", "paid_at"])

            extra_balance -= to_pay


def build_cashier_desk_dict(target_branch_id, month_date=None, today=None, search_query=''):
    """
    Filial POS Kassasi (Cashier Desk) ma'lumotlarini hisoblab, lug'at (dict) ko'rinishida qaytaradi.
    Offline-First yuklash (offline_finance_bundle) va jonli API (cashier-desk) uchun yagona manba.
    """
    from decimal import Decimal
    from django.db.models import Sum, Count, Q
    from django.utils import timezone
    from branches.models import Branch
    from groups.models import Group, GroupEnrollment, Student
    from finance.models import FinanceTransaction, AdminExpense, Payment
    from homework_attends.models import Attendance

    if today is None:
        today = timezone.localdate()

    if month_date is None:
        month_date = today.replace(day=1)

    branch = Branch.objects.filter(id=target_branch_id).first()
    if not branch:
        return None

    # 1. Filial Kassa Qoldig'i (Bugungi Kirim, Chiqim va Balans)
    today_incomes = FinanceTransaction.objects.filter(
        branch_id=target_branch_id,
        date=today,
        transaction_type='income',
        status='completed'
    ).aggregate(
        total=Sum('amount'),
        cash=Sum('amount', filter=Q(payment_method='cash')),
        card=Sum('amount', filter=Q(payment_method__in=['click', 'payme', 'card']))
    )
    today_expenses = FinanceTransaction.objects.filter(
        branch_id=target_branch_id,
        date=today,
        transaction_type='expense',
        status='completed'
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    admin_exp_today = AdminExpense.objects.filter(
        branch_id=target_branch_id,
        date=today
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

    tot_inc = today_incomes['total'] or Decimal('0')
    cash_inc = today_incomes['cash'] or Decimal('0')
    card_inc = today_incomes['card'] or Decimal('0')
    tot_exp = today_expenses + admin_exp_today

    branch_desk_stats = {
        "branch_id": branch.id,
        "branch_name": branch.name,
        "today_date": str(today),
        "month": month_date.strftime("%Y-%m"),
        "today_income": float(tot_inc),
        "today_cash": float(cash_inc),
        "today_card": float(card_inc),
        "today_expense": float(tot_exp),
        "today_balance": float(tot_inc - tot_exp),
    }

    # 2. Guruhlarni yig'ish (Single query)
    groups_qs = Group.objects.filter(
        branch_id=target_branch_id,
        is_faol=True,
        is_archived=False
    ).select_related('mentor', 'branch').prefetch_related('special_lesson_days', 'canceled_lesson_days')

    group_ids = list(groups_qs.values_list('id', flat=True))

    # 3. Dars kunlarini hisoblash (O'tilgan darslar)
    group_lesson_counts = {}
    for g in groups_qs:
        dates = g.get_lesson_dates(month_date.year, month_date.month)
        passed = [d for d in dates if d <= today]
        group_lesson_counts[g.id] = (len(dates), len(passed))

    # 4. Faol enrollmentlar (Bir so'rovda barcha o'quvchilar)
    enrollments = list(GroupEnrollment.objects.filter(
        group_id__in=group_ids,
        is_active=True
    ).select_related('student', 'group', 'group__mentor').order_by('student__full_name'))

    student_ids = list(set(e.student_id for e in enrollments if e.student_id))

    # 5. Multi-Group Accounting: Har bir o'quvchining boshqa guruhlari
    student_other_groups_map = {}
    if student_ids:
        all_active_enrollments = GroupEnrollment.objects.filter(
            student_id__in=student_ids,
            is_active=True
        ).select_related('group', 'group__mentor', 'group__branch')
        for enr in all_active_enrollments:
            student_other_groups_map.setdefault(enr.student_id, []).append({
                "group_id": enr.group_id,
                "group_name": enr.group.name if enr.group else "",
                "branch_id": enr.group.branch_id if enr.group else None,
                "branch_name": enr.group.branch.name if (enr.group and enr.group.branch) else "",
                "mentor_name": enr.group.mentor.get_full_name() if (enr.group and enr.group.mentor) else "Biriktirilmagan",
                "monthly_price": float(enr.group.monthly_price or 0) if enr.group else 0
            })

    # 6. O'quvchilarning joriy oydagi to'lovlari (Payment)
    payments_qs = Payment.objects.filter(
        group_id__in=group_ids,
        month=month_date
    ).select_related('student', 'group', 'marked_by')
    payment_map = {(p.student_id, p.group_id): p for p in payments_qs}

    # 7. Davomatlar (Bir so'rovda o'quvchining kelgan kunlari soni)
    attendance_rows = Attendance.objects.filter(
        group_id__in=group_ids,
        date__year=month_date.year,
        date__month=month_date.month,
        is_present=True,
        marked_by__isnull=False
    ).values('group_id', 'student_id').annotate(present_cnt=Count('id'))
    attendance_map = {(r['group_id'], r['student_id']): r['present_cnt'] for r in attendance_rows}

    # 8. Guruhlar va O'quvchilar ierarxiyasini yig'ish
    group_rosters = {}
    debtors_list = []
    all_branch_debt = Decimal('0')
    all_branch_collected = Decimal('0')

    for g in groups_qs:
        group_rosters[g.id] = {
            "id": g.id,
            "name": g.name,
            "monthly_price": float(g.monthly_price or 0),
            "mentor_id": g.mentor_id,
            "mentor_name": g.mentor.get_full_name() or g.mentor.username if g.mentor else "Biriktirilmagan",
            "days": g.dars_kunlari or ", ".join([["Du", "Se", "Chor", "Pay", "Ju", "Shan", "Yak"][d] for d in g._get_effective_days()]),
            "time": g.dars_vaqti or "",
            "total_lessons": group_lesson_counts.get(g.id, (0, 0))[0],
            "passed_lessons": group_lesson_counts.get(g.id, (0, 0))[1],
            "students_count": 0,
            "paid_count": 0,
            "partial_count": 0,
            "unpaid_count": 0,
            "total_debt": 0.0,
            "total_collected": 0.0,
            "students": []
        }

    for enr in enrollments:
        student = enr.student
        group = enr.group
        if not student or not group:
            continue

        gid = group.id
        total_l, passed_l = group_lesson_counts.get(gid, (0, 0))
        present_c = attendance_map.get((gid, student.id), 0)
        absences = max(0, passed_l - present_c)

        if student.status == 'teacher_negotiated':
            if student.custom_fee is not None:
                base_fee = Decimal(str(student.custom_fee))
            else:
                from finance.utils import get_teacher_negotiated_center_fee
                base_fee = get_teacher_negotiated_center_fee(group)
        elif student.status in ['low_income', 'negotiated'] and student.custom_fee is not None:
            base_fee = Decimal(str(student.custom_fee))
        elif student.status == 'discount':
            if total_l > 0:
                daily_fee = Decimal(str(group.monthly_price or 0)) / Decimal(str(total_l))
                base_fee = (daily_fee * Decimal(str(present_c))).quantize(Decimal('100'))
            else:
                base_fee = Decimal('0')
        else:
            base_fee = Decimal(str(group.monthly_price or 0))

        pmt = payment_map.get((student.id, gid))
        if pmt:
            pmt_id = pmt.id
            expected_amt = Decimal(str(pmt.amount if pmt.amount is not None else base_fee))
            paid_amt = Decimal(str(pmt.paid_amount or 0))
            remaining_amt = pmt.remaining_amount
            is_paid = pmt.is_paid
            is_partial = pmt.is_partial
            pmt_method = pmt.payment_method
            paid_at = pmt.paid_at.isoformat() if pmt.paid_at else None
        else:
            pmt_id = None
            expected_amt = base_fee
            paid_amt = Decimal('0')
            remaining_amt = base_fee
            is_paid = (base_fee <= Decimal('0'))
            is_partial = False
            pmt_method = None
            paid_at = None

        other_grps = [og for og in student_other_groups_map.get(student.id, []) if og['group_id'] != gid]

        is_discount = (student.status == 'discount')
        if is_discount:
            # Imtiyozli (davlat granti) o'quvchidan kassada to'lov qabul qilinmaydi va kassa qarzdorligiga kiritilmaydi
            remaining_amt = Decimal('0')
            is_paid = True
            is_partial = False

        student_data = {
            "student_id": student.id,
            "student_name": student.full_name,
            "student_phone": student.phone or "",
            "parent_phone": student.parent_phone or "",
            "status": student.status,
            "status_display": student.get_status_display(),
            "is_discount": is_discount,
            "custom_fee": float(student.custom_fee) if student.custom_fee is not None else None,
            "group_id": gid,
            "group_name": group.name,
            "mentor_name": group.mentor.get_full_name() if group.mentor else "Biriktirilmagan",
            "payment_id": pmt_id,
            "expected_amount": float(expected_amt),
            "paid_amount": float(paid_amt),
            "remaining_amount": float(remaining_amt),
            "is_paid": is_paid,
            "is_partial": is_partial,
            "payment_method": pmt_method,
            "paid_at": paid_at,
            "present_count": present_c,
            "absences_count": absences,
            "passed_lessons": passed_l,
            "total_lessons": total_l,
            "other_groups_count": len(other_grps),
            "other_groups": other_grps
        }

        if search_query:
            s_name = (student.full_name or '').lower()
            s_phone = (student.phone or '').lower()
            g_name = (group.name or '').lower()
            if search_query not in s_name and search_query not in s_phone and search_query not in g_name:
                continue

        g_item = group_rosters[gid]
        g_item["students_count"] += 1
        g_item["total_debt"] += float(remaining_amt)
        g_item["total_collected"] += float(paid_amt)
        all_branch_debt += remaining_amt
        all_branch_collected += paid_amt

        if is_paid:
            g_item["paid_count"] += 1
        elif is_partial:
            g_item["partial_count"] += 1
            g_item["unpaid_count"] += 1
        else:
            g_item["unpaid_count"] += 1

        g_item["students"].append(student_data)

        if remaining_amt > 0 and not is_discount:
            debtors_list.append(student_data)

    debtors_list.sort(key=lambda d: d["remaining_amount"], reverse=True)

    # 9. O'qituvchilar (Teachers) ierarxiyasi
    teachers_dict = {}
    all_groups_list = []

    for gid, grp in group_rosters.items():
        all_groups_list.append({
            "id": grp["id"],
            "name": grp["name"],
            "monthly_price": grp["monthly_price"],
            "mentor_id": grp["mentor_id"],
            "mentor_name": grp["mentor_name"],
            "days": grp["days"],
            "time": grp["time"],
            "students_count": grp["students_count"],
            "paid_count": grp["paid_count"],
            "unpaid_count": grp["unpaid_count"],
            "total_debt": grp["total_debt"],
            "total_collected": grp["total_collected"],
        })

        m_id = grp["mentor_id"] or 0
        if m_id not in teachers_dict:
            teachers_dict[m_id] = {
                "id": m_id,
                "name": grp["mentor_name"],
                "groups_count": 0,
                "active_students_count": 0,
                "debtors_count": 0,
                "total_debt": 0.0,
                "groups": []
            }
        t_entry = teachers_dict[m_id]
        t_entry["groups_count"] += 1
        t_entry["active_students_count"] += grp["students_count"]
        t_entry["debtors_count"] += grp["unpaid_count"]
        t_entry["total_debt"] += grp["total_debt"]
        t_entry["groups"].append(grp)

    teachers_list = sorted(list(teachers_dict.values()), key=lambda t: t["name"])

    return {
        "branch": branch_desk_stats,
        "teachers": teachers_list,
        "all_groups": sorted(all_groups_list, key=lambda g: g["name"]),
        "debtors": debtors_list,
        "rosters": group_rosters,
        "summary": {
            "total_groups": len(group_ids),
            "total_students": len(student_ids),
            "total_debtors": len(debtors_list),
            "total_debt_amount": float(all_branch_debt),
            "total_collected_month": float(all_branch_collected),
        }
    }


def build_student_calculation_detail_dict(payment, student_id, group_id=None):
    """
    Xodimning oylik maoshidagi aniq bitta o'quvchi bo'yicha to'liq arifmetik hisob-kitob tafsilotlari.
    O'quvchining to'lagan puli, darslar davomati, stavkasi, qo'llanilgan formula va o'qituvchining
    yakuniy ulushi bosqichma-bosqich, shaffof matematik amallar bilan qaytariladi.
    """
    from finance.models import MentorGroupSalaryConfig
    from archivebase.models import ArchivedStudent

    month_date = normalize_month(payment.month)
    month_name_uz = {
        1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel", 5: "May", 6: "Iyun",
        7: "Iyul", 8: "Avgust", 9: "Sentabr", 10: "Oktabr", 11: "Noyabr", 12: "Dekabr"
    }
    month_display = f"{month_name_uz.get(month_date.month, '')} {month_date.year}"

    # 1. O'chirilgan/Arxivlangan o'quvchi tekshiruvi
    is_archived_str = isinstance(student_id, str) and student_id.startswith("archived_")
    if is_archived_str:
        parts = student_id.split("_")
        arch_id = parts[1] if len(parts) > 1 else None
        arch = ArchivedStudent.objects.filter(id=arch_id).first() if arch_id else None
        
        target_payment_data = None
        target_group_id = int(group_id) if group_id else None
        if arch and arch.metadata and 'payments' in arch.metadata:
            month_prefix = month_date.strftime("%Y-%m")
            for p_dict in arch.metadata['payments']:
                if (not target_group_id or p_dict.get('group') == target_group_id) and str(p_dict.get('month', '')).startswith(month_prefix):
                    target_payment_data = p_dict
                    target_group_id = p_dict.get('group')
                    break
        
        grp = Group.objects.filter(id=target_group_id).first() if target_group_id else None
        group_name = grp.name if grp else (target_payment_data.get('group_name') if target_payment_data else "Guruh")
        group_price = float(grp.monthly_price) if grp else float(target_payment_data.get('amount') or 0.0 if target_payment_data else 0.0)
        
        paid_amt = float(target_payment_data.get('paid_amount') or 0.0) if target_payment_data else 0.0
        contract_amt = float(target_payment_data.get('amount') or group_price) if target_payment_data else group_price
        student_name = target_payment_data.get('student_full_name') or (arch.full_name if arch else "Arxivlangan O'quvchi")
        
        # O'qituvchi stavkasi
        employee = payment.employee
        cfg = MentorGroupSalaryConfig.objects.filter(mentor=employee, group=grp).first() if grp else None
        profile = getattr(employee, 'staff_profile', None)
        
        if cfg:
            sal_type = cfg.salary_type
            comm_pct = float(cfg.commission_percentage)
            per_st = float(cfg.per_student_amount)
            src = f"Guruh bo'yicha maxsus stavka ({group_name})"
        elif profile:
            sal_type = profile.salary_type
            comm_pct = float(profile.commission_percentage or 0)
            per_st = float(profile.per_student_amount or 0)
            src = "O'qituvchi profilidagi umumiy stavka"
        else:
            sal_type = 'fixed'
            comm_pct = 0.0
            per_st = 0.0
            src = "Standart stavka"

        if sal_type == 'percentage':
            final_share = round(paid_amt * (comm_pct / 100.0))
            f_template = "O'quvchi to'lagan summa × Foiz stavkasi"
            f_math = f"{paid_amt:,.0f} UZS × {comm_pct}% = {final_share:,.0f} UZS"
        else:
            if paid_amt >= contract_amt and contract_amt > 0:
                final_share = per_st
                f_math = f"{paid_amt:,.0f} >= {contract_amt:,.0f} → {final_share:,.0f} UZS"
            elif paid_amt > 0 and contract_amt > 0:
                final_share = round(min(paid_amt, (per_st * paid_amt) / contract_amt))
                f_math = f"({paid_amt:,.0f} ÷ {contract_amt:,.0f}) × {per_st:,.0f} = {final_share:,.0f} UZS"
            else:
                final_share = 0.0
                f_math = "0 UZS"
            f_template = "(To'langan summa ÷ Shartnoma narxi) × Stavka"

        return {
            'student': {
                'id': student_id,
                'name': f"{student_name} (Guruhdan o'chirilgan/Arxiv)",
                'phone': getattr(arch, 'phone', '') or "",
                'status': 'archived',
                'status_label': "Guruhdan o'chirilgan",
                'is_archived': True,
                'color': "#9ca3af",
            },
            'group': {
                'id': target_group_id,
                'name': group_name,
                'monthly_price': group_price,
            },
            'month': str(month_date),
            'month_display': month_display,
            'salary_config': {
                'type': sal_type,
                'type_label': "Foizli (%)" if sal_type == 'percentage' else "Stavka (so'm/o'quvchi)",
                'rate': comm_pct if sal_type == 'percentage' else per_st,
                'source': src,
                'is_group_specific': bool(cfg),
            },
            'contract_and_payment': {
                'standard_group_price': group_price,
                'custom_fee': None,
                'contract_amount': contract_amt,
                'paid_amount': paid_amt,
                'paid_at': str(target_payment_data.get('paid_at', '')).replace('T', ' ')[:16] if target_payment_data and target_payment_data.get('paid_at') else None,
                'payment_method': target_payment_data.get('payment_method') if target_payment_data else "Kassa",
                'is_partial': target_payment_data.get('is_partial', False) if target_payment_data else False,
                'remaining_debt': max(0.0, contract_amt - paid_amt),
                'refund_amount': float(target_payment_data.get('refund_amount') or 0.0) if target_payment_data else 0.0,
                'refund_ignored': target_payment_data.get('refund_ignored', False) if target_payment_data else False,
                'marked_by_name': "Tizim / Kassa",
                'notes': "O'quvchi to'lovni amalga oshirgach arxivlangan. O'qituvchiga to'langan mablag'dan tegishli ulush saqlab qolingan.",
            },
            'attendance': {
                'is_attendance_based': False,
                'total_lessons': 0,
                'present_count': 0,
                'absent_count': 0,
                'attendance_percentage': 0.0,
                'lessons': [],
            },
            'arithmetic_calculation': {
                'summary_title': "Arxivlangan o'quvchi to'lovidan o'qituvchi ulushi",
                'formula_template': f_template,
                'formula_math': f_math,
                'final_share': final_share,
                'steps': [
                    {
                        'step_number': 1,
                        'title': "O'quvchi to'lovi (Arxivdan tiklangan)",
                        'badge': "Arxiv to'lovi",
                        'explanation': "O'quvchi guruhdan chiqarilishidan oldin amalga oshirgan to'lovi.",
                        'math_formula': f"To'langan summa: {paid_amt:,.0f} UZS (Shartnoma: {contract_amt:,.0f} UZS)",
                        'result': f"{paid_amt:,.0f} UZS",
                        'highlight': False,
                    },
                    {
                        'step_number': 2,
                        'title': "O'qituvchi ulushi hisob-kitobi",
                        'badge': "Yakuniy hisob",
                        'explanation': f"{src}. O'quvchi arxivga olingan bo'lsa-da, uning to'lagan pulidan o'qituvchi ulushi to'liq hisoblangan.",
                        'math_formula': f_math,
                        'result': f"{final_share:,.0f} UZS",
                        'highlight': True,
                    }
                ]
            },
            'transactions': []
        }

    # 2. Faol o'quvchini qidirish
    st_id = int(student_id)
    student = Student.objects.filter(id=st_id).select_related('group', 'branch').first()
    if not student:
        raise ValueError(f"O'quvchi ID={student_id} topilmadi.")

    # Guruhni aniqlash
    grp = None
    if group_id:
        grp = Group.objects.filter(id=group_id).select_related('mentor', 'branch').first()
    if not grp and student.group:
        grp = student.group

    # Xodim va konfiguratsiya
    employee = payment.employee
    group_config = MentorGroupSalaryConfig.objects.filter(mentor=employee, group=grp).first() if grp else None
    profile = getattr(employee, 'staff_profile', None)

    if group_config:
        salary_type = group_config.salary_type
        commission_pct = float(group_config.commission_percentage)
        per_student_amount = float(group_config.per_student_amount)
        config_source = f"Guruh bo'yicha maxsus sozlangan stavka ({grp.name})"
        is_custom_group = True
    elif profile:
        salary_type = profile.salary_type
        commission_pct = float(profile.commission_percentage or 0)
        per_student_amount = float(profile.per_student_amount or 0)
        config_source = "O'qituvchi profilidagi umumiy stavka"
        is_custom_group = False
    else:
        salary_type = 'fixed'
        commission_pct = 0.0
        per_student_amount = 0.0
        config_source = "Standart stavka"
        is_custom_group = False

    # To'lov yozuvi
    p = Payment.objects.filter(
        student=student, group=grp,
        month__year=month_date.year, month__month=month_date.month
    ).select_related('marked_by').first() if grp else None

    paid_amount = float(p.paid_amount or 0) if p else 0.0
    refund_amount = float(p.refund_amount or 0) if p else 0.0
    refund_ignored = p.refund_ignored if p else False
    paid_at = p.paid_at.strftime("%Y-%m-%d %H:%M") if p and p.paid_at else None
    payment_method = p.get_payment_method_display() if p else "Naqd"
    is_partial = p.is_partial if p else False
    marked_by_name = (p.marked_by.get_full_name() or p.marked_by.username) if p and p.marked_by else None
    notes = p.notes if p else None

    # Shartnoma summasi
    monthly_price = float(grp.monthly_price) if grp else 0.0
    custom_fee = float(student.custom_fee) if student.custom_fee is not None else None
    status = student.status
    status_label = student.get_status_display()
    is_discount = status == "discount"
    is_negotiated = status == "negotiated"
    is_teacher_negotiated = status == "teacher_negotiated"

    contract_base = monthly_price
    if custom_fee is not None and status in ["low_income", "negotiated", "discount", "teacher_negotiated"]:
        contract_base = custom_fee
    elif is_teacher_negotiated:
        std_teacher_share = (monthly_price * commission_pct / 100.0) if salary_type == 'percentage' else per_student_amount
        contract_base = max(0.0, monthly_price - std_teacher_share)

    # Darslar va davomat
    lesson_dates = grp.get_lesson_dates(month_date.year, month_date.month) if grp else []
    total_lessons = len(lesson_dates)
    attendances = Attendance.objects.filter(
        student=student, group=grp,
        date__year=month_date.year, date__month=month_date.month,
        marked_by__isnull=False
    ).select_related('marked_by').order_by('date') if grp else []

    att_by_date = {att.date: att for att in attendances}
    present_count = 0
    calendar_lessons = []
    weekdays_uz = {0: "Dushanba", 1: "Seshanba", 2: "Chorshanba", 3: "Payshanba", 4: "Juma", 5: "Shanba", 6: "Yakshanba"}

    for d in sorted(lesson_dates):
        att_entry = att_by_date.get(d)
        is_pres = att_entry.is_present if att_entry else False
        if is_pres:
            present_count += 1
        calendar_lessons.append({
            'date': d.strftime("%Y-%m-%d"),
            'day': d.day,
            'day_name': weekdays_uz.get(d.weekday(), ""),
            'is_present': is_pres,
            'is_manually_adjusted': att_entry.is_manually_adjusted if att_entry else False,
            'marked_by': (att_entry.marked_by.get_full_name() or att_entry.marked_by.username) if att_entry and att_entry.marked_by else None,
            'marked_at': att_entry.created_at.strftime("%Y-%m-%d %H:%M") if att_entry and hasattr(att_entry, 'created_at') and att_entry.created_at else None,
        })

    attendance_percent = round((present_count / total_lessons * 100.0), 1) if total_lessons > 0 else 0.0

    # Audit loglari
    from finance.models import AttendanceAuditLog
    audit_logs_qs = AttendanceAuditLog.objects.filter(
        student=student, group=grp, month=month_date
    ).select_related('modified_by').order_by('-created_at') if grp else []
    audit_logs_list = [
        {
            'id': al.id,
            'modified_by': al.modified_by.get_full_name() or al.modified_by.username if al.modified_by else "Admin",
            'created_at': al.created_at.strftime("%Y-%m-%d %H:%M") if al.created_at else None,
            'previous_attended_count': al.previous_attended_count,
            'new_attended_count': al.new_attended_count,
            'total_planned_lessons': al.total_planned_lessons,
            'previous_teacher_share': float(al.previous_teacher_share or 0),
            'new_teacher_share': float(al.new_teacher_share or 0),
            'previous_state_receivable': float(al.previous_state_receivable or 0),
            'new_state_receivable': float(al.new_state_receivable or 0),
            'reason_for_change': al.reason_for_change or "Sabab ko'rsatilmagan",
        }
        for al in audit_logs_qs
    ]

    # Tranzaksiyalar
    tx_qs = FinanceTransaction.objects.filter(
        student=student, group=grp,
        date__year=month_date.year, date__month=month_date.month
    ).order_by('-date') if grp else []
    transactions_list = [
        {
            'id': tx.id,
            'date': tx.date.strftime("%Y-%m-%d"),
            'amount': float(tx.amount),
            'transaction_type': tx.transaction_type,
            'category': tx.get_category_display(),
            'status': tx.status,
        }
        for tx in tx_qs
    ]

    # Arifmetik hisob-kitob qadamlari
    steps = []
    if is_teacher_negotiated:
        final_share = 0.0
        formula_template = "O'qituvchi kelishgan maqomi → Markaz o'qituvchiga maosh hisoblamaydi = 0 UZS"
        formula_math = "Ulush = 0 UZS"
        steps = [
            {
                'step_number': 1,
                'title': "O'quvchi maxsus maqomi",
                'badge': "O'qituvchi kelishgan",
                'explanation': "O'quvchi 'O'qituvchi kelishgan' maqomida o'qiydi. O'qituvchi o'quvchi bilan bevosita individual kelishgan.",
                'math_formula': "O'qituvchi ↔ O'quvchi bevosita kelishuv",
                'result': "0 UZS oylik",
                'highlight': False,
            },
            {
                'step_number': 2,
                'title': "Markaz operatsion fondi",
                'badge': "Markaz ulushi",
                'explanation': f"Markaz ushbu o'quvchidan faqat o'zining minimal operatsion to'lovini ({contract_base:,.0f} UZS) qabul qiladi.",
                'math_formula': f"Guruh narxi ({monthly_price:,.0f}) − O'qituvchi normasi = {contract_base:,.0f} UZS",
                'result': f"{contract_base:,.0f} UZS (Markazga)",
                'highlight': False,
            },
            {
                'step_number': 3,
                'title': "Yakuniy o'qituvchi ulushi",
                'badge': "0 UZS",
                'explanation': "O'qituvchi to'lovni o'quvchi bilan o'zaro hal qilgani sababli markaz vedomostida ushbu o'quvchi uchun 0 UZS hisoblanadi.",
                'math_formula': "O'qituvchi ulushi = 0 UZS",
                'result': "0 UZS",
                'highlight': True,
            }
        ]

    elif is_discount:
        lesson_price = (contract_base / total_lessons) if total_lessons > 0 else 0.0
        att_sum = lesson_price * present_count

        if salary_type == 'percentage':
            calc_share = att_sum * (commission_pct / 100.0)
            formula_template = "(Guruh narxi ÷ Oydagi darslar) × Qatnashgan darslar × O'qituvchi foizi"
            formula_math = f"({contract_base:,.0f} ÷ {total_lessons}) × {present_count} dars × {commission_pct}% = {calc_share:,.0f} UZS"
            rate_display = f"{commission_pct}%"
        else:
            per_lesson_rate = (per_student_amount / total_lessons) if total_lessons > 0 else 0.0
            calc_share = per_lesson_rate * present_count
            formula_template = "(1 o'quvchi stavkasi ÷ Oydagi darslar) × Qatnashgan darslar"
            formula_math = f"({per_student_amount:,.0f} ÷ {total_lessons}) × {present_count} dars = {calc_share:,.0f} UZS"
            rate_display = f"{per_student_amount:,.0f} UZS / o'quvchi"

        final_share = float(round(calc_share))
        steps = [
            {
                'step_number': 1,
                'title': "Guruh oylik qiymati va oydagi reja darslar",
                'badge': "Guruh rejasi",
                'explanation': f"Ushbu guruhning oylik shartnoma narxi {contract_base:,.0f} UZS. Oydagi tasdiqlangan darslar soni: {total_lessons} ta.",
                'math_formula': f"Guruh narxi: {contract_base:,.0f} UZS | Darslar soni: {total_lessons} ta",
                'result': f"{total_lessons} ta dars",
                'highlight': False,
            },
            {
                'step_number': 2,
                'title': "1 ta darsning bazaviy qiymati",
                'badge': "Dars qiymati",
                'explanation': "Oylik to'lov oydagi darslar soniga bo'linib, 1 ta dars qiymati hisoblab chiqariladi.",
                'math_formula': f"{contract_base:,.0f} UZS ÷ {total_lessons} = {lesson_price:,.2f} UZS / dars",
                'result': f"{lesson_price:,.2f} UZS",
                'highlight': False,
            },
            {
                'step_number': 3,
                'title': "O'quvchining haqiqiy qatnashgan darslari (Davomat)",
                'badge': f"Davomat: {attendance_percent}%",
                'explanation': f"O'quvchi jurnal bo'yicha jami {total_lessons} ta darsdan {present_count} tasida 'Bor' bo'lgan.",
                'math_formula': f"Qatnashgan darslar = {present_count} ta ({attendance_percent}%)",
                'result': f"{present_count} / {total_lessons} ta",
                'highlight': False,
            },
            {
                'step_number': 4,
                'title': "Davlat puli holati (Kirimga va Markaz marjasiga qo'shilmaydi)",
                'badge': "Davlat puli",
                'explanation': "Davlat tomonidan ushbu imtiyozli o'quvchi uchun aynan qancha summa tushishi oldindan aniq bo'lmagani sababli, bu summa umumiy kassa kirimiga va markaz marjasiga qo'shilmaydi (faqat ma'lumot uchun taxminiy hisoblanadi).",
                'math_formula': f"Taxminiy davlat puli = {att_sum:,.0f} UZS (Kassaga olinmaydi)",
                'result': "- (Noma'lum)",
                'highlight': False,
            },
            {
                'step_number': 5,
                'title': f"O'qituvchi stavkasi bo'yicha ulush hisobi ({rate_display})",
                'badge': "Mentor maoshi",
                'explanation': f"{config_source}. Mentor stavkasi darslar soniga bo'linib, o'quvchi Face ID dan o'tgan (qatnashgan) darslariga ko'paytirildi.",
                'math_formula': formula_math,
                'result': f"{final_share:,.0f} UZS",
                'highlight': True,
            }
        ]

    else:
        # regular / low_income / negotiated
        if salary_type == 'percentage':
            calc_share = paid_amount * (commission_pct / 100.0)
            final_share = float(round(calc_share))
            formula_template = "O'quvchi to'lagan summa × (Komissiya foizi ÷ 100)"
            formula_math = f"{paid_amount:,.0f} UZS × {commission_pct}% = {final_share:,.0f} UZS"
            is_fully_paid = (paid_amount >= contract_base and contract_base > 0)

            steps = [
                {
                    'step_number': 1,
                    'title': "O'quvchi to'lagan haqiqiy mablag'",
                    'badge': "To'liq to'langan" if is_fully_paid else "Qisman to'langan",
                    'explanation': f"Guruh shartnoma narxi: {contract_base:,.0f} UZS. O'quvchi haqiqatda to'lagan summa: {paid_amount:,.0f} UZS.",
                    'math_formula': f"Haqiqiy to'lov: {paid_amount:,.0f} UZS" + (f" (Qolgan qarz: {max(0.0, contract_base - paid_amount):,.0f} UZS)" if not is_fully_paid else ""),
                    'result': f"{paid_amount:,.0f} UZS",
                    'highlight': False,
                },
                {
                    'step_number': 2,
                    'title': f"O'qituvchining tasdiqlangan foiz stavkasi ({commission_pct}%)",
                    'badge': f"{commission_pct}%",
                    'explanation': f"{config_source}.",
                    'math_formula': f"Komissiya stavkasi = {commission_pct}% (koeffitsiyent: {commission_pct / 100.0})",
                    'result': f"{commission_pct}%",
                    'highlight': False,
                },
                {
                    'step_number': 3,
                    'title': "O'qituvchi ulushini hisoblash arifmetik amali",
                    'badge': "Hisoblash",
                    'explanation': "O'qituvchi ulushi to'g'ridan-to'g'ri o'quvchi to'lagan summadan belgilangan foizni ajratib olish orqali topiladi.",
                    'math_formula': f"{paid_amount:,.0f} UZS × ({commission_pct} ÷ 100) = {final_share:,.0f} UZS",
                    'result': f"{final_share:,.0f} UZS",
                    'highlight': True,
                }
            ]
        else:
            # student_count
            is_fully_paid = (paid_amount >= contract_base and contract_base > 0)
            if is_fully_paid:
                calc_share = per_student_amount
                prop_percent = 100.0
                formula_template = "To'liq to'lov (To'lov >= Guruh narxi) → 1 o'quvchi to'liq stavkasi"
                formula_math = f"To'lov: {paid_amount:,.0f} >= Narx: {contract_base:,.0f} → Ulush = {per_student_amount:,.0f} UZS"
                step_detail = f"O'quvchi kurs to'lovini 100% bajarganligi sababli, o'qituvchiga ushbu o'quvchi uchun to'liq 1 o'quvchi stavkasi ({per_student_amount:,.0f} UZS) ajratiladi."
            else:
                prop = (paid_amount / contract_base) if contract_base > 0 else 0.0
                calc_share = min(paid_amount, per_student_amount * prop)
                prop_percent = round(prop * 100.0, 1)
                formula_template = "(O'quvchi to'lagan summa ÷ Guruh narxi) × 1 o'quvchi stavkasi"
                formula_math = f"({paid_amount:,.0f} ÷ {contract_base:,.0f}) × {per_student_amount:,.0f} UZS = {calc_share:,.0f} UZS"
                step_detail = f"O'quvchi to'lovni qisman bajargan ({prop_percent}%). Tizim o'qituvchiga to'langan ulushga mutanosib ravishda (proporsional) haq hisoblaydi."

            final_share = float(round(calc_share))
            steps = [
                {
                    'step_number': 1,
                    'title': "Shartnoma narxi va o'quvchi to'lovi",
                    'badge': "To'liq to'lov" if is_fully_paid else f"Qisman ({prop_percent}%)",
                    'explanation': f"Shartnoma narxi: {contract_base:,.0f} UZS. O'quvchi to'lagan summa: {paid_amount:,.0f} UZS.",
                    'math_formula': f"To'lov: {paid_amount:,.0f} UZS / Shartnoma: {contract_base:,.0f} UZS",
                    'result': f"{paid_amount:,.0f} UZS",
                    'highlight': False,
                },
                {
                    'step_number': 2,
                    'title': f"1 ta o'quvchi uchun belgilangan stavka ({per_student_amount:,.0f} UZS)",
                    'badge': f"{per_student_amount:,.0f} UZS",
                    'explanation': f"{config_source}.",
                    'math_formula': f"Standart stavka = {per_student_amount:,.0f} UZS / o'quvchi",
                    'result': f"{per_student_amount:,.0f} UZS",
                    'highlight': False,
                },
                {
                    'step_number': 3,
                    'title': "O'qituvchi ulushini hisoblash arifmetik amali",
                    'badge': "Natija",
                    'explanation': step_detail,
                    'math_formula': formula_math,
                    'result': f"{final_share:,.0f} UZS",
                    'highlight': True,
                }
            ]

    return {
        'student': {
            'id': student.id,
            'name': student.full_name,
            'phone': student.phone or "",
            'status': student.status,
            'status_label': student.get_status_display(),
            'is_archived': False,
            'color': student.color or "#ffffff",
        },
        'group': {
            'id': grp.id if grp else None,
            'name': grp.name if grp else "Guruh",
            'monthly_price': monthly_price,
        },
        'month': str(month_date),
        'month_display': month_display,
        'salary_config': {
            'type': salary_type,
            'type_label': "Foizli (%)" if salary_type == 'percentage' else "Stavka (so'm/o'quvchi)",
            'rate': commission_pct if salary_type == 'percentage' else per_student_amount,
            'source': config_source,
            'is_group_specific': is_custom_group,
        },
        'contract_and_payment': {
            'standard_group_price': monthly_price,
            'custom_fee': custom_fee,
            'contract_amount': contract_base,
            'paid_amount': 0.0 if is_discount else paid_amount,
            'paid_at': paid_at,
            'payment_method': "Davlat puli" if is_discount else payment_method,
            'is_partial': False if is_discount else is_partial,
            'remaining_debt': 0.0 if is_discount else max(0.0, contract_base - paid_amount),
            'refund_amount': refund_amount,
            'refund_ignored': refund_ignored,
            'marked_by_name': marked_by_name or "Kassa",
            'notes': notes,
        },
        'attendance': {
            'is_attendance_based': is_discount,
            'total_lessons': total_lessons,
            'present_count': present_count,
            'absent_count': max(0, total_lessons - present_count),
            'attendance_percentage': attendance_percent,
            'lessons': calendar_lessons,
        },
        'financial_metrics': {
            'course_fee': float(contract_base),
            'n_total': total_lessons,
            'n_attended': present_count,
            'absent_count': max(0, total_lessons - present_count),
            'attendance_rate': attendance_percent,
            'has_manual_adjustment': any(att.is_manually_adjusted for att in attendances),
            'state_receivable_amount': None if is_discount else float(paid_amount),
            'earned_teacher_share': float(final_share),
            'center_gross_margin': None if is_discount else float(max(0.0, paid_amount - final_share)),
            'estimated_state_receivable': float(att_sum) if is_discount else None,
            'estimated_center_margin': float(max(0.0, att_sum - final_share)) if is_discount else None,
        },
        'audit_logs': audit_logs_list,
        'arithmetic_calculation': {
            'summary_title': f"{student.full_name} to'lovidan o'qituvchi ulushi tahlili",
            'formula_template': formula_template,
            'formula_math': formula_math,
            'final_share': final_share,
            'steps': steps,
        },
        'transactions': transactions_list,
    }

