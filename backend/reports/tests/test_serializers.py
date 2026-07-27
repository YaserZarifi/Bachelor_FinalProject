"""Serializer tests — the GeoJSON contract, the anti-fraud capture rules and
the guarded status state-machine.

These are the invariants the whole platform leans on:

* every list response is a GeoJSON ``FeatureCollection`` and every detail
  response a ``Feature`` (both SPAs and the mobile app flatten exactly that);
* trusted-capture metadata is *write-once* — a staff edit can never rewrite the
  original record of when/where a photo was taken;
* a coarse GPS radius (the signature of an IP-derived, VPN-poisoned fix) is
  rejected server-side, not only in the browser;
* status may only move along ``ALLOWED_STATUS_TRANSITIONS``, and reaching
  RESOLVED always requires an "after" photo.
"""

from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory

from reports.models import Report
from reports.serializers import (
    ALLOWED_STATUS_TRANSITIONS,
    CategorySerializer,
    ReportSerializer,
    ReportTransitionSerializer,
)
from testkit import (
    TEHRAN_LAT,
    TEHRAN_LNG,
    NoAutoNLPMixin,
    geometry_lng_lat,
    make_category,
    make_image,
    make_report,
    make_staff,
    make_user,
)


def _request(user=None):
    request = APIRequestFactory().post("/api/reports/")
    request.user = user
    return request


class CategorySerializerTests(TestCase):
    def test_exposes_id_name_description(self):
        data = CategorySerializer(make_category(name="آب و فاضلاب", description="د")).data
        self.assertEqual(set(data), {"id", "name", "description"})
        self.assertEqual(data["name"], "آب و فاضلاب")


class GeoJsonShapeTests(TestCase):
    """Both frontends call `flattenFeatures()` / `flattenFeature()` on these
    exact shapes, so the envelope is part of the public contract."""

    def setUp(self):
        self.category = make_category(name="خرابی آسفالت")
        self.report = make_report(category=self.category)

    def test_single_report_serializes_as_a_geojson_feature(self):
        data = ReportSerializer(self.report).data
        self.assertEqual(data["type"], "Feature")
        self.assertIn("geometry", data)
        self.assertIn("properties", data)

    def test_geometry_carries_the_point_in_lng_lat_order(self):
        lng, lat = geometry_lng_lat(ReportSerializer(self.report).data["geometry"])
        self.assertAlmostEqual(lng, TEHRAN_LNG, places=5)
        self.assertAlmostEqual(lat, TEHRAN_LAT, places=5)

    def test_many_reports_serialize_as_a_feature_collection(self):
        make_report(description="دومی")
        data = ReportSerializer(Report.objects.all(), many=True).data
        self.assertEqual(data["type"], "FeatureCollection")
        self.assertEqual(len(data["features"]), 2)

    def test_id_lives_outside_properties(self):
        data = ReportSerializer(self.report).data
        self.assertEqual(data["id"], self.report.id)

    def test_scalar_fields_live_under_properties(self):
        props = ReportSerializer(self.report).data["properties"]
        for field in (
            "description",
            "status",
            "is_urgent",
            "capture_source",
            "captured_at",
            "gps_accuracy",
            "client_integrity_hash",
            "created_at",
            "updated_at",
        ):
            self.assertIn(field, props, f"«{field}» باید در properties باشد")

    def test_category_name_is_denormalised_for_the_client(self):
        props = ReportSerializer(self.report).data["properties"]
        self.assertEqual(props["category"], self.category.id)
        self.assertEqual(props["category_name"], "خرابی آسفالت")

    def test_category_name_is_null_when_uncategorised(self):
        props = ReportSerializer(make_report(category=None)).data["properties"]
        self.assertIsNone(props["category_name"])

    def test_nlp_convenience_fields_are_projected(self):
        report = make_report(
            nlp_meta={"sentiment_label_fa": "منفی", "crisis_keywords_found": ["گاز"]}
        )
        props = ReportSerializer(report).data["properties"]
        self.assertEqual(props["nlp_sentiment"], "منفی")
        self.assertEqual(props["nlp_crisis_keywords"], ["گاز"])


