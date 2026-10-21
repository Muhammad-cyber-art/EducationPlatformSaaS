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
    all_past_dates = set()
    
    year, month = today.year, today.month
    for _ in range(3):  # MAX 3 oy orqaga qaraymiz (yetarli)
        dates = group.get_lesson_dates(year, month)
        past = [d for d in dates if d <= today]
        all_past_dates.update(past)
        
        if len(all_past_dates) >= 3:
            break
        
        # Oldingi oyga o'tamiz
        if month == 1:
            year, month = year - 1, 12
        else:
            month -= 1
    
    # Eng yangi 3 tasini qaytaramiz
    return sorted(list(all_past_dates), reverse=True)[:3]

def get_or_create_attendance_records(group, requested_date, view_only=False):
    """Davomat yozuvlarini olish yoki yaratish (istalgan kun uchun)
    
    Args:
        group: Guruh obyekti
        requested_date: So'ralgan sana
        view_only: Agar True bo'lsa, yangi yozuvlar yaratilmaydi (o'tgan oylar yoki dars bo'lmagan kunlar uchun)
    """
    # Dars kuni bo'lmasa, yangi davomat yozuvlari avtomatik yaratilmaydi (faqat mavjud yozuvlar ko'rsatiladi)
    if not group.is_lesson_day(requested_date):
        view_only = True

    # 1. Shu kunda guruhda bo'lgan studentlarni aniqlash:
    # A) requested_date kunida faol bo'lgan yoki shu kundan KEYIN guruhdan chiqqan/ko'chgan enrollmentlar
    from groups.models import GroupEnrollment
    active_enrollments = GroupEnrollment.objects.filter(
        group=group,
        joined_at__date__lte=requested_date,
        student__is_archived=False,
        student__is_active=True
    ).filter(
        models.Q(is_active=True) | models.Q(left_at__date__gte=requested_date)
    ).select_related('student')
    
    active_student_ids = set(active_enrollments.values_list('student_id', flat=True))
    
    # 2. Mavjud davomat yozuvlarini olish
    queryset = Attendance.objects.filter(group=group, date=requested_date)
    existing_student_ids = set(queryset.values_list('student_id', flat=True))
    
    # 3. Yetishmayotgan yozuvlarni yaratish (faqat dars kuni va view_only=False bo'lganda)
    if not view_only:
        missing_ids = active_student_ids - existing_student_ids
        if missing_ids:
            new_records = [
                Attendance(student_id=sid, group=group, date=requested_date, is_present=True)
                for sid in missing_ids
            ]
            Attendance.objects.bulk_create(new_records)
            queryset = Attendance.objects.filter(group=group, date=requested_date)
    
    # O'sha kunda guruhda bo'lgan yoki o'sha kunga allaqachon davomat yozuvi mavjud bo'lgan studentlar ko'rsatiladi
    visible_student_ids = active_student_ids | existing_student_ids
    return queryset.filter(student_id__in=visible_student_ids).select_related('student').order_by('student__full_name')


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

    # Faqat shu guruhga aloqador yoki mavjud davomat yozuvi bor studentlar qabul qilinadi
    group_enrollment_student_ids = set(
        GroupEnrollment.objects.filter(
            group=group
        ).filter(
            models.Q(is_active=True) | models.Q(left_at__date__gte=requested_date)
        ).values_list('student_id', flat=True)
    )
    direct_student_ids = set(
        Student.objects.filter(
            models.Q(group=group) | models.Q(enrollments__group=group),
            is_active=True
        ).values_list('id', flat=True)
    )
    active_student_ids = group_enrollment_student_ids | direct_student_ids
    existing_attendances = Attendance.objects.filter(group=group, date=requested_date)
    attendance_map = {att.student_id: att for att in existing_attendances}
    valid_student_ids = active_student_ids | set(attendance_map.keys())

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

            # Dublikat student_id kelganda qayta ishlamaymiz (500 xatosini oldini olish)
            if student_id in processed_student_ids:
                continue

            # Faqat shu kunga aloqador studentlar qayta ishlanadi
            if student_id not in valid_student_ids:
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
            Attendance.objects.bulk_create(to_create, ignore_conflicts=True)
            # ignore_conflicts=True bo'lganda Django PK larni to'ldirmaydi, shuning uchun ID larni bazadan so'raymiz
            created_ids = list(Attendance.objects.filter(
                group=group,
                date=requested_date,
                student_id__in=[obj.student_id for obj in to_create]
            ).values_list('id', flat=True))
            updated_ids.extend(created_ids)

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

    # Xabarnomalarni yuborish (Celery orqali asinxron, muvaffaqiyatsiz bo'lsa fallback fonda)
    from django.db import connection
    schema_name = getattr(connection, 'schema_name', None)

    if updated_ids:
        from django.utils import timezone
        today = timezone.localdate()
        if requested_date == today:
            try:
                from telegram_bot.tasks import send_attendance_notifications_task
                send_attendance_notifications_task.delay(updated_ids, schema_name=schema_name)
            except Exception:
                import threading

                def _fallback_send():
                    try:
                        from telegram_bot.signals import send_attendance_notification
                        atts = Attendance.objects.filter(id__in=updated_ids)
                        for a in atts:
                            try:
                                send_attendance_notification(a, async_send=False)
                            except Exception:
                                pass
                    except Exception:
                        pass

                threading.Thread(target=_fallback_send, daemon=True).start()

    # Guruhda faol yoki shu kuni davomati bo'lgan studentlarning davomatini qaytaramiz
    visible_ids = valid_student_ids | processed_student_ids | set(existing_attendances.values_list('student_id', flat=True))
    return (
        Attendance.objects
        .filter(group=group, date=requested_date, student_id__in=visible_ids)
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
    
    # Shu oyda guruhda bo'lgan barcha o'quvchilar (faol, oy ichida ko'chirilgan yoki oy davomida davomati mavjud bo'lganlar)
    month_enrollments = group.enrollments.filter(
        joined_at__date__lte=last_day,
        student__is_archived=False
    ).filter(
        models.Q(is_active=True) | models.Q(left_at__date__gte=first_day) | models.Q(left_at__isnull=True)
    )
    month_student_ids = set(month_enrollments.values_list('student_id', flat=True))
    
    attendances_month = Attendance.objects.filter(
        group=group,
        date__range=[first_day, report_end_day],
        student__is_archived=False
    )
    att_student_ids = set(attendances_month.values_list('student_id', flat=True))
    
    eligible_ids = (month_student_ids | att_student_ids) - {None}
    from groups.models import Student
    students = Student.objects.filter(
        id__in=eligible_ids, 
        is_archived=False, 
    ).order_by('full_name')
    
    attendances = (
        attendances_month
        .filter(student_id__in=eligible_ids)
        .values('student_id', 'date', 'is_present', 'marked_by_id')
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
        
        homework._notification_handled = True
        from telegram_bot.utils import send_homework_notification_async
        transaction.on_commit(lambda hid=homework.id: send_homework_notification_async(hid))
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
    
    students_data = []
    for sub in submissions:
        student_name = "Noma'lum"
        if sub.student and getattr(sub.student, 'full_name', None):
            student_name = sub.student.full_name
        elif getattr(sub, 'student_full_name', None):
            student_name = sub.student_full_name

        students_data.append({
            "name": student_name,
            "status": sub.get_status_display(),
            "date": sub.submitted_at.strftime('%Y-%m-%d %H:%M') if sub.submitted_at else None
        })

    stats = {
        "total_students": total,
        "full_submissions": full,
        "half_submissions": half,
        "not_submitted": not_sub,
        "submission_rate": round(submission_rate, 2),
        "quality_rate": round(quality_rate, 2),
        "students_data": students_data
    }
    
    archived_by_user = user if (user and getattr(user, 'is_authenticated', False)) else None

    mentor_name = "Noma'lum"
    if instance.mentor:
        if hasattr(instance.mentor, 'get_full_name') and instance.mentor.get_full_name():
            mentor_name = instance.mentor.get_full_name()
        elif getattr(instance.mentor, 'username', None):
            mentor_name = instance.mentor.username

    group_id = instance.group.id if instance.group else 0
    group_name = instance.group.name if instance.group else "Noma'lum"

    ArchivedHomework.objects.create(
        original_id=instance.id,
        full_name=instance.title or "Nomsiz vazifa",
        item_type='homework',
        archived_by=archived_by_user,
        group_id=group_id,
        group_name=group_name,
        mentor_name=mentor_name,
        submission_stats=stats,
        metadata={
            "description": instance.description or "",
            "created_at": instance.created_at.strftime('%Y-%m-%d %H:%M:%S') if instance.created_at else "",
            "group_id": group_id
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
    
    submission_rate = round((scored / total * 100), 2) if total > 0 else 0
    
    students_data = []
    for res in results:
        student_name = "Noma'lum"
        if res.student and getattr(res.student, 'full_name', None):
            student_name = res.student.full_name
        students_data.append({
            "name": student_name,
            "score": res.score or "N/A",
            "status": "Qatnashgan" if res.score else "Qatnashmagan"
        })

    stats = {
        "total_students": total,
        "participated": scored,
        "not_participated": total - scored,
        "participation_rate": submission_rate,
        "students_data": students_data
    }
    
    archived_by_user = user if (user and getattr(user, 'is_authenticated', False)) else None
    
    mentor_name = "Noma'lum"
    if instance.group and instance.group.mentor:
        if hasattr(instance.group.mentor, 'get_full_name') and instance.group.mentor.get_full_name():
            mentor_name = instance.group.mentor.get_full_name()
        elif getattr(instance.group.mentor, 'username', None):
            mentor_name = instance.group.mentor.username

    group_id = instance.group.id if instance.group else 0
    group_name = instance.group.name if instance.group else "Noma'lum"

    ArchivedHomework.objects.create(
        original_id=instance.id,
        full_name=instance.subject or "Nomsiz test",
        item_type='mock_test',
        archived_by=archived_by_user,
        group_id=group_id,
        group_name=group_name,
        mentor_name=mentor_name,
        submission_stats=stats,
        metadata={
            "test_type": instance.type or "",
            "test_date": instance.date.strftime('%Y-%m-%d') if instance.date else "",
            "created_at": instance.created_at.strftime('%Y-%m-%d %H:%M:%S') if instance.created_at else "",
            "group_id": group_id
        }
    )

def edit_past_attendance(attendance_id, user, new_status, reason=''):
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
        
        # 2. "Oxirgi 3 ta dars" yoki to'liq davomat (1 oylik) validatsiyasi — dars jadvaliga asoslanadi
        last_3_dates = get_last_3_lesson_dates(group)
        today = timezone.localdate()
        has_full_attendance = False
        if getattr(user, 'role', '') == 'super_admin' or getattr(user, 'is_superuser', False):
            has_full_attendance = True
        elif getattr(user, 'role', '') == 'admin':
            try:
                from permissions.models import StaffPermission
                sp = StaffPermission.objects.filter(user=user).first()
                if sp and sp.permissions:
                    has_full_attendance = bool(sp.permissions.get('full_attendance'))
            except Exception:
                has_full_attendance = False

        within_1_month = has_full_attendance and (today - timedelta(days=30) <= attendance.date <= today)
        if attendance.date not in last_3_dates and not within_1_month:
            raise ValidationError("Siz faqat oxirgi 3 ta o'tilgan dars davomatini tahrirlashingiz mumkin.")
             
        # 3. Tarixni yozish (Audit) — reason ixtiyoriy, bo'sh bo'lishi mumkin (BUG #3 FIX)
        AttendanceEditLog.objects.create(
            attendance=attendance,
            changed_by=user,
            old_status=attendance.is_present,
            new_status=new_status,
            reason=reason or ''
        )
        
        # 4. Asosiy o'zgarishni yozish
        attendance.is_present = new_status
        attendance.marked_by = user
        attendance.save()
        
        # 5. Moliya recalculation — tranzaksiya yopilgach, post-commit da bajariladi
        from finance.services import update_attendance_based_payments
        transaction.on_commit(
            lambda: update_attendance_based_payments(
                attendance.student, group, attendance.date
            )
        )
        
    # 6. Asinxron xabarnomalar — FAQAT bugungi sana uchun (BUG Notification FIX)
    from django.db import connection
    schema_name = getattr(connection, 'schema_name', None)
    today = timezone.localdate()
    if attendance.date == today:
        try:
            from telegram_bot.tasks import send_attendance_notifications_task
            send_attendance_notifications_task.delay([attendance.id], schema_name=schema_name)
        except Exception:
            import threading

            def _fallback_single_send():
                try:
                    from telegram_bot.signals import send_attendance_notification
                    att = Attendance.objects.get(id=attendance.id)
                    send_attendance_notification(att, async_send=False)
                except Exception:
                    pass

            threading.Thread(target=_fallback_single_send, daemon=True).start()

    return attendance


def compute_student_monthly_attendance(
    student,
    year,
    month,
    req_group_id=None,
    today=None,
    group_lessons_cache=None,
    attendance_records=None,
    active_enrollments=None,
):
    """
    O'quvchining 1 oylik davomat matritsasini GitHub-style heatmap uchun agregatsiya qiladi.
    Optimizatsiya qilingan: offline bundle yoki bevosita API so'rovida qayta ishlatiladi.
    """
    from datetime import date as date_type
    from calendar import monthrange
    from groups.models import GroupEnrollment
    import logging

    logger = logging.getLogger(__name__)

    if today is None:
        today = timezone.localdate()

    if active_enrollments is None:
        active_enrollments = list(
            GroupEnrollment.objects.filter(
                student=student,
                is_active=True
            ).select_related('group')
        )

    if req_group_id is not None:
        try:
            req_group_id = int(req_group_id)
        except (ValueError, TypeError):
            req_group_id = None

    available_groups_dict = {}
    for e in active_enrollments:
        if e.group and e.group.id not in available_groups_dict:
            available_groups_dict[e.group.id] = e.group
    if student.group and student.group.id not in available_groups_dict:
        available_groups_dict[student.group.id] = student.group

    available_groups = list(available_groups_dict.values())

    if req_group_id:
        active_groups = [g for g in available_groups if g.id == req_group_id]
        if not active_groups:
            try:
                from groups.models import Group
                direct_grp = Group.objects.filter(id=req_group_id).first()
                if direct_grp:
                    active_groups = [direct_grp]
            except Exception:
                active_groups = []
    else:
        active_groups = available_groups

    # Join date xaritasi
    join_dates = {}
    for e in active_enrollments:
        join_dates[e.group_id] = e.joined_at.date() if e.joined_at else (student.joined_at.date() if student.joined_at else None)
    if student.group_id and student.group_id not in join_dates:
        join_dates[student.group_id] = student.joined_at.date() if student.joined_at else None

    # Oydagi barcha faol guruhlarning rejalashtirilgan dars kunlarini olish
    group_lessons_map = {}
    for g in active_groups:
        if group_lessons_cache and g.id in group_lessons_cache:
            l_dates = group_lessons_cache[g.id]
        else:
            try:
                l_dates = set(g.get_lesson_dates(year, month))
            except Exception as ex:
                logger.warning(f"Error fetching lesson dates for group {g.id}: {ex}")
                l_dates = set()

        group_lessons_map[g.id] = {
            'id': g.id,
            'name': g.name,
            'color': getattr(g, 'color', '#ffffff'),
            'lesson_dates': l_dates,
            'join_date': join_dates.get(g.id)
        }

    # Oydagi mavjud davomat yozuvlarini olish
    active_gids = [g.id for g in active_groups]
    if attendance_records is None:
        attendance_qs = Attendance.objects.filter(
            student=student,
            date__year=year,
            date__month=month
        ).select_related('group')
        if req_group_id:
            attendance_qs = attendance_qs.filter(group_id=req_group_id)
        else:
            if active_gids:
                attendance_qs = attendance_qs.filter(group_id__in=active_gids)
        records_list = list(attendance_qs)
    else:
        if req_group_id:
            records_list = [r for r in attendance_records if r.group_id == req_group_id]
        else:
            records_list = [r for r in attendance_records if not active_gids or r.group_id in active_gids]

    att_by_date = {}
    for att in records_list:
        att_date_str = str(att.date)
        if att_date_str not in att_by_date:
            att_by_date[att_date_str] = []
        att_by_date[att_date_str].append(att)

    # Oydagi barcha kunlar bo'yicha matritsani qurish
    _, last_day_num = monthrange(year, month)
    days_data = []

    total_scheduled = 0
    total_passed = 0
    attended_count = 0
    absent_count = 0
    unconfirmed_count = 0
    future_count = 0

    for day_num in range(1, last_day_num + 1):
        curr_date = date_type(year, month, day_num)
        curr_date_str = str(curr_date)
        is_today = (curr_date == today)
        is_future = (curr_date > today)

        # Bu kunda darsi bor guruhlarni tekshirish
        day_groups_with_lesson = []
        for gid, ginfo in group_lessons_map.items():
            if curr_date in ginfo['lesson_dates']:
                day_groups_with_lesson.append(ginfo)

        is_lesson = len(day_groups_with_lesson) > 0
        records_today = att_by_date.get(curr_date_str, [])

        status_str = "no_lesson"
        lesson_groups_names = []

        if is_lesson:
            total_scheduled += 1
            lesson_groups_names = [g['name'] for g in day_groups_with_lesson]

            joined_all = any(
                (not ginfo['join_date'] or curr_date >= ginfo['join_date'])
                for ginfo in day_groups_with_lesson
            )

            if not joined_all:
                status_str = "not_joined"
            elif is_future:
                status_str = "future"
                future_count += 1
            else:
                total_passed += 1
                if records_today:
                    confirmed_records = [r for r in records_today if r.marked_by_id is not None]
                    if confirmed_records:
                        if any(r.is_present for r in confirmed_records):
                            status_str = "present"
                            attended_count += 1
                        else:
                            status_str = "absent"
                            absent_count += 1
                    else:
                        status_str = "unconfirmed"
                        unconfirmed_count += 1
                else:
                    status_str = "unconfirmed"
                    unconfirmed_count += 1
        elif records_today:
            confirmed_records = [r for r in records_today if r.marked_by_id is not None]
            if confirmed_records:
                if any(r.is_present for r in confirmed_records):
                    status_str = "present"
                    attended_count += 1
                    total_passed += 1
                else:
                    status_str = "absent"
                    absent_count += 1
                    total_passed += 1
            else:
                status_str = "unconfirmed"
            lesson_groups_names = [r.group_name or (r.group.name if r.group else "Guruh") for r in records_today]

        day_group_ids = [g['id'] for g in day_groups_with_lesson]
        if not day_group_ids and records_today:
            day_group_ids = [r.group_id for r in records_today if r.group_id]

        days_data.append({
            "date": curr_date_str,
            "day": day_num,
            "day_of_week": curr_date.weekday(),
            "is_lesson_day": is_lesson or (len(records_today) > 0),
            "status": status_str,
            "groups": lesson_groups_names,
            "group_ids": day_group_ids,
            "is_today": is_today
        })

    if total_passed > 0:
        attendance_rate = round((attended_count / total_passed * 100), 1)
    else:
        attendance_rate = 0 if future_count > 0 else 100.0

    return {
        "student_id": student.id,
        "student_name": student.full_name,
        "req_group_id": req_group_id,
        "year": year,
        "month": month,
        "groups": [{"id": g.id, "name": g.name} for g in available_groups],
        "stats": {
            "total_scheduled": total_scheduled,
            "total_passed": total_passed,
            "attended_count": attended_count,
            "absent_count": absent_count,
            "unconfirmed_count": unconfirmed_count,
            "future_count": future_count,
            "attendance_rate": attendance_rate
        },
        "days": days_data
    }



