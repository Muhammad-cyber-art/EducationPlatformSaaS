import datetime

from branches.models import Branch
from config.validators import validate_image_file
from django.contrib.auth import get_user_model
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone

User = get_user_model()
color_validator = RegexValidator(
    regex=r"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
    message="Xato format! Rang #ffffff kabi bo'lishi kerak.",
)


class Group(models.Model):
    GROUP_TYPES = [
        ("standard", "Standart"),
        ("advanced", "Advanced"),
    ]

    DAYS_TYPES = [
        ("odd", "Toq kunlar"),
        ("even", "Juft kunlar"),
        ("everyday", "Har kuni"),
    ]
    color = models.CharField(
        max_length=7, default="#ffffff", validators=[color_validator]
    )

    name = models.CharField(max_length=200)
    group_type = models.CharField(
        max_length=20,
        choices=GROUP_TYPES,
        default="standard",
        verbose_name="Guruh turi",
    )
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="groups")

    course_time = models.TextField(blank=True, null=True)

    mentor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={"role": "mentor"},
        related_name="mentor_groups",
    )

    admin = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_groups",
        limit_choices_to={"role__in": ["admin", "super_admin"]},
    )
    start_date = models.DateField(null=True, blank=True)

    # Eskisiga tegmadik
    dars_kunlari = models.CharField(max_length=50, blank=True, null=True)

    # YANGI FIELD: Qisqa va tanlovli (selection)
    days = models.CharField(
        max_length=10,
        choices=DAYS_TYPES,
        default="odd",
        verbose_name="Dars kunlari turi",
    )

    dars_vaqti = models.CharField(max_length=20, blank=True, null=True)
    description = models.TextField(blank=True)
    is_faol = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False, verbose_name="Arxivlangan")
    archived_at = models.DateTimeField(null=True, blank=True)
    subject = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def get_lesson_dates(self, year, month):
        from .utils import get_lessons_in_month

        dates = get_lessons_in_month(self.days, year, month)
        if self.start_date:
            dates = [d for d in dates if d >= self.start_date]

        # Qo'shimcha dars kunlarini qo'shish
        special_dates = list(
            self.special_lesson_days.filter(
                date__year=year, date__month=month
            ).values_list("date", flat=True)
        )

        dates.extend(special_dates)

        # Bekor qilingan kunlarni olib tashlash
        canceled_dates = list(
            self.canceled_lesson_days.filter(
                date__year=year, date__month=month
            ).values_list("date", flat=True)
        )
        dates = [d for d in dates if d not in canceled_dates]

        # Unikal va tartiblangan holatda qaytaramiz (set() orqali dublikatlarni olib tashlaymiz)
        return sorted(list(set(dates)))

    def is_lesson_day(self, date_obj):
        from .utils import is_lesson_day as is_scheduled_lesson_day

        # Agar bekor qilingan bo'lsa
        if self.canceled_lesson_days.filter(date=date_obj).exists():
            return False
        # Agar maxsus dars kuni sifatida qo'shilgan bo'lsa
        if self.special_lesson_days.filter(date=date_obj).exists():
            return True
        return is_scheduled_lesson_day(self.days, date_obj)

    def get_daily_price(self, year, month):
        from finance.utils import floor_amount

        lessons = self.get_lesson_dates(year, month)
        if not lessons:
            return 0
        return floor_amount(self.monthly_price / len(lessons))

    @property
    def computed_status(self) -> str:
        """
        Guruh holatini hisoblab beradi:
        - 'inactive': is_faol = False
        - 'waiting': is_faol = True va start_date > today
        - 'activating_soon': is_faol = True va today <= start_date <= today + 5 kun
        - 'active': is_faol = True va (start_date is None yoki start_date <= today)
        """
        try:
            if not self.is_faol:
                return "inactive"

            if not self.start_date:
                return "active"

            today = timezone.localdate()

            if self.start_date > today:
                # Agar 5 kun ichida boshlansa
                if self.start_date <= today + datetime.timedelta(days=5):
                    return "activating_soon"
                return "waiting"

            return "active"
        except Exception:
            return "active"

    @property
    def is_currently_active(self):
        """
        Tizim logikasi uchun: Guruh haqiqatdan ham darslarni boshlaganmi?
        """
        return (
            self.computed_status in ["active", "activating_soon"]
        )  # 'activating_soon' dars boshlanishidan oldin ham ba'zi logikalar ishlashi kerak bo'lishi mumkin, lekin user "sana kelmaguncha faollashmasligi kerak" dedi.
        # Aslida user: "sana kelmaguncha faollashmasligi kerak" dedi. Shuning uchun faqat 'active' qaytaramiz.

    def is_logic_enabled(self):
        """
        Davomat va to'lovlar yaratilishi mumkinmi?
        """
        if not self.is_faol or not self.start_date:
            return self.is_faol

        return self.start_date <= timezone.localdate()

    class Meta:
        indexes = [
            models.Index(fields=["branch", "is_faol"]),
            models.Index(fields=["mentor", "is_faol"]),
            models.Index(fields=["start_date", "days"]),
            models.Index(fields=["name"]),
            models.Index(fields=["subject"]),
        ]

    def __str__(self):
        return f"{self.name} | Mentor: {self.mentor} | Kun: {self.get_days_display()}"


