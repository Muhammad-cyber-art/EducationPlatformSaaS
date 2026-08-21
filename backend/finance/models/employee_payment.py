from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


def _student_contract_monthly(student, group):
    """
    O'quvchi uchun oylik shartnoma narxi (kelishilgan/custom_fee yoki guruh narxi).
    Davomat jarimasining kunlik asosini shu qiymatdan olamiz — har doim guruh.monthly_price emas.
    """
    cf = getattr(student, "custom_fee", None)
    if cf is not None:
        return Decimal(str(cf))
    return Decimal(str(group.monthly_price or 0))


class MentorGroupSalaryConfig(models.Model):
    """Mentor uchun guruhga xos maosh konfiguratsiyasi"""

    SALARY_TYPE_CHOICES = [
        ("percentage", "Foiz asosida (%)"),
        ("student_count", "O'quvchilar soni bo'yicha (so'm/o'quvchi)"),
    ]

    mentor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_salary_configs",
        verbose_name="Mentor",
    )

    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="mentor_salary_configs",
        verbose_name="Guruh",
    )

    salary_type = models.CharField(
        max_length=20, choices=SALARY_TYPE_CHOICES, verbose_name="Maosh turi"
    )

    commission_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="Komissiya foizi (%)",
        help_text="Faqat 'Foiz asosida' turida ishlatiladi",
    )

    per_student_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="Har bir o'quvchi uchun (so'm)",
        help_text="Faqat 'O'quvchilar soni bo'yicha' turida ishlatiladi",
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Yangilangan")

    class Meta:
        unique_together = ("mentor", "group")
        verbose_name = "Guruh uchun mentor maoshi konfiguratsiyasi"
        verbose_name_plural = "Guruhlar uchun mentor maoshi konfiguratsiyalari"

    def __str__(self):
        return (
            f"{self.mentor.get_full_name() or self.mentor.username} - {self.group.name}"
        )

    def clean(self):
        # Clean method'da validation qilamiz
        from django.core.exceptions import ValidationError

        if self.mentor.role != "mentor":
            raise ValidationError(
                {"mentor": "Faqat mentorlar uchun konfiguratsiya yaratilishi mumkin"}
            )


