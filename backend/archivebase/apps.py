from django.apps import AppConfig

class ArchivebaseConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'archivebase'

    def ready(self):
        import archivebase.signals  # Signalni bu yerda import qilamiz