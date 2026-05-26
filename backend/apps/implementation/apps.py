from django.apps import AppConfig


class ImplementationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.implementation'
    verbose_name = 'Implementation'

    def ready(self):
        import apps.implementation.signals  # noqa: F401
