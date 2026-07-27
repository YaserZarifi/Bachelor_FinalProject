"""The Groq LLM fallback client.

Every test here mocks the network. The point of an LLM fallback is that it is
*optional*: a missing key, a rate-limited endpoint or a malformed answer must
degrade to "no suggestion", never to a failed report submission.
"""

import json
import urllib.error
from unittest import mock

from django.test import SimpleTestCase

from nlp.groq_client import (
    GROQ_ENDPOINT,
    _map_category,
    _map_sentiment,
    classify_with_groq,
    is_configured,
)

CATEGORIES = ["خرابی آسفالت", "انباشت زباله", "مشکلات روشنایی"]


def _fake_response(payload: dict):
    """A context-manager double for `urllib.request.urlopen`."""
    body = json.dumps(
        {"choices": [{"message": {"content": json.dumps(payload, ensure_ascii=False)}}]}
    ).encode()
    response = mock.MagicMock()
    response.read.return_value = body
    response.__enter__.return_value = response
    return response


class ConfigurationTests(SimpleTestCase):
    def test_not_configured_without_a_key(self):
        with mock.patch.dict("os.environ", {"GROQ_API_KEY": ""}):
            self.assertFalse(is_configured())

    def test_configured_with_a_key(self):
        with mock.patch.dict("os.environ", {"GROQ_API_KEY": "gsk_test"}):
            self.assertTrue(is_configured())

    def test_whitespace_only_key_counts_as_missing(self):
        with mock.patch.dict("os.environ", {"GROQ_API_KEY": "   "}):
            self.assertFalse(is_configured())

    def test_without_a_key_the_fallback_is_skipped_entirely(self):
        with mock.patch.dict("os.environ", {"GROQ_API_KEY": ""}):
            with mock.patch("urllib.request.urlopen") as urlopen:
                self.assertIsNone(classify_with_groq("متن", CATEGORIES))
            urlopen.assert_not_called()


class SentimentMappingTests(SimpleTestCase):
    def test_english_labels_map(self):
        self.assertEqual(_map_sentiment("negative")["label_fa"], "منفی")
        self.assertEqual(_map_sentiment("positive")["label_fa"], "مثبت")
        self.assertEqual(_map_sentiment("neutral")["label_fa"], "خنثی")

    def test_persian_labels_map_too(self):
        self.assertEqual(_map_sentiment("منفی")["label"], "negative")
        self.assertEqual(_map_sentiment("مثبت")["label"], "positive")

    def test_case_and_padding_are_tolerated(self):
        self.assertEqual(_map_sentiment("  NEGATIVE  ")["label"], "negative")

    def test_unknown_labels_map_to_nothing(self):
        self.assertIsNone(_map_sentiment("furious"))

    def test_none_maps_to_nothing(self):
        self.assertIsNone(_map_sentiment(None))

    def test_the_mapped_shape_matches_the_lexicon_analyser(self):
        self.assertEqual(
            set(_map_sentiment("negative")), {"label", "label_fa", "score", "intensity"}
        )


class CategoryMappingTests(SimpleTestCase):
    def test_an_exact_match_scores_high_confidence(self):
        self.assertEqual(_map_category("انباشت زباله", CATEGORIES), ("انباشت زباله", 0.90))

    def test_a_partial_match_scores_lower_confidence(self):
        category, confidence = _map_category("مشکلات روشنایی معابر", CATEGORIES)
        self.assertEqual(category, "مشکلات روشنایی")
        self.assertEqual(confidence, 0.75)

    def test_the_catch_all_maps_to_no_category(self):
        category, confidence = _map_category("سایر", CATEGORIES)
        self.assertIsNone(category)
        self.assertEqual(confidence, 0.5)

    def test_an_empty_answer_maps_to_no_category(self):
        self.assertEqual(_map_category("", CATEGORIES), (None, 0.0))
        self.assertEqual(_map_category(None, CATEGORIES), (None, 0.0))

    def test_surrounding_whitespace_is_ignored(self):
        self.assertEqual(_map_category("  انباشت زباله  ", CATEGORIES)[0], "انباشت زباله")


