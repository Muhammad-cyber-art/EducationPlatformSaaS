from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from groups.models import Group, Student

User = get_user_model()


class Homework(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    mentor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_homeworks"
    )
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="homeworks", db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Uyga vazifa"
        verbose_name_plural = "Uyga vazifalar"

    def __str__(self):
        return self.title


class HomeworkSubmission(models.Model):
    NOT_SUBMITTED = "not_submitted"
    HALF = "half"
    FULL = "full"

    STATUS_CHOICES = (
        (NOT_SUBMITTED, "Topshirmagan"),
        (HALF, "Yarim topshirgan"),
        (FULL, "To‘liq topshirgan"),
    )

    homework = models.ForeignKey(
        Homework, on_delete=models.CASCADE, related_name="submissions", db_index=True
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="homework_submissions",
    )
    student_full_name = models.CharField(max_length=200, blank=True, null=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=NOT_SUBMITTED
    )
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = (
            "homework",
            "student",
        )  # Bir talabaga bitta vazifa uchun bitta record

    def __str__(self):
        student_name = self.student_full_name or (
            self.student.full_name if self.student else "Unknown Student"
        )
        return f"{student_name} - {self.homework} ({self.status})"

    def save(self, *args, **kwargs):
        if self.student:
            self.student_full_name = self.student.full_name
        super().save(*args, **kwargs)


class MockTest(models.Model):
    subject = models.CharField(max_length=200)
    type = models.CharField(max_length=200)  # Masalan: Oylik nazorat, Haftalik test
    group = models.ForeignKey(
        Group,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mock_tests",
        db_index=True,
    )
    group_name = models.CharField(max_length=200, blank=True, null=True)
    date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Sinov imtihoni"
        verbose_name_plural = "Sinov imtihonlari"

    def __str__(self):
        group_name = self.group_name or (
            self.group.name if self.group else "Unknown Group"
        )
        return f"{self.subject} - {self.type} ({group_name})"

    def save(self, *args, **kwargs):
        if self.group:
            self.group_name = self.group.name
        super().save(*args, **kwargs)


class MockTestResult(models.Model):
    test = models.ForeignKey(
        MockTest, on_delete=models.CASCADE, related_name="results", db_index=True
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mock_test_results",
    )
    student_full_name = models.CharField(max_length=200, blank=True, null=True)
    score = models.CharField(
        max_length=50, blank=True, default=""
    )  # Masalan: "33/40" yoki "85"
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("test", "student")

    def __str__(self):
        student_name = self.student_full_name or (
            self.student.full_name if self.student else "Unknown Student"
        )
        return f"{student_name} - {self.test}: {self.score}"

    def save(self, *args, **kwargs):
        if self.student:
            self.student_full_name = self.student.full_name
        super().save(*args, **kwargs)


# ================ ATTENDS ==========================
# attends/models.py
from django.conf import settings
from django.db import models
from django.utils import timezone


class Attendance(models.Model):
    student = models.ForeignKey(
        "groups.Student",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendances",
    )
    # O'quvchi ma'lumotlarini saqlash (student o'chirilganda ham saqlanadi)
    student_full_name = models.CharField(max_length=200, blank=True, null=True)

    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendances",
    )
    # Guruh ma'lumotlarini saqlash (group o'chirilganda ham saqlanadi)
    group_name = models.CharField(max_length=200, blank=True, null=True)

    date = models.DateField(default=timezone.localdate)
    is_present = models.BooleanField(default=True)
    # Xabarnoma takrorlanmasligi uchun
    last_sent_status = models.BooleanField(null=True, blank=True)

    # Audit uchun: Kim oxirgi marta o'zgartirdi
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marked_attendances",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        student_name = self.student_full_name or (
            self.student.full_name if self.student else "Unknown Student"
        )
        group_name = self.group_name or (
            self.group.name if self.group else "Unknown Group"
        )
        return f"{student_name} | {group_name} | {self.date} | {self.is_present}"

    def save(self, *args, **kwargs):
        # O'quvchi va guruh ma'lumotlarini avtomatik tarzda saqlash
        if self.student:
            self.student_full_name = self.student.full_name
        if self.group:
            self.group_name = self.group.name
        super().save(*args, **kwargs)


class AttendanceEditLog(models.Model):
    attendance = models.ForeignKey(
        Attendance, on_delete=models.CASCADE, related_name="edit_logs"
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="attendance_edits"
    )
    old_status = models.BooleanField()
    new_status = models.BooleanField()
    reason = models.TextField(blank=True, default='')  # Ixtiyoriy: Seamless flow uchun
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Davomat tahrir tarixi"
        verbose_name_plural = "Davomat tahrir tarixlari"

    def __str__(self):
        return f"{self.attendance} | {self.changed_by} | {self.created_at}"