class EmployeePayment(models.Model):
    """Xodimlar (mentor va admin) uchun oylik maosh to'lovlari"""

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="salary_payments",
        limit_choices_to={"role__in": ["mentor", "admin"]},
    )

    month = models.DateField(verbose_name="Oy")

    salary_base = models.DecimalField(
        max_digits=20, decimal_places=2, verbose_name="Asosiy maosh"
    )
    bonus = models.DecimalField(
        max_digits=20, decimal_places=2, default=0, verbose_name="Bonus"
    )
    deductions = models.DecimalField(
        max_digits=20, decimal_places=2, default=0, verbose_name="Ayirmalar"
    )

    attendance_deductions = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="Davomat bo'yicha ayirmalar",
        help_text="Har bir o'quvchi uchun davomat sababli qirqilgan summa tafsilotlari",
    )

    @property
    def total_advances(self) -> Decimal:
        """
        Ushbu oy uchun berilgan avanslar + o'tgan to'langan oylardan
        'kech' qolib o'tib kelgan avanslar yig'indisi.
        """
        from django.db.models import Sum

        from finance.models import EmployeeAdvance

        # 1. Shu oyga tegishli avanslar
        qs = EmployeeAdvance.objects.filter(employee=self.employee, month=self.month)

        if self.is_paid and self.paid_at:
            # Snapshot: To'langan vaqtgacha bo'lgan avanslar
            return (
                qs.filter(created_at__lte=self.paid_at).aggregate(total=Sum("amount"))[
                    "total"
                ]
                or 0
            )

        # TO'LANMAGAN OY UCHUN:
        total = qs.aggregate(total=Sum("amount"))["total"] or 0

        # Carry-over: O'tgan to'langan oylardan kech qolgan avanslarni yig'amiz
        last_paid = (
            EmployeePayment.objects.filter(
                employee=self.employee, month__lt=self.month, is_paid=True
            )
            .order_by("-month")
            .first()
        )

        if last_paid:
            # Eng oxirgi to'langan oydan keyin yaratilgan barcha 'eskirgan' avanslar
            late_advances = (
                EmployeeAdvance.objects.filter(
                    employee=self.employee,
                    month__lt=self.month,
                    created_at__gt=last_paid.paid_at,
                ).aggregate(total=Sum("amount"))["total"]
                or 0
            )
            total += late_advances
        else:
            # Agar hali birorta ham oy to'lanmagan bo'lsa, barcha o'tgan oylardagi avanslar shu oyga o'tadi
            late_advances = (
                EmployeeAdvance.objects.filter(
                    employee=self.employee, month__lt=self.month
                ).aggregate(total=Sum("amount"))["total"]
                or 0
            )
            total += late_advances

        return total

    @property
    def total_amount(self) -> Decimal:
        """Jami to'lov miqdori (floor)"""
        from finance.utils import floor_amount

        salary = Decimal(str(self.salary_base)) if self.salary_base else Decimal("0")
        bonus = Decimal(str(self.bonus)) if self.bonus else Decimal("0")
        deductions = Decimal(str(self.deductions)) if self.deductions else Decimal("0")
        total_advances = Decimal(str(self.total_advances))

        return floor_amount(salary + bonus - deductions - total_advances)

    is_paid = models.BooleanField(default=False, verbose_name="To'landi")
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name="To'langan vaqt")

    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marked_employee_payments",
        limit_choices_to={"role": "super_admin"},
        verbose_name="Kim tomonidan tasdiqlandi",
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")

    class Meta:
        unique_together = ("employee", "month")
        ordering = ["-month"]
        verbose_name = "Xodim maoshi"
        verbose_name_plural = "Xodimlar maoshlari"

    def __str__(self):
        return f"{self.employee.get_full_name() or self.employee.username} - {self.month.strftime('%B %Y')}"

    def mark_as_paid(self, super_admin_user):
        """To'lovni tasdiqlashda summani qulflash (snapshot)"""
        from django.db import transaction

        with transaction.atomic():
            if not self.is_paid:
                # To'lanayotgan paytda oxirgi marta qayta hisoblab olish (ixtiyoriy, lekin aniqlik uchun yaxshi)
                try:
                    if hasattr(self.employee, "staff_profile"):
                        st = self.employee.staff_profile.salary_type
                        # Foiz — mentor va admin; o'quvchi soni — faqat mentor guruhlari bilan
                        if st == "percentage" or (
                            st == "student_count" and self.employee.role == "mentor"
                        ):
                            self.recalculate_salary()
                except Exception as e:
                    # Agar qayta hisoblashda xatolik bo'lsa, davom etamiz
                    print(f"Recalculate error: {e}")

                self.is_paid = True
                self.paid_at = timezone.now()
                self.marked_by = super_admin_user
                self.save()

                # ✅ Centralized Finance Ledger ga yozish
                try:
                    # Branch mavjudligini tekshirish
                    if not self.employee.branch:
                        print(
                            f"Warning: Employee {self.employee.id} has no branch assigned"
                        )
                        return  # Transaction yaratmasdan chiqamiz

                    from finance.models import FinanceTransaction

                    FinanceTransaction.objects.get_or_create(
                        related_id=f"EMP-{self.id}",
                        defaults={
                            "transaction_type": "expense",
                            "category": "salary",
                            "amount": self.total_amount,
                            "date": self.paid_at.date(),
                            "marked_by": super_admin_user,
                            "branch": self.employee.branch,
                            "title": f"Maosh: {self.employee.get_full_name() or self.employee.username}",
                            "description": f"{self.month.strftime('%Y-%m')} oyi uchun xizmat haqi",
                        },
                    )
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.exception(f"FinanceTransaction creation error for {self.employee.username}: {e}")

    def recalculate_salary(self, commission_basis="paid"):
        """Maoshni StaffProfile bo'yicha qayta hisoblash"""
        if self.is_paid:
            return self.salary_base  # To'langan maoshni o'zgartirib bo'lmaydi

        try:
            profile = self.employee.staff_profile
            # calculate_salary_for_month metodidan foydalanamiz
            calculated_salary = profile.calculate_salary_for_month(self.month, commission_basis=commission_basis)
            # ✅ Decimal ga o'girish
            self.salary_base = Decimal(str(calculated_salary))
            # Davomat ayirmalarini tozalash (endi bu logika yo'q)
            self.attendance_deductions = {}
            return self.salary_base
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.exception(f"Recalculate salary error for {self.employee.username}: {e}")
            return self.salary_base

    def save(self, *args, **kwargs):
        # Month normalizatsiyasi
        if self.month:
            from finance.utils import normalize_month

            self.month = normalize_month(self.month)

        # ✅ Validatsiya: Xodimning staff_profile mavjudligini tekshirish
        if self.employee and not hasattr(self.employee, "staff_profile"):
            from django.core.exceptions import ValidationError

            raise ValidationError(
                f"Xodim {self.employee.get_full_name() or self.employee.username} uchun StaffProfile yaratilmagan. "
                f"Avval /finance/staff-profiles/ orqali profil yarating."
            )

        super().save(*args, **kwargs)


