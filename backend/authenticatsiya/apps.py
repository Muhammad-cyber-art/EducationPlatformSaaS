from django.apps import AppConfig


class AuthenticatsiyaConfig(AppConfig):
    name = 'authenticatsiya'

    def ready(self):
        from django.contrib.auth.models import AnonymousUser
        # Monkey patch AnonymousUser for drf-spectacular schema generation
        # where it evaluates permissions without a real user
        AnonymousUser.role = None
        AnonymousUser.branch_id = None
        AnonymousUser.branch = None
