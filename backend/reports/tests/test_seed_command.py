"""The `seed_reports` demo-data command.

It is the fixture behind every screenshot and dashboard chart in the thesis, so
what matters is that the data it produces is *plausible*: real Iranian city
coordinates, a realistic status mix, and back-dated timestamps so the charts
have a time series to draw.
"""

from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from reports.management.commands.seed_reports import CATEGORIES, CITIES, TEMPLATES
from reports.models import Category, Report
from testkit import NoAutoNLPMixin, make_report


def seed(*args, **kwargs):
    out = StringIO()
    call_command("seed_reports", *args, stdout=out, stderr=StringIO(), **kwargs)
    return out.getvalue()


class SeedDataTests(NoAutoNLPMixin, TestCase):
    def test_it_creates_the_requested_number_of_reports(self):
        seed("--count", "12")
        self.assertEqual(Report.objects.count(), 12)

    def test_it_defaults_to_sixty_reports(self):
        seed()
        self.assertEqual(Report.objects.count(), 60)

    def test_it_creates_the_canonical_categories(self):
        seed("--count", "5")
        self.assertEqual(
            set(Category.objects.values_list("name", flat=True)), set(CATEGORIES)
        )

    def test_it_reuses_categories_that_already_exist(self):
        Category.objects.create(name="خرابی آسفالت")
        seed("--count", "5")
        self.assertEqual(Category.objects.filter(name="خرابی آسفالت").count(), 1)

    def test_every_report_is_categorised(self):
        seed("--count", "20")
        self.assertFalse(Report.objects.filter(category__isnull=True).exists())

    def test_every_report_carries_a_description(self):
        seed("--count", "20")
        for report in Report.objects.all():
            self.assertTrue(report.description.strip())

    def test_the_run_is_reproducible_for_a_given_seed(self):
        seed("--count", "8", "--seed", "7")
        first = list(Report.objects.order_by("id").values_list("description", flat=True))
        Report.objects.all().delete()
        seed("--count", "8", "--seed", "7")
        second = list(Report.objects.order_by("id").values_list("description", flat=True))
        self.assertEqual(first, second)

    def test_different_seeds_produce_different_data(self):
        seed("--count", "8", "--seed", "1")
        first = list(Report.objects.order_by("id").values_list("description", flat=True))
        Report.objects.all().delete()
        seed("--count", "8", "--seed", "999")
        second = list(Report.objects.order_by("id").values_list("description", flat=True))
        self.assertNotEqual(first, second)


class SeedGeographyTests(NoAutoNLPMixin, TestCase):
    def test_every_report_lands_near_one_of_the_listed_cities(self):
        seed("--count", "40")
        for report in Report.objects.all():
            near = any(
                abs(report.location.y - lat) <= jitter + 1e-9
                and abs(report.location.x - lng) <= jitter + 1e-9
                for _, lat, lng, jitter in CITIES
            )
            self.assertTrue(near, f"گزارش #{report.id} خارج از محدوده شهرهاست")

    def test_coordinates_stay_inside_iran(self):
        seed("--count", "40")
        for report in Report.objects.all():
            self.assertGreater(report.location.x, 44)   # lng
            self.assertLess(report.location.x, 64)
            self.assertGreater(report.location.y, 25)   # lat
            self.assertLess(report.location.y, 40)

    def test_a_reasonable_batch_spreads_across_several_cities(self):
        output = seed("--count", "60")
        self.assertIn("cities", output)
        distinct_points = {
            (round(r.location.x), round(r.location.y)) for r in Report.objects.all()
        }
        self.assertGreater(len(distinct_points), 3)


class SeedRealismTests(NoAutoNLPMixin, TestCase):
    def test_it_produces_a_spread_of_statuses(self):
        seed("--count", "60")
        statuses = set(Report.objects.values_list("status", flat=True))
        self.assertGreater(len(statuses), 3)

    def test_only_valid_statuses_are_used(self):
        seed("--count", "60")
        valid = {c[0] for c in Report.STATUS_CHOICES}
        self.assertTrue(set(Report.objects.values_list("status", flat=True)) <= valid)

    def test_some_but_not_all_reports_are_urgent(self):
        seed("--count", "60")
        urgent = Report.objects.filter(is_urgent=True).count()
        self.assertGreater(urgent, 0)
        self.assertLess(urgent, 60)

    def test_reports_are_back_dated_so_charts_have_a_time_series(self):
        seed("--count", "30")
        now = timezone.now()
        oldest = Report.objects.order_by("created_at").first()
        self.assertLess(oldest.created_at, now)
        span_days = (now - oldest.created_at).days
        self.assertGreater(span_days, 7)

    def test_capture_metadata_looks_like_a_real_camera_capture(self):
        seed("--count", "20")
        for report in Report.objects.all():
            self.assertEqual(report.capture_source, "CAMERA")
            self.assertIsNotNone(report.captured_at)
            self.assertGreaterEqual(report.gps_accuracy, 4.0)
            self.assertLessEqual(report.gps_accuracy, 35.0)

    def test_seeded_accuracy_always_passes_the_production_gate(self):
        # Demo data must not be data the API itself would reject.
        from django.conf import settings

        seed("--count", "30")
        ceiling = settings.MAX_REPORT_GPS_ACCURACY_M
        for report in Report.objects.all():
            self.assertLessEqual(report.gps_accuracy, ceiling)

    def test_descriptions_come_from_the_template_bank(self):
        seed("--count", "20")
        prefixes = {
            template.split("{city}")[0][:20]
            for templates in TEMPLATES.values()
            for template in templates
        }
        for report in Report.objects.all():
            self.assertTrue(
                any(report.description.startswith(p) for p in prefixes),
                report.description,
            )

    def test_every_category_has_templates(self):
        self.assertEqual(set(TEMPLATES), set(CATEGORIES))


class SeedFlushTests(NoAutoNLPMixin, TestCase):
    def test_flush_removes_pre_existing_reports(self):
        make_report(description="گزارش قدیمی")
        seed("--count", "5", "--flush")
        self.assertEqual(Report.objects.count(), 5)
        self.assertFalse(Report.objects.filter(description="گزارش قدیمی").exists())

    def test_without_flush_existing_reports_survive(self):
        make_report(description="گزارش قدیمی")
        seed("--count", "5")
        self.assertEqual(Report.objects.count(), 6)

    def test_flush_reports_how_many_rows_it_deleted(self):
        make_report()
        output = seed("--count", "2", "--flush")
        self.assertIn("Deleted existing reports", output)
