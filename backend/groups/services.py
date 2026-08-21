import logging
from django.db import transaction, IntegrityError
from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Group, Student, GroupEnrollment, GroupTransfer, WaitingStudent
from finance.models import Payment, FinanceTransaction
from homework_attends.models import Attendance, HomeworkSubmission, MockTestResult

logger = logging.getLogger(__name__)

def enroll_student_to_group(group, student_id, create_payment=True):
    """O'quvchini guruhga biriktirish logikasi"""
    student = get_object_or_404(Student, id=student_id)
    
    with transaction.atomic():
        enrollment, created = GroupEnrollment.objects.get_or_create(
            student=student,
            group=group
        )
        
        if created:
            # Legacy FK field support
            if not student.group:
                student.group = group
                student.save()
            
            if create_payment:
                from finance.utils import floor_amount
                today = timezone.now().date()
                month_start = today.replace(day=1)
                # User talabi: Advanced guruhda negotiated statusi o'tmaydi
                if group.group_type == 'advanced' and student.status == 'negotiated':
                    base_price = group.monthly_price
                elif student.status in ['low_income', 'negotiated']:
                    base_price = student.custom_fee if student.custom_fee is not None else Decimal('0')
                else:
                    base_price = group.monthly_price
                
                final_amount = floor_amount(base_price)

                p_obj, p_created = Payment.objects.get_or_create(
                    student=student,
                    group=group,
                    month=month_start,
                    defaults={
                        'amount': final_amount,
                        'is_paid': False
                    }
                )
                if not p_created and not p_obj.is_paid:
                    p_obj.amount = final_amount
                    p_obj.save()
        else:
            # Agar enrollment avvaldan bor bo'lsa, u is_active=False bo'lishi mumkin
            if not enrollment.is_active:
                enrollment.is_active = True
                enrollment.save()
            
            # Agar o'quvchining asosiy guruhi bo'lmasa, uni shu guruhga ulaymiz
            if not student.group:
                student.group = group
                student.save()
                
        from finance.services import sync_mentor_salary
        sync_mentor_salary(group)
                    
        return enrollment, created

def unenroll_student_from_group(group, student_id, request_user):
    """O'quvchini guruhdan chiqarish logikasi"""
    student = get_object_or_404(Student, id=student_id)
    enrollment = GroupEnrollment.objects.filter(student=student, group=group).first()
    
    if not enrollment:
        raise ValueError("Ushbu o'quvchi bu guruhda emas")

    with transaction.atomic():
        # Enrollmentni delete emas, faqat is_active=False qilamiz (tarix saqlanadi)
        enrollment.is_active = False
        enrollment.save()

        # BUG FIX: O'quvchi guruhdan chiqarilganda, shu guruhga tegishli
        # uy vazifa va mock-test yozuvlarini tozalaymiz.
        # Faqat NOT_SUBMITTED holatidagilar o'chiriladi — bajarilgan yozuvlar
        # tarixiy ma'lumot sifatida saqlanadi.
        # Bu Telegram botning guruhdan chiqqan o'quvchilarga xabar yuborishini to'xtatadi.
        from homework_attends.models import HomeworkSubmission, MockTestResult
        HomeworkSubmission.objects.filter(
            student=student,
            homework__group=group,
            status=HomeworkSubmission.NOT_SUBMITTED
        ).delete()
        # MockTestResult uchun: natija kiritilmagan (bo'sh score) yozuvlarni o'chiramiz
        MockTestResult.objects.filter(
            student=student,
            test__group=group,
            score=''
        ).delete()
        
        # QuerySet keshlanib qolmasligi uchun bevosita DB dan tekshiramiz
        has_other_groups = GroupEnrollment.objects.filter(student=student, is_active=True).exists()
        
        if not has_other_groups:
            # Oxirgi guruhi bo'lsa - Arxivga o'tkazamiz va Waiting Hall ga qo'shamiz
            from archivebase.services import move_student_to_waiting_hall
            move_student_to_waiting_hall(student, request_user, reason=f"{group.name} guruhidan chiqarildi", branch=group.branch)
            
            from finance.services import sync_mentor_salary
            sync_mentor_salary(group)
            
            return "waiting_hall"
        else:
            # Boshqa guruhlari bo'lsa ham, ushbu filial kutish zaliga nusxa qo'shamiz (User talabi)
            from groups.models import WaitingStudent
            WaitingStudent.objects.create(
                full_name=student.full_name,
                phone=student.phone,
                branch=group.branch,
                notes=f"{group.name} guruhidan chiqarildi | Tizimda boshqa guruhlarda faol",
                telegram_id=student.telegram_id,
                parent_telegram_id=student.parent_telegram_id
            )
            
            # BUG #1 FIX: Faqat is_active=True bo'lgan enrollment olinadi.
            # Avval is_active filtrisiz edi — hozirgina is_active=False qilingan
            # enrollment qaytarib olinardi va student.group noto'g'ri bo'lib qolardi.
            next_enrollment = GroupEnrollment.objects.filter(student=student, is_active=True).first()
            if next_enrollment:
                student.group = next_enrollment.group
                # Branchni ham qolgan guruhga moslaymiz
                student.branch = next_enrollment.group.branch
                student.save()
                
            from finance.services import sync_mentor_salary
            sync_mentor_salary(group)
                
            return "active_elsewhere"

