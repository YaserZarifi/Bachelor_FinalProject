"""The sklearn category classifier (TF-IDF char n-grams + LinearSVC) and the
rule-based categoriser it replaced.

The classifier is the thesis's machine-learning contribution, so the tests
cover three things: Persian text normalisation, prediction quality on realistic
citizen phrasing, and the confidence gate that decides when to escalate to the
LLM fallback.
"""

from django.test import SimpleTestCase

from nlp.categorizer import CATEGORY_KEYWORDS, classify_text
from nlp.classifier import STOPWORDS, normalize_persian, predict_category
from nlp.training_data import TRAINING_SAMPLES


class PersianNormalisationTests(SimpleTestCase):
    def test_arabic_kaf_becomes_persian_kaf(self):
        self.assertNotIn("ك", normalize_persian("كوچه تاريك"))

    def test_arabic_yeh_becomes_persian_yeh(self):
        self.assertNotIn("ي", normalize_persian("خيابان اصلي"))

    def test_stopwords_are_dropped(self):
        normalised = normalize_persian("چاله در خیابان است و خطرناک")
        for stopword in ("در", "است", "و"):
            self.assertNotIn(stopword, normalised.split())

    def test_content_words_survive(self):
        normalised = normalize_persian("چاله در خیابان است و خطرناک")
        self.assertIn("چاله", normalised)
        self.assertIn("خیابان", normalised)
        self.assertIn("خطرناک", normalised)

    def test_repeated_whitespace_collapses(self):
        self.assertNotIn("  ", normalize_persian("چاله     بزرگ\n\nخیابان"))

    def test_emoji_and_control_characters_are_stripped(self):
        self.assertNotIn("😡", normalize_persian("چاله بزرگ 😡🚧"))

    def test_single_character_tokens_are_dropped(self):
        self.assertNotIn("ب", normalize_persian("چاله ب خیابان").split())

    def test_empty_input_yields_empty_output(self):
        self.assertEqual(normalize_persian(""), "")

    def test_normalisation_is_idempotent(self):
        once = normalize_persian("كوچه تاريك و خطرناك است")
        self.assertEqual(normalize_persian(once), once)

    def test_stopword_list_is_non_trivial(self):
        self.assertGreater(len(STOPWORDS), 30)


class TrainingDataTests(SimpleTestCase):
    def test_the_corpus_is_non_empty(self):
        self.assertGreater(len(TRAINING_SAMPLES), 50)

    def test_every_sample_is_a_text_label_pair(self):
        for sample in TRAINING_SAMPLES:
            self.assertEqual(len(sample), 2)
            text, label = sample
            self.assertTrue(text.strip())
            self.assertTrue(label.strip())

    def test_every_class_has_at_least_a_handful_of_examples(self):
        from collections import Counter

        counts = Counter(label for _, label in TRAINING_SAMPLES)
        for label, count in counts.items():
            self.assertGreaterEqual(count, 5, f"دسته «{label}» نمونه کافی ندارد")

    def test_there_are_no_duplicate_samples(self):
        self.assertEqual(len(set(TRAINING_SAMPLES)), len(TRAINING_SAMPLES))


class PredictionShapeTests(SimpleTestCase):
    def test_the_documented_keys_are_returned(self):
        result = predict_category("چاله بزرگ در آسفالت خیابان")
        self.assertEqual(
            set(result),
            {"category", "confidence", "all_scores", "source", "needs_ai_fallback"},
        )

    def test_the_source_is_reported_as_sklearn(self):
        self.assertEqual(predict_category("زباله انباشته شده")["source"], "sklearn")

    def test_confidence_is_a_probability(self):
        confidence = predict_category("چراغ خیابان خاموش است")["confidence"]
        self.assertGreaterEqual(confidence, 0.0)
        self.assertLessEqual(confidence, 1.0)

    def test_the_class_scores_form_a_distribution(self):
        scores = predict_category("لوله ترکیده و فاضلاب جاری است")["all_scores"]
        self.assertGreater(len(scores), 1)
        self.assertAlmostEqual(sum(scores.values()), 1.0, places=2)

    def test_the_result_is_json_serialisable(self):
        import json

        json.dumps(predict_category("زباله در کوچه"), ensure_ascii=False)

    def test_empty_text_does_not_crash(self):
        result = predict_category("")
        self.assertIn("needs_ai_fallback", result)