class GeometryEncodingDeviationTests(TestCase):
    """⚠️ Known deviation from the documented GeoJSON contract.

    ``django-rest-framework-gis`` installs its GeoDjango→``GeometryField``
    serializer mapping from its ``AppConfig.ready()``. ``rest_framework_gis`` is
    **not** listed in ``INSTALLED_APPS``, so that hook never runs and DRF falls
    back to a generic ``ModelField`` for ``Report.location`` — which renders the
    geometry as EWKT (``"SRID=4326;POINT (51.389 35.6892)"``) instead of
    ``{"type": "Point", "coordinates": [lng, lat]}``.

    Consequences observed in the clients:

    * ``frontend-admin`` copes — its ``toLatLng()`` parses both encodings;
    * ``frontend-citizen`` and ``mobile`` read ``geometry.coordinates`` directly,
      so their ``lat``/``lng`` come out ``undefined``.

    Fix: add ``"rest_framework_gis"`` to ``INSTALLED_APPS``. These tests pin the
    behaviour as it is today; once the app is registered they will fail loudly
    and should be updated to assert the GeoJSON object form.
    """

    def test_location_is_not_mapped_to_a_geometry_field(self):
        from rest_framework.fields import ModelField

        self.assertIsInstance(ReportSerializer().fields["location"], ModelField)

    def test_rest_framework_gis_is_not_installed(self):
        from django.conf import settings

        self.assertNotIn("rest_framework_gis", settings.INSTALLED_APPS)

    def test_geometry_is_currently_emitted_as_ewkt(self):
        geometry = ReportSerializer(make_report()).data["geometry"]
        self.assertIsInstance(geometry, str)
        self.assertTrue(geometry.startswith("SRID=4326;POINT"))

    def test_the_coordinates_are_still_recoverable_by_clients(self):
        geometry = ReportSerializer(make_report()).data["geometry"]
        self.assertEqual(
            geometry_lng_lat(geometry),
            (round(TEHRAN_LNG, 4), round(TEHRAN_LAT, 4)),
        )


class ReadOnlyFieldTests(NoAutoNLPMixin, TestCase):
    """A client must not be able to declare its own report urgent, nor forge
    NLP output — those are server-side determinations."""

    def _create(self, **extra):
        payload = {
            "description": "توضیح آزمایشی",
            "location": f"POINT({TEHRAN_LNG} {TEHRAN_LAT})",
            "image_before": make_image(),
        }
        payload.update(extra)
        serializer = ReportSerializer(data=payload, context={"request": _request()})
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    def test_client_cannot_set_is_urgent(self):
        self.assertFalse(self._create(is_urgent=True).is_urgent)

    def test_client_cannot_set_nlp_meta(self):
        self.assertIsNone(self._create(nlp_meta='{"forged": true}').nlp_meta)

    def test_client_cannot_set_nlp_confidence(self):
        self.assertIsNone(self._create(nlp_category_confidence=0.99).nlp_category_confidence)

    def test_declared_read_only_fields(self):
        self.assertEqual(
            set(ReportSerializer.Meta.read_only_fields),
            {
                "nlp_meta",
                "nlp_suggested_category",
                "nlp_category_confidence",
                "nlp_sentiment",
                "nlp_crisis_keywords",
                "created_at",
                "updated_at",
                "is_urgent",
            },
        )


class GpsAccuracyGateTests(TestCase):
    """The browser already filters coarse fixes, but a patched client or a raw
    API call behind a VPN would otherwise store the exit node's city as the
    incident location."""

    def _serializer(self, **extra):
        payload = {
            "description": "گزارش",
            "location": f"POINT({TEHRAN_LNG} {TEHRAN_LAT})",
            "image_before": make_image(),
        }
        payload.update(extra)
        return ReportSerializer(data=payload, context={"request": _request()})

    def test_gnss_grade_accuracy_is_accepted(self):
        self.assertTrue(self._serializer(gps_accuracy=12.0).is_valid())

    def test_accuracy_at_the_ceiling_is_accepted(self):
        self.assertTrue(self._serializer(gps_accuracy=200.0).is_valid())

    def test_kilometre_scale_accuracy_is_rejected(self):
        serializer = self._serializer(gps_accuracy=5000.0)
        self.assertFalse(serializer.is_valid())
        self.assertIn("gps_accuracy", serializer.errors)

    def test_rejection_message_is_in_persian_and_mentions_vpn(self):
        serializer = self._serializer(gps_accuracy=9000.0)
        serializer.is_valid()
        self.assertIn("VPN", str(serializer.errors["gps_accuracy"][0]))

    def test_missing_accuracy_is_allowed_for_non_camera_sources(self):
        self.assertTrue(self._serializer().is_valid())

    @override_settings(MAX_REPORT_GPS_ACCURACY_M=50)
    def test_ceiling_is_configurable(self):
        self.assertFalse(self._serializer(gps_accuracy=120.0).is_valid())
        self.assertTrue(self._serializer(gps_accuracy=40.0).is_valid())

    def test_camera_capture_must_declare_its_accuracy(self):
        # Otherwise the gate above is trivially bypassed by simply omitting it.
        serializer = self._serializer(capture_source="CAMERA")
        self.assertFalse(serializer.is_valid())
        self.assertIn("gps_accuracy", serializer.errors)

    def test_camera_capture_with_accuracy_is_valid(self):
        self.assertTrue(
            self._serializer(capture_source="CAMERA", gps_accuracy=8.0).is_valid()
        )


