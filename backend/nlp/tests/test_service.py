"""`nlp.service.analyze_report` — the orchestration of the whole pipeline:

    crisis keywords → sklearn classifier → (Groq fallback) → sentiment

Tests here focus on the *routing decisions* between stages, which is where the
behaviour actually lives; the individual stages have their own test modules.
"""

import json
from unittest import mock

from django.test import SimpleTestCase

from nlp.service import NLPResult, analyze_report

CATEGORIES = ["خرابی آسفالت", "انباشت زباله", "مشکلات روشنایی", "آب و فاضلاب"]


class EmptyInputTests(SimpleTestCase):
    def test_empty_text_returns_safe_defaults(self):
        result = analyze_report("")
        self.assertFalse(result.is_urgent)
        self.assertIsNone(result.suggested_category)
        self.assertEqual(result.sentiment_label, "neutral")
        self.assertEqual(result.raw_text_length, 0)

    def test_whitespace_only_text_returns_safe_defaults(self):
        self.assertIsNone(analyze_report("   \n  ").suggested_category)

    def test_empty_text_never_calls_the_llm(self):
        with mock.patch("nlp.service.classify_with_groq") as groq:
            analyze_report("", available_categories=CATEGORIES)
        groq.assert_not_called()

    def test_empty_text_reports_the_unknown_source(self):
        self.assertEqual(analyze_report("").category_source, "unknown")


class CrisisIntegrationTests(SimpleTestCase):
    def test_a_crisis_report_is_flagged_urgent(self):
        result = analyze_report("آتش‌سوزی در پارک! اورژانسی است. خیلی خطرناک", CATEGORIES)
        self.assertTrue(result.is_urgent)
        self.assertGreater(result.crisis_score, 0)

    def test_the_matched_keywords_are_reported(self):
        result = analyze_report("نشت گاز و خطر انفجار", CATEGORIES)
        self.assertIn("نشت گاز", result.crisis_keywords_found)

    def test_a_routine_report_is_not_urgent(self):
        self.assertFalse(analyze_report("چراغ کوچه خاموش است", CATEGORIES).is_urgent)


class ClassifierRoutingTests(SimpleTestCase):
    def test_a_confident_local_prediction_is_used_directly(self):
        result = analyze_report(
            "آسفالت خیابان اصلی دارای چاله عمیق است و خطرناک است", CATEGORIES
        )
        self.assertEqual(result.suggested_category, "خرابی آسفالت")
        self.assertEqual(result.category_source, "sklearn")
        self.assertFalse(result.used_ai_fallback)

    def test_a_confident_prediction_never_calls_the_llm(self):
        with mock.patch("nlp.service.classify_with_groq") as groq:
            analyze_report("چراغ خیابان خاموش شده و شب‌ها تاریک است", CATEGORIES)
        groq.assert_not_called()

    def test_an_unsure_prediction_does_call_the_llm(self):
        # The mirror image, using text the local model scores below the gate.
        with mock.patch("nlp.service.classify_with_groq", return_value=None) as groq:
            analyze_report("چاله در خیابان", CATEGORIES)
        groq.assert_called_once()

    def test_the_full_class_score_distribution_is_retained(self):
        result = analyze_report("چراغ خیابان خاموش است", CATEGORIES)
        self.assertGreater(len(result.category_all_scores), 1)


class LlmFallbackRoutingTests(SimpleTestCase):
    """When the local model is unsure (< 0.40) *and* categories are known."""

    LOW_CONFIDENCE = {
        "category": None,
        "confidence": 0.21,
        "all_scores": {"خرابی آسفالت": 0.21},
        "source": "sklearn",
        "needs_ai_fallback": True,
    }

    def test_low_confidence_escalates_to_the_llm(self):
        with mock.patch("nlp.service.predict_category", return_value=self.LOW_CONFIDENCE):
            with mock.patch(
                "nlp.service.classify_with_groq",
                return_value={"category": "انباشت زباله", "confidence": 0.9, "sentiment": None},
            ) as groq:
                result = analyze_report("یک وضعیت نامشخص", CATEGORIES)
        groq.assert_called_once()
        self.assertTrue(result.used_ai_fallback)
        self.assertEqual(result.suggested_category, "انباشت زباله")
        self.assertEqual(result.category_source, "groq")

    def test_without_known_categories_there_is_nothing_to_escalate_to(self):
        with mock.patch("nlp.service.predict_category", return_value=self.LOW_CONFIDENCE):
            with mock.patch("nlp.service.classify_with_groq") as groq:
                result = analyze_report("یک وضعیت نامشخص", available_categories=None)
        groq.assert_not_called()
        self.assertEqual(result.category_source, "unknown")
        self.assertFalse(result.used_ai_fallback)

    def test_an_unavailable_llm_degrades_to_unknown(self):
        with mock.patch("nlp.service.predict_category", return_value=self.LOW_CONFIDENCE):
            with mock.patch("nlp.service.classify_with_groq", return_value=None):
                result = analyze_report("یک وضعیت نامشخص", CATEGORIES)
        self.assertIsNone(result.suggested_category)
        self.assertEqual(result.category_source, "unknown")
        self.assertFalse(result.used_ai_fallback)

    def test_an_llm_answer_of_none_is_recorded_as_unknown(self):
        with mock.patch("nlp.service.predict_category", return_value=self.LOW_CONFIDENCE):
            with mock.patch(
                "nlp.service.classify_with_groq",
                return_value={"category": None, "confidence": 0.5, "sentiment": None},
            ):
                result = analyze_report("یک وضعیت نامشخص", CATEGORIES)
        self.assertIsNone(result.suggested_category)
        self.assertEqual(result.category_source, "unknown")

    def test_the_local_scores_are_kept_for_comparison(self):
        with mock.patch("nlp.service.predict_category", return_value=self.LOW_CONFIDENCE):
            with mock.patch(
                "nlp.service.classify_with_groq",
                return_value={"category": "انباشت زباله", "confidence": 0.9, "sentiment": None},
            ):
                result = analyze_report("یک وضعیت نامشخص", CATEGORIES)
        self.assertEqual(result.category_all_scores, self.LOW_CONFIDENCE["all_scores"])


