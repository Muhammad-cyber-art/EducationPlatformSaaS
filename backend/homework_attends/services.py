from django.db import transaction, models
from django.utils import timezone
from datetime import date, timedelta
from calendar import monthrange
from .models import Attendance, Homework, HomeworkSubmission, MockTest, MockTestResult
from groups.models import Group, Student


def get_last_3_lesson_dates(group):
    """Guruhning eng so'nggi 3 ta haqiqiy dars kunlarini qaytaradi.
    
    Faqat dars jadvaliga (get_lesson_dates) asoslanadi, bazadagi
    davomat yozuvlariga emas. Oy boshi muammosi uchun max 3 oy orqaga qaraydi.
    """
    today = timezone.localdate()
    all_past_dates = []
    
    year, month = today.year, today.month
    for _ in range(3):  # MAX 3 oy orqaga qaraymiz (yetarli)
        dates = group.get_lesson_dates(year, month)
        past = sorted([d for d in dates if d <= today], reverse=True)
        all_past_dates = past + all_past_dates  # eski sanalar boshiga qo'shiladi
        
        if len(all_past_dates) >= 3:
            break
        
        # Oldingi oyga o'tamiz
        if month == 1:
            year, month = year - 1, 12
        else:
            month -= 1
    
    # Eng yangi 3 tasini qaytaramiz
    return sorted(all_past_dates, reverse=True)[:3]

def get_or_create_attendance_records(group, requested_date, view_only=False):
    """Davomat yozuvlarini olish yoki yaratish (istalgan kun uchun)
    
    Args:
        group: Guruh obyekti
        requested_date: So'ralgan sana
        view_only: Agar True bo'lsa, yangi yozuvlar yaratilmaydi (o'tgan oylar uchun)
    """
    # 1. Shu kunda guruhda faol bo'lgan studentlarni aniqlash
    # (GroupEnrollment orqali aniqroq filter qilamiz)
    from groups.models import GroupEnrollment
    active_enrollments = GroupEnrollment.objects.filter(
        group=group,
        joined_at__date__lte=requested_date,
        is_active=True,
        student__is_archived=False,
        student__is_active=True
    ).select_related('student')
    
    active_student_ids = set(active_enrollments.values_list('student_id', flat=True))
    
    # 2. Mavjud davomat yozuvlarini olish
    queryset = Attendance.objects.filter(group=group, date=requested_date)
    existing_student_ids = set(queryset.values_list('student_id', flat=True))
    
    # 3. Yetishmayotgan yozuvlarni yaratish (faqat view_only=False bo'lganda)
    if not view_only:
        missing_ids = active_student_ids - existing_student_ids
        if missing_ids:
            new_records = [
                Attendance(student_id=sid, group=group, date=requested_date, is_present=True)
                for sid in missing_ids
            ]
            Attendance.objects.bulk_create(new_records)
            queryset = Attendance.objects.filter(group=group, date=requested_date)
    
    # Faqat o'sha kunda guruhda bo'lgan studentlarni qaytaramiz
    return queryset.filter(student_id__in=active_student_ids).select_related('student').order_by('student__full_name')


def generate_weekly_attendance_report(group, today=None):
    """Haftalik davomat hisobotini yaratish"""
    if today is None:
        today = timezone.localdate()
    
    start_of_week = today - timedelta(days=today.weekday()) 
    date_list = [(start_of_week + timedelta(days=i)) for i in range(7)]

    active_student_ids = group.enrollments.filter(is_active=True).values_list('student_id', flat=True)
    students = group.students.filter(
        id__in=active_student_ids, 
        is_archived=False, 
        is_active=True
    ).order_by('full_name')
    
    attendances = Attendance.objects.filter(
        group=group, 
        date__range=[date_list[0], date_list[-1]]
    )

    att_data = {}
    for att in attendances:
        if att.student_id not in att_data:
            att_data[att.student_id] = {}
        att_data[att.student_id][str(att.date)] = att.is_present

    report = []
    for student in students:
        student_history = []
        joined_date = student.joined_at.date() if student.joined_at else None

        for d in date_list:
            date_str = str(d)
            if joined_date and d < joined_date:
                status = None
            elif not group.is_lesson_day(d):
                status = None
            else:
                status = att_data.get(student.id, {}).get(date_str, True)

            student_history.append({
                "date": date_str, 
                "day_name": d.strftime('%A'),
                "is_present": status
            })

        report.append({
            "student_id": student.id,
            "student_name": student.full_name,
            "history": student_history
        })

    return {
        "week_start": str(date_list[0]),
        "week_end": str(date_list[-1]),
        "data": report
    }

