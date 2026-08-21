"""
Database Router — Tenant modellarini doim public schemaga yo'naltiradi.

Django bir nechta router qo'llab-quvvatlaydi. Bu router faqat
`tenants` app modellarini boshqaradi — qolganlarini default routerga
qoldiradi.

Qanday ishlaydi:
    - tenants.Tenant, tenants.Domain, tenants.Subscription, tenants.CEOUser
      → Har doim 'default' DB (public schema)
    - Boshqa barcha modellar → Middleware tomonidan o'rnatilgan search_path
      orqali ishlaydi (tenant schema)
"""

# Bu app modellari har doim public schemada
TENANT_APP_LABEL = "tenants"


class TenantSchemaRouter:
    """
    Multi-tenant database router.

    Tenant app modellari uchun har doim 'default' DB ishlatiladi.
    Boshqa app modellari uchun None qaytaradi (Django default yo'naltiradi).
    """

    def db_for_read(self, model, **hints):
        """O'qish uchun DB tanlash."""
        if model._meta.app_label == TENANT_APP_LABEL:
            return "default"
        return None  # Boshqa routerga yoki default'ga qoldiradi

    def db_for_write(self, model, **hints):
        """Yozish uchun DB tanlash."""
        if model._meta.app_label == TENANT_APP_LABEL:
            return "default"
        return None

    def allow_relation(self, obj1, obj2, **hints):
        """
        Ikki model orasidagi relation ruxsatini tekshiradi.
        Bir xil DB'dan bo'lsa ruxsat beradi.
        """
        if (
            obj1._meta.app_label == TENANT_APP_LABEL
            or obj2._meta.app_label == TENANT_APP_LABEL
        ):
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Migatsiya ruxsati.
        - tenants app → faqat 'default' (public schema) da migrate bo'ladi
        - Boshqalar → ham 'default' da migrate bo'ladi (search_path orqali)
        """
        # tenants app faqat default DBda migrate bo'lsin
        if app_label == TENANT_APP_LABEL:
            return db == "default"
        return None
