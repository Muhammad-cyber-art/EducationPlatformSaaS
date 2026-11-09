"""Isolated local tests: never connect to the application's configured database."""
from .settings import *  # noqa: F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache+memory://'
TELEGRAM_BOT_TOKEN = ''
ALLOWED_HOSTS = ['testserver', 'localhost', '.localhost', '.crm.uz', '.chronous.uz']
DEBUG = False
SECURE_SSL_REDIRECT = False
