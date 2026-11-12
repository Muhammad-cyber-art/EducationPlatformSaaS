"""Read-only explanations that reconcile to the actual cashier invoice.

Current schedules can corroborate an old amount, but are not a historical
billing snapshot. Never invent the cause of an unexplained invoice difference.
"""
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from finance.utils import floor_amount, get_teacher_negotiated_center_fee
from groups.utils import get_lessons_in_month
from homework_attends.models import Attendance


def _decimal(value):
    return Decimal(str(value if value is not None else 0))


def _money(value):
    return f'{value:,.2f}'.replace(',', ' ').rstrip('0').rstrip('.')


def _local_date(value):
    return timezone.localdate(value) if timezone.is_aware(value) else value.date()


def build_cashier_calculation(student, group, month, payment, enrollment,
                              expected_amount, remaining_amount, today=None):
    today = today or timezone.localdate()
    standard = _decimal(group.monthly_price)
    expected = _decimal(expected_amount)
    paid = _decimal(payment.paid_amount) if payment else Decimal('0')
    remaining = _decimal(remaining_amount)
    refund = _decimal(payment.refund_amount) if payment and not payment.refund_ignored else Decimal('0')
    steps, warnings = [], []
    current = standard

    def step(code, title, detail, after, formula=None):
        nonlocal current
        after = _decimal(after)
        difference = after - current
        steps.append({
            'code': code, 'title': title, 'detail': detail,
            'before': str(current), 'after': str(after), 'difference': str(difference),
            'formula': formula or f'{_money(current)} {"+" if difference >= 0 else "−"} {_money(abs(difference))} = {_money(after)} UZS',
        })
        current = after

    step('standard', 'Kursning odatiy oylik narxi',
         f'{group.name} guruhining joriy oylik tarifi.', standard,
         f'Oylik tarif = {_money(standard)} UZS')
    base = standard
    if student.status in ('low_income', 'negotiated', 'discount', 'teacher_negotiated'):
        if student.custom_fee is not None:
            base = _decimal(student.custom_fee)
            step('individual', 'Individual narx',
                 f"O‘quvchi holati: {student.get_status_display()}. Joriy individual narx qo‘llanilgan hisob bilan solishtiriladi.", base)
        elif student.status == 'teacher_negotiated':
            base = _decimal(get_teacher_negotiated_center_fee(group))
            step('teacher_agreement', 'O‘qituvchi bilan kelishuv',
                 'Joriy guruh sozlamasidagi markazga tegishli to‘lov summasi.', base)

    dates = group.get_lesson_dates(month.year, month.month)
    joined = (enrollment.joined_at if enrollment else student.joined_at)
    joined_date = _local_date(joined) if joined else None
    left_date = _local_date(enrollment.left_at) if enrollment and enrollment.left_at else None
    frozen_date = _local_date(enrollment.frozen_at) if enrollment and enrollment.is_frozen and enrollment.frozen_at else None
    records = list(Attendance.objects.filter(student=student, group=group,
                   date__year=month.year, date__month=month.month).filter(
                       Q(marked_by__isnull=False) | Q(is_manually_adjusted=True)).order_by('date'))
    present_dates = {row.date for row in records if row.is_present}
    confirmed_dates = {row.date for row in records}
    # Attendance-based billing allows confirmed historical records before a
    # subsequently changed enrollment timestamp, just like finance.utils.
    effective_join = min(present_dates | {joined_date}) if joined_date else (min(present_dates) if present_dates else None)
    eligible_dates = [day for day in dates if not effective_join or day >= effective_join]
    attendance_dates = (set(day for day in eligible_dates if day <= today) | confirmed_dates) & present_dates
    if effective_join:
        attendance_dates = {day for day in attendance_dates if day >= effective_join}
    target_before_refund = expected + refund
    matched_schedule = False

    if student.status == 'discount' and dates:
        raw = min(base, base / len(dates) * len(attendance_dates))
        if floor_amount(raw) == target_before_refund:
            step('attendance', 'Tasdiqlangan davomat bo‘yicha hisob',
                 'Faqat tasdiqlangan kelgan darslar hisobga olinadi. Yakuniy ko‘paytmadan keyin 1 so‘mgacha yaxlitlanadi.',
                 floor_amount(raw),
                 f'yaxlitlash({_money(base)} ÷ {len(dates)} × {len(attendance_dates)}) = {_money(floor_amount(raw))} UZS')
            matched_schedule = True
    elif dates and current != target_before_refund:
        candidates = []
        if joined_date and joined_date > month:
            included = [day for day in dates if day >= joined_date]
            candidates.append(('joined_midmonth', 'Oy o‘rtasida guruhga qo‘shilish',
                               dates, included, f'Guruhga qo‘shilgan sana: {joined_date}.'))
        if group.start_date and group.start_date > month:
            full = get_lessons_in_month(group._get_effective_days(), month.year, month.month)
            candidates.append(('group_start', 'Guruh oy o‘rtasida boshlangan', full, dates,
                               f'Guruh boshlangan sana: {group.start_date}.'))
        for code, title, denominator, included, detail in candidates:
            if denominator and floor_amount(base / len(denominator) * len(included)) == target_before_refund:
                step(code, title, detail + ' Joriy jadval bo‘yicha ushbu hisob saqlangan summa bilan mos keladi.',
                     target_before_refund,
                     f'yaxlitlash({_money(base)} ÷ {len(denominator)} × {len(included)}) = {_money(target_before_refund)} UZS')
                matched_schedule = True
                break

    if current != target_before_refund:
        step('recorded_difference', 'Hisob yozuvidagi farq',
             'Saqlangan hisob joriy tarif va jadvaldan farq qiladi. Sababi tarixiy narx, transfer yoki qo‘lda tahrir bo‘lishi mumkin; aniq sabab yozuvi mavjud emas.',
             target_before_refund)
        warnings.append('Bu farqning tarixiy sababi saqlanmagan. U avtomatik ravishda chegirma yoki davomat chegirmasi deb talqin qilinmaydi.')
    if refund:
        step('refund', 'Hisobda saqlangan davomat chegirmasi',
             'Bu summa hisobda qayd etilgan refund_amount bo‘yicha ko‘rsatiladi; qayta hisoblab o‘zgartirilmaydi.', expected,
             f'{_money(current)} − {_money(refund)} = {_money(expected)} UZS')
    step('invoice', 'Shu oy uchun hisoblangan summa',
         'Saqlangan to‘lov hisobi.' if payment else 'Hali to‘lov hisobi yaratilmagan; kassadagi joriy tarif bo‘yicha ko‘rsatilgan summa.',
         expected, f'Oylik hisob = {_money(expected)} UZS')
    after_payment = max(Decimal('0'), expected - paid)
    step('paid', 'Avval to‘langan summa', 'Bu hisobdagi jami qabul qilingan to‘lovlar oylik hisobdan ayiriladi.',
         after_payment, f'max(0, {_money(expected)} − {_money(paid)}) = {_money(after_payment)} UZS')
    if student.status == 'discount':
        step('grant', 'Davlat granti orqali qoplanadi',
             'Imtiyozli o‘quvchidan kassada pul olinmaydi. Hisoblangan summa davlat qoplamasi uchun, o‘quvchining qarzi esa 0.', remaining)
    elif current != remaining:
        step('settlement', 'Hisob yopilgan holat',
             'Kassada saqlangan to‘langan/yopilgan holat sababli qoldiq oddiy ayirmadan farq qiladi.', remaining)
        warnings.append('Yopilgan hisob holati hisob va to‘lov ayirmasidan farq qiladi; hisob yozuvini tekshiring.')
    if matched_schedule:
        warnings.append('Darslar arifmetikasi joriy jadval bilan tekshirildi. Tarif yoki jadval keyin o‘zgargan bo‘lsa, tarixiy hujjat bilan solishtiring.')

    calendar_rows = []
    for day in dates:
        state = ('before_join' if joined_date and day < joined_date else
                 'after_leave' if left_date and day > left_date else
                 'frozen' if frozen_date and day >= frozen_date else
                 'present' if day in present_dates else
                 'absent' if day in confirmed_dates else
                 'unmarked' if day <= today else 'scheduled')
        calendar_rows.append({'date': str(day), 'state': state})
    return {
        'month': str(month), 'group_name': group.name, 'source': 'invoice' if payment else 'estimate',
        'standard_amount': str(standard), 'expected_amount': str(expected),
        'paid_amount': str(paid), 'remaining_amount': str(remaining),
        'reduction_amount': str(max(Decimal('0'), standard - expected)),
        'is_reduced': expected < standard or remaining < expected,
        'steps': steps, 'warnings': warnings, 'notes': payment.notes if payment else None,
        'context': {
            'joined_date': str(joined_date) if joined_date else None,
            'left_date': str(left_date) if left_date else None,
            'status_label': student.get_status_display(), 'total_lessons': len(dates),
            'confirmed_present_count': len(present_dates),
            'canceled_dates': [str(day) for day in group.canceled_lesson_days.filter(date__year=month.year, date__month=month.month).values_list('date', flat=True)],
            'special_dates': [str(day) for day in group.special_lesson_days.filter(date__year=month.year, date__month=month.month).values_list('date', flat=True)],
        },
        'lessons': calendar_rows,
    }