class StaffProfile(models.Model):
    """Xodimlar (mentor va admin) uchun doimiy ma'lumotlar"""

    SALARY_TYPE_CHOICES = [
        ("fixed", "Belgilangan oylik (so'm)"),
        ("percentage", "Foiz asosida (%)"),
        ("student_count", "O'quvchilar soni bo'yicha (so'm/o'quvchi)"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_profile",
        limit_choices_to={"role__in": ["mentor", "admin"]},
    )

    salary_type = models.CharField(
        max_length=20,
        choices=SALARY_TYPE_CHOICES,
        default="fixed",
        verbose_name="Maosh turi",
    )

    fixed_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="Belgilangan maosh (so'm)",
        help_text="Faqat 'Belgilangan oylik' turida ishlatiladi",
    )

    commission_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="Komissiya foizi (%)",
        help_text="Faqat 'Foiz asosida' turida ishlatiladi",
    )

    per_student_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name="Har bir o'quvchi uchun (so'm)",
        help_text="Faqat 'O'quvchilar soni bo'yicha' turida ishlatiladi",
    )

    karta = models.CharField(
        max_length=20, null=True, blank=True, verbose_name="Karta raqami"
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Yangilangan")

    class Meta:
        verbose_name = "Xodim profili"
        verbose_name_plural = "Xodimlar profillari"

    def __str__(self):
        if self.salary_type == "fixed":
            return f"{self.user.get_full_name() or self.user.username} - {self.fixed_salary:,.0f} so'm"
        elif self.salary_type == "percentage":
            return f"{self.user.get_full_name() or self.user.username} - {self.commission_percentage}%"
        else:
            return f"{self.user.get_full_name() or self.user.username} - {self.per_student_amount:,.0f} so'm/o'quvchi"

    def get_salary_display(self):
        """Maoshni chiroyli formatda ko'rsatish"""
        if self.salary_type == "fixed":
            return f"{int(self.fixed_salary):,} so'm".replace(",", ".")
        elif self.salary_type == "percentage":
            return f"{self.commission_percentage}% (foizdan)"
        else:
            return f"{int(self.per_student_amount):,} so'm (har bir o'quvchi uchun)".replace(
                ",", "."
            )

    def _get_group_salary_config(self, group):
        """Guruh uchun maosh konfiguratsiyasini oladi, agar mavjud bo'lmasa None qaytaradi"""
        return MentorGroupSalaryConfig.objects.filter(
            mentor=self.user, group=group
        ).first()

    def _collect_group_students(self, group):
        """Guruhdagi o'quvchilarni (yangi + legacy) dublikatsiz qaytaradi."""
        students_map = {}
        for enr in group.enrollments.select_related("student").all():
            if enr.student:
                students_map[enr.student.id] = enr.student
        for st in group.old_students_fk.all():
            students_map[st.id] = st
        return list(students_map.values())

    @staticmethod
    def _get_teacher_lesson_share(payment, month):
        """
        Bir studentning oylik to'lovini shu oyda real qatnashgan darslari
        asosida teacher'lar o'rtasida proporsional taqsimlaydi.

        Qaytaradi: {teacher_user_id: Decimal(share_amount)}

        Qoidalar:
        - Faqat is_present=True bo'lgan real davomat hisoblanadi.
        - total_lessons == 0 bo'lsa bo'linish xatosini oldini olish uchun {payment.group.mentor_id: payment.amount} qaytariladi.
        - Duplicate attendance yozuvlari unique_together (student, group, date) constraint bilan DB darajasida himoyalangan.
        - Rounding: floor_amount(1000 ga) ishlatiladi, qoldiq eng ko'p dars o'tgan o'qituvchiga qo'shiladi.
        """
        import math

        from homework_attends.models import Attendance

        from finance.utils import floor_amount

        student = payment.student
        year = payment.month.year
        month_num = payment.month.month
        payment_amount = Decimal(str(payment.amount or 0))

        # Edge case: to'lov nol bo'lsa bo'lish kerak emas
        if payment_amount <= 0:
            return {}

        # Studentning shu oydagi barcha guruhlaridagi real davomati
        att_qs = (
            Attendance.objects.filter(
                student=student,
                date__year=year,
                date__month=month_num,
                is_present=True,
            )
            .select_related("group__mentor")
            .values("group__mentor_id", "group_id")
            .annotate(lessons=models.Count("id"))
        )

        # {mentor_id: lesson_count}
        teacher_lessons: dict[int, int] = {}
        for row in att_qs:
            mentor_id = row["group__mentor_id"]
            if mentor_id is None:
                continue
            teacher_lessons[mentor_id] = (
                teacher_lessons.get(mentor_id, 0) + row["lessons"]
            )

        total_lessons = sum(teacher_lessons.values())

        # Edge case: davomat yo'q — to'lovni payment.group.mentor ga yubor (backward-compatible)
        if total_lessons == 0:
            fallback_mentor_id = payment.group.mentor_id if payment.group else None
            if fallback_mentor_id:
                return {fallback_mentor_id: payment_amount}
            return {}

        # Proporsional taqsimlash (floor 1000 ga)
        shares: dict[int, Decimal] = {}
        allocated = Decimal("0")

        # Saralash: qoldiqni eng katta hissali o'qituvchiga berish uchun deterministik tartib
        sorted_teachers = sorted(teacher_lessons.items(), key=lambda x: (-x[1], x[0]))

        for i, (mentor_id, lessons) in enumerate(sorted_teachers):
            if i == len(sorted_teachers) - 1:
                # Oxirgi o'qituvchiga qoldiqni bering (rounding xatosi to'planmasin)
                share = payment_amount - allocated
            else:
                raw = payment_amount * Decimal(lessons) / Decimal(total_lessons)
                share = floor_amount(raw)
            shares[mentor_id] = share
            allocated += share

        return shares

    def calculate_monthly_income(self, month):
        """
        Mentorning berilgan oydagi jami daromadini hisoblash.

        UNIFIED LOGIC: Barcha joyda bir xil hisoblash (serializer bilan mos)

        Qoidalar:
        1. Discount studentlar uchun: davomat asosida real tushum
        2. Negotiated studentlar uchun: faqat real to'langan summa (paid_amount)
        3. Oddiy (regular, low_income, teacher_negotiated) uchun: real to'langan summa
        4. Student_extra: qo'shimcha to'lovlar (har bir student-group uchun qo'shiladi)
        """
        from finance.utils import (
            calculate_attendance_based_student_payment,
            floor_amount,
        )

        # Admin uchun real tushum: filialdagi barcha guruhlardagi studentlar uchun
        if self.user.role == "admin" and getattr(self.user, "branch", None):
            from groups.models import Group

            from finance.models import FinanceTransaction, Payment

            total = Decimal("0")
            branch_groups = Group.objects.filter(branch=self.user.branch)
            branch_group_ids = [g.id for g in branch_groups]
            processed_pairs = set()

            # Barcha to'lovlarni bitta queryda olamiz
            payment_map = {}
            payment_qs = Payment.objects.filter(
                group_id__in=branch_group_ids,
                month__year=month.year,
                month__month=month.month,
            ).select_related("student")
            for p in payment_qs:
                key = (p.student_id, p.group_id)
                payment_map[key] = p

            # Student extra tranzaksiyalarini yig'ish
            extra_map = {}
            extra_qs = FinanceTransaction.objects.filter(
                category="student_extra",
                date__year=month.year,
                date__month=month.month,
                group_id__in=branch_group_ids,
            ).values("student_id", "group_id", "transaction_type", "amount")
            for tx in extra_qs:
                key = (tx["student_id"], tx["group_id"])
                amt = Decimal(str(tx["amount"] or 0))
                if tx["transaction_type"] == "income":
                    extra_map[key] = extra_map.get(key, Decimal("0")) + amt
                else:
                    extra_map[key] = extra_map.get(key, Decimal("0")) - amt

            for group in branch_groups:
                all_students_map = {}
                for enr in group.enrollments.select_related("student").all():
                    if enr.student:
                        all_students_map[enr.student.id] = enr.student
                for st in group.old_students_fk.all():
                    all_students_map[st.id] = st

                for student in all_students_map.values():
                    key = (student.id, group.id)
                    if key in processed_pairs:
                        continue
                    processed_pairs.add(key)

                    if student.status == "teacher_negotiated":
                        p = payment_map.get(key)
                        base_amount = Decimal("0")
                        if p:
                            base_amount = Decimal(str(p.paid_amount or 0))
                        net_amount = base_amount + extra_map.get(key, Decimal("0"))
                        if net_amount != 0:
                            total += net_amount
                        continue

                    if student.status in ["discount", "negotiated"]:
                        p = payment_map.get(key)
                        base_amount = Decimal("0")
                        if student.status == "discount":
                            # Discount: davomat asosida tushum
                            base_amount = calculate_attendance_based_student_payment(
                                student, group, month
                            )
                        else:
                            # Negotiated: faqat to'langan summa
                            if p:
                                base_amount = Decimal(str(p.paid_amount or 0))
                        net_amount = base_amount + extra_map.get(key, Decimal("0"))
                        if net_amount != 0:
                            total += net_amount
                        continue

                    # Oddiy studentlar uchun: faqat to'langan to'lovlar
                    p = payment_map.get(key)
                    base_amount = Decimal("0")
                    if p and p.is_paid:
                        base_amount = Decimal(str(p.amount or 0))
                    net_amount = base_amount + extra_map.get(key, Decimal("0"))
                    if net_amount != 0 or (p and p.is_paid):
                        total += net_amount

            return floor_amount(total, precision=None)

        if self.user.role != "mentor":
            return Decimal("0")

        from groups.models import Group

        from finance.models import FinanceTransaction, Payment

        # Mentorning barcha guruhlari (faol + nofaol, chunki tarixiy to'lovlar bo'lishi mumkin)
        mentor_groups = Group.objects.filter(mentor=self.user)
        mentor_group_ids = [g.id for g in mentor_groups]

        total_income = Decimal("0")
        processed_student_group_pairs = set()  # Duplicatlarni oldini olish uchun

        # Barcha to'lovlarni bitta queryda olamiz (optimizatsiya)
        _all_payments = Payment.objects.filter(
            group_id__in=mentor_group_ids,
            month__year=month.year,
            month__month=month.month,
        ).select_related("student")
        payment_map = {(p.student_id, p.group_id): p for p in _all_payments}

        # Qo'shimcha to'lovlarni bitta queryda olamiz
        extra_map = {}
        extra_qs = FinanceTransaction.objects.filter(
            category="student_extra",
            date__year=month.year,
            date__month=month.month,
            group_id__in=mentor_group_ids,
        ).values("student_id", "group_id", "transaction_type", "amount")
        for tx in extra_qs:
            key = (tx["student_id"], tx["group_id"])
            amt = Decimal(str(tx["amount"] or 0))
            if tx["transaction_type"] == "income":
                extra_map[key] = extra_map.get(key, Decimal("0")) + amt
            else:
                extra_map[key] = extra_map.get(key, Decimal("0")) - amt

        # 1. Barcha guruhlar va o'quvchilarni ko'rib chiqamiz (serializerdagi get_mentor_groups bilan mos)
        for group in mentor_groups:
            # Guruhdagi barcha o'quvchilarni olamiz
            students_map = {}
            for enr in group.enrollments.select_related("student").all():
                if enr.student:
                    students_map[enr.student.id] = enr.student
            for st in group.old_students_fk.all():
                students_map[st.id] = st

            students = list(students_map.values())

            for student in students:
                key = (student.id, group.id)
                if key in processed_student_group_pairs:
                    continue
                processed_student_group_pairs.add(key)

                if student.status == "teacher_negotiated":
                    p = payment_map.get(key)
                    base_amount = Decimal("0")
                    if p:
                        base_amount = Decimal(str(p.paid_amount or 0))
                    net_amount = base_amount + extra_map.get(key, Decimal("0"))
                    if net_amount != 0:
                        total_income += net_amount
                    continue

                # Discount va negotiated studentlar uchun alohida mantiq
                if student.status in ["discount", "negotiated"]:
                    p = payment_map.get(key)
                    base_amount = Decimal("0")
                    if student.status == "discount":
                        # Discount: davomat asosida tushum
                        base_amount = calculate_attendance_based_student_payment(
                            student, group, month
                        )
                    else:
                        # Negotiated: faqat to'langan summa
                        if p:
                            base_amount = Decimal(str(p.paid_amount or 0))
                    net_amount = base_amount + extra_map.get(key, Decimal("0"))
                    if net_amount != 0:
                        total_income += net_amount
                    continue

                # Oddiy studentlar uchun: faqat to'langan to'lovlar
                p = payment_map.get(key)
                base_amount = Decimal("0")
                if p and p.is_paid:
                    base_amount = Decimal(str(p.amount or 0))
                net_amount = base_amount + extra_map.get(key, Decimal("0"))
                if net_amount != 0 or (p and p.is_paid):
                    total_income += net_amount

        return floor_amount(total_income)

    def calculate_expected_monthly_income(self, month, prefetch_cache=None):
        """
        Mentorning taxminiy oylik ulushi:
        - Barcha o'quvchilar (to'lagan va to'lamagan) hisobga olinadi
        - Discount va negotiated: davomat asosida
        - Teacher negotiated: 0 deb hisoblanadi
        - Guruh konfiguratsiyasi va refund sistemi hisobga olinadi
        """
        from finance.utils import calculate_group_revenue_and_mentor_share, floor_amount

        if self.salary_type == "fixed":
            return floor_amount(self.fixed_salary, precision=None)

        from groups.models import Group

        from finance.models import FinanceTransaction, Payment

        mentor_groups = Group.objects.filter(mentor=self.user)
        if not mentor_groups:
            return Decimal("0")

        # Barcha to'lovlarni bitta queryda olamiz (optimizatsiya)
        mentor_group_ids = [g.id for g in mentor_groups]
        payment_map = {}
        if prefetch_cache and 'payment_map' in prefetch_cache:
            payment_map = prefetch_cache['payment_map']
        else:
            payment_qs = Payment.objects.filter(
                group_id__in=mentor_group_ids,
                month__year=month.year,
                month__month=month.month,
            ).select_related("student")
            for p in payment_qs:
                key = (p.student_id, p.group_id)
                payment_map[key] = p

        # Student extra tranzaksiyalarini olamiz (optimizatsiya)
        extra_map = {}

        # === OPTIMIZATSIYA: cache'larni bir marta qurish ===
        if prefetch_cache and 'lesson_dates_cache' in prefetch_cache:
            lesson_dates_cache = prefetch_cache['lesson_dates_cache']
        else:
            lesson_dates_cache = {}
            for g in mentor_groups:
                lesson_dates_cache[g.id] = g.get_lesson_dates(month.year, month.month)

        if prefetch_cache and 'attendance_cache' in prefetch_cache:
            attendance_cache = prefetch_cache['attendance_cache']
        else:
            from homework_attends.models import Attendance
            _all_att = Attendance.objects.filter(
                group_id__in=mentor_group_ids,
                date__year=month.year,
                date__month=month.month,
                is_present=True,
                marked_by__isnull=False,
            ).values("group_id", "student_id")
            attendance_cache = {}
            for row in _all_att:
                k = (row["group_id"], row["student_id"])
                attendance_cache[k] = attendance_cache.get(k, 0) + 1

        if prefetch_cache and 'enrollment_cache' in prefetch_cache:
            enrollment_cache = prefetch_cache['enrollment_cache']
        else:
            from groups.models import GroupEnrollment
            _all_enrollments = GroupEnrollment.objects.filter(
                group_id__in=mentor_group_ids
            ).select_related("student")
            enrollment_cache = {}
            _join_dates = {}
            for gid in mentor_group_ids:
                enrollment_cache[gid] = {}
                
            for enr in _all_enrollments:
                if enr.student:
                    enrollment_cache[enr.group_id][enr.student.id] = enr.student
                if enr.joined_at:
                    _join_dates[(enr.student_id, enr.group_id)] = enr.joined_at.date()
            enrollment_cache['_join_dates'] = _join_dates

            # Legacy old_students_fk (eski tizimdan qolgan o'quvchilar)
            from groups.models import Student
            for st in Student.objects.filter(group_id__in=mentor_group_ids).only(
                'id', 'custom_fee', 'status', 'full_name', 'joined_at', 'group_id'
            ):
                gid = st.group_id
                enrollment_cache[gid][st.id] = st

            _salary_configs = {}
            for sc in MentorGroupSalaryConfig.objects.filter(
                mentor=self.user, group_id__in=mentor_group_ids
            ):
                _salary_configs[(self.user.id, sc.group_id)] = sc
            enrollment_cache['_salary_configs'] = _salary_configs

        total_expected_share = Decimal("0")

        for group in mentor_groups:
            group_result = calculate_group_revenue_and_mentor_share(
                group=group,
                month_date=month,
                profile=self,
                payment_map=payment_map,
                extra_map=extra_map,
                ignore_today_check=False,
                lesson_dates_cache=lesson_dates_cache,
                attendance_cache=attendance_cache,
                enrollment_cache=enrollment_cache,
            )
            # BUG #6 FIX: expected_revenue bu GURUH daromadi, mentor ulushi EMAS.
            # Mentor faqat o'z ulushini (foiz yoki per_student) olishi kerak.
            # Oldin: total_expected_share += group_result["expected_revenue"]  ← NOTO'G'RI
            # Hozir: to'g'ri field ishlatilmoqda
            total_expected_share += group_result["mentor_share_expected"]

        # Transfer tuzatish: oy o'rtasida ko'chirilgan o'quvchilar uchun mentor ulushini
        # to'g'ri taqsimlash (mavjud hisob logikasiga tegmaydi).
        try:
            from finance.utils import calculate_transfer_salary_adjustment
            transfer_adj = calculate_transfer_salary_adjustment(
                profile=self,
                mentor_group_ids=mentor_group_ids,
                month_date=month,
                payment_map=payment_map,
                lesson_dates_cache=lesson_dates_cache,
                commission_basis="expected",
            )
            total_expected_share += transfer_adj
        except Exception as _te:
            import traceback
            traceback.print_exc()
            # Transfer tuzatish bajarilmasa ham asosiy hisob davom etadi

        return floor_amount(total_expected_share, precision=None)

    def calculate_salary_for_month(self, month, commission_basis="paid", prefetch_cache=None):
        """Berilgan oy uchun maoshni hisoblash (natija floor qilinadi)"""
        from finance.utils import calculate_group_revenue_and_mentor_share, floor_amount

        # Memoization: bir xil parametrlar bilan qayta hisoblashni oldini olish
        cache_key = (str(month), commission_basis)
        if not hasattr(self, '_salary_memo'):
            self._salary_memo = {}
        if cache_key in self._salary_memo:
            return self._salary_memo[cache_key]

        if self.salary_type == "fixed":
            result = floor_amount(self.fixed_salary, precision=None)
            self._salary_memo[cache_key] = result
            return result

        from groups.models import Group

        from finance.models import FinanceTransaction, Payment

        mentor_groups = Group.objects.filter(mentor=self.user)
        if not mentor_groups:
            result = Decimal("0")
            self._salary_memo[cache_key] = result
            return result

        # Barcha to'lovlarni bitta queryda olamiz (optimizatsiya)
        mentor_group_ids = [g.id for g in mentor_groups]
        payment_map = {}
        # Bo'lib to'lgan to'lovlarni ham hisoblash uchun, hammasini olamiz!
        if prefetch_cache and 'payment_map' in prefetch_cache:
            payment_map = prefetch_cache['payment_map']
        else:
            payment_qs = Payment.objects.filter(
                group_id__in=mentor_group_ids,
                month__year=month.year,
                month__month=month.month,
            ).select_related("student")
            for p in payment_qs:
                key = (p.student_id, p.group_id)
                payment_map[key] = p

        # Student extra tranzaksiyalarini endi mentor salary yoki guruh daromadi uchun 
        # hisobga olmaymiz. Qo'shimcha to'lov (student_extra) faqat o'quvchi balansiga ta'sir qiladi.
        extra_map = {}

        # === OPTIMIZATSIYA: lesson_dates, attendance, enrollment cache'larni bir marta qurish ===
        if prefetch_cache and 'lesson_dates_cache' in prefetch_cache:
            lesson_dates_cache = prefetch_cache['lesson_dates_cache']
        else:
            lesson_dates_cache = {}
            for g in mentor_groups:
                lesson_dates_cache[g.id] = g.get_lesson_dates(month.year, month.month)

        if prefetch_cache and 'attendance_cache' in prefetch_cache:
            attendance_cache = prefetch_cache['attendance_cache']
        else:
            # Attendance cache: bitta query bilan barcha guruhlar uchun davomatni olish
            from homework_attends.models import Attendance
            _all_att = Attendance.objects.filter(
                group_id__in=mentor_group_ids,
                date__year=month.year,
                date__month=month.month,
                is_present=True,
                marked_by__isnull=False,
            ).values("group_id", "student_id")
            attendance_cache = {}
            for row in _all_att:
                k = (row["group_id"], row["student_id"])
                attendance_cache[k] = attendance_cache.get(k, 0) + 1

        if prefetch_cache and 'enrollment_cache' in prefetch_cache:
            enrollment_cache = prefetch_cache['enrollment_cache']
        else:
            # Enrollment cache: barcha guruhlar uchun enrollment + salary config + join dates
            from groups.models import GroupEnrollment
            _all_enrollments = GroupEnrollment.objects.filter(
                group_id__in=mentor_group_ids,
                is_active=True
            ).select_related("student")
            enrollment_cache = {}
            _join_dates = {}
            # N+1 FIX: barcha guruhlar uchun boshlang'ich bo'sh dict ochamiz
            for gid in mentor_group_ids:
                enrollment_cache[gid] = {}
                
            for enr in _all_enrollments:
                if enr.student:
                    enrollment_cache[enr.group_id][enr.student.id] = enr.student
                if enr.joined_at:
                    _join_dates[(enr.student_id, enr.group_id)] = enr.joined_at.date()
            enrollment_cache['_join_dates'] = _join_dates

            # Legacy old_students_fk (eski tizimdan qolgan o'quvchilar)
            from groups.models import Student
            _inactive_enrollments = set(
                GroupEnrollment.objects.filter(
                    group_id__in=mentor_group_ids,
                    is_active=False
                ).values_list("student_id", "group_id")
            )

            for st in Student.objects.filter(
                group_id__in=mentor_group_ids,
                is_active=True,
                is_archived=False
            ).only(
                'id', 'custom_fee', 'status', 'full_name', 'joined_at', 'group_id'
            ):
                gid = st.group_id
                if (st.id, gid) in _inactive_enrollments:
                    continue
                enrollment_cache[gid][st.id] = st

            # Salary config cache
            _salary_configs = {}
            for sc in MentorGroupSalaryConfig.objects.filter(
                mentor=self.user, group_id__in=mentor_group_ids
            ):
                _salary_configs[(self.user.id, sc.group_id)] = sc
            enrollment_cache['_salary_configs'] = _salary_configs

        total_salary = Decimal("0")

        for group in mentor_groups:
            group_result = calculate_group_revenue_and_mentor_share(
                group=group,
                month_date=month,
                profile=self,
                payment_map=payment_map,
                extra_map=extra_map,
                ignore_today_check=False,
                lesson_dates_cache=lesson_dates_cache,
                attendance_cache=attendance_cache,
                enrollment_cache=enrollment_cache,
            )
            if commission_basis == "paid":
                total_salary += group_result["mentor_share_paid"]
            else:
                total_salary += group_result["mentor_share_expected"]

        # Transfer tuzatish: oy o'rtasida ko'chirilgan o'quvchilar uchun mentor ulushini
        # to'g'ri taqsimlash. Mavjud calculate_group_revenue_and_mentor_share O'ZGARMAYDI.
        # Bu post-processing qatlami:
        #   A) Eski guruh mentori → 0 olgan, to'g'ri ulush QO'SHILADI
        #   B) Yangi guruh mentori → ortiqcha olgan, ortiqcha AYIRILADI
        try:
            from finance.utils import calculate_transfer_salary_adjustment
            transfer_adj = calculate_transfer_salary_adjustment(
                profile=self,
                mentor_group_ids=mentor_group_ids,
                month_date=month,
                payment_map=payment_map,
                lesson_dates_cache=lesson_dates_cache,
                commission_basis=commission_basis,
            )
            total_salary += transfer_adj
        except Exception as _te:
            import traceback
            traceback.print_exc()
            # Transfer tuzatish bajarilmasa ham asosiy hisob davom etadi

        result = floor_amount(total_salary, precision=None)
        self._salary_memo[cache_key] = result
        return result

    def calculate_attendance_based_salary(self, month):
        """
        OBSOLETE: Mentor davomati logikasi olib tashlandi.
        """
        return self.calculate_salary_for_month(month), {}

    def save(self, *args, **kwargs):
        """Profile yangilanganda mavjud to'lovlarni ham yangilash"""
        # Eski qiymatlarni olish (agar mavjud bo'lsa)
        old_fixed = None
        old_percentage = None
        old_per_student = None

        if self.pk:
            try:
                old = StaffProfile.objects.get(pk=self.pk)
                old_fixed = old.fixed_salary
                old_percentage = old.commission_percentage
                old_per_student = old.per_student_amount
            except StaffProfile.DoesNotExist:
                pass

        # Saqlash
        super().save(*args, **kwargs)

        # Agar maosh o'zgargan bo'lsa, to'lanmagan paymentlarni yangilash
        salary_fields_changed = any(
            [
                old_fixed is not None and old_fixed != self.fixed_salary,
                old_percentage is not None
                and old_percentage != self.commission_percentage,
                old_per_student is not None
                and old_per_student != self.per_student_amount,
            ]
        )

        if salary_fields_changed:
            self._update_unpaid_payments()

    def _update_unpaid_payments(self):
        """To'lanmagan va joriy/kelajakdagi paymentlarni yangilash"""
        today = timezone.now().date()
        current_month = today.replace(day=1)

        unpaid_payments = EmployeePayment.objects.filter(
            employee=self.user, is_paid=False, month__gte=current_month
        )

        to_update = []
        for payment in unpaid_payments:
            payment.salary_base = self.calculate_salary_for_month(payment.month)
            payment.attendance_deductions = {}
            to_update.append(payment)
            
        if to_update:
            EmployeePayment.objects.bulk_update(to_update, ['salary_base', 'attendance_deductions'])


class EmployeeAdvance(models.Model):
    """Xodimga oylik maoshidan tashqari berilgan avans (oldindan to'lov)"""

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_advances",
        verbose_name="Xodim",
    )
    month = models.DateField(verbose_name="Qaysi oy maoshidan ayriladi")
    amount = models.DecimalField(
        max_digits=20, decimal_places=2, verbose_name="Avans summasi"
    )
    description = models.TextField(blank=True, null=True, verbose_name="Izoh")
    date = models.DateField(default=timezone.now, verbose_name="Berilgan sana")
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="Kim berdi",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        verbose_name = "Xodim avansi"
        verbose_name_plural = "Xodimlar avanslari"

    def __str__(self):
        return f"{self.employee.get_full_name()} - {self.amount} ({self.date})"

    @property
    def payment_record(self):
        """Ushbu avans tegishli bo'lgan payment rekordini topish"""
        return EmployeePayment.objects.filter(
            employee=self.employee, month=self.month
        ).first()

    def save(self, *args, **kwargs):
        # Oy normalizatsiyasi
        if self.month:
            from finance.utils import normalize_month

            self.month = normalize_month(self.month)

        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new:
            # ✅ Centralized Finance Ledger ga Chiqim sifatida yozish
            from finance.models import FinanceTransaction

            FinanceTransaction.objects.create(
                related_id=f"ADV-{self.id}",
                transaction_type="expense",
                category="salary",  # Avans maoshning bir qismi
                amount=self.amount,
                date=self.date,
                marked_by=self.marked_by,
                branch=self.employee.branch,
                title=f"Avans: {self.employee.get_full_name() or self.employee.username}",
                description=f"{self.month.strftime('%Y-%m')} oyi maoshi hisobidan avans. {self.description or ''}",
            )
