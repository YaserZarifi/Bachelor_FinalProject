# ==============================================================
# management/commands/train_nlp.py
# دستور مدیریتی برای آموزش و ارزیابی مدل NLP
#
# استفاده:
#   python manage.py train_nlp            ← آموزش اولیه
#   python manage.py train_nlp --eval     ← فقط ارزیابی
#   python manage.py train_nlp --from-db  ← آموزش با داده‌های DB هم
# ==============================================================

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "آموزش و ارزیابی مدل NLP برای دسته‌بندی گزارش‌های شهری"

    def add_arguments(self, parser):
        parser.add_argument(
            "--eval",
            action="store_true",
            help="فقط ارزیابی مدل موجود بدون آموزش مجدد",
        )
        parser.add_argument(
            "--from-db",
            action="store_true",
            help="اضافه کردن گزارش‌های تأییدشده DB به داده‌های آموزشی",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="نمایش جزئیات بیشتر",
        )

    def handle(self, *args, **options):
        from nlp.training_data import TRAINING_SAMPLES
        from nlp.classifier import (
            train_model, normalize_persian, MODEL_PATH, VECTORIZER_PATH
        )

        self.stdout.write(self.style.MIGRATE_HEADING(
            "\n🤖 UrbanHelper NLP Training Pipeline\n"
            + "=" * 45
        ))

        # ── جمع‌آوری داده‌ها ────────────────────────────────────
        samples = list(TRAINING_SAMPLES)
        self.stdout.write(f"📚 داده‌های اولیه: {len(samples)} نمونه")

        if options["from_db"]:
            db_samples = self._load_from_db(options["verbose"])
            samples.extend(db_samples)
            self.stdout.write(f"🗄️  داده‌های DB: {len(db_samples)} نمونه اضافه شد")

        total = len(samples)
        self.stdout.write(f"📊 مجموع داده‌های آموزشی: {total} نمونه\n")

        if options["eval"] and MODEL_PATH.exists():
            self._evaluate_only(samples, options["verbose"])
            return

        # ── آموزش ────────────────────────────────────────────────
        self.stdout.write("⚙️  در حال آموزش مدل...")
        start = timezone.now()

        vectorizer, classifier, accuracy = train_model(save=True)

        elapsed = (timezone.now() - start).total_seconds()

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ آموزش کامل شد!\n"
            f"   دقت (Cross-Validation): {accuracy * 100:.1f}%\n"
            f"   زمان آموزش: {elapsed:.1f} ثانیه\n"
            f"   محل ذخیره: {MODEL_PATH.parent}\n"
        ))

        # ── تست چند نمونه ────────────────────────────────────────
        self.stdout.write("🧪 تست چند نمونه واقعی:")
        self._run_sample_tests()

    def _load_from_db(self, verbose: bool) -> list[tuple[str, str]]:
        """گزارش‌هایی که دسته‌شان توسط مدیر تأیید شده را از DB می‌گیرد."""
        try:
            from reports.models import Report
            confirmed = Report.objects.filter(
                category__isnull=False,
                status__in=["RESOLVED", "CLOSED"],
                description__isnull=False,
            ).select_related("category")

            samples = [
                (r.description, r.category.name)
                for r in confirmed
                if r.description and len(r.description) > 10
            ]
            return samples
        except Exception as e:
            self.stderr.write(f"⚠️  خطا در بارگذاری از DB: {e}")
            return []

    def _evaluate_only(self, samples, verbose):
        """ارزیابی مدل موجود بدون آموزش مجدد."""
        from sklearn.model_selection import cross_val_score
        from sklearn.pipeline import Pipeline
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.svm import LinearSVC
        from nlp.classifier import normalize_persian
        import numpy as np

        texts = [normalize_persian(t) for t, _ in samples]
        labels = [l for _, l in samples]

        pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(
                analyzer="char_wb", ngram_range=(2, 4),
                max_features=15000, sublinear_tf=True,
            )),
            ("clf", LinearSVC(C=1.5, max_iter=2000, class_weight="balanced")),
        ])

        scores = cross_val_score(pipeline, texts, labels, cv=5, scoring="accuracy")
        self.stdout.write(
            f"📈 دقت CV: {np.mean(scores) * 100:.1f}% ± {np.std(scores) * 100:.1f}%"
        )

        if verbose:
            from sklearn.metrics import classification_report
            pipeline.fit(texts, labels)
            preds = pipeline.predict(texts)
            self.stdout.write(classification_report(labels, preds))

    def _run_sample_tests(self):
        """چند نمونه واقعی را تست می‌کند."""
        from nlp.classifier import predict_category

        test_cases = [
            ("آسفالت خیابان دارای چاله عمیق است", "خرابی آسفالت"),
            ("زباله‌های انباشته کنار پارک بوی بد می‌دهد", "انباشت زباله"),
            ("چراغ خیابان سه ماه است خاموش است", "مشکلات روشنایی"),
            ("لوله ترکیده و فاضلاب جاری است", "آب و فاضلاب"),
            ("درخت خشکیده نیاز به قطع دارد", "مشکلات فضای سبز"),
        ]

        correct = 0
        for text, expected in test_cases:
            result = predict_category(text)
            predicted = result["category"] or "نامشخص"
            is_correct = predicted == expected
            if is_correct:
                correct += 1
            icon = "✅" if is_correct else "❌"
            self.stdout.write(
                f"  {icon} «{text[:35]}...»\n"
                f"     انتظار: {expected} | پیش‌بینی: {predicted} "
                f"({result['confidence']:.0%})"
            )

        self.stdout.write(
            self.style.SUCCESS(f"\n  نتیجه: {correct}/{len(test_cases)} صحیح\n")
        )
