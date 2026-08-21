import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from authenticatsiya.models import UserModel
from groups.models import Student
from telegram_bot.models import BotProfile

print("Migrating existing telegram IDs to BotProfile...")

# Admins
admins = UserModel.objects.filter(telegram_chat_id__isnull=False).exclude(telegram_chat_id='')
for admin in admins:
    BotProfile.objects.update_or_create(
        telegram_id=admin.telegram_chat_id,
        defaults={
            'phone_number': admin.phone_number,
            'role': admin.role,
            'user': admin,
            'is_active': True
        }
    )
print(f"Migrated {admins.count()} admins.")

# Students
students = Student.objects.filter(telegram_id__isnull=False).exclude(telegram_id='')
for student in students:
    BotProfile.objects.update_or_create(
        telegram_id=student.telegram_id,
        defaults={
            'phone_number': student.phone,
            'role': 'student',
            'student': student,
            'is_active': True
        }
    )
print(f"Migrated {students.count()} students.")

# Parents
parents = Student.objects.filter(parent_telegram_id__isnull=False).exclude(parent_telegram_id='')
for parent in parents:
    BotProfile.objects.update_or_create(
        telegram_id=parent.parent_telegram_id,
        defaults={
            'phone_number': parent.parent_phone,
            'role': 'student',
            'student': parent,
            'is_active': True
        }
    )
print(f"Migrated {parents.count()} parents.")

print("Migration completed.")
