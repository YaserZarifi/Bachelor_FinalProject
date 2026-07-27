"""WebSocket tests for `ws/reports/<id>/` (Channels consumer).

Live status is the feature citizens actually notice, and it is also the one
place where the dual-access model is enforced *outside* DRF: the consumer has
to authenticate a JWT **or** a guest token by itself.

`TransactionTestCase` is required — the consumer touches the database from a
separate async context, which a transaction-wrapped `TestCase` would hide.
"""

from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.gis.geos import Point
from django.test import TransactionTestCase

from civic_api.guest_tokens import issue_guest_token
from civic_api.routing import websocket_urlpatterns
from reports.models import Report
from testkit import TEHRAN_LAT, TEHRAN_LNG, access_token_for, make_image, no_auto_nlp

application = URLRouter(websocket_urlpatterns)


def _make_report_sync(user=None, status="SUBMITTED"):
    with no_auto_nlp():
        return Report.objects.create(
            user=user,
            description="گزارش برای تست وب‌سوکت",
            location=Point(TEHRAN_LNG, TEHRAN_LAT, srid=4326),
            image_before=make_image(),
            status=status,
        )


async def connect(report_id, query=""):
    communicator = WebsocketCommunicator(
        application, f"/ws/reports/{report_id}/{query}"
    )
    connected, code = await communicator.connect()
    return communicator, connected, code


class GuestSubscriptionTests(TransactionTestCase):
    def setUp(self):
        self.report = _make_report_sync()
        self.token = issue_guest_token(self.report.id)

    async def test_a_valid_guest_token_is_accepted(self):
        communicator, connected, _ = await connect(
            self.report.id, f"?guest_token={self.token}"
        )
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_the_server_confirms_the_subscription(self):
        communicator, _, _ = await connect(self.report.id, f"?guest_token={self.token}")
        message = await communicator.receive_json_from()
        self.assertEqual(message["event"], "subscribed")
        self.assertEqual(message["report_id"], self.report.id)
        await communicator.disconnect()

    async def test_a_wrong_guest_token_is_rejected_with_4403(self):
        _, connected, code = await connect(self.report.id, "?guest_token=nope")
        self.assertFalse(connected)
        self.assertEqual(code, 4403)

    async def test_no_credentials_at_all_is_rejected(self):
        _, connected, code = await connect(self.report.id)
        self.assertFalse(connected)
        self.assertEqual(code, 4403)

    async def test_a_token_for_another_report_is_rejected(self):
        other = await database_sync_to_async(_make_report_sync)()
        _, connected, code = await connect(other.id, f"?guest_token={self.token}")
        self.assertFalse(connected)
        self.assertEqual(code, 4403)

    async def test_an_unknown_report_is_rejected_with_4404(self):
        _, connected, code = await connect(999999, f"?guest_token={self.token}")
        self.assertFalse(connected)
        self.assertEqual(code, 4404)


class JwtSubscriptionTests(TransactionTestCase):
    def setUp(self):
        from testkit import make_staff, make_user

        self.owner = make_user(username="owner")
        self.stranger = make_user(username="stranger")
        self.staff = make_staff()
        self.report = _make_report_sync(user=self.owner)

    async def test_the_owners_jwt_is_accepted(self):
        communicator, connected, _ = await connect(
            self.report.id, f"?access={access_token_for(self.owner)}"
        )
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_another_citizens_jwt_is_rejected(self):
        _, connected, code = await connect(
            self.report.id, f"?access={access_token_for(self.stranger)}"
        )
        self.assertFalse(connected)
        self.assertEqual(code, 4403)

    async def test_a_malformed_jwt_is_rejected(self):
        _, connected, code = await connect(self.report.id, "?access=not.a.jwt")
        self.assertFalse(connected)
        self.assertEqual(code, 4403)

    async def test_staff_have_no_implicit_socket_access(self):
        # ⚠️ Documented asymmetry: the REST layer lets staff read every report,
        # but the consumer only checks ownership, so a staff JWT is refused.
        _, connected, code = await connect(
            self.report.id, f"?access={access_token_for(self.staff)}"
        )
        self.assertFalse(connected)
        self.assertEqual(code, 4403)

    async def test_a_guest_token_still_works_alongside_an_invalid_jwt(self):
        report = await database_sync_to_async(_make_report_sync)()
        token = await database_sync_to_async(issue_guest_token)(report.id)
        communicator, connected, _ = await connect(
            report.id, f"?access=bogus&guest_token={token}"
        )
        self.assertTrue(connected)
        await communicator.disconnect()