def bulk_confirm_attendance(group, requested_date, attendances_payload, user):
    """Davomatlarni bulk tasdiqlash va xabarnomalarni yuborish.
    
    BUG #3 FIX: Guruhda hozir FAOL bo'lgan studentlar ID larini oldindan
    aniqlab olamiz. Payload'da kelgan lekin guruhdan allaqachon chiqarilgan
    student ID lari e'tiborga olinmaydi — bu ularning keyingi hisobotlarda
    yana paydo bo'lib qolishini oldini oladi.
    """
    from groups.models import GroupEnrollment

    # --- BUG #3 FIX: Faqat guruhda faol bo'lgan studentlar ID larini olamiz ---
    active_student_ids = set(
        GroupEnrollment.objects.filter(
            group=group,
            is_active=True
        ).values_list('student_id', flat=True)
    )

    existing_attendances = Attendance.objects.filter(group=group, date=requested_date)
    attendance_map = {att.student_id: att for att in existing_attendances}

    to_create = []
    to_update = []
    updated_ids = []
    processed_student_ids = set()

    with transaction.atomic():
        for item in attendances_payload:
            try:
                raw_student_id = item.get('student_id')
                if raw_student_id is None:
                    continue
                student_id = int(raw_student_id)  # Type safety
            except (ValueError, TypeError):
                continue

            # --- BUG #3 FIX: Guruhdan chiqarilgan student ID lari o'tkazib yuboriladi ---
            if student_id not in active_student_ids:
                continue

            is_present = item.get('is_present', True)

            if student_id in attendance_map:
                attendance = attendance_map[student_id]
                if attendance.is_present != is_present or attendance.marked_by != user:
                    attendance.is_present = is_present
                    attendance.marked_by = user
                    to_update.append(attendance)
                updated_ids.append(attendance.id)
                processed_student_ids.add(student_id)
            else:
                # Rekord yo'q — faqat faol student uchun yaratiladi (yuqorida tekshirildi)
                to_create.append(Attendance(
                    student_id=student_id,
                    group=group,
                    date=requested_date,
                    is_present=is_present,
                    marked_by=user
                ))
                processed_student_ids.add(student_id)

        if to_update:
            Attendance.objects.bulk_update(to_update, ['is_present', 'marked_by'])
        if to_create:
            created_objs = Attendance.objects.bulk_create(to_create)
            updated_ids.extend([obj.id for obj in created_objs])

        # Qo'shimcha: To'lov va maoshni qayta hisoblash (bulk uchun)
        if processed_student_ids:
            def trigger_finance_recalc():
                from finance.services import update_attendance_based_payments
                students = Student.objects.filter(id__in=processed_student_ids)
                for student in students:
                    try:
                        update_attendance_based_payments(student, group, requested_date)
                    except Exception as e:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.error("Failed to update payments for student %s in bulk: %s", student.id, e)
            
            transaction.on_commit(trigger_finance_recalc)

    # Xabarnomalarni yuborishni fonda bajaramiz (API tez qaytishi uchun)
    import threading

    def background_notifications(ids):
        try:
            # 1. Celery orqali urinib ko'ramiz
            from telegram_bot.tasks import send_attendance_notifications_task
            send_attendance_notifications_task.delay(ids)
        except Exception:
            # 2. Agar Celery bo'lmasa, oddiy thread + loop
            try:
                from telegram_bot.signals import send_attendance_notification
                atts = Attendance.objects.filter(id__in=ids)
                for a in atts:
                    try:
                        send_attendance_notification(a, async_send=False)
                    except Exception:
                        pass
            except Exception:
                pass

    if updated_ids:
        from django.utils import timezone
        today = timezone.localdate()
        if requested_date == today:
            threading.Thread(target=background_notifications, args=(updated_ids,)).start()

    # Faqat guruhda faol studentlarning davomatini qaytaramiz
    return (
        Attendance.objects
        .filter(group=group, date=requested_date, student_id__in=active_student_ids)
        .select_related('student')
        .order_by('student__full_name')
    )


