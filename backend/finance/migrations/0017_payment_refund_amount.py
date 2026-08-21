# Generated migration for refund_amount field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0016_employeepayment_attendance_deductions_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='refund_amount',
            field=models.DecimalField(default=0, decimal_places=2, max_digits=10, verbose_name='Refund miqdori'),
        ),
    ]
