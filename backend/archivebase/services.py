from datetime import date, datetime
from decimal import Decimal
from django.forms.models import model_to_dict
from django.db import transaction, models
from .models import ArchivedStudent, ArchivedStaff, ArchivedGroup, ArchivedLid
from finance.models import Payment
import json
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
    
    # 1. Bog'liq ma'lumotlarni yig'ish
    payments = Payment.objects.filter(student=student)
    
    # 2. Student ma'lumotlarini dict qilish va sanalarni tozalash
    student_data = model_to_dict(student)
    cleaned_student_data = json_serializable_convert(student_data)
    
    # Qo'shimcha ID larni qo'shish
    cleaned_student_data["branch_id"] = student.branch_id
    cleaned_student_data["group_id"] = student.group_id
    
    # 3. Bog'langan ma'lumotlarni tozalab qo'shish
    cleaned_student_data["payments"] = serialize_related(payments)

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
    group_data = model_to_dict(group)
    group_data = json_serializable_convert(group_data)
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
    """
    Arxivlangan studentni qayta tiklash.
    Metadata dan barcha ma'lumotlarni olib, yangi Student obyekti yaratadi.
    """
    from groups.models import Student, Group
    from branches.models import Branch
    
    archived = ArchivedStudent.objects.get(id=archived_student_id)
    metadata = archived.metadata
    
    # Branch va Group ni topish (agar mavjud bo'lsa)
    branch = None
    branch_id = metadata.get('branch_id') or metadata.get('branch')
    if branch_id:
        branch = Branch.objects.filter(id=branch_id).first()
    
    group = None
    group_id = metadata.get('group_id') or metadata.get('group')
    if group_id:
        group = Group.objects.filter(id=group_id).first()
        
    # Agar ID orqali topilmasa yoki saqlanmagan bo'lsa, nomi orqali qidiramiz (Yangi logika)
    if not group and archived.last_group_name and archived.last_group_name != "Guruhsiz":
        # Avval joriy filial (branch) dagi shunday nomli faol guruhni izlaymiz
        if branch:
            group = Group.objects.filter(name__iexact=archived.last_group_name, branch=branch, is_archived=False).first()
        # Topilmasa umuman hamma filiallardan izlab ko'ramiz
        if not group:
            group = Group.objects.filter(name__iexact=archived.last_group_name, is_archived=False).first()
    
    # 1. Soft-archived student bazada mavjudmi? (Tarix va ID saqlanishi uchun)
    student = Student.objects.filter(id=archived.original_id).first()
    if student:
        student.is_archived = False
        student.is_active = True
        student.archived_at = None
        if branch:
            student.branch = branch
        if group:
            student.group = group
            if not student.branch:
                student.branch = group.branch
        student.save()
        
        if group:
            from groups.models import GroupEnrollment
            enrollment, created = GroupEnrollment.objects.get_or_create(
                student=student, group=group, defaults={"is_active": True, "left_at": None}
            )
            if not created and (not enrollment.is_active or enrollment.left_at is not None):
                enrollment.is_active = True
                enrollment.left_at = None
                enrollment.save(update_fields=['is_active', 'left_at'])
                
        archived.delete()
        return student

    # 2. Hard-deleted student (orqaga moslik uchun):
    student = Student.objects.create(
        full_name=archived.full_name,
        branch=branch,
        group=group,
        phone=metadata.get('phone', ''),
        birth_date=metadata.get('birth_date'),
        parent_name=metadata.get('parent_name', ''),
        parent_phone=metadata.get('parent_phone', ''),
        address=metadata.get('address', ''),
        notes=metadata.get('notes', ''),
        color=metadata.get('color', '#ffffff'),
        status=metadata.get('status', 'regular'),
        telegram_id=metadata.get('telegram_id'),
        parent_telegram_id=metadata.get('parent_telegram_id'),
        custom_fee=metadata.get('custom_fee'),
    )

    # Many-to-Many bog'liqlikni ham tiklaymiz
    if group:
        from groups.models import GroupEnrollment
        enrollment, created = GroupEnrollment.objects.get_or_create(
            student=student, group=group, defaults={"is_active": True, "left_at": None}
        )
        if not created and (not enrollment.is_active or enrollment.left_at is not None):
            enrollment.is_active = True
            enrollment.left_at = None
            enrollment.save(update_fields=['is_active', 'left_at'])

    # Metadata dagi to'lovlarni tiklash
    saved_payments = metadata.get('payments', [])
    for p_data in saved_payments:
        try:
            m_date = p_data.get('month')
            if isinstance(m_date, str):
                try:
                    m_date = datetime.strptime(m_date[:10], '%Y-%m-%d').date()
                except Exception:
                    pass
            Payment.objects.create(
                student=student,
                group_id=p_data.get('group'),
                month=m_date,
                amount=p_data.get('amount'),
                paid_amount=p_data.get('paid_amount', 0),
                is_paid=p_data.get('is_paid', False),
                is_partial=p_data.get('is_partial', False),
                payment_method=p_data.get('payment_method', 'cash'),
                notes=p_data.get('notes', ''),
                is_auto_discount=p_data.get('is_auto_discount', False),
            )
        except Exception:
            pass

    # Yetim qolgan Attendance, Homework, MockTest, FinanceTransaction larni qayta ulash
    from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult
    from finance.models import FinanceTransaction
    from django.db.models import Q
    att_qs = Attendance.objects.filter(
        Q(student__isnull=True) | Q(student_id=archived.original_id),
        student_full_name=student.full_name
    )
    if student.branch:
        att_qs = att_qs.filter(Q(group__branch=student.branch) | Q(group__isnull=True))
    att_qs.update(student=student)

    hw_qs = HomeworkSubmission.objects.filter(
        Q(student__isnull=True) | Q(student_id=archived.original_id),
        student_full_name=student.full_name
    )
    if student.branch:
        hw_qs = hw_qs.filter(Q(homework__group__branch=student.branch) | Q(homework__group__isnull=True))
    hw_qs.update(student=student)

    mock_qs = MockTestResult.objects.filter(
        Q(student__isnull=True) | Q(student_id=archived.original_id),
        student_full_name=student.full_name
    )
    if student.branch:
        mock_qs = mock_qs.filter(Q(test__group__branch=student.branch) | Q(test__group__isnull=True))
    mock_qs.update(student=student)

    tx_qs = FinanceTransaction.objects.filter(
        Q(student__isnull=True) | Q(student_id=archived.original_id),
        student_name=student.full_name
    )
    if student.branch:
        tx_qs = tx_qs.filter(Q(branch=student.branch) | Q(branch__isnull=True))
    tx_qs.update(student=student)

    if student.telegram_id:
        try:
            from telegram_bot.models import BotProfile
            BotProfile.objects.update_or_create(
                telegram_id=student.telegram_id,
                defaults={
                    'student': student,
                    'phone_number': student.phone or '',
                    'role': 'student',
                    'is_active': True,
                }
            )
        except Exception:
            pass

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
    """
    Arxivlangan guruhni va uning o'quvchilarini qayta tiklash.

    ⚠️ BUG FIX #2: Avvalgi versiya faqat guruh strukturasini tiklardi,
    o'quvchilar va ularning GroupEnrollment yozuvlari tiklanmasdi.
    Endi arxivdagi studentlar ham qayta tiklanadi va guruhga biriktiriladi.

    Qaytaradi:
        dict: {
            'group': Group instance,
            'restored_students': int,
            'skipped_students': int,
            'errors': list[str]
        }
    """
    from groups.models import Group, GroupEnrollment, Student
    from branches.models import Branch
    from django.contrib.auth import get_user_model
    import logging
    logger = logging.getLogger(__name__)
    User = get_user_model()

    archived = ArchivedGroup.objects.get(id=archived_group_id)
    metadata = archived.metadata

    # --- Branch va Mentorni bazadan topish ---
    branch = None
    if metadata.get('branch'):
        branch = Branch.objects.filter(id=metadata['branch']).first()

    mentor = None
    if metadata.get('mentor'):
        mentor = User.objects.filter(id=metadata['mentor'], role='mentor').first()

    admin = None
    if metadata.get('admin'):
        admin = User.objects.filter(id=metadata['admin']).first()

    # --- Guruhni qayta yaratish ---
    group = Group.objects.create(
        name=archived.full_name,
        branch=branch,
        mentor=mentor,
        admin=admin,
        monthly_price=metadata.get('monthly_price', 0),
        subject=archived.subject,
        course_time=metadata.get('course_time', ''),
        dars_kunlari=metadata.get('dars_kunlari', ''),
        days=metadata.get('days', 'odd'),
        dars_vaqti=metadata.get('dars_vaqti', ''),
        description=metadata.get('description', ''),
        is_faol=metadata.get('is_faol', True),
        color=metadata.get('color', '#ffffff'),
    )
    logger.info(f"[GroupRestore] Guruh qayta yaratildi: '{group.name}' (yangi ID={group.id})")

    # -------------------------------------------------------------------
    # BUG FIX #2 — Arxivlangan o'quvchilarni ham tiklash
    #
    # Arxivlashda metadata['archived_student_ids'] saqlangan bo'lsa,
    # shu ID lar bo'yicha ArchivedStudent jadvalidan topib tiklaymiz.
    # -------------------------------------------------------------------
    restored_count = 0
    skipped_count = 0
    errors = []

    archived_student_ids = metadata.get('archived_student_ids', [])

    if archived_student_ids:
        logger.info(
            f"[GroupRestore] {len(archived_student_ids)} ta arxivlangan student tiklanmoqda..."
        )
        # Yangi format: arxivlash paytida ArchivedStudent.id lari saqlangan
        archived_record_ids = metadata.get('archived_student_record_ids', [])
        
        for i, orig_student_id in enumerate(archived_student_ids):
            try:
                # 1-usul: to'g'ridan-to'g'ri ArchivedStudent.id bo'yicha (yangi format)
                archived_student = None
                if archived_record_ids and i < len(archived_record_ids):
                    archived_student = ArchivedStudent.objects.filter(
                        id=archived_record_ids[i]
                    ).first()
                
                # 2-usul: original_id bo'yicha (eski format, backward compatibility)
                if not archived_student and orig_student_id:
                    archived_student = ArchivedStudent.objects.filter(
                        original_id=orig_student_id
                    ).order_by('-archived_at').first()

                if not archived_student:
                    logger.warning(
                        f"[GroupRestore] Student (orig_id={orig_student_id}) arxivda topilmadi — o'tkazib yuborildi."
                    )
                    skipped_count += 1
                    continue

                # restore_student_from_archive ichidagi logikadan foydalanib
                # student tiklaymiz, lekin guruhni o'zimiz belgilaymiz
                student_meta = archived_student.metadata

                # Branch: avval student o'z branchini saqlaydi,
                # aks holda tiklangan guruh branchini ishlatamiz
                student_branch = branch
                if student_meta.get('branch_id'):
                    from branches.models import Branch as Br
                    student_branch = Br.objects.filter(
                        id=student_meta['branch_id']
                    ).first() or branch

                student = Student.objects.create(
                    full_name=archived_student.full_name,
                    branch=student_branch,
                    group=group,   # legacy FK — tiklangan guruhga
                    phone=student_meta.get('phone', ''),
                    birth_date=student_meta.get('birth_date'),
                    parent_name=student_meta.get('parent_name', ''),
                    parent_phone=student_meta.get('parent_phone', ''),
                    address=student_meta.get('address', ''),
                    notes=student_meta.get('notes', ''),
                    color=student_meta.get('color', '#ffffff'),
                    status=student_meta.get('status', 'regular'),
                    telegram_id=student_meta.get('telegram_id'),
                    parent_telegram_id=student_meta.get('parent_telegram_id'),
                    custom_fee=student_meta.get('custom_fee'),
                )

                # GroupEnrollment yaratish (M2M)
                # BUG #6 FIX: Agar eski is_active=False enrollment mavjud bo'lsa, uni yoqamiz.
                enr, enr_created = GroupEnrollment.objects.get_or_create(
                    student=student,
                    group=group,
                    defaults={"is_active": True}
                )
                if not enr_created and not enr.is_active:
                    enr.is_active = True
                    enr.save(update_fields=['is_active'])

                # Arxiv yozuvini o'chiramiz (aralashib ketmasligi uchun)
                archived_student.delete()

                restored_count += 1
                logger.info(
                    f"[GroupRestore] Student '{student.full_name}' (yangi ID={student.id}) tiklandi."
                )

            except Exception as exc:
                error_msg = (
                    f"Student orig_id={orig_student_id} tiklashda xato: {exc}"
                )
                logger.error(f"[GroupRestore] {error_msg}")
                errors.append(error_msg)
    else:
        logger.info(
            "[GroupRestore] metadata['archived_student_ids'] topilmadi — "
            "eski format arxiv, studentlar alohida tiklanishi kerak."
        )

    # -------------------------------------------------------------------
    # YANI QO'SHILGAN QISM: O'chirilmagan, lekin arxivlanganda guruhdan 
    # chiqarilgan o'quvchilarni yana guruhga bog'lab qo'yamiz.
    # -------------------------------------------------------------------
    multi_group_student_ids = metadata.get('multi_group_student_ids', [])
    if multi_group_student_ids:
        from groups.models import Student, GroupEnrollment
        logger.info(
            f"[GroupRestore] {len(multi_group_student_ids)} ta o'chirilmagan (boshqa guruhlarda qolgan) student tiklanmoqda..."
        )
        for s_id in multi_group_student_ids:
            try:
                student = Student.objects.filter(id=s_id).first()
                if student:
                    GroupEnrollment.objects.get_or_create(student=student, group=group)
                    restored_count += 1
                    logger.info(f"[GroupRestore] Multi-group Student '{student.full_name}' guruhga yana qo'shildi.")
                else:
                    skipped_count += 1
                    logger.warning(f"[GroupRestore] Multi-group Student (ID={s_id}) bazadan topilmadi (balki to'liq o'chirib yuborilgandir).")
            except Exception as exc:
                error_msg = f"Multi-group Student ID={s_id} tiklashda xato: {exc}"
                logger.error(f"[GroupRestore] {error_msg}")
                errors.append(error_msg)

    logger.info(
        f"[GroupRestore] Natija: guruh='{group.name}', "
        f"tiklandi={restored_count}, o'tkazildi={skipped_count}, xato={len(errors)}"
    )

    return {
        'group': group,
        'restored_students': restored_count,
        'skipped_students': skipped_count,
        'errors': errors,
    }


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
    
    # 1. Bog'liq ma'lumotlarni yig'ish
    from finance.models import Payment
    payments = Payment.objects.filter(student=student)
    
    # 2. Student ma'lumotlarini dict qilish va sanalarni tozalash
    student_data = model_to_dict(student)
    cleaned_student_data = json_serializable_convert(student_data)
    
    # Qo'shimcha ID larni qo'shish
    cleaned_student_data["branch_id"] = student.branch_id
    cleaned_student_data["group_id"] = student.group_id
    
    # 3. Bog'langan ma'lumotlarni tozalab qo'shish
    cleaned_student_data["payments"] = serialize_related(payments)

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
