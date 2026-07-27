"""Persian sentiment analysis (lexicon + intensifiers).

Sentiment feeds the admin dashboard's "citizen mood" panel, so what matters is
that a complaint reads as negative, a thank-you as positive, and a flat factual
report as neutral — plus a bounded, JSON-safe score.
"""

from django.test import SimpleTestCase

from nlp.sentiment import INTENSIFIERS, NEGATIVE_WORDS, POSITIVE_WORDS, analyze_sentiment


class LexiconTests(SimpleTestCase):
    def test_the_lexicons_do_not_overlap(self):
        self.assertEqual(set(NEGATIVE_WORDS) & set(POSITIVE_WORDS), set())

    def test_all_weights_are_positive_integers(self):
        for word, weight in {**NEGATIVE_WORDS, **POSITIVE_WORDS}.items():
            self.assertIsInstance(weight, int, word)
            self.assertGreater(weight, 0, word)

    def test_intensifiers_are_non_empty_strings(self):
        self.assertTrue(INTENSIFIERS)
        for word in INTENSIFIERS:
            self.assertTrue(word.strip())


class PolarityTests(SimpleTestCase):
    def test_an_angry_complaint_is_negative(self):
        result = analyze_sentiment("خیلی بد است! اعتراض دارم. رسیدگی نمی‌کنند")
        self.assertEqual(result["label"], "negative")
        self.assertEqual(result["label_fa"], "منفی")
        self.assertLess(result["score"], 0)

    def test_a_thank_you_is_positive(self):
        result = analyze_sentiment("ممنون که رفع شد. خیلی خوب بود")
        self.assertEqual(result["label"], "positive")
        self.assertEqual(result["label_fa"], "مثبت")
        self.assertGreater(result["score"], 0)

    def test_a_plain_factual_report_is_neutral(self):
        result = analyze_sentiment("چراغ خیابان در موقعیت مشخص خاموش است")
        self.assertEqual(result["label"], "neutral")
        self.assertEqual(result["label_fa"], "خنثی")

    def test_empty_text_is_neutral_with_a_zero_score(self):
        result = analyze_sentiment("")
        self.assertEqual(result["label"], "neutral")
        self.assertEqual(result["score"], 0.0)
        self.assertEqual(result["intensity"], 0.0)

    def test_text_with_no_lexicon_hits_is_neutral(self):
        result = analyze_sentiment("درخت کاشته شده در ضلع شمالی میدان")
        self.assertEqual(result["label"], "neutral")
        self.assertEqual(result["neg_score"], 0)
        self.assertEqual(result["pos_score"], 0)


class ScoreShapeTests(SimpleTestCase):
    def test_the_score_stays_inside_minus_one_and_one(self):
        for text in (
            "افتضاح، وحشتناک، فجیع، خیلی بد، خطرناک، عصبانی",
            "عالی، سپاسگزار، حل شد، بهبود، زیبا، تمیز",
            "",
        ):
            score = analyze_sentiment(text)["score"]
            self.assertGreaterEqual(score, -1.0)
            self.assertLessEqual(score, 1.0)

    def test_intensity_stays_inside_zero_and_one(self):
        for text in ("افتضاح وحشتناک فجیع خطرناک عصبانی خشمگین", "مشکل", ""):
            intensity = analyze_sentiment(text)["intensity"]
            self.assertGreaterEqual(intensity, 0.0)
            self.assertLessEqual(intensity, 1.0)

    def test_all_documented_keys_are_present(self):
        result = analyze_sentiment("مشکل دارد")
        self.assertEqual(
            set(result),
            {"label", "label_fa", "score", "intensity", "neg_score", "pos_score"},
        )

    def test_the_result_is_json_serialisable(self):
        import json

        json.dumps(analyze_sentiment("خیلی بد و خطرناک"), ensure_ascii=False)


class IntensifierTests(SimpleTestCase):
    def test_an_intensifier_raises_the_intensity(self):
        plain = analyze_sentiment("خطرناک است و اعتراض دارم")
        boosted = analyze_sentiment("بسیار خطرناک است و به شدت اعتراض دارم")
        self.assertGreater(boosted["intensity"], plain["intensity"])

    def test_a_strongly_worded_complaint_is_intense(self):
        result = analyze_sentiment("بسیار خطرناک است و به شدت اعتراض دارم")
        self.assertGreater(result["intensity"], 0.3)

    def test_a_stronger_complaint_registers_a_higher_intensity(self):
        mild = analyze_sentiment("یک اشکال کوچک دارد")
        harsh = analyze_sentiment("افتضاح است، وحشتناک و خیلی بد")
        self.assertGreater(harsh["intensity"], mild["intensity"])

    def test_the_score_measures_polarity_not_magnitude(self):
        # ⚠️ Design note worth knowing when reading the dashboard: `score` is
        # (pos − neg) / (pos + neg), so *any* purely negative text saturates at
        # −1.0 regardless of how mild it is. Magnitude lives in `intensity`.
        mild = analyze_sentiment("یک اشکال کوچک دارد")
        harsh = analyze_sentiment("افتضاح است، وحشتناک و خیلی بد")
        self.assertEqual(mild["score"], -1.0)
        self.assertEqual(harsh["score"], -1.0)
        self.assertNotEqual(mild["intensity"], harsh["intensity"])

    def test_the_intensifier_amplifies_the_dominant_polarity(self):
        result = analyze_sentiment("خیلی افتضاح و وحشتناک")
        self.assertEqual(result["label"], "negative")
        self.assertGreater(result["neg_score"], result["pos_score"])


class MixedSentimentTests(SimpleTestCase):
    def test_balanced_positive_and_negative_reads_as_neutral(self):
        # "خوب" (+2) against "بد" (−2) cancels out.
        result = analyze_sentiment("هم خوب است هم بد")
        self.assertEqual(result["label"], "neutral")

    def test_the_stronger_side_wins(self):
        result = analyze_sentiment("ممنون، ولی افتضاح و وحشتناک و خیلی بد است")
        self.assertEqual(result["label"], "negative")

    def test_neglect_phrases_are_treated_as_strongly_negative(self):
        result = analyze_sentiment("ماه‌هاست رها شده و رسیدگی نمی‌کنند")
        self.assertEqual(result["label"], "negative")
