"""Report signals — the fan-out that keeps every client in sync.

Saving a `Report` must (a) always broadcast over the WebSocket channel, and
(b) enqueue a mobile push **only** when an existing report's status genuinely
changed. Getting (b) wrong would spam citizens on every unrelated staff edit.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from django.test import TestCase

from civic_api.signals import notify_report_subscribers, stash_old_status
from reports.models import Report
from testkit import make_report, make_staff


class BroadcastSignalTests(TestCase):
    def test_creating_a_report_broadcasts(self):
        with patch("civic_api.signals.broadcast_report_update") as broadcast:
            report = make_report()
        broadcast.assert_called_once()
        self.assertEqual(broadcast.call_args.args[0].id, report.id)

    def test_updating_a_report_broadcasts(self):
        report = make_report()
        with patch("civic_api.signals.broadcast_report_update") as broadcast:
            report.status = "UNDER_REVIEW"
            report.save()
        broadcast.assert_called_once()

    def test_a_broken_channel_layer_never_breaks_the_save(self):
        # A dead Redis must not stop a citizen from filing a report.
        with patch(
            "civic_api.signals.broadcast_report_update",
            side_effect=RuntimeError("channel layer down"),
        ):
            report = make_report(description="با کانال خراب")
        self.assertTrue(Report.objects.filter(id=report.id).exists())


class StatusChangePushTests(TestCase):
    def setUp(self):
        self.report = make_report(status="SUBMITTED")

    def test_a_real_status_change_enqueues_a_push(self):
        with patch("pushnotify.tasks.send_status_push.delay") as delay:
            self.report.status = "UNDER_REVIEW"
            self.report.save()
        delay.assert_called_once_with(self.report.id, "UNDER_REVIEW")

    def test_creating_a_report_does_not_push(self):
        with patch("pushnotify.tasks.send_status_push.delay") as delay:
            make_report()
        delay.assert_not_called()

    def test_saving_without_a_status_change_does_not_push(self):
        with patch("pushnotify.tasks.send_status_push.delay") as delay:
            self.report.description = "توضیح جدید"
            self.report.save()
        delay.assert_not_called()

    def test_each_step_of_the_lifecycle_pushes_once(self):
        with patch("pushnotify.tasks.send_status_push.delay") as delay:
            for target in ("UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"):
                self.report.status = target
                self.report.save()
        self.assertEqual(delay.call_count, 3)

    def test_a_broker_outage_never_breaks_the_save(self):
        with patch(
            "pushnotify.tasks.send_status_push.delay",
            side_effect=OSError("broker unreachable"),
        ):
            self.report.status = "UNDER_REVIEW"
            self.report.save()
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "UNDER_REVIEW")

    def test_a_transition_through_the_api_pushes(self):
        from rest_framework.test import APIClient

        from testkit import auth

        client = auth(APIClient(), make_staff())
        with patch("pushnotify.tasks.send_status_push.delay") as delay:
            client.post(
                f"/api/reports/{self.report.id}/transition/", {"status": "UNDER_REVIEW"}
            )
        delay.assert_called_once_with(self.report.id, "UNDER_REVIEW")


class OldStatusStashTests(TestCase):
    """`pre_save` snapshots the previous status so `post_save` can tell a real
    transition from an unrelated field edit."""

    def test_a_new_instance_has_no_previous_status(self):
        report = Report(description="x")
        stash_old_status(Report, report)
        self.assertIsNone(report._old_status)

    def test_an_existing_instance_remembers_its_stored_status(self):
        report = make_report(status="ASSIGNED")
        report.status = "IN_PROGRESS"
        stash_old_status(Report, report)
        self.assertEqual(report._old_status, "ASSIGNED")

    def test_the_stash_reads_the_database_not_the_in_memory_value(self):
        report = make_report(status="SUBMITTED")
        report.status = "CLOSED"  # not saved yet
        stash_old_status(Report, report)
        self.assertEqual(report._old_status, "SUBMITTED")

    def test_a_deleted_row_leaves_the_stash_empty(self):
        report = make_report()
        Report.objects.filter(id=report.id).delete()
        stash_old_status(Report, report)
        self.assertIsNone(report._old_status)


class BroadcastPayloadTests(TestCase):
    """The payload the consumer relays to browsers and phones."""

    @staticmethod
    def _fake_layer():
        """`group_send` is awaited inside `async_to_sync`, so the double has to
        be awaitable."""
        layer = MagicMock()
        layer.group_send = AsyncMock()
        return layer

    def test_payload_carries_the_fields_clients_render(self):
        report = make_report(status="IN_PROGRESS", is_urgent=True)
        layer = self._fake_layer()
        with patch("civic_api.ws_broadcast.get_channel_layer", return_value=layer):
            from civic_api.ws_broadcast import broadcast_report_update

            broadcast_report_update(report)
        group, payload = layer.group_send.call_args.args
        self.assertEqual(group, f"report_{report.id}")
        self.assertEqual(payload["type"], "report.event")
        self.assertEqual(payload["event"], "report.updated")
        self.assertEqual(payload["report_id"], report.id)
        self.assertEqual(payload["status"], "IN_PROGRESS")
        self.assertTrue(payload["is_urgent"])
        self.assertIsNotNone(payload["updated_at"])

    def test_a_custom_event_name_is_honoured(self):
        report = make_report()
        layer = self._fake_layer()
        with patch("civic_api.ws_broadcast.get_channel_layer", return_value=layer):
            from civic_api.ws_broadcast import broadcast_report_update

            broadcast_report_update(report, event_name="report.created")
        self.assertEqual(layer.group_send.call_args.args[1]["event"], "report.created")

    def test_a_missing_channel_layer_is_a_no_op(self):
        report = make_report()
        with patch("civic_api.ws_broadcast.get_channel_layer", return_value=None):
            from civic_api.ws_broadcast import broadcast_report_update

            broadcast_report_update(report)  # must not raise


class SignalRegistrationTests(TestCase):
    """The wiring itself — a silently disconnected receiver would make every
    live-update test above pass while production stayed dark."""

    def test_post_save_receiver_is_connected(self):
        from django.db.models.signals import post_save

        receivers = [r[1]() for r in post_save.receivers]
        self.assertIn(notify_report_subscribers, receivers)

    def test_pre_save_receiver_is_connected(self):
        from django.db.models.signals import pre_save

        receivers = [r[1]() for r in pre_save.receivers]
        self.assertIn(stash_old_status, receivers)
