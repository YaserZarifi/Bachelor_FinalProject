"""Custom Django test runner for UrbanHelper.

Guest access tokens live in Redis db=1 under the key ``uh:guest_ws:<report_id>``
(:mod:`civic_api.guest_tokens`). Test reports are numbered from 1, so running the
suite against the developer's Redis would silently overwrite the tokens of real
reports 1..N — citizens tracking those reports would lose access.

The runner therefore swaps the module-level Redis factory for an in-memory
double for the duration of the run. The double implements exactly the three
commands the token module uses (``set``/``get``/``delete``), so the code under
test is exercised unchanged. A dedicated test
(``civic_api.tests.test_guest_tokens.RealRedisGuestTokenTests``) still runs
against the real server, using out-of-range report ids and cleaning up after
itself.
"""

from __future__ import annotations

from django.test.runner import DiscoverRunner


class InMemoryRedis:
    """Minimal stand-in for the subset of ``redis.Redis`` guest tokens uses."""

    def __init__(self):
        self.store: dict[str, str] = {}
        self.expiries: dict[str, int] = {}

    def set(self, key, value, ex=None):
        self.store[key] = value
        if ex is not None:
            self.expiries[key] = ex
        return True

    def get(self, key):
        return self.store.get(key)

    def delete(self, key):
        self.expiries.pop(key, None)
        return 1 if self.store.pop(key, None) is not None else 0

    def flushdb(self):
        self.store.clear()
        self.expiries.clear()


#: Shared instance — tests may import and ``flushdb()`` it between cases.
fake_redis = InMemoryRedis()


class UrbanHelperTestRunner(DiscoverRunner):
    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        from civic_api import guest_tokens

        self._real_client = guest_tokens._client
        guest_tokens._client = lambda: fake_redis

    def teardown_test_environment(self, **kwargs):
        from civic_api import guest_tokens

        guest_tokens._client = self._real_client
        super().teardown_test_environment(**kwargs)
