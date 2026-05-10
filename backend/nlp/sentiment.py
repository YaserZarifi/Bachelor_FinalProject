# ==============================================================
# sentiment.py
# تحلیل احساسات متن گزارش‌های فارسی
# سه سطح: منفی / خنثی / مثبت + شدت احساس
# ==============================================================

from __future__ import annotations

# ---------------------------------------------------------------
# واژگان احساسی فارسی با وزن
# وزن منفی = احساس منفی/اعتراضی | وزن مثبت = تشکر/رضایت
# ---------------------------------------------------------------

NEGATIVE_WORDS: dict[str, int] = {
    # اعتراض و ناراحتی
    "مشکل": 1, "خراب": 2, "افتضاح": 3, "بد": 2, "بدتر": 3,
    "ناراحت": 2, "عصبانی": 3, "خشمگین": 3, "اعتراض": 2,
    "شکایت": 2, "ناراضی": 2, "متأسف": 1, "متاسف": 1,
    "آزاردهنده": 2, "دردناک": 2, "کثیف": 2, "زشت": 2,
    "وحشتناک": 3, "فجیع": 3, "ناقص": 2, "معیوب": 2,
    "اشکال": 1, "ایراد": 1, "نقص": 1,
    # فوریت/اضطرار
    "خطرناک": 3, "خطر": 2, "اورژانسی": 3, "فوری": 2,
    # غفلت
    "توجه نمی‌کنند": 3, "بی‌توجهی": 3, "بی توجهی": 3,
    "رسیدگی نمی‌کنند": 3, "رها شده": 2, "فراموش شده": 2,
}

POSITIVE_WORDS: dict[str, int] = {
    "تشکر": 2, "ممنون": 2, "سپاسگزار": 3, "خوب": 2,
    "عالی": 3, "بهتر": 2, "بهبود": 2, "رفع شد": 3,
    "حل شد": 3, "اقدام شد": 2, "زیبا": 2, "تمیز": 2,
    "مرتب": 1, "منظم": 1,
}

INTENSIFIERS: list[str] = [
    "خیلی", "بسیار", "کاملاً", "کاملا", "اصلاً", "اصلا",
    "به شدت", "شدیداً", "شدیدا", "فوق‌العاده",
]


def analyze_sentiment(text: str) -> dict:
    """
    احساس غالب در متن گزارش را تحلیل می‌کند.

    Returns:
        {
            "label": "negative" | "neutral" | "positive",
            "label_fa": "منفی" | "خنثی" | "مثبت",
            "score": float,       # -1.0 (خیلی منفی) تا +1.0 (خیلی مثبت)
            "intensity": float,   # شدت احساس (0.0 - 1.0)
            "neg_score": int,
            "pos_score": int,
        }
    """
    # بررسی وجود تشدیدکننده در کنار هر کلمه
    intensifier_bonus = 1.5 if any(i in text for i in INTENSIFIERS) else 1.0

    neg_score = 0
    for word, weight in NEGATIVE_WORDS.items():
        if word in text:
            neg_score += weight

    pos_score = 0
    for word, weight in POSITIVE_WORDS.items():
        if word in text:
            pos_score += weight

    # اعمال ضریب تشدید
    if neg_score > pos_score:
        neg_score = int(neg_score * intensifier_bonus)
    else:
        pos_score = int(pos_score * intensifier_bonus)

    total = neg_score + pos_score
    if total == 0:
        return {
            "label": "neutral",
            "label_fa": "خنثی",
            "score": 0.0,
            "intensity": 0.0,
            "neg_score": 0,
            "pos_score": 0,
        }

    # score: از ۱- تا ۱+
    raw_score = (pos_score - neg_score) / total
    score = round(max(-1.0, min(1.0, raw_score)), 3)

    # intensity: چقدر احساس قوی است
    intensity = round(min(1.0, total / 10.0), 3)

    if score < -0.1:
        label, label_fa = "negative", "منفی"
    elif score > 0.1:
        label, label_fa = "positive", "مثبت"
    else:
        label, label_fa = "neutral", "خنثی"

    return {
        "label": label,
        "label_fa": label_fa,
        "score": score,
        "intensity": intensity,
        "neg_score": neg_score,
        "pos_score": pos_score,
    }
