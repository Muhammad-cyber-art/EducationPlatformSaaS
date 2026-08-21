from django.db import models
from django.core.validators import RegexValidator

color_validator = RegexValidator(
    regex=r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
    message='Xato format! Rang #ffffff kabi bo\'lishi kerak.'
)
class Branch(models.Model):
    color = models.CharField(max_length=7, default="#ffffff", validators=[color_validator])

    name = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
