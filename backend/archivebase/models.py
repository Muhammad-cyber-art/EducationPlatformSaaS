# Create your models here.
from django.db import models
from django.conf import settings

class ArchiveBase(models.Model):
    """Barcha arxivlar uchun umumiy maydonlar"""
    original_id = models.IntegerField(help_text="Asl ob'ektning ID raqami")
    full_name = models.CharField(max_length=255)
    archived_at = models.DateTimeField(auto_now_add=True)
    # Amallarni bajargan SuperAdmin
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name="%(class)s_actions"
    )
    reason = models.TextField(blank=True, null=True)
    # O'chirilgan vaqtdagi barcha ma'lumotlar snapshot ko'rinishida
    metadata = models.JSONField(default=dict, help_text="Barcha ma'lumotlar lug'ati")

    class Meta:
        abstract = True

class ArchivedStudent(ArchiveBase):
    branch_name = models.CharField(max_length=200, blank=True, null=True)
    last_group_name = models.CharField(max_length=200, blank=True, null=True)

    class Meta:
        verbose_name = "Arxivlangan Student"

class ArchivedLid(ArchiveBase):
    branch_name = models.CharField(max_length=200, blank=True, null=True)
    phone = models.CharField(max_length=25, blank=True, null=True)
    subject = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        verbose_name = "Arxivlangan Lid"
        verbose_name_plural = "Arxivlangan Lidlar"

class ArchivedStaff(ArchiveBase):
    ROLE_CHOICES = [('mentor', 'Mentor'), ('admin', 'Admin')]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    phone = models.CharField(max_length=25, blank=True, null=True)
    branch_id = models.IntegerField(null=True, blank=True, help_text="Filial ID raqami")

    class Meta:
        verbose_name = "Arxivlangan Xodim"


class ArchivedGroup(ArchiveBase):
    branch_name = models.CharField(max_length=200, blank=True, null=True)
    mentor_name = models.CharField(max_length=200, blank=True, null=True)
    subject = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        verbose_name = "Arxivlangan Guruh"


class PaymentArchive(models.Model):
    # Xodim ma'lumotlari (Profil o'chsa ham saqlanib qolishi uchun raqam va matn ko'rinishida)
    user_id = models.IntegerField()
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=50)
    branch_name = models.CharField(max_length=100, null=True)
    
    # To'lov ma'lumotlari (Kvitansiyadan olinadi)
    monthly_salary = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    karta = models.CharField(max_length=20, null=True)
    
    # Kvitansiya tafsilotlari
    month = models.DateField()
    is_paid = models.BooleanField()
    paid_at = models.DateTimeField(null=True, blank=True)
    
    # Arxivlash vaqti
    archived_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "To'lov Arxivi"

    def __str__(self):
        return f"Archive: {self.full_name} - {self.month}"


class ArchivedHomework(ArchiveBase):
    TYPE_CHOICES = [
        ('homework', 'Uyga Vazifa'),
        ('mock_test', 'Mock Test'),
    ]
    item_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='homework')
    group_id = models.IntegerField()
    group_name = models.CharField(max_length=200)
    mentor_name = models.CharField(max_length=200, blank=True, null=True)
    submission_stats = models.JSONField(default=dict, help_text="Talabalar statistikasi (snapshot)")

    class Meta:
        verbose_name = "Arxivlangan Uyga Vazifa"
        verbose_name_plural = "Arxivlangan Uyga Vazifalar"

    def __str__(self):
        return f"Archive: {self.full_name} (Group: {self.group_name})"