"""Minimal Expo Push API client (stdlib only, no extra dependencies).

See https://docs.expo.dev/push-notifications/sending-notifications/
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"
_CHUNK = 100  # Expo accepts up to 100 messages per request


def is_expo_token(token: str | None) -> bool:
    return bool(token) and (
        token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")
    )


def send_push_messages(messages: list[dict]) -> list[dict]:
    """POST a batch of Expo messages. Returns the list of per-message tickets.

    Each message dict should contain at least ``to``; optionally ``title``,
    ``body``, ``data``, ``sound``, ``priority``, ``channelId``.
    """
    tickets: list[dict] = []
    valid = [m for m in messages if is_expo_token(m.get("to"))]
    if not valid:
        return tickets

    for start in range(0, len(valid), _CHUNK):
        chunk = valid[start : start + _CHUNK]
        body = json.dumps(chunk).encode("utf-8")
        req = urllib.request.Request(
            EXPO_PUSH_ENDPOINT,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                parsed = json.loads(resp.read().decode("utf-8"))
                data = parsed.get("data", [])
                if isinstance(data, list):
                    tickets.extend(data)
        except urllib.error.URLError as exc:
            logger.warning("Expo push request failed: %s", exc)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Expo push unexpected error: %s", exc, exc_info=True)

    return tickets
