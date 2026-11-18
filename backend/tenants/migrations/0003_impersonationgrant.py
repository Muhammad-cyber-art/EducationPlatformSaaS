from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("tenants", "0002_tenant_telegram_bot_token")]
    operations = [migrations.CreateModel(
        name="ImpersonationGrant",
        fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("code_hash", models.CharField(max_length=64, unique=True)),
            ("admin_user_id", models.PositiveBigIntegerField()),
            ("expires_at", models.DateTimeField()),
            ("consumed_at", models.DateTimeField(blank=True, null=True)),
            ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="tenants.tenant")),
            ("ceo", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="tenants.ceouser")),
        ],
        options={"db_table": "tenants_impersonation_grant"},
    )]
