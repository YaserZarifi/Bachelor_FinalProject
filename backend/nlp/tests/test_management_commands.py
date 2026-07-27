"""The `train_nlp` management command — the thesis's model-training entry point.

Training genuinely refits the model and rewrites the pickle in
``nlp/model_files/``, so every test here redirects those paths into a temporary
directory. Without that a test run would leave the developer's trained model
replaced by whatever the last test produced.
"""

import tempfile
from io import StringIO
from pathlib import Path
from unittest import mock

from django.core.management import call_command
from django.test import TestCase

from testkit import NoAutoNLPMixin, make_category, make_report


class _IsolatedModelDir:
    """Point the classifier's pickle paths at a throwaway directory."""

    def __enter__(self):
        self._tmp = tempfile.TemporaryDirectory(prefix="urbanhelper-model-")
        directory = Path(self._tmp.name)
        self._patches = [
            mock.patch("nlp.classifier.MODEL_DIR", directory),
            mock.patch("nlp.classifier.MODEL_PATH", directory / "classifier.pkl"),
            mock.patch("nlp.classifier.VECTORIZER_PATH", directory / "vectorizer.pkl"),
        ]
        for patch in self._patches:
            patch.start()
        return directory

    def __exit__(self, *exc):
        for patch in reversed(self._patches):
            patch.stop()
        self._tmp.cleanup()


def run_train(*args):
    out = StringIO()
    call_command("train_nlp", *args, stdout=out, stderr=StringIO())
    return out.getvalue()


class TrainCommandTests(TestCase):
    def test_training_runs_and_reports_success(self):
        with _IsolatedModelDir():
            output = run_train()
        self.assertIn("آموزش کامل شد", output)

    def test_training_writes_the_model_and_vectorizer_pickles(self):
        with _IsolatedModelDir() as directory:
            run_train()
            self.assertTrue((directory / "classifier.pkl").exists())
            self.assertTrue((directory / "vectorizer.pkl").exists())

    def test_the_reported_accuracy_is_a_sane_percentage(self):
        import re

        with _IsolatedModelDir():
            output = run_train()
        match = re.search(r"Cross-Validation\):\s*([\d.]+)%", output)
        self.assertIsNotNone(match, output)
        accuracy = float(match.group(1))
        self.assertGreater(accuracy, 50.0)
        self.assertLessEqual(accuracy, 100.0)

    def test_the_corpus_size_is_reported(self):
        with _IsolatedModelDir():
            output = run_train()
        self.assertIn("مجموع داده‌های آموزشی", output)

    def test_sample_predictions_are_printed_after_training(self):
        with _IsolatedModelDir():
            output = run_train()
        self.assertIn("تست چند نمونه واقعی", output)
        self.assertIn("نتیجه:", output)


class EvaluateOnlyTests(TestCase):
    def test_eval_reports_cross_validation_accuracy(self):
        with _IsolatedModelDir() as directory:
            run_train()  # produce a model first
            self.assertTrue((directory / "classifier.pkl").exists())
            output = run_train("--eval")
        self.assertIn("دقت CV", output)

    def test_eval_does_not_overwrite_the_saved_model(self):
        with _IsolatedModelDir() as directory:
            run_train()
            before = (directory / "classifier.pkl").read_bytes()
            run_train("--eval")
            self.assertEqual((directory / "classifier.pkl").read_bytes(), before)

    def test_eval_falls_back_to_training_when_no_model_exists(self):
        with _IsolatedModelDir() as directory:
            output = run_train("--eval")
        self.assertIn("آموزش کامل شد", output)

    def test_verbose_eval_prints_a_classification_report(self):
        with _IsolatedModelDir():
            run_train()
            output = run_train("--eval", "--verbose")
        self.assertIn("precision", output)


class TrainFromDatabaseTests(NoAutoNLPMixin, TestCase):
    """`--from-db` folds admin-confirmed reports back into the corpus — the
    feedback loop that lets the model improve as staff triage real reports."""

    def test_confirmed_reports_are_added_to_the_corpus(self):
        category = make_category(name="خرابی آسفالت")
        make_report(
            description="چاله بسیار عمیقی در خیابان اصلی محله ایجاد شده است",
            category=category,
            status="RESOLVED",
        )
        with _IsolatedModelDir():
            output = run_train("--from-db")
        self.assertIn("داده‌های DB: 1 نمونه", output)

    def test_reports_still_in_progress_are_not_used(self):
        category = make_category(name="خرابی آسفالت")
        make_report(
            description="چاله بسیار عمیقی در خیابان اصلی محله ایجاد شده است",
            category=category,
            status="IN_PROGRESS",
        )
        with _IsolatedModelDir():
            output = run_train("--from-db")
        self.assertIn("داده‌های DB: 0 نمونه", output)

    def test_uncategorised_reports_are_not_used(self):
        make_report(
            description="چاله بسیار عمیقی در خیابان اصلی محله ایجاد شده است",
            category=None,
            status="CLOSED",
        )
        with _IsolatedModelDir():
            output = run_train("--from-db")
        self.assertIn("داده‌های DB: 0 نمونه", output)

    def test_very_short_descriptions_are_not_used(self):
        category = make_category(name="خرابی آسفالت")
        make_report(description="چاله", category=category, status="CLOSED")
        with _IsolatedModelDir():
            output = run_train("--from-db")
        self.assertIn("داده‌های DB: 0 نمونه", output)

    def test_closed_reports_count_as_confirmed_too(self):
        category = make_category(name="انباشت زباله")
        make_report(
            description="زباله‌های انباشته شده در کنار پارک محله بوی بد می‌دهند",
            category=category,
            status="CLOSED",
        )
        with _IsolatedModelDir():
            output = run_train("--from-db")
        self.assertIn("داده‌های DB: 1 نمونه", output)

    def test_an_empty_database_simply_adds_nothing(self):
        with _IsolatedModelDir():
            output = run_train("--from-db")
        self.assertIn("داده‌های DB: 0 نمونه", output)