class Student(models.Model):
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name="branch_students",
        null=True,
        blank=True,  # Avtomatik to'ldirilishi uchun boshida null ruxsat beramiz
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="old_students_fk",
    )
    color = models.CharField(
        max_length=7, default="#ffffff", validators=[color_validator]
    )
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    parent_name = models.CharField(max_length=200, blank=True)
    parent_phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=300, blank=True)
    notes = models.TextField(blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(
        upload_to="students/", null=True, blank=True, validators=[validate_image_file]
    )
    telegram_id = models.CharField(
        max_length=20, blank=True, null=True, verbose_name="Student Telegram Chat ID"
    )
    parent_telegram_id = models.CharField(
        max_length=20, blank=True, null=True, verbose_name="Parent Telegram Chat ID"
    )

    # Soft delete fields
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    is_archived = models.BooleanField(default=False, verbose_name="Arxivlangan")
    archived_at = models.DateTimeField(null=True, blank=True)

    # Yangi FIELDS: O'quvchi statusi va individual narxi
    STUDENT_STATUS = [
        ("regular", "Oddiy"),
        ("discount", "Imtiyozli"),
        ("low_income", "Kam ta'minlangan"),
        ("negotiated", "Kelishilgan narx"),
        ("teacher_negotiated", "O'qituvchi kelishgan"),
    ]
    groups = models.ManyToManyField(
        Group,
        through="GroupEnrollment",
        related_name="students",
        verbose_name="O'quvchi guruhlari",
    )
    status = models.CharField(
        max_length=20,
        choices=STUDENT_STATUS,
        default="regular",
        verbose_name="O'quvchi holati",
    )
    custom_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Individual narx",
        help_text="Agar o'quvchi guruh narxidan boshqa (masalan, kamroq) narxda o'qisa, shu yerga yozing.",
    )
    include_in_mentor_salary = models.BooleanField(
        default=False,
        verbose_name="Mentor oyligiga qo'shilsinmi?",
        help_text="Faqat 'O'qituvchi kelishgan' statusidagi o'quvchilar uchun amal qiladi.",
    )

    def save(self, *args, **kwargs):
        # Agar guruh biriktirilgan bo'lsa va branch hali yo'q bo'lsa,
        # branchni guruhdan olamiz
        if self.group and not self.branch:
            self.branch = self.group.branch

        is_new = self.pk is None
        super(Student, self).save(*args, **kwargs)

        # ✅ Task 1: M2M va Enrollment synchronization
        # Agar ForeignKey 'group' o'rnatilgan bo'lsa, Enrollment ham mavjudligiga ishonch hosil qilamiz
        if self.group:
            # BUG #5 FIX: get_or_create faqat yangi yaratilganda defaults ni qo'llaydi.
            # Agar is_active=False bo'lgan eski enrollment mavjud bo'lsa — u yoqilmagan qolardi.
            # Endi aniq ravishda is_active=True ga o'tkaziladi.
            obj, created = GroupEnrollment.objects.get_or_create(
                student=self, group=self.group, defaults={"is_active": True}
            )
            if not created and not obj.is_active:
                obj.is_active = True
                obj.save(update_fields=['is_active'])

    def get_absences_count(self, year, month, group=None):
        """O'quvchining berilgan oydagi qoldirgan darslari sonini qaytaradi.

        BUG #5 TUZATILDI: calculate_attendance_based_student_payment() bilan
        izchillik uchun marked_by__isnull=False filtri qo'shildi.
        """
        target_group = group or self.group
        if not target_group:
            return 0

        today = timezone.localdate()
        lesson_dates = target_group.get_lesson_dates(year, month)

        # Faqat o'tib bo'lgan va oydagi dars kunlarini olamiz
        passed_lessons = [d for d in lesson_dates if d <= today]
        total_passed = len(passed_lessons)

        # Kelgan kunlar soni — faqat tasdiqlangan (marked_by mavjud) davomatlar
        present_count = self.attendances.filter(
            group=target_group,
            date__year=year,
            date__month=month,
            date__in=passed_lessons,
            is_present=True,
            marked_by__isnull=False,  # BUG #5 FIX: calculate_attendance_based_student_payment bilan izchil
        ).count()

        # Qoldirgan darslar = (O'tilgan darslar soni) - (Kelgan darslar soni)
        absences = total_passed - present_count
        return max(0, absences)

    def calculate_accrued_amount(self, year, month, group=None):
        """
        NEW LOGIC: Davomatga qarab bir kunlik dars narxi qo'shilib borishi.
        Oylik to'lov = (Kelgan kunlar soni) * (Bir kunlik dars narxi)
        """
        from finance.utils import floor_amount

        target_group = group or self.group
        if not target_group:
            return 0

        # Oydagi jami rejalashtirilgan darslar soni
        lesson_dates = target_group.get_lesson_dates(year, month)
        total_lessons_count = len(lesson_dates)
        if total_lessons_count <= 0:
            return 0

        # O'quvchining haqiqiy oylik narxi (custom_fee yoki guruh narxi)
        base_price = target_group.monthly_price
        if self.status in ["low_income", "negotiated", "discount"]:
            if self.custom_fee is not None:
                base_price = self.custom_fee

        # Bir kunlik dars narxi
        daily_price = floor_amount(base_price / total_lessons_count)

        # O'qituvchi kelishgan: Umuman pul to'lamaydi
        if self.status == "teacher_negotiated":
            return 0

        # Faqat o'tib ketgan va oydagi dars kunlarini olamiz
        today = timezone.localdate()
        active_lesson_dates = [d for d in lesson_dates if d <= today]

        # Kelgan kunlar soni
        present_count = self.attendances.filter(
            group=target_group,
            date__year=year,
            date__month=month,
            date__in=active_lesson_dates,
            is_present=True,
        ).count()

        accrued_amount = floor_amount(daily_price * present_count)
        return accrued_amount

    def calculate_refund_amount(self, year, month, group=None):
        """
        Dars qoldirganlik uchun refund (chegirma) summasini hisoblash.

        BUG #2 TUZATILDI: Oldingi versiyada floor_amount IKKI MARTA qo'llanilardi:
          1) daily_price = floor_amount(base_price / lessons)  ← birinchi floor
          2) refund = floor_amount(daily_price * absences)     ← ikkinchi floor
        Bu kumulyativ rounding loss yaratardi (har bir o'quvchi 1,000–3,000 so'm
        kam chegirma olardi).

        Tuzatma: raw daily_price hisoblash, bir marta floor qilish.
        """
        from decimal import Decimal
        from finance.utils import floor_amount

        target_group = group or self.group
        if not target_group:
            return 0

        # get_absences_count endi marked_by filtri bilan ishlaydi (Bug #5 bilan izchil)
        absences = self.get_absences_count(year, month, group=target_group)

        if absences <= 0:
            return 0

        lesson_dates = target_group.get_lesson_dates(year, month)
        base_price = target_group.monthly_price
        if self.status in [
            "low_income",
            "negotiated",
            "discount",
            "teacher_negotiated",
        ]:
            if self.custom_fee is not None:
                base_price = self.custom_fee
        lessons_count = len(lesson_dates)
        if lessons_count <= 0:
            return 0

        # BUG #2 FIX: Xom (floor qilinmagan) kunlik narxdan refund hisoblaymiz,
        # keyin BITTA floor_amount qo'llaymiz — kumulyativ xatolikni oldini oladi.
        raw_daily_price = Decimal(str(base_price)) / Decimal(str(lessons_count))
        refund = floor_amount(raw_daily_price * Decimal(str(absences)))

        # Yaxlitlash tufayli refund asosiy narxdan oshib ketmasin
        base_floor = floor_amount(base_price)
        if refund > base_floor:
            return base_floor
        return refund

    def __str__(self):
        group_name = self.group.name if self.group else "Guruhsiz"
        return f"{self.full_name} ({group_name})"