class SentimentRoutingTests(SimpleTestCase):
    def test_the_lexicon_is_the_default_source(self):
        result = analyze_report("خیلی بد و افتضاح است", CATEGORIES)
        self.assertEqual(result.sentiment_source, "lexicon")
        self.assertEqual(result.sentiment_label, "negative")

    def test_an_llm_sentiment_overrides_the_lexicon(self):
        # The lexicon reads a plain report as neutral; the LLM sees the
        # frustration, so its verdict wins when the fallback ran.
        groq_sentiment = {
            "label": "negative",
            "label_fa": "منفی",
            "score": -0.6,
            "intensity": 0.6,
        }
        with mock.patch(
            "nlp.service.predict_category",
            return_value=LlmFallbackRoutingTests.LOW_CONFIDENCE,
        ):
            with mock.patch(
                "nlp.service.classify_with_groq",
                return_value={
                    "category": "انباشت زباله",
                    "confidence": 0.9,
                    "sentiment": groq_sentiment,
                },
            ):
                result = analyze_report("وضعیت اینجا اصلاً مناسب نیست", CATEGORIES)
        self.assertEqual(result.sentiment_source, "groq")
        self.assertEqual(result.sentiment_label, "negative")
        self.assertEqual(result.sentiment_score, -0.6)

    def test_an_llm_call_without_sentiment_keeps_the_lexicon_verdict(self):
        with mock.patch(
            "nlp.service.predict_category",
            return_value=LlmFallbackRoutingTests.LOW_CONFIDENCE,
        ):
            with mock.patch(
                "nlp.service.classify_with_groq",
                return_value={"category": "انباشت زباله", "confidence": 0.9, "sentiment": None},
            ):
                result = analyze_report("خیلی بد و افتضاح", CATEGORIES)
        self.assertEqual(result.sentiment_source, "lexicon")


class ResultContractTests(SimpleTestCase):
    def test_the_result_is_an_nlp_result(self):
        self.assertIsInstance(analyze_report("زباله در کوچه"), NLPResult)

    def test_the_dict_form_is_json_serialisable(self):
        # `nlp_meta` is a JSONField, so anything non-serialisable here would
        # break the report save rather than just the analysis.
        payload = analyze_report("زباله انباشته شده در کوچه", CATEGORIES).to_dict()
        self.assertIsInstance(json.dumps(payload, ensure_ascii=False), str)

    def test_the_dict_form_carries_every_documented_key(self):
        payload = analyze_report("چاله در خیابان", CATEGORIES).to_dict()
        for key in (
            "suggested_category",
            "category_confidence",
            "category_source",
            "category_all_scores",
            "is_urgent",
            "crisis_score",
            "crisis_keywords_found",
            "sentiment_label",
            "sentiment_label_fa",
            "sentiment_score",
            "sentiment_intensity",
            "used_ai_fallback",
            "raw_text_length",
            "sentiment_source",
        ):
            self.assertIn(key, payload)

    def test_the_text_length_is_recorded(self):
        text = "چاله بزرگ در خیابان ولیعصر"
        self.assertEqual(analyze_report(text, CATEGORIES).raw_text_length, len(text))

    def test_the_confidence_is_rounded_for_storage(self):
        confidence = analyze_report("چاله در آسفالت", CATEGORIES).category_confidence
        self.assertEqual(confidence, round(confidence, 3))

    def test_a_long_report_is_handled(self):
        long_text = "زباله انباشته شده در کوچه. " * 200
        self.assertGreater(analyze_report(long_text, CATEGORIES).raw_text_length, 1000)
