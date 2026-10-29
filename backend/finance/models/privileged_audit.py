from django.conf import settings
from django.db import models


class AttendanceAuditLog(models.Model):
    """
    Maxsus / Imtiyozli (davlat tomonidan moliyalashtiriluvchi) talabalar davomatini
    qo'lda o'zgartirish (override) va moliyaviy qayta hisoblash audit jurnali.
    Moliyaviy firibgarlik va noaniqliklarni oldini olish uchun barcha o'zgarishlarni
    muallifi, sababi va moliyaviy farqi bilan qayd etadi.
    """
    student = models.ForeignKey(
        "groups.Student",
        on_delete=models.CASCADE,
        related_name="privileged_attendance_audit_logs",
        verbose_name="O'quvchi",
        db_index=True,
    )
    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="privileged_attendance_audit_logs",
        verbose_name="Guruh",
        db_index=True,
    )
    month = models.DateField(
        verbose_name="Hisob-kitob oyi",
        db_index=True,
    )
    modified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="privileged_attendance_overrides",
        verbose_name="O'zgartirgan xodim",
    )
    previous_attended_count = models.PositiveIntegerField(
        default=0,
        verbose_name="Oldingi tasdiqlangan darslar soni (N_prev)",
    )
    new_attended_count = models.PositiveIntegerField(
        default=0,
        verbose_name="Yangi tasdiqlangan darslar soni (N_new)",
    )
    total_planned_lessons = models.PositiveIntegerField(
        default=0,
        verbose_name="Oydagi rejalashtirilgan jami darslar (N_total)",
    )
    previous_teacher_share = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        verbose_name="Oldingi o'qituvchi ulushi (UZS)",
    )
    new_teacher_share = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        verbose_name="Yangi o'qituvchi ulushi (UZS)",
    )
    previous_state_receivable = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        verbose_name="Oldingi davlatdan kutilayotgan tushum (UZS)",
    )
    new_state_receivable = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        verbose_name="Yangi davlatdan kutilayotgan tushum (UZS)",
    )
    reason_for_change = models.TextField(
        blank=True,
        default="",
        verbose_name="O'zgartirish sababi / izoh",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="O'zgartirilgan sana va vaqt",
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Imtiyozli davomat audit jurnali"
        verbose_name_plural = "Imtiyozli davomat audit jurnallari"

    def __str__(self):
        return (
            f"AuditLog #{self.id}: {self.student.full_name} | "
            f"{self.month.strftime('%Y-%m')} | {self.previous_attended_count} -> {self.new_attended_count} "
            f"({self.modified_by})"
        )