class GroupEnrollment(models.Model):
    """
    O'quvchi va guruhni bog'lovchi oraliq jadval (Many-to-Many).
    Bu orqali bir o'quvchini bir nechta guruhga biriktirish mumkin.
    """

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="enrollments"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="enrollments"
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    # Guruh uchun individual narx (agar student modelidagidan farq qilsa)
    # Hozircha Student modelidagi custom_fee ishlatiladi, lekin kelajakda guruh kesimida bo'lishi mumkin.

    class Meta:
        unique_together = ("student", "group")
        verbose_name = "O'quvchi guruhga birikishi"
        verbose_name_plural = "O'quvchilar guruhga birikishi"
        indexes = [
            models.Index(fields=["student", "is_active"]),
            models.Index(fields=["group", "is_active"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} -> {self.group.name}"


class GroupTransfer(models.Model):
    """O'quvchining guruhdan guruhga o'tish tarixi va moliyaviy hisobi"""

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="transfers"
    )
    from_group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="transfers_out"
    )
    to_group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="transfers_in"
    )

    transfer_date = models.DateField(default=timezone.now)

    # Moliyaviy snapshot
    old_group_fee = models.DecimalField(
        max_digits=10, decimal_places=2, help_text="Eski guruh uchun qolgan qarz/to'lov"
    )
    new_group_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Yangi guruh uchun boshlang'ich to'lov",
    )

    reason = models.TextField(blank=True, null=True)
    marked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class MentorGroupAssignment(models.Model):
    """Qo‘shimcha mas'ul mentorlarni — asosiy mentor (Group.mentor) o‘zgarmaydi"""

    mentor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="additional_assigned_groups",
        limit_choices_to={"role": "mentor"},
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="additional_mentors"
    )
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_additional_mentors",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("mentor", "group")
        verbose_name = "Qo‘shimcha mentor tayinlash"
        verbose_name_plural = "Qo‘shimcha mentorlar tayinlashlari"

    def __str__(self):
        return f"{self.mentor.get_full_name() or self.mentor.username} → {self.group.name} (qo‘shimcha)"


