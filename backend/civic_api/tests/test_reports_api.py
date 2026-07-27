"""End-to-end REST tests for `/api/reports/` and `/api/categories/`.

This is the platform's dual-access model in action: a report may be filed with
no account at all (the server hands back a one-report guest token), while list
and write access stay locked down to the owner or to staff.
"""

from django.test import TestCase
from rest_framework.test import APIClient

from reports.models import Report
from testkit import (
    TEHRAN_LAT,
    TEHRAN_LNG,
    NoAutoNLPMixin,
    auth,
    geometry_lng_lat,
    make_category,
    make_image,
    make_report,
    make_staff,
    make_user,
    properties,
    report_payload,
)

REPORTS_URL = "/api/reports/"


class AnonymousReportCreationTests(NoAutoNLPMixin, TestCase):
    """A citizen must be able to file a report without an account — the
    proposal's core accessibility requirement."""

    def setUp(self):
        self.client = APIClient()

    def test_anonymous_create_succeeds(self):
        response = self.client.post(REPORTS_URL, report_payload(), format="multipart")
        self.assertEqual(response.status_code, 201, response.data)

    def test_created_report_has_no_owner(self):
        self.client.post(REPORTS_URL, report_payload(), format="multipart")
        self.assertIsNone(Report.objects.get().user)

    def test_response_is_a_geojson_feature(self):
        response = self.client.post(REPORTS_URL, report_payload(), format="multipart")
        self.assertEqual(response.data["type"], "Feature")
        self.assertIn("properties", response.data)

    def test_response_geometry_matches_the_submitted_point(self):
        response = self.client.post(REPORTS_URL, report_payload(), format="multipart")
        lng, lat = geometry_lng_lat(response.data["geometry"])
        self.assertAlmostEqual(lng, TEHRAN_LNG, places=4)
        self.assertAlmostEqual(lat, TEHRAN_LAT, places=4)

    def test_guest_access_token_is_returned_inside_properties(self):
        response = self.client.post(REPORTS_URL, report_payload(), format="multipart")
        token = properties(response.data).get("guest_access_token")
        self.assertTrue(token)
        self.assertGreaterEqual(len(token), 32)

    def test_guest_token_actually_verifies_against_the_store(self):
        from civic_api.guest_tokens import verify_guest_token

        response = self.client.post(REPORTS_URL, report_payload(), format="multipart")
        self.assertTrue(
            verify_guest_token(
                response.data["id"], properties(response.data)["guest_access_token"]
            )
        )

    def test_each_report_gets_a_distinct_token(self):
        first = self.client.post(REPORTS_URL, report_payload(), format="multipart")
        second = self.client.post(REPORTS_URL, report_payload(), format="multipart")
        self.assertNotEqual(
            properties(first.data)["guest_access_token"],
            properties(second.data)["guest_access_token"],
        )

    def test_capture_metadata_is_persisted(self):
        self.client.post(REPORTS_URL, report_payload(), format="multipart")
        report = Report.objects.get()
        self.assertEqual(report.capture_source, "CAMERA")
        self.assertEqual(report.gps_accuracy, 12.5)
        self.assertEqual(report.client_integrity_hash, "a" * 64)
        self.assertIsNotNone(report.captured_at)

    def test_new_report_starts_in_submitted(self):
        response = self.client.post(REPORTS_URL, report_payload(), format="multipart")
        self.assertEqual(properties(response.data)["status"], "SUBMITTED")

    def test_missing_description_is_rejected(self):
        payload = report_payload()
        payload.pop("description")
        response = self.client.post(REPORTS_URL, payload, format="multipart")
        self.assertEqual(response.status_code, 400)

    def test_missing_image_is_rejected(self):
        payload = report_payload()
        payload.pop("image_before")
        response = self.client.post(REPORTS_URL, payload, format="multipart")
        self.assertEqual(response.status_code, 400)

    def test_missing_location_is_rejected(self):
        payload = report_payload()
        payload.pop("location")
        response = self.client.post(REPORTS_URL, payload, format="multipart")
        self.assertEqual(response.status_code, 400)

    def test_vpn_grade_gps_accuracy_is_rejected(self):
        response = self.client.post(
            REPORTS_URL, report_payload(gps_accuracy=45000), format="multipart"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("gps_accuracy", response.data)

    def test_camera_capture_without_accuracy_is_rejected(self):
        payload = report_payload()
        payload.pop("gps_accuracy")
        response = self.client.post(REPORTS_URL, payload, format="multipart")
        self.assertEqual(response.status_code, 400)

    def test_a_category_may_be_chosen_at_submission(self):
        category = make_category(name="انباشت زباله")
        response = self.client.post(
            REPORTS_URL, report_payload(category=category.id), format="multipart"
        )
        self.assertEqual(properties(response.data)["category"], category.id)
        self.assertEqual(properties(response.data)["category_name"], "انباشت زباله")


class AuthenticatedReportCreationTests(NoAutoNLPMixin, TestCase):
    def setUp(self):
        self.user = make_user()
        self.client = auth(APIClient(), self.user)

    def test_report_is_attributed_to_the_signed_in_user(self):
        self.client.post(REPORTS_URL, report_payload(), format="multipart")
        self.assertEqual(Report.objects.get().user, self.user)

    def test_no_guest_token_is_issued_for_signed_in_users(self):
        response = self.client.post(REPORTS_URL, report_payload(), format="multipart")
        self.assertIsNone(properties(response.data).get("guest_access_token"))

    def test_client_cannot_attribute_a_report_to_someone_else(self):
        other = make_user(username="other")
        self.client.post(
            REPORTS_URL, report_payload(user=other.id), format="multipart"
        )
        self.assertEqual(Report.objects.get().user, self.user)


class ReportListTests(NoAutoNLPMixin, TestCase):
    def setUp(self):
        self.owner = make_user(username="owner")
        self.other = make_user(username="other")
        self.staff = make_staff()
        self.own = make_report(user=self.owner, description="مال من")
        self.foreign = make_report(user=self.other, description="مال دیگری")
        self.anonymous = make_report(user=None, description="ناشناس")

    def test_anonymous_listing_is_denied(self):
        self.assertEqual(APIClient().get(REPORTS_URL).status_code, 401)

    def test_a_citizen_sees_only_their_own_reports(self):
        response = auth(APIClient(), self.owner).get(REPORTS_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([f["id"] for f in response.data["features"]], [self.own.id])

    def test_a_citizen_never_sees_anonymous_reports(self):
        response = auth(APIClient(), self.owner).get(REPORTS_URL)
        ids = [f["id"] for f in response.data["features"]]
        self.assertNotIn(self.anonymous.id, ids)

    def test_staff_see_every_report(self):
        response = auth(APIClient(), self.staff).get(REPORTS_URL)
        self.assertEqual(len(response.data["features"]), 3)

    def test_list_is_a_feature_collection(self):
        response = auth(APIClient(), self.staff).get(REPORTS_URL)
        self.assertEqual(response.data["type"], "FeatureCollection")

    def test_list_is_ordered_newest_first(self):
        response = auth(APIClient(), self.staff).get(REPORTS_URL)
        ids = [f["id"] for f in response.data["features"]]
        self.assertEqual(ids, sorted(ids, reverse=True))


class ReportRetrieveTests(NoAutoNLPMixin, TestCase):
    def setUp(self):
        self.owner = make_user(username="owner")
        self.other = make_user(username="other")
        self.staff = make_staff()
        self.report = make_report(user=self.owner)
        self.guest_report = make_report(user=None)

        from civic_api.guest_tokens import issue_guest_token

        self.guest_token = issue_guest_token(self.guest_report.id)

    def test_owner_can_read_their_report(self):
        response = auth(APIClient(), self.owner).get(f"{REPORTS_URL}{self.report.id}/")
        self.assertEqual(response.status_code, 200)

    def test_another_citizen_cannot_read_it(self):
        response = auth(APIClient(), self.other).get(f"{REPORTS_URL}{self.report.id}/")
        self.assertEqual(response.status_code, 404)

    def test_staff_can_read_any_report(self):
        response = auth(APIClient(), self.staff).get(f"{REPORTS_URL}{self.report.id}/")
        self.assertEqual(response.status_code, 200)

    def test_anonymous_without_a_token_is_refused(self):
        response = APIClient().get(f"{REPORTS_URL}{self.guest_report.id}/")
        self.assertEqual(response.status_code, 404)

    def test_a_valid_guest_token_grants_read_access(self):
        response = APIClient().get(
            f"{REPORTS_URL}{self.guest_report.id}/", {"guest_token": self.guest_token}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.guest_report.id)

    def test_a_wrong_guest_token_is_refused(self):
        # DRF answers an *unauthenticated* denial with 401 (it can offer a
        # Bearer challenge); an authenticated one would be 403.
        response = APIClient().get(
            f"{REPORTS_URL}{self.guest_report.id}/", {"guest_token": "wrong-token"}
        )
        self.assertEqual(response.status_code, 401)

    def test_a_guest_token_does_not_unlock_a_different_report(self):
        # The token is scoped to exactly one report id.
        response = APIClient().get(
            f"{REPORTS_URL}{self.report.id}/", {"guest_token": self.guest_token}
        )
        self.assertEqual(response.status_code, 401)

    def test_a_signed_in_stranger_with_a_guest_token_is_forbidden(self):
        response = auth(APIClient(), self.other).get(
            f"{REPORTS_URL}{self.guest_report.id}/", {"guest_token": "wrong-token"}
        )
        self.assertEqual(response.status_code, 403)

    def test_unknown_report_id_is_a_404(self):
        response = auth(APIClient(), self.staff).get(f"{REPORTS_URL}999999/")
        self.assertEqual(response.status_code, 404)

    def test_detail_response_is_a_feature(self):
        response = auth(APIClient(), self.owner).get(f"{REPORTS_URL}{self.report.id}/")
        self.assertEqual(response.data["type"], "Feature")


class ReportWritePermissionTests(NoAutoNLPMixin, TestCase):
    def setUp(self):
        self.owner = make_user(username="owner")
        self.staff = make_staff()
        self.report = make_report(user=self.owner)
        self.url = f"{REPORTS_URL}{self.report.id}/"

    def test_anonymous_cannot_patch(self):
        self.assertEqual(APIClient().patch(self.url, {"description": "x"}).status_code, 401)

    def test_the_owner_cannot_patch_their_own_report(self):
        # Editing is a staff/triage operation; citizens file, they don't revise.
        response = auth(APIClient(), self.owner).patch(self.url, {"description": "x"})
        self.assertEqual(response.status_code, 403)

    def test_staff_can_patch(self):
        response = auth(APIClient(), self.staff).patch(
            self.url, {"description": "پس از بازدید میدانی"}
        )
        self.assertEqual(response.status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.description, "پس از بازدید میدانی")

    def test_the_owner_cannot_delete_their_own_report(self):
        self.assertEqual(auth(APIClient(), self.owner).delete(self.url).status_code, 403)

    def test_staff_can_delete(self):
        self.assertEqual(auth(APIClient(), self.staff).delete(self.url).status_code, 204)
        self.assertFalse(Report.objects.filter(id=self.report.id).exists())

    def test_staff_edits_cannot_rewrite_the_capture_record(self):
        report = make_report(
            capture_source="CAMERA", gps_accuracy=7.0, client_integrity_hash="d" * 64
        )
        auth(APIClient(), self.staff).patch(
            f"{REPORTS_URL}{report.id}/",
            {
                "capture_source": "UNKNOWN",
                "gps_accuracy": 99.0,
                "client_integrity_hash": "e" * 64,
            },
        )
        report.refresh_from_db()
        self.assertEqual(report.capture_source, "CAMERA")
        self.assertEqual(report.gps_accuracy, 7.0)
        self.assertEqual(report.client_integrity_hash, "d" * 64)

    def test_staff_patch_honours_the_status_machine(self):
        response = auth(APIClient(), self.staff).patch(self.url, {"status": "CLOSED"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.data)


class ReportTransitionActionTests(NoAutoNLPMixin, TestCase):
    """`POST /api/reports/{id}/transition/` — the only sanctioned way to move a
    report through its lifecycle."""

    def setUp(self):
        self.staff = make_staff()
        self.citizen = make_user()
        self.report = make_report(status="SUBMITTED")
        self.url = f"{REPORTS_URL}{self.report.id}/transition/"

    def test_anonymous_is_denied(self):
        self.assertEqual(
            APIClient().post(self.url, {"status": "UNDER_REVIEW"}).status_code, 401
        )

    def test_a_citizen_is_denied(self):
        response = auth(APIClient(), self.citizen).post(self.url, {"status": "UNDER_REVIEW"})
        self.assertEqual(response.status_code, 403)

    def test_staff_can_perform_an_allowed_transition(self):
        response = auth(APIClient(), self.staff).post(self.url, {"status": "UNDER_REVIEW"})
        self.assertEqual(response.status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "UNDER_REVIEW")

    def test_the_response_is_the_updated_feature(self):
        response = auth(APIClient(), self.staff).post(self.url, {"status": "UNDER_REVIEW"})
        self.assertEqual(response.data["type"], "Feature")
        self.assertEqual(properties(response.data)["status"], "UNDER_REVIEW")

    def test_an_illegal_jump_is_rejected(self):
        response = auth(APIClient(), self.staff).post(self.url, {"status": "RESOLVED"})
        self.assertEqual(response.status_code, 400)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "SUBMITTED")

    def test_resolving_without_evidence_is_rejected(self):
        report = make_report(status="IN_PROGRESS")
        response = auth(APIClient(), self.staff).post(
            f"{REPORTS_URL}{report.id}/transition/", {"status": "RESOLVED"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("image_after", response.data)

    def test_resolving_with_evidence_succeeds_and_stores_the_image(self):
        report = make_report(status="IN_PROGRESS")
        response = auth(APIClient(), self.staff).post(
            f"{REPORTS_URL}{report.id}/transition/",
            {"status": "RESOLVED", "image_after": make_image("after.jpg")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200, response.data)
        report.refresh_from_db()
        self.assertEqual(report.status, "RESOLVED")
        self.assertTrue(report.image_after)

    def test_a_closed_report_is_frozen(self):
        report = make_report(status="CLOSED")
        response = auth(APIClient(), self.staff).post(
            f"{REPORTS_URL}{report.id}/transition/", {"status": "IN_PROGRESS"}
        )
        self.assertEqual(response.status_code, 400)

    def test_the_whole_lifecycle_can_be_walked(self):
        client = auth(APIClient(), self.staff)
        for target in ("UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"):
            self.assertEqual(client.post(self.url, {"status": target}).status_code, 200)
        self.assertEqual(
            client.post(
                self.url,
                {"status": "RESOLVED", "image_after": make_image("after.jpg")},
                format="multipart",
            ).status_code,
            200,
        )
        self.assertEqual(client.post(self.url, {"status": "CLOSED"}).status_code, 200)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "CLOSED")

    def test_transition_on_a_missing_report_is_a_404(self):
        response = auth(APIClient(), self.staff).post(
            f"{REPORTS_URL}999999/transition/", {"status": "UNDER_REVIEW"}
        )
        self.assertEqual(response.status_code, 404)


class DistanceFilterTests(NoAutoNLPMixin, TestCase):
    """`DistanceToPointFilter` powers "reports near me" on the map.

    ⚠️ `ReportViewSet` does not set `distance_filter_convert_meters`, so `dist`
    is interpreted in **degrees**, not metres — a `dist=1000` query therefore
    matches the whole hemisphere rather than a 1 km radius.
    """

    def setUp(self):
        self.staff = make_staff()
        self.client = auth(APIClient(), self.staff)
        self.near = make_report(lng=TEHRAN_LNG + 0.001, lat=TEHRAN_LAT, description="نزدیک")
        self.far = make_report(lng=TEHRAN_LNG + 3.0, lat=TEHRAN_LAT, description="دور")

    def _ids(self, response):
        return {f["id"] for f in response.data["features"]}

    def test_without_a_point_every_report_is_returned(self):
        self.assertEqual(
            self._ids(self.client.get(REPORTS_URL)), {self.near.id, self.far.id}
        )

    def test_a_tight_radius_returns_only_the_nearby_report(self):
        response = self.client.get(
            REPORTS_URL, {"point": f"{TEHRAN_LNG},{TEHRAN_LAT}", "dist": "0.01"}
        )
        self.assertEqual(self._ids(response), {self.near.id})

    def test_a_wide_radius_returns_both(self):
        response = self.client.get(
            REPORTS_URL, {"point": f"{TEHRAN_LNG},{TEHRAN_LAT}", "dist": "10"}
        )
        self.assertEqual(self._ids(response), {self.near.id, self.far.id})

    def test_the_dist_parameter_is_in_degrees_not_metres(self):
        # Documents the gotcha above: 0.5 "metres" would exclude everything, but
        # 0.5 degrees ≈ 55 km, so the nearby report still matches.
        response = self.client.get(
            REPORTS_URL, {"point": f"{TEHRAN_LNG},{TEHRAN_LAT}", "dist": "0.5"}
        )
        self.assertIn(self.near.id, self._ids(response))

    def test_a_malformed_point_is_a_client_error(self):
        response = self.client.get(REPORTS_URL, {"point": "not,a,point", "dist": "1"})
        self.assertEqual(response.status_code, 400)

    def test_a_malformed_distance_is_a_client_error(self):
        response = self.client.get(
            REPORTS_URL, {"point": f"{TEHRAN_LNG},{TEHRAN_LAT}", "dist": "far"}
        )
        self.assertEqual(response.status_code, 400)


class CategoryApiTests(TestCase):
    URL = "/api/categories/"

    def setUp(self):
        self.category = make_category(name="خرابی آسفالت", description="چاله و ترک")

    def test_listing_requires_authentication(self):
        self.assertEqual(APIClient().get(self.URL).status_code, 401)

    def test_a_citizen_can_list_categories(self):
        response = auth(APIClient(), make_user()).get(self.URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_categories_are_plain_json_not_geojson(self):
        response = auth(APIClient(), make_user()).get(self.URL)
        self.assertEqual(response.data[0]["name"], "خرابی آسفالت")
        self.assertNotIn("geometry", response.data[0])

    def test_a_single_category_can_be_retrieved(self):
        response = auth(APIClient(), make_user()).get(f"{self.URL}{self.category.id}/")
        self.assertEqual(response.status_code, 200)

    def test_the_endpoint_is_read_only(self):
        client = auth(APIClient(), make_staff())
        self.assertEqual(client.post(self.URL, {"name": "جدید"}).status_code, 405)
        self.assertEqual(
            client.delete(f"{self.URL}{self.category.id}/").status_code, 405
        )