def transfer_student_to_group(student, new_group_id, request_user, reason, from_group_id=None):
    """O'quvchini bir guruhdan boshqasiga o'tkazish (Davomat, To'lov, Vazifalar, Testlarni ham ko'chiradi)"""
    new_group = get_object_or_404(Group, id=new_group_id)
    
    if from_group_id:
        old_group = get_object_or_404(Group, id=from_group_id)
    else:
        old_group = student.group

    if not old_group:
        raise ValueError("O'quvchi hozirda bironta guruhda emas")
        
    if old_group == new_group:
        raise ValueError("O'quvchi allaqachon ushbu guruhda")

    with transaction.atomic():
        from finance.utils import floor_amount
        today = timezone.now().date()
        current_month_start = today.replace(day=1)

        # 0. Snapshot fees (User talabi: Advanced guruh qoidasi bilan)
        def get_effective_fee(st, gr):
            if gr.group_type == 'advanced' and st.status == 'negotiated':
                return gr.monthly_price
            if st.status in ['low_income', 'negotiated']:
                return st.custom_fee if st.custom_fee is not None else Decimal('0')
            # BUG FIX: 'discount' o'quvchilar uchun to'lov davomatga qarab hisoblanadi,
            # bu yerda esa snapshot narxi sifatida guruh narxini olamiz.
            # Asl hisob transfer tugagach qayta amalga oshiriladi (pastda).
            if st.status == 'discount':
                return gr.monthly_price
            return gr.monthly_price

        old_group_fee = floor_amount(get_effective_fee(student, old_group))
        new_group_fee = floor_amount(get_effective_fee(student, new_group))

        # 1. Enrollmentlar bilan ishlash
        old_enrollment = GroupEnrollment.objects.filter(student=student, group=old_group).first()
        if old_enrollment:
            old_enrollment.is_active = False
            old_enrollment.save()
        new_enrollment, _ = GroupEnrollment.objects.get_or_create(student=student, group=new_group)
        if not new_enrollment.is_active:
            new_enrollment.is_active = True
            new_enrollment.save()

        # 2. To'lovni hisoblash (Prorated)
        old_lesson_dates = old_group.get_lesson_dates(current_month_start.year, current_month_start.month)
        new_lesson_dates = new_group.get_lesson_dates(current_month_start.year, current_month_start.month)
        
        passed_old_lessons = [d for d in old_lesson_dates if d <= today]
        remaining_new_lessons = [d for d in new_lesson_dates if d > today]
        
        if student.status == 'discount':
            from finance.utils import calculate_attendance_based_student_payment
            old_amount = calculate_attendance_based_student_payment(student, old_group, current_month_start)
            new_amount = calculate_attendance_based_student_payment(student, new_group, current_month_start)
        else:
            old_daily = Decimal(str(old_group_fee)) / Decimal(str(max(1, len(old_lesson_dates))))
            old_amount = floor_amount(old_daily * len(passed_old_lessons))
            
            new_daily = Decimal(str(new_group_fee)) / Decimal(str(max(1, len(new_lesson_dates))))
            new_amount = floor_amount(new_daily * len(remaining_new_lessons))

        # Update Old Payment
        old_payment = Payment.objects.filter(student=student, group=old_group, month=current_month_start).first()
        excess_paid = Decimal("0")
        
        if old_payment:
            if old_payment.paid_amount > old_amount:
                excess_paid = old_payment.paid_amount - old_amount
                old_payment.paid_amount = old_amount
                old_payment.amount = old_amount
                old_payment.is_paid = True
                old_payment.is_partial = False
            else:
                old_payment.amount = old_amount
                if old_payment.paid_amount >= old_amount and old_amount > 0:
                    old_payment.is_paid = True
                    old_payment.is_partial = False
                elif old_payment.paid_amount > 0:
                    old_payment.is_paid = False
                    old_payment.is_partial = True
                else:
                    old_payment.is_paid = False
                    old_payment.is_partial = False
                    
            old_payment.save()
        else:
            if old_amount > 0:
                Payment.objects.create(
                    student=student, group=old_group, month=current_month_start,
                    amount=old_amount, is_paid=False, is_partial=False
                )

        # Update New Payment
        existing_new = Payment.objects.filter(student=student, group=new_group, month=current_month_start).first()
        
        if existing_new:
            existing_new.amount = new_amount
            existing_new.paid_amount += excess_paid
            if existing_new.paid_amount >= new_amount and new_amount > 0:
                existing_new.is_paid = True
                existing_new.is_partial = False
            elif existing_new.paid_amount > 0:
                existing_new.is_paid = False
                existing_new.is_partial = True
            else:
                existing_new.is_paid = False
                existing_new.is_partial = False
            existing_new.save()
        else:
            p_obj = Payment(
                student=student, group=new_group, month=current_month_start,
                amount=new_amount, paid_amount=excess_paid
            )
            if p_obj.paid_amount >= new_amount and new_amount > 0:
                p_obj.is_paid = True
                p_obj.is_partial = False
            elif p_obj.paid_amount > 0:
                p_obj.is_paid = False
                p_obj.is_partial = True
            else:
                p_obj.is_paid = False
                p_obj.is_partial = False
            p_obj.save()

        # 3. Davomat, Uy vazifalari va Tranzaksiyalar o'z guruhida qoladi (Tarix saqlanishi uchun)
        
        # 6. Transfer log
        GroupTransfer.objects.create(
            student=student,
            from_group=old_group,
            to_group=new_group,
            transfer_date=today,
            reason=reason,
            marked_by=request_user,
            old_group_fee=old_group_fee,
            new_group_fee=new_group_fee
        )

        # 7. Student model yangilash (agar student.group shu eski guruh bo'lsa yoki umuman bo'lmasa)
        if student.group == old_group or not student.group:
            student.group = new_group
            
            # Agar o'quvchining eski filialida boshqa faol guruhlari qolmagan bo'lsagina profil filiali o'zgaradi
            has_other_groups_in_old_branch = GroupEnrollment.objects.filter(
                student=student,
                group__branch=old_group.branch,
                is_active=True
            ).exclude(group=old_group).exists()
            
            if not has_other_groups_in_old_branch:
                student.branch = new_group.branch
                
            student.save()
            
        from finance.services import sync_mentor_salary
        sync_mentor_salary(old_group, current_month_start)
        sync_mentor_salary(new_group, current_month_start)
        
    return True

