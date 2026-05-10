"""Guest report access tokens stored in Redis (no DB migration on root-owned models)."""
from __future__ import annotations

import secrets

import redis
from django.conf import settings


def _client() -> redis.Redis:
    host = getattr(settings, "REDIS_HOST", "127.0.0.1")
    port = int(getattr(settings, "REDIS_PORT", 6379))
    return redis.Redis(host=host, port=port, db=1, decode_responses=True)


def _key(report_id: int) -> str:
    return f"uh:guest_ws:{report_id}"


def issue_guest_token(report_id: int) -> str:
    token = secrets.token_urlsafe(32)
    _client().set(_key(report_id), token, ex=60 * 60 * 24 * 365 * 2)
    return token


def verify_guest_token(report_id: int, token: str) -> bool:
    if not token:
        return False
    stored = _client().get(_key(report_id))
    return stored == token


def revoke_guest_token(report_id: int) -> None:
    _client().delete(_key(report_id))
