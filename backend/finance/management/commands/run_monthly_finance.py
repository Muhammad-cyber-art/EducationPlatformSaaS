from django.core.management.base import BaseCommand
from finance.services import generate_monthly_payments

class Command(BaseCommand):
    help = "Yangi oy uchun to'lov varaqalarini yaratadi"

    def handle(self, *args, **options):
        self.stdout.write("To'lovlarni yaratish boshlandi...")
        count = generate_monthly_payments()
        self.stdout.write(self.style.SUCCESS(f"Muvaffaqiyatli: {count} ta varaqalar yaratildi."))