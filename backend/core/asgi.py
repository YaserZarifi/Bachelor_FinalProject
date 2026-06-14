"""
ASGI entrypoint: HTTP via Django, WebSockets via Channels (UrbanHelper).
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Initialize Django before importing Channels or any app routing
django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.conf import settings
import civic_api.routing

allowed_origins = getattr(settings, "WEBSOCKET_ALLOWED_ORIGINS", ["http://localhost:3001"])

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": OriginValidator(
            AuthMiddlewareStack(URLRouter(civic_api.routing.websocket_urlpatterns)),
            allowed_origins,
        ),
    }
)
