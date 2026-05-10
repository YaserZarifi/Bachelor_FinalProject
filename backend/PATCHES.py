# ============================================================
# PATCH 1: core/settings.py
# این دو تغییر را اعمال کن:
# ============================================================

# ── الف) در INSTALLED_APPS، بعد از 'reports' اضافه کن: ──────
INSTALLED_APPS = [
    # ... بقیه ...
    'reports',
    'nlp',           # ← این خط را اضافه کن
]

# ── ب) در انتهای فایل اضافه کن: ────────────────────────────
# NLP / AI Settings
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Logging برای ماژول NLP
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "loggers": {
        "nlp": {
            "handlers": ["console"],
            "level": "INFO",
        },
    },
}


# ============================================================
# PATCH 2: core/urls.py
# ============================================================

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('reports.urls')),
    path('api/nlp/', include('nlp.urls')),   # ← این خط را اضافه کن
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


# ============================================================
# PATCH 3: requirements.txt
# این خط‌ها را اضافه کن:
# ============================================================
# anthropic>=0.40.0