class CaptureMetadataImmutabilityTests(TestCase):
    """`ReportSerializer.update()` strips the four capture fields, so the
    original record of *when and where* the photo was taken is permanent."""

    def setUp(self):
        self.captured_at = timezone.now() - timedelta(hours=2)
        self.report = make_report(
            capture_source="CAMERA",
            captured_at=self.captured_at,
            gps_accuracy=9.0,
            client_integrity_hash="b" * 64,
        )

    def _update(self, **payload):
        serializer = ReportSerializer(
            self.report,
            data=payload,
            partial=True,
            context={"request": _request(make_staff())},
        )
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    def test_capture_source_cannot_be_rewritten(self):
        self.assertEqual(self._update(capture_source="UNKNOWN").capture_source, "CAMERA")

    def test_captured_at_cannot_be_rewritten(self):
        updated = self._update(captured_at=timezone.now().isoformat())
        self.assertEqual(updated.captured_at, self.captured_at)

    def test_gps_accuracy_cannot_be_rewritten(self):
        self.assertEqual(self._update(gps_accuracy=1.0).gps_accuracy, 9.0)

    def test_integrity_hash_cannot_be_rewritten(self):
        self.assertEqual(self._update(client_integrity_hash="c" * 64).client_integrity_hash, "b" * 64)

    def test_ordinary_fields_are_still_editable(self):
        self.assertEqual(self._update(description="توضیح اصلاح‌شده").description, "توضیح اصلاح‌شده")

    def test_accuracy_gate_does_not_fire_on_update(self):
        # The field is immutable, so a huge value on update is discarded rather
        # than raising — the create-time gate is the only place it matters.
        self.assertEqual(self._update(gps_accuracy=90000.0).gps_accuracy, 9.0)


class TransitionMapTests(TestCase):
    """Structural checks on the state machine itself."""

    def test_every_status_has_an_entry(self):
        self.assertEqual(
            set(ALLOWED_STATUS_TRANSITIONS),
            {c[0] for c in Report.STATUS_CHOICES},
        )

    def test_every_target_is_a_real_status(self):
        valid = {c[0] for c in Report.STATUS_CHOICES}
        for source, targets in ALLOWED_STATUS_TRANSITIONS.items():
            self.assertTrue(targets <= valid, f"مقصد نامعتبر در {source}")

    def test_closed_is_terminal(self):
        self.assertEqual(ALLOWED_STATUS_TRANSITIONS["CLOSED"], set())

    def test_no_status_transitions_to_itself(self):
        for source, targets in ALLOWED_STATUS_TRANSITIONS.items():
            self.assertNotIn(source, targets)

    def test_a_new_report_cannot_jump_straight_to_resolved(self):
        self.assertNotIn("RESOLVED", ALLOWED_STATUS_TRANSITIONS["SUBMITTED"])

    def test_resolved_can_be_reopened_to_in_progress(self):
        self.assertIn("IN_PROGRESS", ALLOWED_STATUS_TRANSITIONS["RESOLVED"])

    def test_every_status_is_reachable_from_submitted(self):
        seen, frontier = {"SUBMITTED"}, ["SUBMITTED"]
        while frontier:
            for target in ALLOWED_STATUS_TRANSITIONS[frontier.pop()]:
                if target not in seen:
                    seen.add(target)
                    frontier.append(target)
        self.assertEqual(seen, {c[0] for c in Report.STATUS_CHOICES})