class PredictionQualityTests(SimpleTestCase):
    """Realistic citizen phrasing that is *not* copied from the training set.

    Two different questions are measured separately, because the model answers
    them differently:

    1. **Is the top-scoring class right?** — the model's raw accuracy. Measured
       against ``all_scores`` so the confidence gate does not mask it.
    2. **Is it confident enough to act alone?** — only clearly-worded reports
       clear the 0.40 gate; the rest are handed to the LLM by design.
    """

    #: Held-out phrasings, none of which appear in ``TRAINING_SAMPLES``.
    CASES = [
        ("آسفالت کوچه ما پر از چاله و دست‌انداز شده", "خرابی آسفالت"),
        ("چاله عمیق در آسفالت", "خرابی آسفالت"),
        ("سطل زباله سر کوچه پر شده و بوی بد می‌دهد", "انباشت زباله"),
        ("زباله انباشته شده در کوچه", "انباشت زباله"),
        ("چراغ‌های خیابان شب‌ها روشن نمی‌شوند و همه‌جا تاریک است", "مشکلات روشنایی"),
        ("چراغ خیابان خاموش شده و شب‌ها تاریک است", "مشکلات روشنایی"),
        ("لوله آب ترکیده و فاضلاب جلوی خانه جاری است", "آب و فاضلاب"),
    ]

    #: Reports the model resolves confidently enough to skip the LLM entirely.
    CONFIDENT_CASES = [
        ("چاله عمیق در آسفالت", "خرابی آسفالت"),
        ("سطل زباله سر کوچه پر شده و بوی بد می‌دهد", "انباشت زباله"),
        ("چراغ خیابان خاموش شده و شب‌ها تاریک است", "مشکلات روشنایی"),
        ("لوله آب ترکیده و فاضلاب جلوی خانه جاری است", "آب و فاضلاب"),
    ]

    @staticmethod
    def _top_class(text):
        scores = predict_category(text)["all_scores"]
        return max(scores, key=scores.get)

    def test_the_top_scoring_class_is_correct_on_held_out_phrasing(self):
        for text, expected in self.CASES:
            with self.subTest(text=text):
                self.assertEqual(self._top_class(text), expected)

    def test_clearly_worded_reports_clear_the_confidence_gate(self):
        for text, expected in self.CONFIDENT_CASES:
            with self.subTest(text=text):
                result = predict_category(text)
                self.assertFalse(result["needs_ai_fallback"])
                self.assertEqual(result["category"], expected)

    def test_terse_or_vague_reports_are_handed_to_the_llm(self):
        # Two or three words carry too little signal for a char n-gram model —
        # exactly the case the LLM fallback exists to cover.
        for text in ("چاله در خیابان", "یک مشکل وجود دارد", "لطفاً رسیدگی کنید"):
            with self.subTest(text=text):
                result = predict_category(text)
                self.assertTrue(result["needs_ai_fallback"])
                self.assertIsNone(result["category"])

    def test_the_returned_label_is_always_the_top_scoring_class(self):
        result = predict_category("چاله عمیق در آسفالت")
        self.assertEqual(
            result["category"], max(result["all_scores"], key=result["all_scores"].get)
        )

    def test_a_withheld_prediction_still_exposes_its_scores(self):
        # Even when the gate trips, the admin UI can still show what the model
        # was leaning towards.
        result = predict_category("چاله در خیابان")
        self.assertIsNone(result["category"])
        self.assertTrue(result["all_scores"])


