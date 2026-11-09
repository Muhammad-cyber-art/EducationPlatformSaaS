"""Integration tests against the isolated audit PostgreSQL cluster on loopback."""
from .test_settings import *  # noqa: F403

DATABASES = {'default': {
    'ENGINE': 'django.db.backends.postgresql',
    'HOST': '127.0.0.1',
    'PORT': '55439',
    'USER': 'audit_runner',
    'NAME': 'postgres',
    'TEST': {'NAME': 'test_education_backend_audit'},
}}
