"""Seed demo urban-issue reports across major Iranian cities.

Idempotent-ish: creates the canonical categories if missing, then generates a
batch of realistic Persian reports with jittered per-city coordinates, varied
statuses/urgency and back-dated `created_at` timestamps (so the admin charts
have a time series to draw). Purely for demos/development — never run in prod.

    python manage.py seed_reports                # add 60 reports
    python manage.py seed_reports --count 120    # add 120
    python manage.py seed_reports --flush        # delete existing reports first
"""
from __future__ import annotations

import random
from datetime import timedelta

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand
from django.utils import timezone

from reports.models import Category, Report

# ── Canonical categories (must match nlp/categorizer.py names) ──────────────
CATEGORIES = [
    "خرابی آسفالت",
    "انباشت زباله",
    "مشکلات روشنایی",
    "آب و فاضلاب",
    "مشکلات فضای سبز",
    "ساختمان و تأسیسات",
    "ترافیک و حمل‌ونقل",
]

# ── Major Iranian cities: (name, center_lat, center_lng, jitter_degrees) ────
CITIES = [
    ("تهران", 35.6892, 51.3890, 0.06),
    ("مشهد", 36.2605, 59.6168, 0.05),
    ("اصفهان", 32.6546, 51.6680, 0.05),
    ("شیراز", 29.5918, 52.5837, 0.04),
    ("تبریز", 38.0800, 46.2919, 0.04),
    ("کرج", 35.8400, 50.9391, 0.04),
    ("اهواز", 31.3183, 48.6706, 0.04),
    ("قم", 34.6416, 50.8746, 0.03),
    ("کرمانشاه", 34.3277, 47.0778, 0.03),
    ("رشت", 37.2808, 49.5832, 0.03),
    ("یزد", 31.8974, 54.3569, 0.03),
    ("کرمان", 30.2839, 57.0834, 0.03),
]

# ── Per-category Persian description templates ("{city}" filled in) ─────────
TEMPLATES = {
    "خرابی آسفالت": [
        "چاله بزرگ در وسط خیابان اصلی {city} باعث آسیب به خودروها شده است.",
        "ترک‌خوردگی و دست‌انداز شدید در آسفالت کوچه، عبور را خطرناک کرده است.",
        "زمین فرو رفته کنار جدول در محله ما در {city}؛ نیاز به مرمت فوری دارد.",
        "موج آسفالت و گودال عمیق در ورودی بزرگراه {city} تصادف‌ساز شده است.",
    ],
    "انباشت زباله": [
        "تجمع زباله در کنار خیابان {city} بوی بد گرفته و محل تردد حشرات شده است.",
        "سطل زباله پر شده و پسماند در پیاده‌رو ریخته است؛ چند روز جمع‌آوری نشده.",
        "نخاله ساختمانی رهاشده در زمین خالی محله در {city}.",
        "زباله‌دان محله در {city} شکسته و آشغال در معبر پخش شده است.",
    ],
    "مشکلات روشنایی": [
        "چراغ خیابان در کوچه ما در {city} چند شب است خاموش مانده و تاریکی خطرناک است.",
        "تیر چراغ برق سوخته و روشن نمی‌شود؛ عبور شبانه در {city} ناامن شده.",
        "روشنایی پارک محله در {city} کامل خاموش است.",
        "لامپ معابر بلوار اصلی {city} چشمک‌زن شده و نیاز به تعویض دارد.",
    ],
    "آب و فاضلاب": [
        "لوله ترکیده و آب‌گرفتگی شدید در خیابان {city}؛ آب در حال هدر رفتن است.",
        "بوی فاضلاب از دریچه منهول در کوچه ما در {city} به مشام می‌رسد.",
        "نشت آب از جوی کنار خیابان {city} پیاده‌رو را لغزنده کرده است.",
        "سرریز فاضلاب در معبر عمومی {city}؛ نیاز به رسیدگی فوری بهداشتی.",
    ],
    "مشکلات فضای سبز": [
        "درخت خطرناک و شاخه شکسته در بوستان {city} ممکن است روی عابران بیفتد.",
        "خشک شدن چمن و نبود آبیاری در فضای سبز محله در {city}.",
        "درخت افتاده روی پیاده‌رو مسیر عبور را در {city} مسدود کرده است.",
        "علف هرز و نخاله در پارک محله {city} انباشته شده است.",
    ],
    "ساختمان و تأسیسات": [
        "نرده پل عابر پیاده در {city} شکسته و برای کودکان خطرناک است.",
        "دیوار نیمه‌تخریب‌شده کنار معبر در {city} در حال ریزش است.",
        "پله‌های زیرگذر {city} ترک خورده و لغزنده شده است.",
        "ساخت‌وساز غیرمجاز و تجاوز به معبر عمومی در محله {city}.",
    ],
    "ترافیک و حمل‌ونقل": [
        "چراغ راهنمایی تقاطع اصلی {city} خراب شده و ترافیک سنگین ایجاد کرده است.",
        "خط‌کشی عابر پیاده در خیابان {city} کاملاً پاک شده است.",
        "پارک غیرمجاز خودروها پیاده‌رو را در {city} مسدود کرده است.",
        "تابلوی ترافیکی افتاده و علائم راهنمایی در {city} ناخوانا شده است.",
    ],
}

