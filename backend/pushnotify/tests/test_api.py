"""Device registration API and the `PushDevice` / `ReportSubscription` models.

Registration is deliberately open to anonymous callers — a guest reporter has
no account but still deserves a notification when their report is fixed. The
guard is that binding a device to a report requires that report's guest token.
"""

from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from civic_api.guest_tokens import issue_guest_token
from pushnotify.models import PushDevice, ReportSubscription
from testkit import NoAutoNLPMixin, auth, make_report, make_user

REGISTER_URL = "/api/push/register/"
UNREGISTER_URL = "/api/push/unregister/"
TOKEN = "ExponentPushToken[device-alpha]"
OTHER_TOKEN = "ExponentPushToken[device-beta]"


class RegistrationTests(NoAutoNLPMixin, TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_an_anonymous_device_can_register(self):
        response = self.client.post(REGISTER_URL, {"expo_token": TOKEN})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["registered"])
        self.assertTrue(PushDevice.objects.filter(expo_token=TOKEN).exists())

    def test_an_anonymous_device_has_no_owner(self):
        self.client.post(REGISTER_URL, {"expo_token": TOKEN})
        self.assertIsNone(PushDevice.objects.get().user)

    def test_a_signed_in_device_is_bound_to_its_user(self):
        user = make_user()
        auth(self.client, user).post(REGISTER_URL, {"expo_token": TOKEN})
        self.assertEqual(PushDevice.objects.get().user, user)

    def test_the_platform_is_recorded(self):
        self.client.post(REGISTER_URL, {"expo_token": TOKEN, "platform": "android"})
        self.assertEqual(PushDevice.objects.get().platform, "android")

    def test_the_platform_defaults_to_unknown(self):
        self.client.post(REGISTER_URL, {"expo_token": TOKEN})
        self.assertEqual(PushDevice.objects.get().platform, "unknown")

    def test_an_unrecognised_platform_is_rejected(self):
        response = self.client.post(
            REGISTER_URL, {"expo_token": TOKEN, "platform": "symbian"}
        )
        self.assertEqual(response.status_code, 400)

    def test_a_non_expo_token_is_rejected(self):
        response = self.client.post(REGISTER_URL, {"expo_token": "fcm-token"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("expo_token", response.data)

    def test_the_rejection_message_is_in_persian(self):
        response = self.client.post(REGISTER_URL, {"expo_token": "fcm-token"})
        self.assertIn("Expo", str(response.data["expo_token"][0]))

    def test_the_token_is_required(self):
        self.assertEqual(self.client.post(REGISTER_URL, {}).status_code, 400)

    def test_registering_twice_updates_rather_than_duplicates(self):
        self.client.post(REGISTER_URL, {"expo_token": TOKEN, "platform": "ios"})
        self.client.post(REGISTER_URL, {"expo_token": TOKEN, "platform": "android"})
        self.assertEqual(PushDevice.objects.count(), 1)
        self.assertEqual(PushDevice.objects.get().platform, "android")

    def test_re_registering_reactivates_a_disabled_device(self):
        PushDevice.objects.create(expo_token=TOKEN, is_active=False)
        self.client.post(REGISTER_URL, {"expo_token": TOKEN})
        self.assertTrue(PushDevice.objects.get().is_active)

    def test_signing_in_claims_a_previously_anonymous_device(self):
        self.client.post(REGISTER_URL, {"expo_token": TOKEN})
        user = make_user()
        auth(self.client, user).post(REGISTER_URL, {"expo_token": TOKEN})
        self.assertEqual(PushDevice.objects.get().user, user)


class GuestSubscriptionTests(NoAutoNLPMixin, TestCase):
    """Binding an anonymous device to the one report it filed."""

    def setUp(self):
        self.client = APIClient()
        self.report = make_report(user=None)
        self.guest_token = issue_guest_token(self.report.id)

    def _register(self, **extra):
        payload = {"expo_token": TOKEN}
        payload.update(extra)
        return self.client.post(REGISTER_URL, payload)

    def test_a_valid_guest_token_creates_the_subscription(self):
        response = self._register(
            report_id=self.report.id, guest_token=self.guest_token
        )
        self.assertEqual(response.data["subscribed_report"], self.report.id)
        self.assertTrue(
            ReportSubscription.objects.filter(report=self.report).exists()
        )

    def test_a_wrong_guest_token_does_not_subscribe(self):
        response = self._register(report_id=self.report.id, guest_token="wrong")
        self.assertIsNone(response.data["subscribed_report"])
        self.assertFalse(ReportSubscription.objects.exists())

    def test_a_missing_guest_token_does_not_subscribe(self):
        response = self._register(report_id=self.report.id)
        self.assertIsNone(response.data["subscribed_report"])

    def test_a_token_for_a_different_report_does_not_subscribe(self):
        other = make_report(user=None)
        response = self._register(report_id=other.id, guest_token=self.guest_token)
        self.assertIsNone(response.data["subscribed_report"])

    def test_an_unknown_report_id_does_not_subscribe(self):
        response = self._register(report_id=999999, guest_token=self.guest_token)
        self.assertIsNone(response.data["subscribed_report"])

    def test_registering_without_a_report_leaves_the_device_unsubscribed(self):
        response = self._register()
        self.assertIsNone(response.data["subscribed_report"])
        self.assertFalse(ReportSubscription.objects.exists())

    def test_subscribing_twice_is_idempotent(self):
        self._register(report_id=self.report.id, guest_token=self.guest_token)
        self._register(report_id=self.report.id, guest_token=self.guest_token)
        self.assertEqual(ReportSubscription.objects.count(), 1)

    def test_one_device_may_follow_several_reports(self):
        second = make_report(user=None)
        second_token = issue_guest_token(second.id)
        self._register(report_id=self.report.id, guest_token=self.guest_token)
        self._register(report_id=second.id, guest_token=second_token)
        self.assertEqual(ReportSubscription.objects.count(), 2)


class UnregistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        PushDevice.objects.create(expo_token=TOKEN, is_active=True)

    def test_unregistering_deactivates_the_device(self):
        response = self.client.post(UNREGISTER_URL, {"expo_token": TOKEN})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["unregistered"])
        self.assertFalse(PushDevice.objects.get().is_active)

    def test_the_device_row_is_kept_for_audit(self):
        self.client.post(UNREGISTER_URL, {"expo_token": TOKEN})
        self.assertEqual(PushDevice.objects.count(), 1)

    def test_unregistering_an_unknown_token_is_harmless(self):
        response = self.client.post(UNREGISTER_URL, {"expo_token": OTHER_TOKEN})
        self.assertEqual(response.status_code, 200)

    def test_the_token_is_required(self):
        self.assertEqual(self.client.post(UNREGISTER_URL, {}).status_code, 400)

    def test_unregistering_needs_no_authentication(self):
        # A user who has signed out must still be able to stop notifications.
        self.assertEqual(
            APIClient().post(UNREGISTER_URL, {"expo_token": TOKEN}).status_code, 200
        )


class PushDeviceModelTests(TestCase):
    def test_the_expo_token_is_unique(self):
        PushDevice.objects.create(expo_token=TOKEN)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PushDevice.objects.create(expo_token=TOKEN)

    def test_devices_are_active_by_default(self):
        self.assertTrue(PushDevice.objects.create(expo_token=TOKEN).is_active)

    def test_str_names_the_owner(self):
        user = make_user(username="ali")
        device = PushDevice.objects.create(expo_token=TOKEN, user=user)
        self.assertIn("ali", str(device))

    def test_str_marks_anonymous_devices_as_guest(self):
        self.assertIn("guest", str(PushDevice.objects.create(expo_token=TOKEN)))

    def test_deleting_the_user_keeps_the_device(self):
        user = make_user()
        device = PushDevice.objects.create(expo_token=TOKEN, user=user)
        user.delete()
        device.refresh_from_db()
        self.assertIsNone(device.user)

    def test_a_user_may_register_several_devices(self):
        user = make_user()
        PushDevice.objects.create(expo_token=TOKEN, user=user)
        PushDevice.objects.create(expo_token=OTHER_TOKEN, user=user)
        self.assertEqual(user.push_devices.count(), 2)


class ReportSubscriptionModelTests(NoAutoNLPMixin, TestCase):
    def setUp(self):
        self.report = make_report()
        self.device = PushDevice.objects.create(expo_token=TOKEN)

    def test_a_device_cannot_subscribe_to_the_same_report_twice(self):
        ReportSubscription.objects.create(report=self.report, device=self.device)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ReportSubscription.objects.create(report=self.report, device=self.device)

    def test_deleting_the_report_removes_the_subscription(self):
        ReportSubscription.objects.create(report=self.report, device=self.device)
        self.report.delete()
        self.assertFalse(ReportSubscription.objects.exists())

    def test_deleting_the_device_removes_the_subscription(self):
        ReportSubscription.objects.create(report=self.report, device=self.device)
        self.device.delete()
        self.assertFalse(ReportSubscription.objects.exists())

    def test_str_identifies_both_sides(self):
        subscription = ReportSubscription.objects.create(
            report=self.report, device=self.device
        )
        self.assertIn(str(self.report.id), str(subscription))

    def test_the_reverse_accessors_are_named_as_documented(self):
        ReportSubscription.objects.create(report=self.report, device=self.device)
        self.assertEqual(self.report.push_subscriptions.count(), 1)
        self.assertEqual(self.device.subscriptions.count(), 1)
