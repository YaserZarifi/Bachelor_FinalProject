"""Settings used by the automated test-suite.

Run with::

    python manage.py test --settings=core.settings_test

Differences from ``core.settings`` — every one of them exists so the suite is
*hermetic*: it must never touch the developer's Redis data, never reach an
external API (Groq / Expo), and never depend on a running Celery worker.
"""

import os
import tempfile

from .settings import *  # noqa: F401,F403

# ── Channels ────────────────────────────────────────────────────────────
# An in-memory layer keeps WebSocket group delivery deterministic and removes
# the Redis dependency from consumer tests.
CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}

# ── Celery ──────────────────────────────────────────────────────────────
# Tasks execute inline in the calling process, so ``.delay()`` never needs a
# broker. Tests that assert *enqueueing* still patch ``.delay`` explicitly.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = False

# ── Speed ───────────────────────────────────────────────────────────────
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Uploaded test images land in a throwaway directory, never in backend/media/.
MEDIA_ROOT = tempfile.mkdtemp(prefix="urbanhelper-test-media-")

# ── External services must stay unreachable ─────────────────────────────
# Without a key the Groq fallback short-circuits, so no test can accidentally
# spend quota or depend on network availability. Tests that need the fallback
# patch ``nlp.service.classify_with_groq`` / ``urllib.request.urlopen``.
os.environ.pop("GROQ_API_KEY", None)
os.environ["GROQ_API_KEY"] = ""

DEBUG = False

# Swaps the guest-token Redis client for an in-memory double (see the module).
TEST_RUNNER = "core.test_runner.UrbanHelperTestRunner"
