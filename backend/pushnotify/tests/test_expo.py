"""The stdlib-only Expo Push client.

Two things matter here: never sending a malformed token to Expo (they get
rejected in bulk, poisoning the whole batch), and never letting a push failure
propagate into the request that triggered it.
"""

import json
import urllib.error
from unittest import mock

from django.test import SimpleTestCase

from pushnotify.expo import EXPO_PUSH_ENDPOINT, is_expo_token, send_push_messages


def _response(tickets):
    response = mock.MagicMock()
    response.read.return_value = json.dumps({"data": tickets}).encode()
    response.__enter__.return_value = response
    return response


class TokenValidationTests(SimpleTestCase):
    def test_an_exponent_push_token_is_valid(self):
        self.assertTrue(is_expo_token("ExponentPushToken[abcdef123456]"))

    def test_an_expo_push_token_is_valid(self):
        self.assertTrue(is_expo_token("ExpoPushToken[abcdef123456]"))

    def test_an_fcm_token_is_not_an_expo_token(self):
        self.assertFalse(is_expo_token("fcm-token-abcdef"))

    def test_an_empty_token_is_invalid(self):
        self.assertFalse(is_expo_token(""))

    def test_none_is_invalid(self):
        self.assertFalse(is_expo_token(None))

    def test_the_prefix_is_case_sensitive(self):
        self.assertFalse(is_expo_token("exponentpushtoken[abc]"))

    def test_a_token_with_leading_whitespace_is_invalid(self):
        self.assertFalse(is_expo_token(" ExponentPushToken[abc]"))


class SendingTests(SimpleTestCase):
    VALID = "ExponentPushToken[valid-device]"

    def test_a_batch_is_posted_to_the_expo_endpoint(self):
        with mock.patch(
            "urllib.request.urlopen", return_value=_response([{"status": "ok"}])
        ) as urlopen:
            tickets = send_push_messages([{"to": self.VALID, "title": "س", "body": "ب"}])
        self.assertEqual(urlopen.call_args.args[0].full_url, EXPO_PUSH_ENDPOINT)
        self.assertEqual(tickets, [{"status": "ok"}])

    def test_the_body_is_json_with_the_message(self):
        with mock.patch(
            "urllib.request.urlopen", return_value=_response([{"status": "ok"}])
        ) as urlopen:
            send_push_messages([{"to": self.VALID, "title": "عنوان"}])
        body = json.loads(urlopen.call_args.args[0].data.decode())
        self.assertEqual(body[0]["to"], self.VALID)
        self.assertEqual(body[0]["title"], "عنوان")

    def test_invalid_tokens_are_filtered_out_before_sending(self):
        with mock.patch(
            "urllib.request.urlopen", return_value=_response([{"status": "ok"}])
        ) as urlopen:
            send_push_messages(
                [{"to": self.VALID}, {"to": "garbage"}, {"to": None}, {}]
            )
        body = json.loads(urlopen.call_args.args[0].data.decode())
        self.assertEqual(len(body), 1)

    def test_a_batch_with_no_valid_tokens_makes_no_request(self):
        with mock.patch("urllib.request.urlopen") as urlopen:
            self.assertEqual(send_push_messages([{"to": "garbage"}]), [])
        urlopen.assert_not_called()

    def test_an_empty_batch_makes_no_request(self):
        with mock.patch("urllib.request.urlopen") as urlopen:
            self.assertEqual(send_push_messages([]), [])
        urlopen.assert_not_called()

    def test_large_batches_are_chunked_at_the_expo_limit(self):
        messages = [{"to": f"ExponentPushToken[device-{i}]"} for i in range(250)]
        with mock.patch(
            "urllib.request.urlopen", return_value=_response([{"status": "ok"}])
        ) as urlopen:
            send_push_messages(messages)
        # 250 messages → 100 + 100 + 50
        self.assertEqual(urlopen.call_count, 3)
        sizes = [len(json.loads(c.args[0].data.decode())) for c in urlopen.call_args_list]
        self.assertEqual(sizes, [100, 100, 50])

    def test_tickets_from_every_chunk_are_collected(self):
        messages = [{"to": f"ExponentPushToken[device-{i}]"} for i in range(150)]
        with mock.patch(
            "urllib.request.urlopen", return_value=_response([{"status": "ok"}])
        ):
            tickets = send_push_messages(messages)
        self.assertEqual(len(tickets), 2)  # one stubbed ticket per chunk

    def test_a_network_failure_returns_no_tickets_instead_of_raising(self):
        with mock.patch(
            "urllib.request.urlopen", side_effect=urllib.error.URLError("offline")
        ):
            self.assertEqual(send_push_messages([{"to": self.VALID}]), [])

    def test_an_http_error_returns_no_tickets_instead_of_raising(self):
        error = urllib.error.HTTPError(EXPO_PUSH_ENDPOINT, 500, "boom", {}, None)
        with mock.patch("urllib.request.urlopen", side_effect=error):
            self.assertEqual(send_push_messages([{"to": self.VALID}]), [])

    def test_a_malformed_response_returns_no_tickets(self):
        response = mock.MagicMock()
        response.read.return_value = b"not json"
        response.__enter__.return_value = response
        with mock.patch("urllib.request.urlopen", return_value=response):
            self.assertEqual(send_push_messages([{"to": self.VALID}]), [])

    def test_a_response_without_a_data_list_returns_no_tickets(self):
        response = mock.MagicMock()
        response.read.return_value = b'{"data": {"unexpected": true}}'
        response.__enter__.return_value = response
        with mock.patch("urllib.request.urlopen", return_value=response):
            self.assertEqual(send_push_messages([{"to": self.VALID}]), [])

    def test_the_request_declares_json_content(self):
        with mock.patch(
            "urllib.request.urlopen", return_value=_response([])
        ) as urlopen:
            send_push_messages([{"to": self.VALID}])
        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_header("Content-type"), "application/json")
        self.assertEqual(request.get_method(), "POST")
