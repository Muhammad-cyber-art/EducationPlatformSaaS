from django.apps import AppConfig


class TenantsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "tenants"
    verbose_name = "Multi-Tenant Management"

    def ready(self):
        """App yuklanganda pooling xavfsizlik signallarini ulash."""
        from tenants.signals import register_pooling_signals
        register_pooling_signals()
