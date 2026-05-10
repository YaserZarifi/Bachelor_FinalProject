# ==============================================================
# service.py  (نسخه ۲ — با sklearn classifier)
# جریان: crisis → sklearn classifier → (fallback: Claude API)
#         → sentiment → نتیجه نهایی
# ==============================================================

from __future__ import annotations
import logging
import os
from dataclasses import dataclass, asdict

from .crisis_keywords import is_crisis
from .classifier import predict_category        # ← جدید: sklearn
from .sentiment import analyze_sentiment

logger = logging.getLogger(__name__)


@dataclass
class NLPResult:
    """نتیجه کامل تحلیل NLP یک گزارش"""
    # دسته‌بندی
    suggested_category: str | None
    category_confidence: float
    category_source: str          # "sklearn" | "ai_api" | "keyword" | "unknown"
    category_all_scores: dict     # امتیاز همه دسته‌ها

    # بحران
    is_urgent: bool
    crisis_score: int
    crisis_keywords_found: list[str]

    # احساسات
    sentiment_label: str
    sentiment_label_fa: str
    sentiment_score: float
    sentiment_intensity: float

    # متا
    used_ai_fallback: bool
    raw_text_length: int

    def to_dict(self) -> dict:
        return asdict(self)


# ──────────────────────────────────────────────────────────────
# Claude API fallback
# ──────────────────────────────────────────────────────────────

def _call_claude_for_category(text: str, available_categories: list[str]) -> dict:
    """وقتی sklearn اطمینان کافی ندارد، از Claude API کمک می‌گیریم."""
    try:
        import anthropic
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not api_key:
            logger.warning("[NLP] ANTHROPIC_API_KEY not set — skipping AI fallback")
            return {"category": None, "confidence": 0.0}

        client = anthropic.Anthropic(api_key=api_key)
        categories_str = "\n".join(f"- {c}" for c in available_categories)

        prompt = f"""تو یک سیستم دسته‌بندی گزارش‌های شهری هستی.

دسته‌های موجود:
{categories_str}
- سایر (هیچ‌کدام از موارد بالا)

متن گزارش:
\"\"\"{text}\"\"\"

فقط نام دسته را بنویس. بدون توضیح."""

        msg = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=30,
            messages=[{"role": "user", "content": prompt}],
        )
        result = msg.content[0].text.strip()

        if result in available_categories:
            return {"category": result, "confidence": 0.85}
        for cat in available_categories:
            if cat in result or result in cat:
                return {"category": cat, "confidence": 0.70}
        return {"category": None, "confidence": 0.5}

    except ImportError:
        logger.error("[NLP] anthropic not installed. Run: pip install anthropic")
    except Exception as e:
        logger.error(f"[NLP] Claude API error: {e}")
    return {"category": None, "confidence": 0.0}


# ──────────────────────────────────────────────────────────────
# سرویس اصلی
# ──────────────────────────────────────────────────────────────

def analyze_report(text: str, available_categories: list[str] | None = None) -> NLPResult:
    """
    تحلیل کامل یک گزارش شهری.

    Args:
        text: متن توضیحات گزارش
        available_categories: لیست دسته‌های DB برای Claude fallback

    Returns:
        NLPResult
    """
    if not text or not text.strip():
        return NLPResult(
            suggested_category=None, category_confidence=0.0,
            category_source="unknown", category_all_scores={},
            is_urgent=False, crisis_score=0, crisis_keywords_found=[],
            sentiment_label="neutral", sentiment_label_fa="خنثی",
            sentiment_score=0.0, sentiment_intensity=0.0,
            used_ai_fallback=False, raw_text_length=0,
        )

    # ── ۱. بررسی بحران ──────────────────────────────────────────
    urgent, crisis_score, crisis_kws = is_crisis(text)

    # ── ۲. sklearn classifier ────────────────────────────────────
    sklearn_result = predict_category(text)
    used_ai = False

    if not sklearn_result["needs_ai_fallback"]:
        # مدل محلی اطمینان کافی دارد
        suggested_category = sklearn_result["category"]
        category_confidence = sklearn_result["confidence"]
        category_source = "sklearn"
        all_scores = sklearn_result["all_scores"]

    elif available_categories:
        # ── ۳. Fallback به Claude API ────────────────────────────
        logger.info(
            f"[NLP] sklearn confidence={sklearn_result['confidence']:.2f} — "
            "calling Claude API"
        )
        ai_result = _call_claude_for_category(text, available_categories)
        used_ai = True
        suggested_category = ai_result["category"]
        category_confidence = ai_result["confidence"]
        category_source = "ai_api" if suggested_category else "unknown"
        all_scores = sklearn_result["all_scores"]  # نگه‌داری برای مقایسه

    else:
        suggested_category = None
        category_confidence = sklearn_result["confidence"]
        category_source = "unknown"
        all_scores = sklearn_result["all_scores"]

    # ── ۴. تحلیل احساسات ────────────────────────────────────────
    sentiment = analyze_sentiment(text)

    return NLPResult(
        suggested_category=suggested_category,
        category_confidence=round(category_confidence, 3),
        category_source=category_source,
        category_all_scores=all_scores,
        is_urgent=urgent,
        crisis_score=crisis_score,
        crisis_keywords_found=crisis_kws,
        sentiment_label=sentiment["label"],
        sentiment_label_fa=sentiment["label_fa"],
        sentiment_score=sentiment["score"],
        sentiment_intensity=sentiment["intensity"],
        used_ai_fallback=used_ai,
        raw_text_length=len(text),
    )