def merge_student_profiles(master, duplicate_id):
    """Ikki o'quvchi profilini birlashtirish"""
    duplicate = get_object_or_404(Student, id=duplicate_id)
    
    with transaction.atomic():
        # 1. Enrollments
        for enrollment in duplicate.enrollments.all():
            GroupEnrollment.objects.get_or_create(student=master, group=enrollment.group)
        
        # 2. Attendance
        Attendance.objects.filter(student=duplicate).update(student=master)
        # Handle unique conflicts for same date/lesson
        attendances = Attendance.objects.filter(student=duplicate)
        for attr in attendances:
            try:
                attr.student = master
                attr.save()
            except IntegrityError:
                attr.delete()

        # 3. Homework & Results
        HomeworkSubmission.objects.filter(student=duplicate).update(student=master)
        MockTestResult.objects.filter(student=duplicate).update(student=master)

        # 4. Finance
        Payment.objects.filter(student=duplicate).update(student=master)
        FinanceTransaction.objects.filter(student=duplicate).update(student=master)

        # 5. History
        GroupTransfer.objects.filter(student=duplicate).update(student=master)

        # 6. Metadata merge
        if not master.telegram_id: master.telegram_id = duplicate.telegram_id
        if not master.parent_telegram_id: master.parent_telegram_id = duplicate.parent_telegram_id
        
        master.notes = f"{master.notes or ''}\n[MERGED FROM {duplicate.id}]: {duplicate.notes or ''}".strip()
        master.save()

        # 7. Delete duplicate
        duplicate.delete()
        
    return master

