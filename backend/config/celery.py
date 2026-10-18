import os
from celery import Celery
from celery.schedules import crontab

# Django sozlamalarini celery uchun o'rnatish
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('educational_platform')

# Django settings'dagi CELERY prefiksli barcha sozlamalarni o'qiydi
app.config_from_object('django.conf:settings', namespace='CELERY')

# Barcha installed app'lardagi tasks.py fayllarini avtomatik qidiradi
app.autodiscover_tasks()

# Celery Safety Protocols
app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
