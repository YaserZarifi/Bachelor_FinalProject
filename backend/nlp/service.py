# ==============================================================
# service.py  (نسخه ۳ — با sklearn classifier + Groq fallback)
# جریان: crisis → sklearn classifier → (fallback: Groq API — دسته + احساسات)
#         → sentiment → نتیجه نهایی
# ==============================================================

from __future__ import annotations
import logging
from dataclasses import dataclass, asdict

from .crisis_keywords import is_crisis
from .classifier import predict_category        # ← sklearn
from .sentiment import analyze_sentiment
from .groq_client import classify_with_groq     # ← LLM fallback (Groq)

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
    sentiment_source: str = "lexicon"   # "lexicon" | "groq"

    def to_dict(self) -> dict:
        return asdict(self)


# ──────────────────────────────────────────────────────────────
# سرویس اصلی
# ──────────────────────────────────────────────────────────────

def analyze_report(text: str, available_categories: list[str] | None = None) -> NLPResult:
    """
    تحلیل کامل یک گزارش شهری.

    Args:
        text: متن توضیحات گزارش
        available_categories: لیست دسته‌های DB برای fallback مدل زبانی (Groq)

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
    groq_sentiment = None   # اگر Groq اجرا شود، احساساتش هم برمی‌گردد

    if not sklearn_result["needs_ai_fallback"]:
        # مدل محلی اطمینان کافی دارد
        suggested_category = sklearn_result["category"]
        category_confidence = sklearn_result["confidence"]
        category_source = "sklearn"
        all_scores = sklearn_result["all_scores"]

    elif available_categories:
        # ── ۳. Fallback به Groq (دسته + احساسات در یک فراخوانی) ─────
        logger.info(
            f"[NLP] sklearn confidence={sklearn_result['confidence']:.2f} — "
            "calling Groq API"
        )
        ai_result = classify_with_groq(text, available_categories)
        all_scores = sklearn_result["all_scores"]  # نگه‌داری برای مقایسه
        if ai_result is not None:
            used_ai = True
            suggested_category = ai_result["category"]
            category_confidence = ai_result["confidence"]
            category_source = "groq" if suggested_category else "unknown"
            groq_sentiment = ai_result.get("sentiment")
        else:
            # Groq در دسترس نبود یا خطا داد → بدون شکست، دسته نامشخص
            suggested_category = None
            category_confidence = sklearn_result["confidence"]
            category_source = "unknown"

    else:
        suggested_category = None
        category_confidence = sklearn_result["confidence"]
        category_source = "unknown"
        all_scores = sklearn_result["all_scores"]

    # ── ۴. تحلیل احساسات ────────────────────────────────────────
    # پیش‌فرض: لغت‌نامه. اگر Groq احساسات معتبر برگردانده باشد، همان اولویت دارد
    # تا مشکل «همیشه خنثی» لغت‌نامه رفع شود.
    sentiment = analyze_sentiment(text)
    sentiment_source = "lexicon"
    if groq_sentiment:
        sentiment = groq_sentiment
        sentiment_source = "groq"

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
        sentiment_source=sentiment_source,
    )