def get_monthly_attendance_data(group, month, year):
    """Oylik davomat ma'lumotlarini yig'ish"""
    today = timezone.localdate()
    first_day = date(year, month, 1)
    _, last_day_num = monthrange(year, month)
    last_day = date(year, month, last_day_num)
    
    report_end_day = today if (year == today.year and month == today.month) else last_day
    # User talabi: Faqat dars bor kunlarini chiqaramiz
    lesson_dates = group.get_lesson_dates(year, month)
    date_list = [d for d in lesson_dates if d <= report_end_day]
    
    active_student_ids = group.enrollments.filter(is_active=True).values_list('student_id', flat=True)
    students = group.students.filter(
        id__in=active_student_ids, 
        is_archived=False, 
        is_active=True
    ).order_by('full_name')
    
    # BUG #4 FIX: att_data faqat hozir faol studentlar uchun yig'iladi.
    # Arxivlangan yoki guruhdan chiqarilgan studentlarning eski davomat
    # yozuvlari att_data ga tushmaydi — bu ortiqcha DB yuklanishini va
    # kelajakda yuz berishi mumkin bo'lgan ma'lumot noto'g'riligini oldini oladi.
    active_student_ids_set = set(active_student_ids)  # QuerySet -> set (tezroq lookup)
    attendances = (
        Attendance.objects
        .filter(
            group=group,
            date__range=[first_day, report_end_day],
            student_id__in=active_student_ids_set,  # Faqat faol studentlar
        )
        .values('student_id', 'date', 'is_present', 'marked_by_id')  # SELECT optimallashtirish
    )

    att_data = {}
    for att in attendances:
        sid = att['student_id']
        if sid not in att_data:
            att_data[sid] = {}
        # is_present dan tashqari, mentor tasdiqlaganligini (marked_by) ham saqlaymiz
        att_data[sid][str(att['date'])] = {
            'is_present': att['is_present'],
            'is_confirmed': att['marked_by_id'] is not None
        }

    return date_list, students, att_data

def create_homework_with_submissions(serializer, user, group):
    """Uyga vazifa yaratish va FAQAT FAOL o'quvchilar uchun submission ochish.
    
    BUG FIX: Avval group.students.all() ishlatilgan edi — bu nofaol (unenrolled)
    yoki arxivlangan o'quvchilarni ham qo'shib yuborardi. Endi faqat
    GroupEnrollment.is_active=True bo'lgan (guruhda faol) o'quvchilar uchun
    submission yaratilyapti.
    """
    from groups.models import GroupEnrollment
    with transaction.atomic():
        homework = serializer.save(mentor=user, group=group)
        
        # Faqat guruhda FAOL bo'lgan, arxivlanmagan va aktiv o'quvchilar
        active_student_ids = GroupEnrollment.objects.filter(
            group=group,
            is_active=True
        ).values_list('student_id', flat=True)
        
        students = group.students.filter(
            id__in=active_student_ids,
            is_archived=False,
            is_active=True
        )
        
        submissions = [
            HomeworkSubmission(
                homework=homework,
                student=student,
                status=HomeworkSubmission.NOT_SUBMITTED
            )
            for student in students
        ]
        HomeworkSubmission.objects.bulk_create(submissions, ignore_conflicts=True)
        return homework

def archive_homework(instance, user):
    """Uyga vazifani o'chirishdan oldin arxivlash"""
    from archivebase.models import ArchivedHomework
    
    submissions = instance.submissions.all().select_related('student')
    total = submissions.count()
    full = submissions.filter(status='full').count()
    half = submissions.filter(status='half').count()
    not_sub = submissions.filter(status='not_submitted').count()
    
    submission_rate = (full / total * 100) if total > 0 else 0
    quality_rate = ((full + (half * 0.5)) / total * 100) if total > 0 else 0
    
    stats = {
        "total_students": total,
        "full_submissions": full,
        "half_submissions": half,
        "not_submitted": not_sub,
        "submission_rate": round(submission_rate, 2),
        "quality_rate": round(quality_rate, 2),
        "students_data": [
            {
                "name": sub.student.full_name,
                "status": sub.get_status_display(),
                "date": sub.submitted_at.strftime('%Y-%m-%d %H:%M') if sub.submitted_at else None
            }
            for sub in submissions
        ]
    }
    
    ArchivedHomework.objects.create(
        original_id=instance.id,
        full_name=instance.title,
        item_type='homework',
        archived_by=user,
        group_id=instance.group.id,
        group_name=instance.group.name,
        mentor_name=instance.mentor.get_full_name() if instance.mentor else "Noma'lum",
        submission_stats=stats,
        metadata={
            "description": instance.description,
            "created_at": instance.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            "group_id": instance.group.id
        }
    )

