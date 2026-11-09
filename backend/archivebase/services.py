from datetime import date, datetime
from decimal import Decimal
from django.forms.models import model_to_dict
from django.db import transaction, models
from .models import ArchivedStudent, ArchivedStaff, ArchivedGroup, ArchivedLid
from finance.models import Payment
import json
from .snapshots import (snapshot, snapshot_rows, student_history, restore_row,
                        restore_student_history, restore_payments, require_archive_access)
def json_serializable_convert(obj):
    """
    Sana, vaqt, Decimal va Django model ob'ektlarini 
    JSON tushunadigan formatga o'tkazuvchi yordamchi funksiya
    """
    from django.db.models.fields.files import FieldFile
    from django.db.models import Model, QuerySet
    from datetime import date, datetime
    from decimal import Decimal
    
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, FieldFile):
        return obj.name if obj else None
    if isinstance(obj, Model):
        # Model ob'ektini string ko'rinishida yoki ID sini qaytaramiz
        return str(obj)
    if isinstance(obj, QuerySet):
        return list(obj) # QuerySetni listga o'girib, qayta rekursiv chaqiramiz
    if isinstance(obj, dict):
        return {k: json_serializable_convert(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_serializable_convert(i) for i in obj]
    return obj

def serialize_related(queryset):
    """QuerySetni list[dict] ko'rinishiga o'tkazadi va sanalarni tozalaydi"""
    data_list = [model_to_dict(obj) for obj in queryset]
    return json_serializable_convert(data_list)

@transaction.atomic
def move_student_to_archive(student, archived_by, reason: str = "") -> ArchivedStudent:
    from groups.models import Student
    student = Student.objects.select_for_update().get(pk=student.pk)
    
    # 1. Bog'liq ma'lumotlarni yig'ish
    payments = Payment.objects.filter(student=student)
    
    # 2. Student ma'lumotlarini dict qilish va sanalarni tozalash
    student_data = snapshot(student)
    cleaned_student_data = json_serializable_convert(student_data)
    
    # Qo'shimcha ID larni qo'shish
    cleaned_student_data["branch_id"] = student.branch_id
    cleaned_student_data["group_id"] = student.group_id
    
    # 3. Bog'langan ma'lumotlarni tozalab qo'shish
    cleaned_student_data["payments"] = snapshot_rows(payments)
    cleaned_student_data["history_ids"] = student_history(student)
    cleaned_student_data["enrollments"] = snapshot_rows(student.enrollments.all())

    # 4. Arxiv yaratish
    archived = ArchivedStudent.objects.create(
        original_id=student.id,
        full_name=student.full_name,
        branch_name=getattr(student.branch, "name", "Noma'lum"),
        last_group_name=getattr(student.group, "name", "Guruhsiz"),
        archived_by=archived_by,
        reason=reason,
        metadata=cleaned_student_data, # Endi bu yerda date ob'ektlari yo'q, faqat stringlar
    )

    # 5. O'chirish
    payments.delete()
    student.delete()

    return archived

# move_staff_to_archive funksiyasida ham xuddi shunday cleaned_data ishlating
@transaction.atomic
def move_staff_to_archive(staff, archived_by, reason: str = "") -> ArchivedStaff:
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # 1. Ma'lumotlarni yig'ish (faqat kerakli maydonlarni)
    staff_data = {
        "id": staff.id,
        "username": staff.username,
        "first_name": staff.first_name,
        "last_name": staff.last_name,
        "email": staff.email,
        "role": getattr(staff, 'role', 'mentor'),
        "phone_number": getattr(staff, "phone_number", ""),
        "date_joined": staff.date_joined.isoformat() if staff.date_joined else None,
        "branch": staff.branch_id, # Filtr ishlashi uchun branch ID
    }
    
    # 1.1 StaffProfile (To'lov ma'lumotlari) ni saqlash
    if hasattr(staff, 'staff_profile'):
        try:
            profile_data = model_to_dict(staff.staff_profile)
            # ID ni olib tashlaymiz, chunki tiklanganda yangi ID beriladi
            if 'id' in profile_data: del profile_data['id']
            if 'user' in profile_data: del profile_data['user']
            staff_data['staff_profile'] = json_serializable_convert(profile_data)
        except Exception:
            pass
    
    # Metadata uchun to'liq tozalangan ma'lumot
    cleaned_staff_data = json_serializable_convert(staff_data)
    
    # 2. Arxiv yaratish (O'chirishdan OLDIN)
    archived = ArchivedStaff.objects.create(
        original_id=staff.id,
        full_name=f"{staff.first_name} {staff.last_name}".strip() or staff.username,
        role=getattr(staff, 'role', 'mentor'),
        phone=getattr(staff, "phone_number", ""),
        branch_id=staff.branch.id if staff.branch else None,
        archived_by=archived_by,
        reason=reason,
        metadata=cleaned_staff_data,
    )

    # 3. O'chirish
    # Dastlab StaffProfile ni o'chiramiz (Signal ishlashi va Paymentlar arxivlanishi uchun)
    if hasattr(staff, 'staff_profile'):
        try:
            staff.staff_profile.delete()
        except Exception:
            pass # Profil bo'lmasa yoki xato bo'lsa, davom etamiz
            
    staff.delete()
    return archived
def send_to_archive(instance, request_user, reason: str = ""):
    from groups.models import Student, WaitingStudent
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if isinstance(instance, Student):
        return move_student_to_archive(instance, archived_by=request_user, reason=reason)
    
    if isinstance(instance, User):
        return move_staff_to_archive(instance, archived_by=request_user, reason=reason)
    
    if isinstance(instance, WaitingStudent):
        return move_lid_to_archive(instance, archived_by=request_user, reason=reason)
    
    raise ValueError(f"Archive qo'llab-quvvatlanmagan model: {type(instance).__name__}")


@transaction.atomic
def move_group_to_archive(group, archived_by, reason: str = "") -> ArchivedGroup:
    """
    Guruhni arxivga ko'chiradi.

    ⚠️ BUG FIX #1: Agar o'quvchi bir nechta guruhda bo'lsa,
    uni to'liq arxivlamay — faqat shu guruh enrollment'ini o'chirish kerak.
    Aksincha, u boshqa faol guruhlardan ham yo'qolib ketardi.
    """
    from groups.models import Group, GroupEnrollment, Student
    from finance.models import Payment
    import logging
    logger = logging.getLogger(__name__)

    group = Group.objects.select_for_update().get(pk=group.pk)
    group_data = snapshot(group)
    group_data["payments"] = snapshot_rows(Payment.objects.filter(group=group))
    group_data["enrollments"] = snapshot_rows(group.enrollments.all())
    group_data["special_lesson_days"] = snapshot_rows(group.special_lesson_days.all())
    group_data["canceled_lesson_days"] = snapshot_rows(group.canceled_lesson_days.all())
    group_data["additional_mentors"] = snapshot_rows(group.additional_mentors.all())
    from homework_attends.models import Attendance, MockTest, Homework, HomeworkSubmission
    from finance.models import FinanceTransaction
    group_data['homeworks'] = snapshot_rows(Homework.objects.filter(group=group))
    group_data['homework_submissions'] = snapshot_rows(HomeworkSubmission.objects.filter(homework__group=group))
    group_data["history_ids"] = {
        "attendance": list(Attendance.objects.filter(group=group).values_list('pk', flat=True)),
        "mock_tests": list(MockTest.objects.filter(group=group).values_list('pk', flat=True)),
        "transactions": list(FinanceTransaction.objects.filter(group=group).values_list('pk', flat=True)),
    }

    # 1. Faqat shu guruhda ayni paytda faol bo'lgan o'quvchilarni olamiz
    active_enrollment_student_ids = GroupEnrollment.objects.filter(
        group=group,
        is_active=True
    ).values_list('student_id', flat=True)

    # Legacy FK orqali to'g'ridan-to'g'ri biriktirilgan o'quvchilarni ham inobatga olamiz
    current_students = list(Student.objects.filter(
        models.Q(id__in=active_enrollment_student_ids) |
        models.Q(group=group, is_active=True, is_archived=False)
    ).distinct())

    # Arxivlanishi kerak bo'lgan va faqat shu guruhda bo'lgan studentlarni
    # boshqa guruhlarda ham bor bo'lganlardan ajratamiz.
    students_to_fully_archive = []   # Boshqa guruhi yo'q → to'liq arxivlanadi
    students_to_unenroll_only = []   # Boshqa guruhi bor  → faqat enrollment o'chadi

    for student in current_students:
        # Shu guruhdan tashqari boshqa FAOL guruhlari bormi?
        other_active = GroupEnrollment.objects.filter(
            student=student,
            is_active=True
        ).exclude(group=group).exists()
        
        if not other_active:
            # Agar GroupEnrollment bo'lmasa, legacy FK tekshiramiz
            other_active = Student.objects.filter(id=student.id).exclude(group=group).filter(
                group__isnull=False, group__is_faol=True
            ).exists()

        if other_active:
            students_to_unenroll_only.append(student)
        else:
            students_to_fully_archive.append(student)

    # Guruhdan avval chiqqan/ko'chgan (is_active=False) enrollmentlarni tozalaymiz (o'quvchiga tegmasdan)
    GroupEnrollment.objects.filter(group=group, is_active=False).delete()

    logger.info(
        f"[GroupArchive] Guruh='{group.name}' (ID={group.id}): "
        f"{len(students_to_fully_archive)} ta to'liq arxiv, "
        f"{len(students_to_unenroll_only)} ta faqat unenroll."
    )

    # ⚠️ O'quvchi ID larini arxivlashdan OLDIN saqlab olamiz.
    # Sabab: move_student_to_archive → student.delete() chaqirilgandan keyin
    # Django ob'ektning pk (id) ni None ga o'rnatadi.
    student_ids_to_archive = [s.id for s in students_to_fully_archive]

    # 2a. Faqat shu guruhda bo'lgan o'quvchilarni to'liq arxivlaymiz
    archived_student_records = []   # ArchivedStudent id larini saqlaymiz
    for student in students_to_fully_archive:
        archived_rec = move_student_to_archive(
            student, archived_by,
            reason=f"Guruh arxivlangani uchun: {reason}"
        )
        archived_student_records.append(archived_rec.id)

    # 2b. Bir nechta guruhda bo'lgan o'quvchilar — faqat shu guruhdan chiqaramiz
    #     Ularning boshqa guruhlardagi ma'lumotlari va to'lovlari SAQLANIB QOLADI.
    for student in students_to_unenroll_only:
        # Faqat shu guruh bilan bog'liq Paymentlarni o'chirish (PROTECT ochilishi uchun)
        Payment.objects.filter(student=student, group=group).delete()
        # GroupEnrollment ni o'chirish
        GroupEnrollment.objects.filter(student=student, group=group).delete()
        # Agar legacy FK ham shu guruhga ko'rsatib turgan bo'lsa yoki bo'sh bo'lsa — boshqa guruhga o'tkazamiz
        if student.group_id == group.id or not student.group_id:
            # BUG FIX: student.groups — barcha (is_active=False ham) enrollmentlarni qaytaradi.
            # Faqat FAOL enrollmentlardagi guruhni keyingi guruh sifatida olamiz.
            next_group = Group.objects.filter(
                enrollments__student=student,
                enrollments__is_active=True
            ).exclude(id=group.id).first()
            student.group = next_group
            student.branch = next_group.branch if next_group else student.branch
            student.save(update_fields=['group', 'branch'])
            logger.info(
                f"[GroupArchive] Student '{student.full_name}' (ID={student.id}) "
                f"legacy FK yangilandi → '{next_group}'"
            )
        elif hasattr(student, 'sync_active_group_and_branch'):
            student.sync_active_group_and_branch()

    # 3. O'quvchilar bo'shatilgandan keyin qolgan "yetim" to'lovlarni topib saqlaymiz
    remaining_payments = Payment.objects.filter(group=group)
    payments_data = serialize_related(remaining_payments)

    # 4. Guruh ma'lumotlarini snapshot qilish (student ID listini ham saqlaymiz)
    # original Student.id lari (arxivlashdan oldin saqlangan)
    group_data["archived_student_ids"] = student_ids_to_archive
    # ArchivedStudent.id lari — tiklashda to'g'ri qidirish uchun
    group_data["archived_student_record_ids"] = archived_student_records
    group_data["multi_group_student_ids"] = [s.id for s in students_to_unenroll_only]
    group_data["orphan_payments"] = payments_data

    # 5. Arxiv yozuvini yaratish
    archived_group = ArchivedGroup.objects.create(
        original_id=group.id,
        full_name=group.name,
        branch_name=getattr(group.branch, "name", "Noma'lum"),
        mentor_name=str(group.mentor) if group.mentor else "Ustozsiz",
        subject=group.subject,
        archived_by=archived_by,
        reason=reason,
        metadata=group_data,
    )

    # 6. Qolgan yetim to'lovlarni o'chirish (PROTECT dan o'tish uchun)
    remaining_payments.delete()

    # 7. Guruhni o'chirish
    group.delete()

    return archived_group

# ==================== RESTORE FUNCTIONS ====================

@transaction.atomic
def restore_student_from_archive(archived_student_id, restored_by):
    """Restore one identity and its exact history; never claim orphans by name."""
    from groups.models import Student, Group, GroupEnrollment
    archived = ArchivedStudent.objects.select_for_update().get(pk=archived_student_id)
    require_archive_access(archived, restored_by)
    metadata = archived.metadata
    student = Student.objects.select_for_update().filter(pk=archived.original_id).first()
    if student is not None and not student.is_archived:
        raise ValueError("Ushbu IDda faol o'quvchi mavjud; tiklash bekor qilindi.")
    data = dict(metadata)
    data['id'] = archived.original_id
    data['full_name'] = archived.full_name
    data['branch'] = metadata.get('branch_id') or metadata.get('branch')
    data['group'] = metadata.get('group_id') or metadata.get('group')
    data.update(is_active=True, is_archived=False, archived_at=None)
    if student is None:
        student = restore_row(Student, data)
    else:
        # Existing soft archives already retain their history and financial rows.
        Student.objects.filter(pk=student.pk).update(is_active=True, is_archived=False, archived_at=None)
        student.refresh_from_db()

    for enrollment_data in metadata.get('enrollments', []):
        group_id = enrollment_data.get('group')
        if not Group.objects.filter(pk=group_id).exists():
            continue
        values = {key: value for key, value in enrollment_data.items() if key not in ('id', 'student', 'group')}
        # Updating a DateTimeField accepts the original ISO timestamp, preserving membership history.
        enrollment, _ = GroupEnrollment.objects.get_or_create(student=student, group_id=group_id)
        GroupEnrollment.objects.filter(pk=enrollment.pk).update(**values)
    if student.group_id and not metadata.get('enrollments'):
        GroupEnrollment.objects.update_or_create(student=student, group=student.group,
                                                defaults={'is_active': True, 'left_at': None})
    restore_payments(metadata.get('payments', []), student=student)
    student.archive_restore_warnings = restore_student_history(archived, student)
    # Legacy or deleted primary groups must not select an unrelated same-name group.
    student.sync_active_group_and_branch()
    if student.telegram_id:
        from telegram_bot.models import BotProfile
        BotProfile.objects.update_or_create(
            telegram_id=student.telegram_id,
            defaults={'student': student, 'phone_number': student.phone or '',
                      'role': 'student', 'is_active': True},
        )
    archived.delete()
    return student

@transaction.atomic
def restore_staff_from_archive(archived_staff_id, restored_by):
    """
    Arxivlangan xodimni (mentor/admin) qayta tiklash.
    """
    from django.contrib.auth import get_user_model
    from branches.models import Branch
    User = get_user_model()
    
    archived = ArchivedStaff.objects.get(id=archived_staff_id)
    metadata = archived.metadata
    
    # Branch ni topish
    branch = None
    if metadata.get('branch'):
        branch = Branch.objects.filter(id=metadata['branch']).first()
    
    # Usernameni unique qilish (agar kerak bo'lsa)
    original_username = metadata.get('username', f"user_{archived.original_id}")
    username = original_username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{original_username}_{counter}"
        counter += 1
    
    # Xodimni qayta yaratish
    user = User.objects.create(
        username=username,
        first_name=metadata.get('first_name', ''),
        last_name=metadata.get('last_name', ''),
        email=metadata.get('email', ''),
        role=archived.role,
        branch=branch,
        phone_number=archived.phone,
    )
    
    # Parolni o'rnatish (default)
    # BUG #7 FIX: set_password ikki marta chaqirilgan edi — keraksiz takrorlash.
    user.set_password('changeme123')
    user.save()

    # StaffProfile ni tiklash
    if metadata.get('staff_profile'):
        try:
            from finance.models import StaffProfile
            profile_data = metadata['staff_profile']
            # Yangi userga bog'laymiz
            StaffProfile.objects.create(user=user, **profile_data)
        except Exception as e:
            # Profil tiklanmasa ham user tiklandi, shuning uchun xatoni yutib yuboramiz
            # yoki log qilamiz. Asosiy maqsad user tiklanishi.
            print(f"StaffProfile tiklashda xato: {e}")
            pass
    
    return user

@transaction.atomic
def restore_group_from_archive(archived_group_id, restored_by):
    """Restore the group atomically, including invoices, schedule and exact history."""
    from groups.models import (Group, GroupEnrollment, Student, SpecialLessonDay,
                               CanceledLessonDay, MentorGroupAssignment)
    from homework_attends.models import Attendance, MockTest, Homework, HomeworkSubmission
    from finance.models import FinanceTransaction
    archived = ArchivedGroup.objects.select_for_update().get(pk=archived_group_id)
    require_archive_access(archived, restored_by)
    metadata = archived.metadata
    if Group.objects.filter(pk=archived.original_id).exists():
        raise ValueError("Ushbu IDda guruh mavjud; tiklash bekor qilindi.")
    group = restore_row(Group, dict(metadata, id=archived.original_id, name=archived.full_name,
                                    is_archived=False, archived_at=None))
    restored_count = skipped_count = 0
    warnings = []
    if 'history_ids' not in metadata:
        warnings.append("Eski guruh arxivida tarix IDlari yo'q; bog'lanmagan davomatni alohida tekshirish kerak.")
    record_ids = metadata.get('archived_student_record_ids', [])
    for index, original_id in enumerate(metadata.get('archived_student_ids', [])):
        if record_ids and index < len(record_ids):
            student_archive = ArchivedStudent.objects.filter(pk=record_ids[index]).first()
        else:
            student_archive = ArchivedStudent.objects.filter(original_id=original_id).order_by('-archived_at').first()
        if student_archive:
            restored_student = restore_student_from_archive(student_archive.pk, restored_by)
            warnings.extend(restored_student.archive_restore_warnings)
            restored_count += 1
        elif Student.objects.filter(pk=original_id, is_active=True, is_archived=False).exists():
            # The student may already have been restored separately.
            restored_count += 1
        else:
            # Silently dropping an invoice/student would make this a lossy restore.
            raise ValueError(f"O'quvchi {original_id} arxivi topilmadi; guruh tiklanmadi.")

    for enrollment_data in metadata.get('enrollments', []):
        student_id = enrollment_data.get('student')
        if not Student.objects.filter(pk=student_id).exists():
            skipped_count += 1
            continue
        values = {key: value for key, value in enrollment_data.items() if key not in ('id', 'student', 'group')}
        enrollment, _ = GroupEnrollment.objects.get_or_create(student_id=student_id, group=group)
        GroupEnrollment.objects.filter(pk=enrollment.pk).update(**values)
    for student_id in metadata.get('multi_group_student_ids', []):
        if Student.objects.filter(pk=student_id).exists():
            GroupEnrollment.objects.get_or_create(student_id=student_id, group=group)
            restored_count += 1
        else:
            skipped_count += 1
    # Older group snapshots only stored leftover invoices; student snapshots contain the rest.
    restore_payments(metadata.get('payments', metadata.get('orphan_payments', [])))
    for data in metadata.get('homeworks', []):
        restore_row(Homework, data, group_id=group.pk)
    for data in metadata.get('homework_submissions', []):
        restore_row(HomeworkSubmission, data)
    for key, model in (('special_lesson_days', SpecialLessonDay),
                       ('canceled_lesson_days', CanceledLessonDay),
                       ('additional_mentors', MentorGroupAssignment)):
        for data in metadata.get(key, []):
            restore_row(model, data, group_id=group.pk)
    for model, key in ((Attendance, 'attendance'), (MockTest, 'mock_tests'),
                       (FinanceTransaction, 'transactions')):
        model.objects.filter(pk__in=metadata.get('history_ids', {}).get(key, []),
                             group__isnull=True).update(group=group)
    archived.delete()
    return {'group': group, 'restored_students': restored_count,
            'skipped_students': skipped_count, 'errors': list(dict.fromkeys(warnings))}

@transaction.atomic
def move_lid_to_archive(waiting_student, archived_by, reason: str = "") -> ArchivedLid:
    from groups.models import WaitingStudent
    
    # 1. WaitingStudent ma'lumotlarini dict qilish va sanalarni tozalash
    student_data = model_to_dict(waiting_student)
    cleaned_student_data = json_serializable_convert(student_data)
    
    # 2. Arxiv yaratish
    archived = ArchivedLid.objects.create(
        original_id=waiting_student.id,
        full_name=waiting_student.full_name,
        branch_name=getattr(waiting_student.branch, "name", "Noma'lum"),
        phone=waiting_student.phone,
        subject=waiting_student.subject,
        archived_by=archived_by,
        reason=reason,
        metadata=cleaned_student_data,
    )
    
    # 3. O'chirish
    waiting_student.delete()
    
    return archived


@transaction.atomic
def restore_lid_from_archive(archived_lid_id, restored_by):
    from groups.models import WaitingStudent
    from branches.models import Branch
    
    archived = ArchivedLid.objects.get(id=archived_lid_id)
    metadata = archived.metadata
    
    # Branch ni topish (agar mavjud bo'lsa)
    branch = None
    if metadata.get('branch'):
        branch = Branch.objects.filter(id=metadata['branch']).first()
    
    # WaitingStudent ni qayta yaratish
    waiting_student = WaitingStudent.objects.create(
        full_name=archived.full_name,
        branch=branch,
        phone=archived.phone,
        subject=archived.subject,
        notes=metadata.get('notes', ''),
        telegram_id=metadata.get('telegram_id'),
        parent_telegram_id=metadata.get('parent_telegram_id'),
    )
    
    return waiting_student


@transaction.atomic
def move_student_to_waiting_hall(student, archived_by, reason, branch):
    from groups.models import WaitingStudent
    from .models import ArchivedStudent
    
    from groups.models import Student
    student = Student.objects.select_for_update().get(pk=student.pk)
    # 1. Bog'liq ma'lumotlarni yig'ish
    from finance.models import Payment
    payments = Payment.objects.filter(student=student)
    
    # 2. Student ma'lumotlarini dict qilish va sanalarni tozalash
    student_data = snapshot(student)
    cleaned_student_data = json_serializable_convert(student_data)
    
    # Qo'shimcha ID larni qo'shish
    cleaned_student_data["branch_id"] = student.branch_id
    cleaned_student_data["group_id"] = student.group_id
    
    # 3. Bog'langan ma'lumotlarni tozalab qo'shish
    cleaned_student_data["payments"] = snapshot_rows(payments)
    cleaned_student_data["history_ids"] = student_history(student)
    cleaned_student_data["enrollments"] = snapshot_rows(student.enrollments.all())

    # 4. Arxiv yaratish (Waiting Hall uchun reason ni [WAITING_HALL] bilan boshlaymiz)
    archived = ArchivedStudent.objects.create(
        original_id=student.id,
        full_name=student.full_name,
        branch_name=getattr(student.branch, "name", "Noma'lum"),
        last_group_name=getattr(student.group, "name", "Guruhsiz"),
        archived_by=archived_by,
        reason=f"[WAITING_HALL] {reason}",
        metadata=cleaned_student_data,
    )

    # 5. Waiting Student yaratish
    WaitingStudent.objects.create(
        full_name=student.full_name,
        phone=student.phone,
        branch=branch,
        notes=f"Oldingi ID: {student.id} | {reason}",
        telegram_id=student.telegram_id,
        parent_telegram_id=student.parent_telegram_id
    )
    
    # 6. Bog'liq to'lovlarni o'chirish
    payments.delete()
    
    # 7. Asl studentni o'chirish
    student.delete()
    
    return archived
