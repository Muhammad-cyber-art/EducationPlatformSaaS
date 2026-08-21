from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import BaseUserManager
from branches.models import Branch
from django.core.validators import RegexValidator
from config.validators import validate_image_file

color_validator = RegexValidator(
    regex=r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
    message='Xato format! Rang #ffffff kabi bo\'lishi kerak.'
)


class CustomUserManager(BaseUserManager):
    def create_user(self, password=None, **extra_fields):
        user = self.model(**extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'super_admin')
        return self.create_user(password=password, **extra_fields)

class UserModel(AbstractUser):
    ROLE_CHOICES = (
        ('super_admin', 'Super Admin'),
        ('admin', 'Admin'),
        ('mentor', 'Mentor'),
    )
    color = models.CharField(max_length=7, default="#ffffff", validators=[color_validator])
    image = models.ImageField(
        upload_to='users/', 
        null=True, 
        blank=True,
        validators=[validate_image_file]
    )

    role = models.CharField(
        max_length=15,
        choices=ROLE_CHOICES,
        default='mentor'
    )

    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )

    objects = CustomUserManager()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    phone_number = models.CharField(max_length=15, blank=True, null=True)
    subject = models.CharField(max_length=50, blank=True, null=True)
    telegram_chat_id = models.CharField(max_length=50, blank=True, null=True, verbose_name="Telegram Chat ID (Admin Bot)")
    
    def is_super_admin(self):
        return self.role == 'super_admin'

    
    def is_admin(self):
        return self.role == 'admin'

    
    def is_mentor(self):
        return self.role == 'mentor'

class BranchAccess(models.Model):
    user = models.ForeignKey(
        UserModel,
        on_delete=models.CASCADE,
        related_name='branch_accesses'  # user.branch_accesses orqali olish mumkin
    )
    branch = models.ForeignKey(
        'branches.Branch',  # branches app dagi Branch model
        on_delete=models.CASCADE
    )
    access_level = models.CharField(
        max_length=20,
        choices=[
            ('view', 'Faqat koʻrish'),
            ('edit', 'Tahrirlash'),
            ('admin', 'Toʻliq admin'),
        ],
        default='view'
    )
    granted_by = models.ForeignKey(
        UserModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='granted_branch_accesses'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'branch')  # Bir user bir branch ga faqat bitta ruxsat
        verbose_name = 'Branch ruxsati'
        verbose_name_plural = 'Branch ruxsatlari'
        db_table = 'authentication_branch_access'  # Agar kerak bo'lsa nom berish

    def __str__(self):
        return f"{self.user.username} → {self.branch.name} ({self.access_level})"