def create_mock_test_with_results(serializer, group):
    """Mock test yaratish va barcha studentlar uchun natija qatorini ochish"""
    with transaction.atomic():
        mock_test = serializer.save(group=group)
        students = group.students.all()
        
        results = [
            MockTestResult(test=mock_test, student=student, score='')
            for student in students
        ]
        MockTestResult.objects.bulk_create(results)
        return mock_test

def archive_mock_test(instance, user):
    """Mock testni o'chirishdan oldin arxivlash"""
    from archivebase.models import ArchivedHomework
    
    results = instance.results.all().select_related('student')
    total = results.count()
    scored = results.exclude(score='').exclude(score__isnull=True).count()
    
    stats = {
        "total_students": total,
        "participated": scored,
        "not_participated": total - scored,
        "participation_rate": round((scored / total * 100), 2) if total > 0 else 0,
        "students_data": [
            {
                "name": res.student.full_name,
                "score": res.score or "N/A",
                "status": "Qatnashgan" if res.score else "Qatnashmagan"
            }
            for res in results
        ]
    }
    
    ArchivedHomework.objects.create(
        original_id=instance.id,
        full_name=instance.subject,
        item_type='mock_test',
        archived_by=user,
        group_id=instance.group.id,
        group_name=instance.group.name,
        mentor_name=instance.group.mentor.get_full_name() if instance.group.mentor else "Noma'lum",
        submission_stats=stats,
        metadata={
            "test_type": instance.type,
            "test_date": instance.date.strftime('%Y-%m-%d'),
            "created_at": instance.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            "group_id": instance.group.id
        }
    )

def edit_past_attendance(attendance_id, admin_user, new_status, reason=''):
    from django.db import transaction
    from rest_framework.exceptions import ValidationError
    from .models import AttendanceEditLog
    
    with transaction.atomic():
        # 1. Row-level Lock bilan davomatni tortib olish (Race condition himoyasi)
        try:
            attendance = Attendance.objects.select_for_update().get(id=attendance_id)
        except Attendance.DoesNotExist:
            raise ValidationError("Davomat topilmadi.")
            
        if attendance.is_present == new_status:
            return attendance  # O'zgarish yo'q
             
        group = attendance.group
        
        # 2. "Oxirgi 3 ta dars" validatsiyasi — dars jadvaliga asoslanadi (BUG #1 FIX)
        last_3_dates = get_last_3_lesson_dates(group)
        if attendance.date not in last_3_dates:
            raise ValidationError("Siz faqat oxirgi 3 ta o'tilgan dars davomatini tahrirlashingiz mumkin.")
             
        # 3. Tarixni yozish (Audit) — reason ixtiyoriy, bo'sh bo'lishi mumkin (BUG #3 FIX)
        AttendanceEditLog.objects.create(
            attendance=attendance,
            changed_by=admin_user,
            old_status=attendance.is_present,
            new_status=new_status,
            reason=reason or ''
        )
        
        # 4. Asosiy o'zgarishni yozish
        attendance.is_present = new_status
        attendance.marked_by = admin_user
        attendance.save()
        
        # 5. Moliya recalculation — tranzaksiya yopilgach, post-commit da bajariladi
        from finance.services import update_attendance_based_payments
        transaction.on_commit(
            lambda: update_attendance_based_payments(
                attendance.student, group, attendance.date
            )
        )
        
    # 6. Asinxron xabarnomalar — FAQAT bugungi sana uchun (BUG Notification FIX)
    import threading
    def background_notifications(att_id):
        try:
            from telegram_bot.tasks import send_attendance_notifications_task
            send_attendance_notifications_task.delay([att_id])
        except Exception:
            try:
                from telegram_bot.signals import send_attendance_notification
                att = Attendance.objects.get(id=att_id)
                send_attendance_notification(att, async_send=False)
            except Exception:
                pass
    
    today = timezone.localdate()
    if attendance.date == today:
        threading.Thread(target=background_notifications, args=(attendance.id,)).start()
    
    return attendance


