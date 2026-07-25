"""Minimal Groq API client (stdlib only, no extra dependencies).

Groq exposes an OpenAI-compatible Chat Completions endpoint. We use it as the
LLM fallback for report classification + sentiment, replacing the old Gemini
fallback. Mirrors the stdlib approach of ``pushnotify/expo.py``.

See https://console.groq.com/docs/api-reference#chat-create
"""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
_DEFAULT_MODEL = "llama-3.3-70b-versatile"
_TIMEOUT = 8  # seconds — keep short; runs on the report-create request thread

# نگاشت برچسب احساسات مدل به فارسی + امتیاز عددی هم‌راستا با sentiment.py
_SENTIMENT_MAP = {
    "positive": {"label": "positive", "label_fa": "مثبت", "score": 0.6, "intensity": 0.6},
    "negative": {"label": "negative", "label_fa": "منفی", "score": -0.6, "intensity": 0.6},
    "neutral": {"label": "neutral", "label_fa": "خنثی", "score": 0.0, "intensity": 0.0},
}


def is_configured() -> bool:
    """آیا کلید Groq تنظیم شده است؟"""
    return bool(os.environ.get("GROQ_API_KEY", "").strip())


def _map_sentiment(raw: str | None) -> dict | None:
    if not raw:
        return None
    key = str(raw).strip().lower()
    # پذیرش برچسب فارسی هم در صورت بازگشت
    if key in ("مثبت", "positive"):
        key = "positive"
    elif key in ("منفی", "negative"):
        key = "negative"
    elif key in ("خنثی", "neutral"):
        key = "neutral"
    return _SENTIMENT_MAP.get(key)


def _map_category(raw: str | None, available_categories: list[str]) -> tuple[str | None, float]:
    """نگاشت خروجی مدل به یکی از دسته‌های DB — exact سپس fuzzy (مثل منطق قبلی Gemini)."""
    if not raw:
        return None, 0.0
    result = str(raw).strip()
    if result in available_categories:
        return result, 0.90
    for cat in available_categories:
        if cat in result or result in cat:
            return cat, 0.75
    # مدل «سایر» یا چیز نامرتبط برگردانده
    return None, 0.5


def classify_with_groq(text: str, available_categories: list[str]) -> dict | None:
    """وقتی sklearn اطمینان کافی ندارد، از Groq برای دسته + احساسات کمک می‌گیریم.

    Returns:
        {
            "category": str | None,
            "confidence": float,
            "sentiment": {"label", "label_fa", "score", "intensity"} | None,
        }
        یا ``None`` اگر Groq تنظیم نشده باشد یا فراخوانی با خطا مواجه شود.
    """
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.warning("[NLP] GROQ_API_KEY not set — skipping Groq fallback")
        return None

    model = os.environ.get("GROQ_MODEL", "").strip() or _DEFAULT_MODEL
    categories_str = "\n".join(f"- {c}" for c in available_categories)

    system_prompt = (
        "تو یک سیستم دسته‌بندی گزارش‌های شهری فارسی هستی. "
        "همیشه فقط یک شیء JSON معتبر برمی‌گردانی، بدون هیچ توضیح اضافی."
    )
    user_prompt = f"""دسته‌های مجاز:
{categories_str}
- سایر (هیچ‌کدام از موارد بالا)

متن گزارش:
\"\"\"{text}\"\"\"

یک شیء JSON دقیقاً با این ساختار برگردان:
{{"category": "<نام دقیق یکی از دسته‌های بالا یا سایر>", "sentiment": "positive|negative|neutral"}}

- مقدار category باید عیناً یکی از نام‌های فهرست بالا (یا «سایر») باشد.
- مقدار sentiment احساس شهروند نسبت به مشکل است: منفی برای شکایت/نارضایتی، خنثی برای گزارش ساده."""

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.0,
        "max_tokens": 200,
        "response_format": {"type": "json_object"},
    }

    req = urllib.request.Request(
        GROQ_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            # Groq sits behind Cloudflare, which 403s (error 1010) the default
            # ``Python-urllib`` User-Agent. Send an explicit one.
            "User-Agent": "UrbanHelper-NLP/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            parsed = json.loads(resp.read().decode("utf-8"))
        content = parsed["choices"][0]["message"]["content"]
        data = json.loads(content)
    except urllib.error.HTTPError as exc:
        body = ""
        try:
            body = exc.read().decode("utf-8", errors="replace")
        except Exception:  # pragma: no cover - defensive
            pass
        logger.error("[NLP] Groq HTTP error %s: %s", exc.code, body[:300])
        return None
    except urllib.error.URLError as exc:
        logger.error("[NLP] Groq request failed: %s", exc)
        return None
    except (KeyError, IndexError, ValueError) as exc:
        logger.error("[NLP] Groq response parse error: %s", exc)
        return None
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("[NLP] Groq unexpected error: %s", exc, exc_info=True)
        return None

    category, confidence = _map_category(data.get("category"), available_categories)
    sentiment = _map_sentiment(data.get("sentiment"))

    return {
        "category": category,
        "confidence": confidence,
        "sentiment": sentiment,
    }