class LiveUpdateDeliveryTests(TransactionTestCase):
    """The end-to-end promise: a staff transition reaches the citizen's screen
    without a refresh."""

    def setUp(self):
        self.report = _make_report_sync()
        self.token = issue_guest_token(self.report.id)

    async def _subscribed(self):
        communicator, connected, _ = await connect(
            self.report.id, f"?guest_token={self.token}"
        )
        self.assertTrue(connected)
        await communicator.receive_json_from()  # drop the "subscribed" frame
        return communicator

    async def test_a_status_change_is_pushed_to_the_subscriber(self):
        communicator = await self._subscribed()

        @database_sync_to_async
        def advance():
            self.report.status = "UNDER_REVIEW"
            self.report.save()

        await advance()
        message = await communicator.receive_json_from(timeout=5)
        self.assertEqual(message["event"], "report.updated")
        self.assertEqual(message["report_id"], self.report.id)
        self.assertEqual(message["status"], "UNDER_REVIEW")
        await communicator.disconnect()

    async def test_the_urgent_flag_is_pushed(self):
        communicator = await self._subscribed()

        @database_sync_to_async
        def escalate():
            self.report.is_urgent = True
            self.report.save()

        await escalate()
        message = await communicator.receive_json_from(timeout=5)
        self.assertTrue(message["is_urgent"])
        await communicator.disconnect()

    async def test_the_payload_carries_a_timestamp(self):
        communicator = await self._subscribed()

        @database_sync_to_async
        def touch():
            self.report.status = "UNDER_REVIEW"
            self.report.save()

        await touch()
        message = await communicator.receive_json_from(timeout=5)
        self.assertIsNotNone(message["updated_at"])
        await communicator.disconnect()

    async def test_updates_to_other_reports_are_not_delivered(self):
        communicator = await self._subscribed()
        other = await database_sync_to_async(_make_report_sync)()

        @database_sync_to_async
        def advance_other():
            other.status = "UNDER_REVIEW"
            other.save()

        await advance_other()
        self.assertTrue(await communicator.receive_nothing(timeout=1))
        await communicator.disconnect()

    async def test_two_subscribers_both_receive_the_update(self):
        first = await self._subscribed()
        second = await self._subscribed()

        @database_sync_to_async
        def advance():
            self.report.status = "UNDER_REVIEW"
            self.report.save()

        await advance()
        self.assertEqual((await first.receive_json_from(timeout=5))["status"], "UNDER_REVIEW")
        self.assertEqual((await second.receive_json_from(timeout=5))["status"], "UNDER_REVIEW")
        await first.disconnect()
        await second.disconnect()

    async def test_a_disconnected_client_stops_receiving(self):
        communicator = await self._subscribed()
        await communicator.disconnect()

        @database_sync_to_async
        def advance():
            self.report.status = "UNDER_REVIEW"
            self.report.save()

        await advance()  # must not raise even with nobody listening


class OriginValidationTests(TransactionTestCase):
    """The production ASGI app wraps the router in an `OriginValidator`."""

    def setUp(self):
        self.report = _make_report_sync()
        self.token = issue_guest_token(self.report.id)

    async def test_a_disallowed_origin_is_rejected(self):
        from channels.security.websocket import OriginValidator

        guarded = OriginValidator(application, ["http://localhost:3001"])
        communicator = WebsocketCommunicator(
            guarded,
            f"/ws/reports/{self.report.id}/?guest_token={self.token}",
            headers=[(b"origin", b"http://evil.example.com")],
        )
        connected, _ = await communicator.connect()
        self.assertFalse(connected)

    async def test_an_allowed_origin_passes_through(self):
        from channels.security.websocket import OriginValidator

        guarded = OriginValidator(application, ["http://localhost:3001"])
        communicator = WebsocketCommunicator(
            guarded,
            f"/ws/reports/{self.report.id}/?guest_token={self.token}",
            headers=[(b"origin", b"http://localhost:3001")],
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()


class RoutingTests(TransactionTestCase):
    def test_the_route_pattern_only_accepts_numeric_ids(self):
        pattern = websocket_urlpatterns[0].pattern
        self.assertIsNotNone(pattern.regex.search("ws/reports/12/"))
        self.assertIsNone(pattern.regex.search("ws/reports/abc/"))

    def test_a_trailing_slash_is_required(self):
        pattern = websocket_urlpatterns[0].pattern
        self.assertIsNone(pattern.regex.search("ws/reports/12"))