class ReportSerializerStatusRuleTests(TestCase):
    """`ReportSerializer.validate()` guards the same machine on PATCH/PUT."""

    def setUp(self):
        self.staff = make_staff()
        self.report = make_report(status="SUBMITTED")

    def _validate(self, report=None, **payload):
        serializer = ReportSerializer(
            report or self.report,
            data=payload,
            partial=True,
            context={"request": _request(self.staff)},
        )
        return serializer

    def test_allowed_transition_passes(self):
        self.assertTrue(self._validate(status="UNDER_REVIEW").is_valid())

    def test_forbidden_transition_is_rejected(self):
        serializer = self._validate(status="CLOSED")
        self.assertFalse(serializer.is_valid())
        self.assertIn("status", serializer.errors)

    def test_rejection_message_names_both_states(self):
        serializer = self._validate(status="CLOSED")
        serializer.is_valid()
        message = str(serializer.errors["status"][0])
        self.assertIn("SUBMITTED", message)
        self.assertIn("CLOSED", message)

    def test_setting_the_same_status_is_a_no_op(self):
        self.assertTrue(self._validate(status="SUBMITTED").is_valid())

    def test_resolved_requires_an_after_image(self):
        report = make_report(status="IN_PROGRESS")
        serializer = self._validate(report, status="RESOLVED")
        self.assertFalse(serializer.is_valid())
        self.assertIn("image_after", serializer.errors)

    def test_resolved_is_allowed_when_the_after_image_is_supplied(self):
        report = make_report(status="IN_PROGRESS")
        self.assertTrue(
            self._validate(report, status="RESOLVED", image_after=make_image("after.jpg")).is_valid()
        )

    def test_resolved_is_allowed_when_an_after_image_already_exists(self):
        report = make_report(status="IN_PROGRESS")
        report.image_after = make_image("after.jpg")
        report.save()
        self.assertTrue(self._validate(report, status="RESOLVED").is_valid())

    def test_non_staff_bypasses_the_serializer_guard(self):
        # Documents *why* the viewset must also gate writes on IsStaffUser: the
        # serializer only enforces the machine for staff requests.
        serializer = ReportSerializer(
            self.report,
            data={"status": "CLOSED"},
            partial=True,
            context={"request": _request(make_user())},
        )
        self.assertTrue(serializer.is_valid())


class ReportTransitionSerializerTests(TestCase):
    """The dedicated `POST /reports/{id}/transition/` payload."""

    def setUp(self):
        self.report = make_report(status="SUBMITTED")

    def _serializer(self, report=None, **payload):
        return ReportTransitionSerializer(
            data=payload, context={"report": report or self.report}
        )

    def test_valid_transition(self):
        self.assertTrue(self._serializer(status="UNDER_REVIEW").is_valid())

    def test_invalid_transition(self):
        serializer = self._serializer(status="RESOLVED")
        self.assertFalse(serializer.is_valid())
        self.assertIn("status", serializer.errors)

    def test_unknown_status_value_is_rejected(self):
        serializer = self._serializer(status="TELEPORTED")
        self.assertFalse(serializer.is_valid())

    def test_status_is_required(self):
        self.assertFalse(self._serializer().is_valid())

    def test_same_status_short_circuits_validation(self):
        self.assertTrue(self._serializer(status="SUBMITTED").is_valid())

    def test_closed_report_cannot_transition_anywhere(self):
        closed = make_report(status="CLOSED")
        for target in ("SUBMITTED", "UNDER_REVIEW", "IN_PROGRESS", "RESOLVED"):
            with self.subTest(target=target):
                self.assertFalse(self._serializer(closed, status=target).is_valid())

    def test_resolved_requires_evidence(self):
        report = make_report(status="IN_PROGRESS")
        serializer = self._serializer(report, status="RESOLVED")
        self.assertFalse(serializer.is_valid())
        self.assertIn("image_after", serializer.errors)

    def test_resolved_accepts_evidence_in_the_payload(self):
        report = make_report(status="IN_PROGRESS")
        self.assertTrue(
            self._serializer(report, status="RESOLVED", image_after=make_image("after.jpg")).is_valid()
        )

    def test_full_lifecycle_walk_is_permitted(self):
        report = make_report(status="SUBMITTED")
        for target in ("UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"):
            serializer = self._serializer(report, status=target)
            self.assertTrue(serializer.is_valid(), serializer.errors)
            report.status = target
            report.save()

        serializer = self._serializer(report, status="RESOLVED", image_after=make_image("a.jpg"))
        self.assertTrue(serializer.is_valid(), serializer.errors)
        report.status = "RESOLVED"
        report.image_after = make_image("a.jpg")
        report.save()

        self.assertTrue(self._serializer(report, status="CLOSED").is_valid())

    def test_raise_exception_surfaces_a_validation_error(self):
        with self.assertRaises(ValidationError):
            self._serializer(status="CLOSED").is_valid(raise_exception=True)