class SuccessfulCallTests(SimpleTestCase):
    def setUp(self):
        self.env = mock.patch.dict("os.environ", {"GROQ_API_KEY": "gsk_test"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_a_well_formed_answer_is_parsed(self):
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_fake_response({"category": "انباشت زباله", "sentiment": "negative"}),
        ):
            result = classify_with_groq("زباله زیاد است", CATEGORIES)
        self.assertEqual(result["category"], "انباشت زباله")
        self.assertEqual(result["confidence"], 0.90)
        self.assertEqual(result["sentiment"]["label"], "negative")

    def test_the_request_targets_the_groq_endpoint_with_a_bearer_key(self):
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_fake_response({"category": "سایر", "sentiment": "neutral"}),
        ) as urlopen:
            classify_with_groq("متن", CATEGORIES)
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, GROQ_ENDPOINT)
        self.assertEqual(request.get_header("Authorization"), "Bearer gsk_test")

    def test_a_browser_like_user_agent_is_sent(self):
        # Groq sits behind Cloudflare, which 403s the default Python-urllib UA.
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_fake_response({"category": "سایر", "sentiment": "neutral"}),
        ) as urlopen:
            classify_with_groq("متن", CATEGORIES)
        self.assertIn("UrbanHelper", urlopen.call_args.args[0].get_header("User-agent"))

    def test_the_prompt_lists_every_available_category(self):
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_fake_response({"category": "سایر", "sentiment": "neutral"}),
        ) as urlopen:
            classify_with_groq("متن", CATEGORIES)
        body = json.loads(urlopen.call_args.args[0].data.decode())
        prompt = body["messages"][-1]["content"]
        for category in CATEGORIES:
            self.assertIn(category, prompt)

    def test_the_model_is_asked_for_deterministic_json(self):
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_fake_response({"category": "سایر", "sentiment": "neutral"}),
        ) as urlopen:
            classify_with_groq("متن", CATEGORIES)
        body = json.loads(urlopen.call_args.args[0].data.decode())
        self.assertEqual(body["temperature"], 0.0)
        self.assertEqual(body["response_format"], {"type": "json_object"})

    def test_the_model_name_can_be_overridden_by_environment(self):
        with mock.patch.dict("os.environ", {"GROQ_MODEL": "llama-3.1-8b-instant"}):
            with mock.patch(
                "urllib.request.urlopen",
                return_value=_fake_response({"category": "سایر", "sentiment": "neutral"}),
            ) as urlopen:
                classify_with_groq("متن", CATEGORIES)
        body = json.loads(urlopen.call_args.args[0].data.decode())
        self.assertEqual(body["model"], "llama-3.1-8b-instant")


class FailureHandlingTests(SimpleTestCase):
    """None of these may raise — a failed fallback just means "no suggestion"."""

    def setUp(self):
        self.env = mock.patch.dict("os.environ", {"GROQ_API_KEY": "gsk_test"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_an_http_error_returns_none(self):
        error = urllib.error.HTTPError(GROQ_ENDPOINT, 429, "Too Many Requests", {}, None)
        with mock.patch("urllib.request.urlopen", side_effect=error):
            self.assertIsNone(classify_with_groq("متن", CATEGORIES))

    def test_a_network_error_returns_none(self):
        with mock.patch(
            "urllib.request.urlopen", side_effect=urllib.error.URLError("no route to host")
        ):
            self.assertIsNone(classify_with_groq("متن", CATEGORIES))

    def test_a_timeout_returns_none(self):
        with mock.patch("urllib.request.urlopen", side_effect=TimeoutError()):
            self.assertIsNone(classify_with_groq("متن", CATEGORIES))

    def test_non_json_content_returns_none(self):
        response = mock.MagicMock()
        response.read.return_value = json.dumps(
            {"choices": [{"message": {"content": "این JSON نیست"}}]}
        ).encode()
        response.__enter__.return_value = response
        with mock.patch("urllib.request.urlopen", return_value=response):
            self.assertIsNone(classify_with_groq("متن", CATEGORIES))

    def test_an_unexpected_envelope_returns_none(self):
        response = mock.MagicMock()
        response.read.return_value = b'{"unexpected": true}'
        response.__enter__.return_value = response
        with mock.patch("urllib.request.urlopen", return_value=response):
            self.assertIsNone(classify_with_groq("متن", CATEGORIES))

    def test_a_hallucinated_category_is_discarded(self):
        with mock.patch(
            "urllib.request.urlopen",
            return_value=_fake_response({"category": "تعمیر فضاپیما", "sentiment": "neutral"}),
        ):
            result = classify_with_groq("متن", CATEGORIES)
        self.assertIsNone(result["category"])

    def test_a_missing_sentiment_key_is_tolerated(self):
        with mock.patch(
            "urllib.request.urlopen", return_value=_fake_response({"category": "انباشت زباله"})
        ):
            result = classify_with_groq("متن", CATEGORIES)
        self.assertEqual(result["category"], "انباشت زباله")
        self.assertIsNone(result["sentiment"])