def assign_waiting_student_to_group(waiting_student, group_id, request_user):
    """Kutish zalidagi o'quvchini guruhga biriktirish"""
    group = get_object_or_404(Group, id=group_id)
    with transaction.atomic():
        from archivebase.models import ArchivedStudent
        from archivebase.services import restore_student_from_archive
        import re
        
        # 1. Avval faol o'quvchilar orasidan qidiramiz (Dublikatni oldini olish uchun)
        student = Student.objects.filter(
            full_name=waiting_student.full_name,
            phone=waiting_student.phone
        ).first()

        # Telefon raqami formati har xil bo'lsa, tozalab qidiramiz (Senior Fix)
        if not student and waiting_student.phone:
            clean_p = re.sub(r'\D', '', waiting_student.phone)
            if len(clean_p) >= 9:
                last_9 = clean_p[-9:]
                candidates = Student.objects.filter(full_name=waiting_student.full_name)
                for cand in candidates:
                    if cand.phone:
                        cand_clean = re.sub(r'\D', '', cand.phone)
                        if cand_clean.endswith(last_9):
                            student = cand
                            break

        if student:
            # O'quvchi allaqachon mavjud bo'lsa, uning guruhini yangilab qo'yamiz (agar bo'sh bo'lsa)
            if not student.group:
                student.group = group
                student.branch = group.branch
                student.save()
        else:
            # 2. Arxivdan qidiramiz
            archived = None
            
            # A) Birinchi navbatda Oldingi ID orqali qidirib ko'ramiz (Senior Fix - eng aniq bog'liqlik)
            old_id_match = re.search(r"Oldingi ID:\s*(\d+)", waiting_student.notes or "")
            if old_id_match:
                old_id = int(old_id_match.group(1))
                archived = ArchivedStudent.objects.filter(original_id=old_id).order_by('-archived_at').first()
            
            # B) Agar ID orqali topilmasa, ism va telefon raqami bo'yicha aniq moslikni qidiramiz
            if not archived:
                archived = ArchivedStudent.objects.filter(
                    full_name=waiting_student.full_name,
                    metadata__phone=waiting_student.phone
                ).order_by('-archived_at').first()
            
            # C) Agar hali ham topilmasa, telefon raqami formatidan qat'i nazar oxirgi 9 ta raqam bo'yicha qidiramiz
            if not archived and waiting_student.phone:
                clean_p = re.sub(r'\D', '', waiting_student.phone)
                if len(clean_p) >= 9:
                    last_9 = clean_p[-9:]
                    name_matches = ArchivedStudent.objects.filter(full_name=waiting_student.full_name)
                    for candidate in name_matches:
                        cand_phone = candidate.metadata.get('phone') or ""
                        cand_clean = re.sub(r'\D', '', cand_phone)
                        if cand_clean.endswith(last_9):
                            archived = candidate
                            break

            if archived:
                student = restore_student_from_archive(archived.id, request_user)
                student.group = group
                student.branch = group.branch
                student.save()
                archived.delete()
            else:
                # 3. Mutlaqo yangi o'quvchi
                student = Student.objects.create(
                    branch=group.branch,
                    group=group,
                    full_name=waiting_student.full_name,
                    phone=waiting_student.phone,
                    notes=waiting_student.notes,
                    telegram_id=waiting_student.telegram_id,
                    parent_telegram_id=waiting_student.parent_telegram_id
                )
        
        # Many-to-Many link
        GroupEnrollment.objects.get_or_create(student=student, group=group)
        waiting_student.delete()
        
    return student


