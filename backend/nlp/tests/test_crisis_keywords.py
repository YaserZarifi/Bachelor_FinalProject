"""Crisis detection — the weighted Persian keyword pass that flags a report as
urgent before any model runs.

This is the safety-critical half of the NLP pipeline: a missed gas leak or open
manhole is a far worse error than a false alarm, so the tests lean on recall.
"""

from django.test import SimpleTestCase

from nlp.crisis_keywords import (
    CRISIS_KEYWORDS,
    CRISIS_SCORE_THRESHOLD,
    calculate_crisis_score,
    is_crisis,
)


class ScoringTests(SimpleTestCase):
    def test_a_single_keyword_scores_its_weight(self):
        score, matched = calculate_crisis_score("آتش")
        self.assertEqual(score, CRISIS_KEYWORDS["آتش"])
        self.assertEqual(matched, ["آتش"])

    def test_scores_accumulate_across_keywords(self):
        score, matched = calculate_crisis_score("انفجار و مصدوم")
        self.assertGreaterEqual(score, 6)
        self.assertIn("انفجار", matched)
        self.assertIn("مصدوم", matched)

    def test_a_clean_text_scores_zero(self):
        score, matched = calculate_crisis_score("درخت‌های پارک هرس شده‌اند")
        self.assertEqual(score, 0)
        self.assertEqual(matched, [])

    def test_empty_text_scores_zero(self):
        self.assertEqual(calculate_crisis_score(""), (0, []))

    def test_whitespace_only_text_scores_zero(self):
        self.assertEqual(calculate_crisis_score("    ")[0], 0)

    def test_every_weight_is_between_one_and_three(self):
        for keyword, weight in CRISIS_KEYWORDS.items():
            self.assertIn(weight, (1, 2, 3), f"وزن نامعتبر برای «{keyword}»")

    def test_life_threatening_terms_carry_the_top_weight(self):
        for keyword in ("آتش‌سوزی", "انفجار", "نشت گاز", "مصدوم", "اورژانس", "سیل"):
            self.assertEqual(CRISIS_KEYWORDS[keyword], 3, keyword)

    def test_nuisance_terms_carry_the_lowest_weight(self):
        for keyword in ("ترافیک", "لجن", "تابلو شکسته"):
            self.assertEqual(CRISIS_KEYWORDS[keyword], 1, keyword)


class UrgencyDecisionTests(SimpleTestCase):
    def test_threshold_is_three(self):
        self.assertEqual(CRISIS_SCORE_THRESHOLD, 3)

    def test_a_fire_report_is_urgent(self):
        urgent, _, matched = is_crisis("آتش‌سوزی در پارک محله، خیلی خطرناک است")
        self.assertTrue(urgent)
        self.assertIn("آتش‌سوزی", matched)

    def test_a_gas_leak_is_urgent(self):
        self.assertTrue(is_crisis("نشت گاز از لوله معیوب در کوچه")[0])

    def test_an_open_manhole_is_urgent(self):
        self.assertTrue(is_crisis("چاه باز در وسط خیابان. خیلی خطرناک است")[0])

    def test_an_injury_report_is_urgent(self):
        self.assertTrue(is_crisis("یک نفر مصدوم شده، آمبولانس لازم است")[0])

    def test_a_flood_report_is_urgent(self):
        self.assertTrue(is_crisis("سیل تمام کوچه را گرفته است")[0])

    def test_an_electrocution_hazard_is_urgent(self):
        self.assertTrue(is_crisis("خطر برق‌گرفتگی از سیم برق افتاده")[0])

    def test_a_routine_pothole_is_not_urgent(self):
        self.assertFalse(is_crisis("آسفالت خیابان خراب شده و دست‌انداز دارد")[0])

    def test_a_thank_you_note_is_not_urgent(self):
        self.assertFalse(is_crisis("ممنون از رسیدگی سریع شما")[0])

    def test_a_single_low_weight_word_is_not_enough(self):
        # «خطر» alone scores 1 — below the threshold, so no false alarm.
        urgent, score, _ = is_crisis("خطر")
        self.assertFalse(urgent)
        self.assertLess(score, CRISIS_SCORE_THRESHOLD)

    def test_empty_text_is_not_urgent(self):
        urgent, score, matched = is_crisis("")
        self.assertFalse(urgent)
        self.assertEqual(score, 0)
        self.assertEqual(matched, [])

    def test_the_return_shape_is_stable(self):
        urgent, score, matched = is_crisis("آتش")
        self.assertIsInstance(urgent, bool)
        self.assertIsInstance(score, int)
        self.assertIsInstance(matched, list)

    def test_spaced_and_zwnj_spellings_are_both_recognised(self):
        # Persian users type «آتش سوزی» and «آتش‌سوزی» interchangeably.
        self.assertTrue(is_crisis("آتش سوزی بزرگ")[0])
        self.assertTrue(is_crisis("آتش‌سوزی بزرگ")[0])

    def test_urgency_survives_a_long_surrounding_narrative(self):
        text = (
            "سلام. دیروز از محل عبور می‌کردم و متوجه شدم که در کوچه شهید احمدی "
            "نشت گاز وجود دارد و بوی شدیدی می‌آید. لطفاً رسیدگی کنید."
        )
        self.assertTrue(is_crisis(text)[0])
