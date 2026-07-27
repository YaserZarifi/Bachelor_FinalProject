"""How the NLP pipeline attaches to a saved report.

Two paths exist and both are covered:

* ``nlp.signals.run_nlp_on_new_report`` — a synchronous ``post_save`` receiver
  that analyses every newly created report;
* ``nlp.tasks.process_report_nlp`` — the Celery task that does the same work off
  the request thread.

Also covers the two HTTP endpoints under ``/api/nlp/``.
"""

from unittest import mock

from django.contrib.gis.geos import Point
from django.test import TestCase
from rest_framework.test import APIClient

from nlp.tasks import process_report_nlp
from reports.models import Category, Report
from testkit import (
    TEHRAN_LAT,
    TEHRAN_LNG,
    NoAutoNLPMixin,
    auth,
    make_category,
    make_image,
    make_report,
    make_staff,
    make_user,
    no_auto_nlp,
)


def _create_report(description, category=None):
    """Create a report *with* the NLP signal live."""
    return Report.objects.create(
        description=description,
        category=category,
        location=Point(TEHRAN_LNG, TEHRAN_LAT, srid=4326),
        image_before=make_image(),
    )


class AutoAnalysisSignalTests(TestCase):
    def setUp(self):
        self.asphalt = make_category(name="خرابی آسفالت")
        self.rubbish = make_category(name="انباشت زباله")

    def test_a_new_report_is_analysed_automatically(self):
        report = _create_report("چاله عمیق در آسفالت")
        report.refresh_from_db()
        self.assertIsNotNone(report.nlp_meta)

    def test_the_stored_meta_carries_the_pipeline_output(self):
        report = _create_report("زباله‌های انباشته بوی بد می‌دهند")
        report.refresh_from_db()
        self.assertIn("sentiment_label_fa", report.nlp_meta)
        self.assertIn("crisis_keywords_found", report.nlp_meta)
        self.assertIn("category_source", report.nlp_meta)

    def test_a_crisis_report_is_marked_urgent_without_client_input(self):
        report = _create_report("نشت گاز و خطر انفجار در کوچه، فوری رسیدگی کنید")
        report.refresh_from_db()
        self.assertTrue(report.is_urgent)

    def test_a_routine_report_stays_non_urgent(self):
        report = _create_report("چراغ کوچه خاموش است")
        report.refresh_from_db()
        self.assertFalse(report.is_urgent)

    def test_an_uncategorised_report_gets_a_category(self):
        report = _create_report("چاله عمیق در آسفالت")
        report.refresh_from_db()
        self.assertEqual(report.category, self.asphalt)

    def test_a_category_chosen_by_the_citizen_is_never_overwritten(self):
        report = _create_report(
            "چاله عمیق در آسفالت", category=self.rubbish
        )
        report.refresh_from_db()
        self.assertEqual(report.category, self.rubbish)

    def test_editing_a_report_does_not_re_run_the_analysis(self):
        report = _create_report("چراغ کوچه خاموش است")
        report.refresh_from_db()
        before = report.nlp_meta
        with mock.patch("nlp.service.analyze_report") as analyze:
            report.description = "متن جدید"
            report.save()
        analyze.assert_not_called()
        report.refresh_from_db()
        self.assertEqual(report.nlp_meta, before)

    def test_an_analysis_failure_never_loses_the_report(self):
        # The citizen's submission must survive an NLP outage.
        with mock.patch("nlp.service.analyze_report", side_effect=RuntimeError("مدل خراب")):
            report = _create_report("چاله در خیابان")
        self.assertTrue(Report.objects.filter(id=report.id).exists())

    def test_a_report_filed_through_the_api_is_analysed(self):
        from testkit import report_payload

        response = APIClient().post(
            "/api/reports/",
            report_payload(description="زباله‌های انباشته در کنار خیابان بوی بد می‌دهد"),
            format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        report = Report.objects.get(id=response.data["id"])
        self.assertIsNotNone(report.nlp_meta)


class CeleryTaskTests(NoAutoNLPMixin, TestCase):
    """`nlp.tasks.process_report_nlp` — the asynchronous variant."""

    def setUp(self):
        self.category = make_category(name="خرابی آسفالت")

    def test_the_task_writes_the_analysis_back(self):
        report = make_report(description="چاله عمیق در آسفالت")
        process_report_nlp(report.id)
        report.refresh_from_db()
        self.assertIsNotNone(report.nlp_meta)

    def test_the_task_sets_the_suggested_category_and_confidence(self):
        report = make_report(description="چاله عمیق در آسفالت")
        process_report_nlp(report.id)
        report.refresh_from_db()
        self.assertEqual(report.nlp_suggested_category, self.category)
        self.assertIsNotNone(report.nlp_category_confidence)

    def test_the_task_escalates_urgency(self):
        report = make_report(description="آتش‌سوزی و انفجار، اورژانس خبر کنید")
        process_report_nlp(report.id)
        report.refresh_from_db()
        self.assertTrue(report.is_urgent)

    def test_the_task_leaves_the_chosen_category_alone(self):
        # Unlike the signal, the task only fills `nlp_suggested_category`, so
        # the staff-visible `category` is untouched.
        report = make_report(description="چاله عمیق در آسفالت")
        process_report_nlp(report.id)
        report.refresh_from_db()
        self.assertIsNone(report.category)

    def test_a_missing_report_is_a_no_op(self):
        process_report_nlp(999999)  # must not raise

    def test_a_suggestion_with_no_matching_category_row_is_skipped(self):
        report = make_report(description="چاله عمیق در آسفالت")
        Category.objects.all().delete()
        process_report_nlp(report.id)
        report.refresh_from_db()
        self.assertIsNone(report.nlp_suggested_category)
        self.assertIsNotNone(report.nlp_meta)

    def test_the_task_is_registered_under_its_documented_name(self):
        self.assertEqual(process_report_nlp.name, "nlp.tasks.process_report_nlp")


class AnalyzeEndpointTests(TestCase):
    """`POST /api/nlp/analyze/` — live feedback while the citizen types."""

    URL = "/api/nlp/analyze/"

    def setUp(self):
        make_category(name="انباشت زباله")
        self.client = auth(APIClient(), make_user())

    def test_authentication_is_required(self):
        self.assertEqual(APIClient().post(self.URL, {"text": "زباله"}).status_code, 401)

    def test_a_report_text_is_analysed(self):
        response = self.client.post(self.URL, {"text": "زباله‌های انباشته در کوچه"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("suggested_category", response.data)
        self.assertIn("sentiment", response.data)

    def test_urgency_is_reported(self):
        response = self.client.post(self.URL, {"text": "آتش‌سوزی و انفجار در ساختمان"})
        self.assertTrue(response.data["is_urgent"])
        self.assertGreater(response.data["crisis_score"], 0)

    def test_the_matched_crisis_keywords_are_returned(self):
        response = self.client.post(self.URL, {"text": "نشت گاز خطرناک"})
        self.assertIn("نشت گاز", response.data["crisis_keywords_found"])

    def test_the_sentiment_block_has_the_documented_shape(self):
        response = self.client.post(self.URL, {"text": "خیلی بد و افتضاح است"})
        self.assertEqual(
            set(response.data["sentiment"]), {"label", "label_fa", "score", "intensity"}
        )

    def test_empty_text_is_a_client_error(self):
        response = self.client.post(self.URL, {"text": ""})
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)

    def test_whitespace_only_text_is_a_client_error(self):
        self.assertEqual(self.client.post(self.URL, {"text": "   "}).status_code, 400)

    def test_a_missing_text_field_is_a_client_error(self):
        self.assertEqual(self.client.post(self.URL, {}).status_code, 400)

    def test_an_overlong_text_is_refused(self):
        response = self.client.post(self.URL, {"text": "ا" * 5001})
        self.assertEqual(response.status_code, 400)

    def test_text_at_the_length_limit_is_accepted(self):
        self.assertEqual(self.client.post(self.URL, {"text": "ا" * 5000}).status_code, 200)

    def test_analysing_does_not_create_a_report(self):
        self.client.post(self.URL, {"text": "زباله در کوچه"})
        self.assertEqual(Report.objects.count(), 0)


class ReanalyzeEndpointTests(NoAutoNLPMixin, TestCase):
    """`POST /api/nlp/reanalyze/<id>/` — re-run analysis after a staff edit."""

    def setUp(self):
        self.category = make_category(name="خرابی آسفالت")
        self.client = auth(APIClient(), make_staff())

    def test_an_existing_report_can_be_re_analysed(self):
        report = make_report(description="چاله عمیق در آسفالت")
        response = self.client.post(f"/api/nlp/reanalyze/{report.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["report_id"], report.id)
        self.assertIn("nlp_result", response.data)

    def test_re_analysis_applies_the_category(self):
        report = make_report(description="چاله عمیق در آسفالت")
        self.client.post(f"/api/nlp/reanalyze/{report.id}/")
        report.refresh_from_db()
        self.assertEqual(report.category, self.category)

    def test_re_analysis_can_escalate_urgency(self):
        report = make_report(description="نشت گاز و خطر انفجار در کوچه")
        self.client.post(f"/api/nlp/reanalyze/{report.id}/")
        report.refresh_from_db()
        self.assertTrue(report.is_urgent)

    def test_the_changed_fields_are_reported_back(self):
        report = make_report(description="آتش‌سوزی گسترده و انفجار")
        response = self.client.post(f"/api/nlp/reanalyze/{report.id}/")
        self.assertIn("is_urgent", response.data["updated_fields"])

    def test_re_analysing_an_unchanged_report_updates_nothing(self):
        report = make_report(description="یک متن کاملاً خنثی درباره پارک")
        response = self.client.post(f"/api/nlp/reanalyze/{report.id}/")
        self.assertEqual(response.data["updated_fields"], [])

    def test_an_unknown_report_is_a_404(self):
        response = self.client.post("/api/nlp/reanalyze/999999/")
        self.assertEqual(response.status_code, 404)
        self.assertIn("error", response.data)

    def test_authentication_is_required(self):
        report = make_report()
        self.assertEqual(
            APIClient().post(f"/api/nlp/reanalyze/{report.id}/").status_code, 401
        )

    def test_a_plain_citizen_can_currently_trigger_re_analysis(self):
        # ⚠️ The docstring says "admins only" but the view carries no
        # IsAdminUser permission, so the project default (IsAuthenticated)
        # applies. Pinned here so the gap is visible rather than assumed.
        report = make_report(description="چاله در خیابان")
        response = auth(APIClient(), make_user(username="citizen2")).post(
            f"/api/nlp/reanalyze/{report.id}/"
        )
        self.assertEqual(response.status_code, 200)


class SignalRegistrationTests(TestCase):
    def test_the_auto_analysis_receiver_is_connected(self):
        from django.db.models.signals import post_save

        from nlp.signals import run_nlp_on_new_report

        self.assertIn(run_nlp_on_new_report, [r[1]() for r in post_save.receivers])

    def test_the_test_helper_really_detaches_and_reattaches_it(self):
        from django.db.models.signals import post_save

        from nlp.signals import run_nlp_on_new_report

        with no_auto_nlp():
            self.assertNotIn(
                run_nlp_on_new_report, [r[1]() for r in post_save.receivers]
            )
        self.assertIn(run_nlp_on_new_report, [r[1]() for r in post_save.receivers])
