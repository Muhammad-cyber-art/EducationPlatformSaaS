import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0021_mentorgroupsalaryconfig'),
        ('groups', '0026_alter_group_days'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='mentorgroupsalaryconfig',
            name='mentor',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='group_salary_configs',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Mentor',
            ),
        ),
    ]