class WaitingStudent(models.Model):
    """Kutishlar zali - guruhga birikmagan, rejalashtirilgan o'quvchilar"""

    branch = models.ForeignKey(
        Branch, on_delete=models.CASCADE, related_name="waiting_students"
    )
    full_name = models.CharField(max_length=200, verbose_name="Ism Familiya")
    phone = models.CharField(max_length=20, verbose_name="Telefon")
    subject = models.CharField(
        max_length=100, blank=True, null=True, verbose_name="Qiziqqan fan"
    )
    notes = models.TextField(blank=True, verbose_name="Izoh")
    telegram_id = models.CharField(
        max_length=20, blank=True, null=True, verbose_name="Telegram Chat ID"
    )
    parent_telegram_id = models.CharField(
        max_length=20, blank=True, null=True, verbose_name="Ota-ona Telegram Chat ID"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Kutayotgan o'quvchi"
        verbose_name_plural = "Kutayotgan o'quvchilar"

    def __str__(self):
        return f"{self.full_name} ({self.subject or 'Umumiy'})"


class SpecialLessonDay(models.Model):
    """Guruh uchun qo'shimcha (jadvaldan tashqari) dars kuni"""

    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="special_lesson_days"
    )
    date = models.DateField()
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "date")
        ordering = ["-date"]
        verbose_name = "Qo'shimcha dars kuni"
        verbose_name_plural = "Qo'shimcha dars kunlari"

    def __str__(self):
        return f"{self.group.name} | {self.date}"


class CanceledLessonDay(models.Model):
    """Guruh uchun bekor qilingan dars kuni (regular yoki special)"""

    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="canceled_lesson_days"
    )
    date = models.DateField()
    reason = models.TextField(blank=True, verbose_name="Bekor qilish sababi")
    canceled_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "date")
        ordering = ["-date"]
        verbose_name = "Bekor qilingan dars kuni"
        verbose_name_plural = "Bekor qilingan dars kunlari"

    def __str__(self):
        return f"{self.group.name} | {self.date} (bekor qilindi)"
