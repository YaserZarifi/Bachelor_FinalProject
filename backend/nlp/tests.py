# ==============================================================
# tests.py
# تست‌های جامع ماژول NLP
# اجرا: python manage.py test nlp
# ==============================================================

from django.test import TestCase
from .crisis_keywords import is_crisis, calculate_crisis_score
from .categorizer import classify_text
from .sentiment import analyze_sentiment
from .service import analyze_report


class CrisisDetectionTests(TestCase):
    """تست‌های تشخیص بحران"""

    def test_fire_emergency(self):
        text = "آتش‌سوزی در پارک محله، خیلی خطرناک است"
        urgent, score, kws = is_crisis(text)
        self.assertTrue(urgent)
        self.assertIn("آتش‌سوزی", kws)

    def test_gas_leak(self):
        text = "نشت گاز از لوله معیوب در کوچه"
        urgent, score, kws = is_crisis(text)
        self.assertTrue(urgent)

    def test_open_manhole(self):
        text = "چاه باز در وسط خیابان. خیلی خطرناک است"
        urgent, score, kws = is_crisis(text)
        self.assertTrue(urgent)

    def test_normal_report_not_urgent(self):
        text = "آسفالت خیابان خراب شده و دست‌انداز دارد"
        urgent, score, kws = is_crisis(text)
        self.assertFalse(urgent)

    def test_empty_text(self):
        urgent, score, kws = is_crisis("")
        self.assertFalse(urgent)
        self.assertEqual(score, 0)


class CategorizerTests(TestCase):
    """تست‌های دسته‌بندی گزارش"""

    def test_pothole_category(self):
        text = "آسفالت کوچه خراب شده و چاله بزرگی ایجاد شده"
        result = classify_text(text)
        self.assertEqual(result["category"], "خرابی آسفالت")
        self.assertGreater(result["confidence"], 0.3)

    def test_trash_category(self):
        text = "زباله‌های انباشته شده در کنار خیابان بوی بد می‌دهد"
        result = classify_text(text)
        self.assertEqual(result["category"], "انباشت زباله")

    def test_lighting_category(self):
        text = "چراغ خیابان خاموش شده و شب‌ها تاریک است"
        result = classify_text(text)
        self.assertEqual(result["category"], "مشکلات روشنایی")

    def test_water_category(self):
        text = "لوله ترکیده و فاضلاب جلوی خانه جاری است"
        result = classify_text(text)
        self.assertEqual(result["category"], "آب و فاضلاب")

    def test_unknown_text_needs_fallback(self):
        text = "یک مشکل وجود دارد"  # متن بسیار مبهم
        result = classify_text(text)
        self.assertTrue(result["needs_ai_fallback"] or result["confidence"] < 0.35)


class SentimentTests(TestCase):
    """تست‌های تحلیل احساسات"""

    def test_negative_angry(self):
        text = "خیلی بد است! اعتراض دارم. رسیدگی نمی‌کنند"
        result = analyze_sentiment(text)
        self.assertEqual(result["label"], "negative")
        self.assertLess(result["score"], 0)

    def test_positive_grateful(self):
        text = "ممنون که رفع شد. خیلی خوب بود"
        result = analyze_sentiment(text)
        self.assertEqual(result["label"], "positive")
        self.assertGreater(result["score"], 0)

    def test_neutral(self):
        text = "چراغ خیابان در موقعیت مشخص خاموش است"
        result = analyze_sentiment(text)
        self.assertEqual(result["label"], "neutral")

    def test_intensity_with_intensifier(self):
        text = "بسیار خطرناک است و به شدت اعتراض دارم"
        result = analyze_sentiment(text)
        self.assertGreater(result["intensity"], 0.3)


class NLPServiceIntegrationTests(TestCase):
    """تست‌های یکپارچه سرویس اصلی"""

    def test_full_pipeline_crisis_report(self):
        text = "آتش‌سوزی در پارک! اورژانسی است. خیلی خطرناک"
        result = analyze_report(text, available_categories=["مشکلات فضای سبز"])
        self.assertTrue(result.is_urgent)
        self.assertGreater(result.crisis_score, 0)

    def test_full_pipeline_pothole(self):
        text = "آسفالت خیابان اصلی دارای چاله عمیق است و خطرناک است"
        result = analyze_report(
            text,
            available_categories=["خرابی آسفالت", "انباشت زباله", "مشکلات روشنایی"],
        )
        self.assertEqual(result.suggested_category, "خرابی آسفالت")
        self.assertFalse(result.used_ai_fallback)

    def test_empty_text_returns_safe_defaults(self):
        result = analyze_report("")
        self.assertFalse(result.is_urgent)
        self.assertIsNone(result.suggested_category)
        self.assertEqual(result.sentiment_label, "neutral")

    def test_result_is_serializable(self):
        import json
        text = "زباله انباشته شده در کوچه"
        result = analyze_report(text)
        # نباید خطا بدهد
        serialized = json.dumps(result.to_dict(), ensure_ascii=False)
        self.assertIsInstance(serialized, str)
