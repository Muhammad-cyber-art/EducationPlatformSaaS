# permissions/models.py
from django.db import models
from django.conf import settings

# Eski AdminAccess modeli - orqaga qarab moslik (Backward Compatibility) uchun saqlab turamiz,
# lekin yangi mantiq asosan StaffPermission da bo'ladi.
class AdminAccess(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='admin_access'
    )
    # Funksional ruxsatlar (Legacy)
    can_download_daily_report = models.BooleanField(default=False)
    can_view_payments = models.BooleanField(default=False)
    can_edit_students = models.BooleanField(default=True)
    can_delete_data = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.user.username} - Legacy Ruxsatlari"

class StaffPermission(models.Model):
    """
    Adminlar uchun modullar kesimida batafsil ruxsatlarni saqlash.
    Permissions formati (JSON):
    {
        "finance": ["view", "create"],
        "courses": ["view", "edit", "delete"],
        "teachers": ["view"]
    }
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='staff_permissions'
    )
    permissions = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.user.username} - Dynamic Permissions"

    class Meta:
        verbose_name = "Xodim Ruxsati"
        verbose_name_plural = "Xodim Ruxsatlari"