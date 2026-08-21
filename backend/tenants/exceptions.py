"""
Tenants app uchun maxsus exception sinflar.

Bu exceptionlar middleware va servis qatlamida ishlatiladi,
HTTP responseni to'g'ri qaytarish uchun middleware tomonidan tutiladi.
"""


class TenantNotFoundError(Exception):
    """
    Kelayotgan domen yoki schema uchun tenant topilmadi.

    Middleware bu exceptionni tutib, HTTP 404 qaytaradi.
    """
    def __init__(self, domain: str = None, schema: str = None):
        self.domain = domain
        self.schema = schema
        if domain:
            message = f"Domen '{domain}' uchun tenant topilmadi."
        elif schema:
            message = f"Schema '{schema}' uchun tenant topilmadi."
        else:
            message = "Tenant topilmadi."
        super().__init__(message)


class TenantInactiveError(Exception):
    """
    Topilgan tenant bloklangan (is_active=False).

    Middleware bu exceptionni tutib, HTTP 403 qaytaradi.
    """
    def __init__(self, tenant_name: str = None):
        self.tenant_name = tenant_name
        message = f"O'quv markaz '{tenant_name}' vaqtincha bloklangan." if tenant_name else "O'quv markaz bloklangan."
        super().__init__(message)


class TenantSchemaError(Exception):
    """
    PostgreSQL schemasi bilan ishlashda xatolik yuz berdi.
    Masalan, schema yaratilmagan yoki search_path o'rnatishda muammo.
    """
    def __init__(self, schema_name: str = None, original_error: Exception = None):
        self.schema_name = schema_name
        self.original_error = original_error
        message = f"Schema '{schema_name}' bilan ishlashda xatolik: {original_error}"
        super().__init__(message)


class InvalidSchemaNameError(ValueError):
    """
    Schema nomi noto'g'ri formatda (SQL injection oldini olish).
    Faqat [a-z0-9_] belgilari ruxsat etiladi.
    """
    def __init__(self, schema_name: str):
        self.schema_name = schema_name
        super().__init__(
            f"Noto'g'ri schema nomi: '{schema_name}'. "
            "Faqat kichik harflar, raqamlar va '_' belgisi ruxsat etiladi."
        )