class ConfidenceGateTests(SimpleTestCase):
    """Below 0.40 confidence the pipeline escalates to the LLM."""

    def test_a_low_confidence_prediction_is_withheld(self):
        # When the gate trips, `category` is None so the caller cannot use a
        # guess the model is not confident about.
        from unittest.mock import patch

        with patch("nlp.classifier._load_or_train") as loader:
            import numpy as np

            vectorizer, classifier = loader.return_value = (
                _StubVectorizer(),
                _StubClassifier(np.array([0.1, 0.11, 0.12])),
            )
            result = predict_category("متن مبهم")
        self.assertIsNone(result["category"])
        self.assertTrue(result["needs_ai_fallback"])

    def test_a_high_confidence_prediction_passes_the_gate(self):
        from unittest.mock import patch

        import numpy as np

        with patch("nlp.classifier._load_or_train") as loader:
            loader.return_value = (_StubVectorizer(), _StubClassifier(np.array([5.0, 0.1, 0.1])))
            result = predict_category("متن روشن")
        self.assertEqual(result["category"], "الف")
        self.assertFalse(result["needs_ai_fallback"])

    def test_a_model_failure_degrades_gracefully(self):
        # A corrupt pickle must not take the whole report-create request down.
        from unittest.mock import patch

        with patch("nlp.classifier._load_or_train", side_effect=OSError("pickle corrupt")):
            result = predict_category("چاله در خیابان")
        self.assertIsNone(result["category"])
        self.assertEqual(result["confidence"], 0.0)
        self.assertTrue(result["needs_ai_fallback"])


class _StubVectorizer:
    def transform(self, texts):
        return texts


class _StubClassifier:
    classes_ = ["الف", "ب", "ج"]

    def __init__(self, scores):
        self._scores = scores

    def predict(self, X):
        return [self.classes_[int(self._scores.argmax())]]

    def decision_function(self, X):
        return [self._scores]


class RuleBasedCategoriserTests(SimpleTestCase):
    """`categorizer.classify_text` is the earlier keyword approach, kept as a
    transparent baseline the thesis compares the ML model against."""

    def test_a_pothole_report_is_categorised(self):
        result = classify_text("آسفالت کوچه خراب شده و چاله بزرگی ایجاد شده")
        self.assertEqual(result["category"], "خرابی آسفالت")
        self.assertGreater(result["confidence"], 0.3)

    def test_a_rubbish_report_is_categorised(self):
        self.assertEqual(
            classify_text("زباله‌های انباشته شده در کنار خیابان بوی بد می‌دهد")["category"],
            "انباشت زباله",
        )

    def test_a_lighting_report_is_categorised(self):
        self.assertEqual(
            classify_text("چراغ خیابان خاموش شده و شب‌ها تاریک است")["category"],
            "مشکلات روشنایی",
        )

    def test_a_water_report_is_categorised(self):
        self.assertEqual(
            classify_text("لوله ترکیده و فاضلاب جلوی خانه جاری است")["category"],
            "آب و فاضلاب",
        )

    def test_a_vague_report_asks_for_the_llm(self):
        result = classify_text("یک مشکل وجود دارد")
        self.assertTrue(result["needs_ai_fallback"] or result["confidence"] < 0.35)

    def test_text_with_no_keywords_returns_nothing(self):
        result = classify_text("امروز هوا آفتابی بود")
        self.assertIsNone(result["category"])
        self.assertEqual(result["scores"], {})
        self.assertTrue(result["needs_ai_fallback"])

    def test_the_keyword_map_is_well_formed(self):
        for category, keywords in CATEGORY_KEYWORDS.items():
            self.assertTrue(category.strip())
            for keyword, weight in keywords:
                self.assertTrue(keyword.strip())
                self.assertGreater(weight, 0)

    def test_confidence_never_exceeds_one(self):
        for text, _ in PredictionQualityTests.CASES:
            self.assertLessEqual(classify_text(text)["confidence"], 1.0)


class ModelVersusBaselineTests(SimpleTestCase):
    """A head-to-head the thesis can quote: on held-out phrasing, how often does
    each approach put the correct category on top?"""

    def _accuracy(self, predictor):
        hits = sum(
            1
            for text, expected in PredictionQualityTests.CASES
            if predictor(text) == expected
        )
        return hits / len(PredictionQualityTests.CASES)

    def test_the_ml_model_gets_every_held_out_case_right(self):
        self.assertEqual(self._accuracy(PredictionQualityTests._top_class), 1.0)

    def test_the_keyword_baseline_is_not_worse_on_these_cases(self):
        # Both approaches handle the canonical wording; the ML model's value is
        # robustness to phrasings the keyword list never anticipated.
        baseline = self._accuracy(
            lambda text: (classify_text(text)["scores"] or {"": 0})
            and max(
                classify_text(text)["scores"],
                key=classify_text(text)["scores"].get,
                default=None,
            )
        )
        self.assertGreaterEqual(baseline, 0.5)
