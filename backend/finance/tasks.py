from celery import shared_task
from .services import generate_monthly_payments
import logging

logger = logging.getLogger(__name__)

@shared_task
def generate_monthly_payments_task():
    """Har oyning 1-kunida oylik to'lovlarni generatsiya qilish (Multi-tenant)."""
    from tenants.models import Tenant
    from tenants.utils import tenant_schema_context

    logger.info("Oylik to'lovlarni yaratish boshlandi (Multi-tenant)...")
    active_tenants = Tenant.objects.filter(is_active=True)

    if not active_tenants.exists():
        count = generate_monthly_payments()
        logger.info(f"Oylik to'lovlar yaratildi (public): {count} ta")
        return count

    total_count = 0
    for tenant in active_tenants:
        try:
            with tenant_schema_context(tenant.schema_name):
                count = generate_monthly_payments()
                total_count += count
                logger.info(f"[{tenant.name} - {tenant.schema_name}] {count} ta to'lov yaratildi.")
        except Exception as exc:
            logger.error(f"Tenant {tenant.schema_name} uchun to'lov yaratishda xatolik: {exc}", exc_info=True)

    logger.info(f"Jami barcha markazlar uchun {total_count} ta to'lov yaratildi.")
    return total_count

