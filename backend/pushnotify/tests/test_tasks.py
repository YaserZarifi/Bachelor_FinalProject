"""`pushnotify.tasks.send_status_push` — who gets told when a report moves.

The fan-out rule is: the author's own devices (for signed-in reports) **plus**
any anonymous device that presented the report's guest token. Getting the
audience wrong either leaks one citizen's report status to another, or leaves
the reporter uninformed.
"""

from unittest import mock

from django.test import TestCase

from pushnotify.models import PushDevice, ReportSubscription
from pushnotify.tasks import STATUS_LABELS, _collect_tokens, send_status_push
from testkit import NoAutoNLPMixin, make_report, make_user

OWNER_TOKEN = "ExponentPushToken[owner-phone]"
GUEST_TOKEN = "ExponentPushToken[guest-phone]"
STRANGER_TOKEN = "ExponentPushToken[stranger-phone]"


class AudienceTests(NoAutoNLPMixin, TestCase):
    def setUp(self):
        self.owner = make_user(username="owner")
        self.report = make_report(user=self.owner)

    def test_the_authors_devices_are_included(self):
        PushDevice.objects.create(expo_token=OWNER_TOKEN, user=self.owner)
        self.assertEqual(_collect_tokens(self.report), {OWNER_TOKEN})

    def test_another_citizens_devices_are_excluded(self):
        stranger = make_user(username="stranger")
        PushDevice.objects.create(expo_token=STRANGER_TOKEN, user=stranger)
        self.assertEqual(_collect_tokens(self.report), set())

    def test_a_subscribed_guest_device_is_included(self):
        device = PushDevice.objects.create(expo_token=GUEST_TOKEN)
        ReportSubscription.objects.create(report=self.report, device=device)
        self.assertIn(GUEST_TOKEN, _collect_tokens(self.report))

    def test_the_author_and_a_guest_device_are_both_reached(self):
        PushDevice.objects.create(expo_token=OWNER_TOKEN, user=self.owner)
        guest = PushDevice.objects.create(expo_token=GUEST_TOKEN)
        ReportSubscription.objects.create(report=self.report, device=guest)
        self.assertEqual(_collect_tokens(self.report), {OWNER_TOKEN, GUEST_TOKEN})

    def test_deactivated_owner_devices_are_skipped(self):
        PushDevice.objects.create(
            expo_token=OWNER_TOKEN, user=self.owner, is_active=False
        )
        self.assertEqual(_collect_tokens(self.report), set())

    def test_deactivated_subscribed_devices_are_skipped(self):
        device = PushDevice.objects.create(expo_token=GUEST_TOKEN, is_active=False)
        ReportSubscription.objects.create(report=self.report, device=device)
        self.assertEqual(_collect_tokens(self.report), set())

    def test_a_device_that_is_both_owner_and_subscriber_is_counted_once(self):
        device = PushDevice.objects.create(expo_token=OWNER_TOKEN, user=self.owner)
        ReportSubscription.objects.create(report=self.report, device=device)
        self.assertEqual(_collect_tokens(self.report), {OWNER_TOKEN})

    def test_an_anonymous_report_only_reaches_its_subscribers(self):
        anonymous = make_report(user=None)
        PushDevice.objects.create(expo_token=OWNER_TOKEN, user=self.owner)
        guest = PushDevice.objects.create(expo_token=GUEST_TOKEN)
        ReportSubscription.objects.create(report=anonymous, device=guest)
        self.assertEqual(_collect_tokens(anonymous), {GUEST_TOKEN})

    def test_a_report_with_no_devices_reaches_nobody(self):
        self.assertEqual(_collect_tokens(self.report), set())


