from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0019_adminexpense'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='paid_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name="To'langan summa (jami)"),
        ),
        migrations.AddField(
            model_name='payment',
            name='is_partial',
            field=models.BooleanField(default=False, verbose_name="Bo'lib to'langan"),
        ),
    ]
