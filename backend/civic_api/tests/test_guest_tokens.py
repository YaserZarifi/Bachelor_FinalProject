"""Guest access tokens — the capability that lets an anonymous citizen keep
following the one report they filed, without an account.

The suite runs against an in-memory Redis double (see ``core.test_runner``) so
it never touches the developer's real token store; ``RealRedisGuestTokenTests``
additionally exercises the genuine Redis integration when one is reachable.
"""

import os
import random
import unittest

from django.test import TestCase

from civic_api.guest_tokens import (
    _key,
    issue_guest_token,
    revoke_guest_token,
    verify_guest_token,
)


class GuestTokenTests(TestCase):
    def setUp(self):
        from core.test_runner import fake_redis

        fake_redis.flushdb()

    def test_issuing_returns_a_token(self):
        self.assertTrue(issue_guest_token(1))

    def test_tokens_are_long_enough_to_resist_guessing(self):
        # secrets.token_urlsafe(32) → 43 URL-safe characters ≈ 256 bits.
        self.assertGreaterEqual(len(issue_guest_token(1)), 43)

    def test_a_freshly_issued_token_verifies(self):
        self.assertTrue(verify_guest_token(1, issue_guest_token(1)))

    def test_a_wrong_token_does_not_verify(self):
        issue_guest_token(1)
        self.assertFalse(verify_guest_token(1, "definitely-not-the-token"))

    def test_an_empty_token_does_not_verify(self):
        issue_guest_token(1)
        self.assertFalse(verify_guest_token(1, ""))

    def test_a_none_token_does_not_verify(self):
        issue_guest_token(1)
        self.assertFalse(verify_guest_token(1, None))

    def test_a_token_is_scoped_to_a_single_report(self):
        token = issue_guest_token(1)
        issue_guest_token(2)
        self.assertFalse(verify_guest_token(2, token))

    def test_verification_against_an_unknown_report_fails(self):
        self.assertFalse(verify_guest_token(4242, "anything"))

    def test_two_reports_get_different_tokens(self):
        self.assertNotEqual(issue_guest_token(1), issue_guest_token(2))

    def test_re_issuing_invalidates_the_previous_token(self):
        old = issue_guest_token(1)
        new = issue_guest_token(1)
        self.assertFalse(verify_guest_token(1, old))
        self.assertTrue(verify_guest_token(1, new))

    def test_revoking_removes_access(self):
        token = issue_guest_token(1)
        revoke_guest_token(1)
        self.assertFalse(verify_guest_token(1, token))

    def test_revoking_an_unknown_report_is_harmless(self):
        revoke_guest_token(999999)  # must not raise

    def test_key_namespacing(self):
        self.assertEqual(_key(7), "uh:guest_ws:7")

    def test_tokens_are_stored_with_a_long_expiry(self):
        from core.test_runner import fake_redis

        issue_guest_token(1)
        # Two years — a report may sit in the queue for a long time.
        self.assertEqual(fake_redis.expiries[_key(1)], 60 * 60 * 24 * 365 * 2)


def _redis_available() -> bool:
    try:
        import redis

        client = redis.Redis(
            host=os.environ.get("REDIS_HOST", "127.0.0.1"),
            port=int(os.environ.get("REDIS_PORT", "6379")),
            db=1,
            socket_connect_timeout=1,
        )
        client.ping()
        return True
    except Exception:
        return False


@unittest.skipUnless(_redis_available(), "Redis is not reachable")
class RealRedisGuestTokenTests(TestCase):
    """The same contract, against the real Redis server.

    Report ids are drawn from a high range that production data never reaches,
    and every key is deleted afterwards, so a test run cannot revoke a genuine
    citizen's access.
    """

    def setUp(self):
        from civic_api import guest_tokens
        from core.test_runner import UrbanHelperTestRunner  # noqa: F401

        # Temporarily restore the genuine Redis-backed client.
        self._patched = guest_tokens._client
        import redis
        from django.conf import settings

        guest_tokens._client = lambda: redis.Redis(
            host=getattr(settings, "REDIS_HOST", "127.0.0.1"),
            port=int(getattr(settings, "REDIS_PORT", 6379)),
            db=1,
            decode_responses=True,
        )
        self.report_id = random.randint(900_000_000, 999_999_999)

    def tearDown(self):
        revoke_guest_token(self.report_id)
        from civic_api import guest_tokens

        guest_tokens._client = self._patched

    def test_round_trip_through_real_redis(self):
        token = issue_guest_token(self.report_id)
        self.assertTrue(verify_guest_token(self.report_id, token))

    def test_revocation_through_real_redis(self):
        token = issue_guest_token(self.report_id)
        revoke_guest_token(self.report_id)
        self.assertFalse(verify_guest_token(self.report_id, token))

    def test_the_key_actually_carries_a_ttl(self):
        import redis
        from django.conf import settings

        issue_guest_token(self.report_id)
        client = redis.Redis(
            host=getattr(settings, "REDIS_HOST", "127.0.0.1"),
            port=int(getattr(settings, "REDIS_PORT", 6379)),
            db=1,
        )
        self.assertGreater(client.ttl(_key(self.report_id)), 0)