class MessageContentTests(NoAutoNLPMixin, TestCase):
    def setUp(self):
        self.owner = make_user(username="owner")
        self.report = make_report(user=self.owner, status="IN_PROGRESS")
        PushDevice.objects.create(expo_token=OWNER_TOKEN, user=self.owner)

    def _send(self, status="RESOLVED"):
        with mock.patch("pushnotify.tasks.send_push_messages", return_value=[]) as send:
            send_status_push(self.report.id, status)
        return send.call_args.args[0] if send.call_args else []

    def test_one_message_is_built_per_token(self):
        self.assertEqual(len(self._send()), 1)

    def test_the_message_is_addressed_to_the_device(self):
        self.assertEqual(self._send()[0]["to"], OWNER_TOKEN)

    def test_the_title_is_in_persian(self):
        self.assertEqual(self._send()[0]["title"], "وضعیت گزارش شما به‌روز شد")

    def test_the_body_names_the_report_and_its_new_state(self):
        body = self._send("RESOLVED")[0]["body"]
        self.assertIn(str(self.report.id), body)
        self.assertIn("حل‌شده", body)

    def test_every_status_renders_a_persian_label(self):
        for status, label in STATUS_LABELS.items():
            with self.subTest(status=status):
                self.assertIn(label, self._send(status)[0]["body"])

    def test_an_unknown_status_falls_back_to_the_raw_value(self):
        self.assertIn("MYSTERY", self._send("MYSTERY")[0]["body"])

    def test_the_payload_lets_the_app_deep_link_to_the_report(self):
        data = self._send()[0]["data"]
        self.assertEqual(data["type"], "report_status")
        self.assertEqual(data["report_id"], self.report.id)
        self.assertEqual(data["status"], "RESOLVED")

    def test_the_message_is_marked_high_priority_with_sound(self):
        message = self._send()[0]
        self.assertEqual(message["priority"], "high")
        self.assertEqual(message["sound"], "default")

    def test_the_android_channel_is_declared(self):
        self.assertEqual(self._send()[0]["channelId"], "status-updates")


class TaskRobustnessTests(NoAutoNLPMixin, TestCase):
    def test_a_report_with_no_audience_sends_nothing(self):
        report = make_report(user=None)
        with mock.patch("pushnotify.tasks.send_push_messages") as send:
            send_status_push(report.id, "RESOLVED")
        send.assert_not_called()

    def test_a_missing_report_is_a_no_op(self):
        with mock.patch("pushnotify.tasks.send_push_messages") as send:
            send_status_push(999999, "RESOLVED")  # must not raise
        send.assert_not_called()

    def test_the_task_is_registered_under_its_documented_name(self):
        self.assertEqual(send_status_push.name, "pushnotify.tasks.send_status_push")

    def test_several_devices_all_receive_a_message(self):
        owner = make_user(username="owner")
        report = make_report(user=owner)
        PushDevice.objects.create(expo_token=OWNER_TOKEN, user=owner)
        PushDevice.objects.create(expo_token=STRANGER_TOKEN, user=owner)
        with mock.patch("pushnotify.tasks.send_push_messages", return_value=[]) as send:
            send_status_push(report.id, "RESOLVED")
        self.assertEqual(len(send.call_args.args[0]), 2)


class EndToEndPushTests(NoAutoNLPMixin, TestCase):
    """From a staff transition all the way to the outgoing Expo payload."""

    def test_a_status_transition_produces_a_push_for_the_reporter(self):
        from rest_framework.test import APIClient

        from testkit import auth, make_staff

        owner = make_user(username="owner")
        report = make_report(user=owner, status="SUBMITTED")
        PushDevice.objects.create(expo_token=OWNER_TOKEN, user=owner)

        with mock.patch("pushnotify.tasks.send_push_messages", return_value=[]) as send:
            auth(APIClient(), make_staff()).post(
                f"/api/reports/{report.id}/transition/", {"status": "UNDER_REVIEW"}
            )

        messages = send.call_args.args[0]
        self.assertEqual(messages[0]["to"], OWNER_TOKEN)
        self.assertIn("در حال بررسی", messages[0]["body"])

    def test_a_guest_reporter_who_registered_a_device_is_notified(self):
        from rest_framework.test import APIClient

        from civic_api.guest_tokens import issue_guest_token
        from testkit import auth, make_staff

        report = make_report(user=None, status="SUBMITTED")
        guest_token = issue_guest_token(report.id)
        APIClient().post(
            "/api/push/register/",
            {
                "expo_token": GUEST_TOKEN,
                "report_id": report.id,
                "guest_token": guest_token,
            },
        )

        with mock.patch("pushnotify.tasks.send_push_messages", return_value=[]) as send:
            auth(APIClient(), make_staff()).post(
                f"/api/reports/{report.id}/transition/", {"status": "UNDER_REVIEW"}
            )

        self.assertEqual(send.call_args.args[0][0]["to"], GUEST_TOKEN)

    def test_an_unrelated_edit_produces_no_push(self):
        from rest_framework.test import APIClient

        from testkit import auth, make_staff

        owner = make_user(username="owner")
        report = make_report(user=owner)
        PushDevice.objects.create(expo_token=OWNER_TOKEN, user=owner)

        with mock.patch("pushnotify.tasks.send_push_messages") as send:
            auth(APIClient(), make_staff()).patch(
                f"/api/reports/{report.id}/", {"description": "یادداشت داخلی"}
            )
        send.assert_not_called()
