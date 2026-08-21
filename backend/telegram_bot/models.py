from django.db import models

class BotProfile(models.Model):
    ROLE_CHOICES = (
        ('super_admin', 'Super Admin'),
        ('admin', 'Admin'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
    )
    
    telegram_id = models.CharField(max_length=50, unique=True, db_index=True, verbose_name="Telegram ID")
    phone_number = models.CharField(max_length=20, verbose_name="Telefon raqam")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, verbose_name="Rol")
    
    user = models.OneToOneField('authenticatsiya.UserModel', null=True, blank=True, on_delete=models.CASCADE, related_name='bot_profile')
    student = models.OneToOneField('groups.Student', null=True, blank=True, on_delete=models.CASCADE, related_name='bot_profile')
    
    is_active = models.BooleanField(default=True, verbose_name="Faolmi")
    language = models.CharField(max_length=10, default='uz', verbose_name="Til")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan vaqti")
    
    def get_full_name(self):
        if self.user:
            return self.user.get_full_name() or self.user.username
        if self.student:
            return self.student.full_name
        return "Noma'lum"

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"
    
    class Meta:
        verbose_name = "Bot Foydalanuvchisi"
        verbose_name_plural = "Bot Foydalanuvchilari"