def cancel_lesson_day(group, date, request_user, reason=""):
    """Guruh uchun dars kuni bekor qilish"""
    import logging
    logger = logging.getLogger(__name__)
    from .models import CanceledLessonDay
    from finance.models import EmployeePayment
    with transaction.atomic():
        canceled, created = CanceledLessonDay.objects.get_or_create(
            group=group,
            date=date,
            defaults={
                'canceled_by': request_user,
                'reason': reason
            }
        )
        if not created:
            canceled.reason = reason
            canceled.canceled_by = request_user
            canceled.save()
        
        # Mentor oyligini qayta hisoblash
        if group.mentor and hasattr(group.mentor, 'staff_profile'):
            try:
                payment_month = date.replace(day=1)
                emp_payment = EmployeePayment.objects.filter(
                    employee=group.mentor,
                    month=payment_month,
                    is_paid=False
                ).first()
                
                if emp_payment:
                    emp_payment.recalculate_salary()
                    emp_payment.save()
                else:
                    # To'lov mavjud emas, yangi yaratish
                    emp_payment, _ = EmployeePayment.objects.get_or_create(
                        employee=group.mentor,
                        month=payment_month,
                        defaults={
                            'salary_base': 0,
                            'bonus': 0,
                            'deductions': 0,
                            'is_paid': False,
                            'attendance_deductions': {}
                        }
                    )
                    emp_payment.recalculate_salary()
                    emp_payment.save()
            except Exception as e:
                logger.exception("Mentor oyligini yangilashda xatolik")
        
        return canceled, created


def reactivate_lesson_day(group, date, request_user):
    """Guruh uchun bekor qilingan dars kunini qayta faollashtirish"""
    import logging
    logger = logging.getLogger(__name__)
    from .models import CanceledLessonDay
    from finance.models import EmployeePayment
    with transaction.atomic():
        canceled = CanceledLessonDay.objects.filter(group=group, date=date).first()
        if canceled:
            canceled.delete()
            
            # Mentor oyligini qayta hisoblash
            if group.mentor and hasattr(group.mentor, 'staff_profile'):
                try:
                    payment_month = date.replace(day=1)
                    emp_payment = EmployeePayment.objects.filter(
                        employee=group.mentor,
                        month=payment_month,
                        is_paid=False
                    ).first()
                    
                    if emp_payment:
                        emp_payment.recalculate_salary()
                        emp_payment.save()
                    else:
                        # To'lov mavjud emas, yangi yaratish
                        emp_payment, _ = EmployeePayment.objects.get_or_create(
                            employee=group.mentor,
                            month=payment_month,
                            defaults={
                                'salary_base': 0,
                                'bonus': 0,
                                'deductions': 0,
                                'is_paid': False,
                                'attendance_deductions': {}
                            }
                        )
                        emp_payment.recalculate_salary()
                        emp_payment.save()
                except Exception as e:
                    logger.exception("Mentor oyligini yangilashda xatolik")
            
            return True
        else:
            return False
