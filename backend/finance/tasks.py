from celery import shared_task
from .services import generate_monthly_payments
import logging

logger = logging.getLogger(__name__)

@shared_task
def generate_monthly_payments_task():
    logger.info("Oylik to'lovlarni yaratish boshlandi...")
    count = generate_monthly_payments()
    logger.info(f"Oylik to'lovlar yaratildi: {count} ta")
    return count
