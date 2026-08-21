from django.core.management.base import BaseCommand
from homework_attends.models import Attendance
from datetime import date
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Eski logika bo\'yicha yaratilgan va False bo\'lib qolgan 4-Aprel davomatlarini True ga aylantiradi.'

    def handle(self, *args, **options):
        # Faqat qat'iy ravishda bugungi sana: 2026 yil 4 Aprel
        target_date = date(2026, 4, 4)
        
        # FAQAT 4-aprelga tegishli, False turgan va admin tasdiqlamagan(marked_by=null) larni olamiz
        attendances = Attendance.objects.filter(
            date=target_date, 
            is_present=False, 
            marked_by__isnull=True
        )
        
        count = attendances.count()
        
        if count > 0:
            attendances.update(is_present=True)
            self.stdout.write(self.style.SUCCESS(f'Muvaffaqiyatli: {count} ta davomat True ga (Keldi state) aylantirildi.'))
        else:
            self.stdout.write(self.style.WARNING(f'Hech narsa o\'zgartirilmadi: 4-aprel uchun "Kelmadi" degan tizim yozuvlari topilmadi.'))
