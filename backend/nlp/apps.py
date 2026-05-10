# apps.py
from django.apps import AppConfig


class NlpConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "nlp"
    verbose_name = "ماژول هوش مصنوعی / NLP"

    def ready(self):
        # سیگنال‌ها را هنگام بارگذاری اپ ثبت می‌کند
        import nlp.signals  # noqa: F401
