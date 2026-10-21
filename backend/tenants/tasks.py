import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def migrate_tenant_schema_async_task(schema_name: str):
    """
    Belgilangan tenant schema migratsiyasini Celery orqali asinxron bajarish.
    """
    from django.core.management import call_command
    from tenants.utils import validate_schema_name, schema_exists

    if not validate_schema_name(schema_name):
        logger.error(f"Noto'g'ri schema nomi: {schema_name}")
        return False

    if not schema_exists(schema_name):
        logger.error(f"Schema mavjud emas: {schema_name}")
        return False

    logger.info(f"Schema {schema_name} uchun asinxron migratsiya boshlandi...")
    try:
        call_command("migrate_tenant_schema", schema_name, verbosity=1)
        logger.info(f"Schema {schema_name} uchun asinxron migratsiya muvaffaqiyatli yakunlandi.")
        return True
    except Exception as exc:
        logger.error(f"Schema {schema_name} uchun asinxron migratsiyada xatolik: {exc}", exc_info=True)
        return False


@shared_task
def migrate_all_tenants_task():
    """
    Barcha faol tenantlarni asinxron tekshirib, migratsiyalarini yangilash.
    """
    from tenants.models import Tenant

    active_tenants = Tenant.objects.filter(is_active=True)
    results = {}
    for tenant in active_tenants:
        try:
            success = migrate_tenant_schema_async_task(tenant.schema_name)
            results[tenant.schema_name] = success
        except Exception as exc:
            results[tenant.schema_name] = False
            logger.error(f"Tenant {tenant.schema_name} migratsiyasida xatolik: {exc}")

    return results
