from django.db import migrations, models


def reject_duplicate_invoices(apps, schema_editor):
    payment = apps.get_model('finance', 'Payment')
    duplicates = payment.objects.using(schema_editor.connection.alias).filter(
        student__isnull=False, group__isnull=False, month__isnull=False,
    ).values('student_id', 'group_id', 'month').annotate(count=models.Count('id')).filter(count__gt=1)
    if duplicates.exists():
        raise RuntimeError(
            'Duplicate monthly invoices detected. Run audit_financial_integrity --all-tenants '
            'before deployment and reconcile the reported invoice IDs. '
            'No financial rows have been merged or deleted.'
        )


class Migration(migrations.Migration):
    dependencies = [('finance', '0034_attendanceauditlog')]
    operations = [
        migrations.RunPython(reject_duplicate_invoices, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='payment',
            constraint=models.UniqueConstraint(
                fields=('student', 'group', 'month'),
                condition=models.Q(student__isnull=False, group__isnull=False, month__isnull=False),
                name='unique_student_group_month_bill',
            ),
        ),
    ]
