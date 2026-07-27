"""Model-level tests for the `reports` app (Category, Report).

Covers defaults, Persian display labels, geometry storage, the relational
delete behaviour that keeps a report alive after its author is removed, and the
JSON-backed NLP convenience properties.
"""

from django.contrib.gis.geos import Point
from django.db import IntegrityError, transaction
from django.test import TestCase

from reports.models import Category, Report
from testkit import TEHRAN_LAT, TEHRAN_LNG, make_category, make_report, make_user


class CategoryModelTests(TestCase):
    def test_str_is_the_name(self):
        self.assertEqual(str(make_category(name="انباشت زباله")), "انباشت زباله")

    def test_description_is_optional(self):
        category = Category.objects.create(name="روشنایی")
        self.assertIsNone(category.description)

    def test_persian_verbose_names(self):
        self.assertEqual(Category._meta.verbose_name, "دسته‌بندی")
        self.assertEqual(Category._meta.verbose_name_plural, "دسته‌بندی‌ها")


class ReportDefaultsTests(TestCase):
    def setUp(self):
        self.report = make_report()

    def test_new_report_starts_as_submitted(self):
        self.assertEqual(self.report.status, "SUBMITTED")

    def test_new_report_is_not_urgent_by_default(self):
        # Urgency is only ever set by the NLP crisis pass, never by the client.
        self.assertFalse(self.report.is_urgent)

    def test_capture_source_defaults_to_unknown(self):
        self.assertEqual(self.report.capture_source, "UNKNOWN")

    def test_capture_metadata_is_empty_by_default(self):
        self.assertIsNone(self.report.captured_at)
        self.assertIsNone(self.report.gps_accuracy)
        self.assertEqual(self.report.client_integrity_hash, "")

    def test_timestamps_are_populated(self):
        self.assertIsNotNone(self.report.created_at)
        self.assertIsNotNone(self.report.updated_at)

    def test_str_uses_persian_status_label(self):
        self.assertEqual(str(self.report), f"گزارش #{self.report.id} — ثبت شده")

    def test_str_reflects_status_changes(self):
        self.report.status = "RESOLVED"
        self.assertIn("حل‌شده", str(self.report))


class ReportStatusChoicesTests(TestCase):
    """The six lifecycle states are a contract shared by the two SPAs, the
    mobile app and the push worker — each mirrors this list."""

    EXPECTED = [
        ("SUBMITTED", "ثبت شده"),
        ("UNDER_REVIEW", "در حال بررسی"),
        ("ASSIGNED", "ارجاع داده‌شده"),
        ("IN_PROGRESS", "در حال اقدام"),
        ("RESOLVED", "حل‌شده"),
        ("CLOSED", "مختومه"),
    ]

    def test_status_choices_match_the_documented_lifecycle(self):
        self.assertEqual(Report.STATUS_CHOICES, self.EXPECTED)

    def test_push_worker_labels_match_the_model(self):
        from pushnotify.tasks import STATUS_LABELS

        self.assertEqual(STATUS_LABELS, dict(self.EXPECTED))

    def test_capture_source_choices(self):
        self.assertEqual(
            Report.CAPTURE_SOURCE_CHOICES,
            [("CAMERA", "دوربین درون‌برنامه‌ای"), ("UNKNOWN", "نامشخص")],
        )


class ReportGeometryTests(TestCase):
    def test_location_round_trips_as_a_wgs84_point(self):
        report = make_report(lng=TEHRAN_LNG, lat=TEHRAN_LAT)
        report.refresh_from_db()
        self.assertEqual(report.location.srid, 4326)
        self.assertAlmostEqual(report.location.x, TEHRAN_LNG, places=5)
        self.assertAlmostEqual(report.location.y, TEHRAN_LAT, places=5)

    def test_x_is_longitude_and_y_is_latitude(self):
        # GeoJSON coordinate order ([lng, lat]) trips people up constantly; this
        # pins the convention the serializers and both map clients rely on.
        report = make_report(lng=51.0, lat=35.0)
        self.assertEqual((report.location.x, report.location.y), (51.0, 35.0))

    def test_distance_query_finds_nearby_reports(self):
        from django.contrib.gis.measure import D

        near = make_report(lng=TEHRAN_LNG + 0.001, lat=TEHRAN_LAT)
        make_report(lng=TEHRAN_LNG + 5, lat=TEHRAN_LAT)  # ~450 km away
        centre = Point(TEHRAN_LNG, TEHRAN_LAT, srid=4326)

        found = Report.objects.filter(location__distance_lte=(centre, D(m=500)))
        self.assertEqual([r.id for r in found], [near.id])


class ReportRelationTests(TestCase):
    def test_deleting_the_author_keeps_the_report(self):
        user = make_user()
        report = make_report(user=user)
        user.delete()
        report.refresh_from_db()
        self.assertIsNone(report.user)

    def test_deleting_a_category_keeps_the_report(self):
        category = make_category()
        report = make_report(category=category)
        category.delete()
        report.refresh_from_db()
        self.assertIsNone(report.category)

    def test_reports_may_be_anonymous(self):
        self.assertIsNone(make_report(user=None).user)

    def test_nlp_suggested_category_is_independent_of_category(self):
        suggested = make_category(name="مشکلات روشنایی")
        report = make_report(nlp_suggested_category=suggested)
        report.refresh_from_db()
        self.assertIsNone(report.category)
        self.assertEqual(report.nlp_suggested_category, suggested)
        self.assertEqual(list(suggested.nlp_suggested_reports.all()), [report])


class ReportOrderingTests(TestCase):
    def test_default_ordering_is_newest_first(self):
        first = make_report(description="اول")
        second = make_report(description="دوم")
        third = make_report(description="سوم")
        self.assertEqual(
            [r.id for r in Report.objects.all()], [third.id, second.id, first.id]
        )


class ReportNlpPropertyTests(TestCase):
    def test_sentiment_property_reads_the_json_blob(self):
        report = make_report(nlp_meta={"sentiment_label_fa": "منفی"})
        self.assertEqual(report.nlp_sentiment, "منفی")

    def test_sentiment_property_is_none_without_meta(self):
        self.assertIsNone(make_report(nlp_meta=None).nlp_sentiment)

    def test_crisis_keywords_property_reads_the_json_blob(self):
        report = make_report(nlp_meta={"crisis_keywords_found": ["آتش‌سوزی", "خطر"]})
        self.assertEqual(report.nlp_crisis_keywords, ["آتش‌سوزی", "خطر"])

    def test_crisis_keywords_default_to_an_empty_list(self):
        self.assertEqual(make_report(nlp_meta=None).nlp_crisis_keywords, [])
        self.assertEqual(make_report(nlp_meta={}).nlp_crisis_keywords, [])

    def test_nlp_meta_survives_a_database_round_trip(self):
        meta = {"sentiment_score": -0.6, "crisis_keywords_found": ["گاز"], "n": 3}
        report = make_report(nlp_meta=meta)
        report.refresh_from_db()
        self.assertEqual(report.nlp_meta, meta)


class ReportRequiredFieldsTests(TestCase):
    def test_description_is_mandatory_at_the_database_level(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Report.objects.create(
                    description=None, location=Point(51.0, 35.0, srid=4326)
                )

    def test_location_is_mandatory_at_the_database_level(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Report.objects.create(description="بدون موقعیت", location=None)
