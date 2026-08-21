from django.db import models
from django.conf import settings

class ReportDownloadTrack(models.Model):
    REPORT_TYPES = (
        ('daily', 'Daily Excel Report'),
        ('monthly', 'Monthly Financial Report'),
        ('attendance_monthly', 'Monthly Attendance Report'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='report_downloads',
        verbose_name="Foydalanuvchi"
    )
    report_type = models.CharField(
        max_length=20,
        choices=REPORT_TYPES,
        verbose_name="Hisobot turi"
    )
    report_date = models.DateField(
        verbose_name="Hisobot sanasi"
    )
    downloaded_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Yuklab olingan vaqt"
    )

    class Meta:
        verbose_name = "Hisobot yuklash tarixi"
        verbose_name_plural = "Hisobot yuklash tarixlari"
        unique_together = ('user', 'report_type', 'report_date')

    def __str__(self):
        return f"{self.user.username} - {self.report_type} ({self.report_date})"