STATUS_WEIGHTS = [
    ("SUBMITTED", 28),
    ("UNDER_REVIEW", 18),
    ("ASSIGNED", 14),
    ("IN_PROGRESS", 16),
    ("RESOLVED", 18),
    ("CLOSED", 6),
]


class Command(BaseCommand):
    help = "Seed demo reports across Iranian cities (development/demo only)."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=60, help="How many reports to create.")
        parser.add_argument("--flush", action="store_true", help="Delete all existing reports first.")
        parser.add_argument("--seed", type=int, default=1402, help="RNG seed for reproducibility.")

    def handle(self, *args, **opts):
        rng = random.Random(opts["seed"])

        if opts["flush"]:
            deleted, _ = Report.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Deleted existing reports ({deleted} rows)."))

        # Categories
        cat_map: dict[str, Category] = {}
        for name in CATEGORIES:
            cat, created = Category.objects.get_or_create(name=name)
            cat_map[name] = cat
            if created:
                self.stdout.write(f"  + category «{name}»")

        statuses = [s for s, _ in STATUS_WEIGHTS]
        weights = [w for _, w in STATUS_WEIGHTS]

        now = timezone.now()
        created_ids: list[int] = []
        per_city: dict[str, int] = {}

        for _ in range(opts["count"]):
            city, lat, lng, jitter = rng.choice(CITIES)
            cat_name = rng.choice(CATEGORIES)
            desc = rng.choice(TEMPLATES[cat_name]).format(city=city)
            status = rng.choices(statuses, weights=weights, k=1)[0]
            is_urgent = rng.random() < 0.18

            point = Point(
                lng + rng.uniform(-jitter, jitter),
                lat + rng.uniform(-jitter, jitter),
            )

            report = Report.objects.create(
                category=cat_map[cat_name],
                description=desc,
                location=point,
                status=status,
                is_urgent=is_urgent,
                capture_source="CAMERA",
                captured_at=now - timedelta(days=rng.randint(0, 60)),
                gps_accuracy=round(rng.uniform(4.0, 35.0), 1),
            )
            created_ids.append(report.id)
            per_city[city] = per_city.get(city, 0) + 1

        # Back-date created_at (auto_now_add can't be set at create()) so the
        # dashboard time-series charts have realistic spread.
        for rid in created_ids:
            backdate = now - timedelta(
                days=rng.randint(0, 60), hours=rng.randint(0, 23), minutes=rng.randint(0, 59)
            )
            Report.objects.filter(pk=rid).update(created_at=backdate)

        self.stdout.write(self.style.SUCCESS(f"\nSeeded {len(created_ids)} reports across {len(per_city)} cities:"))
        for city, n in sorted(per_city.items(), key=lambda kv: -kv[1]):
            self.stdout.write(f"  {city}: {n}")
        self.stdout.write(self.style.SUCCESS(f"Total reports now: {Report.objects.count()}"))
