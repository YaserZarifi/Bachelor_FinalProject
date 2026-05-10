from django.apps import AppConfig


class CivicApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "civic_api"
    verbose_name = "UrbanHelper API / Realtime"

    def ready(self):
        import civic_api.signals  # noqa: F401
