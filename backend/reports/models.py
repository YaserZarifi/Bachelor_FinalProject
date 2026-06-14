from django.contrib.gis.db import models
from django.contrib.auth.models import User


class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "دسته‌بندی"
        verbose_name_plural = "دسته‌بندی‌ها"


class Report(models.Model):
    STATUS_CHOICES = [
        ('SUBMITTED',    'ثبت شده'),
        ('UNDER_REVIEW', 'در حال بررسی'),
        ('ASSIGNED',     'ارجاع داده‌شده'),
        ('IN_PROGRESS',  'در حال اقدام'),
        ('RESOLVED',     'حل‌شده'),
        ('CLOSED',       'مختومه'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name="کاربر"
    )
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name="دسته‌بندی"
    )
    description = models.TextField(verbose_name="توضیحات")
    location = models.PointField(srid=4326, verbose_name="موقعیت مکانی")
    image_before = models.ImageField(upload_to='reports/before/', verbose_name="تصویر قبل")
    image_after = models.ImageField(upload_to='reports/after/', blank=True, null=True, verbose_name="تصویر بعد")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SUBMITTED', verbose_name="وضعیت")
    is_urgent = models.BooleanField(default=False, verbose_name="فوری")

    # ── Trusted-capture metadata (anti-fraud, Offline-First) ────
    CAPTURE_SOURCE_CHOICES = [
        ('CAMERA',  'دوربین درون‌برنامه‌ای'),
        ('UNKNOWN', 'نامشخص'),
    ]
    capture_source = models.CharField(
        max_length=12, choices=CAPTURE_SOURCE_CHOICES, default='UNKNOWN',
        verbose_name="منبع تصویر",
        help_text="آیا تصویر مستقیماً با دوربین درون‌برنامه ثبت شده یا منبع آن نامشخص است.",
    )
    captured_at = models.DateTimeField(
        null=True, blank=True, verbose_name="زمان ثبت در دستگاه",
        help_text="برچسب زمانی لحظهٔ ثبت تصویر روی دستگاه کاربر.",
    )
    gps_accuracy = models.FloatField(
        null=True, blank=True, verbose_name="دقت موقعیت (متر)",
        help_text="شعاع خطای GPS گزارش‌شده توسط دستگاه، بر حسب متر.",
    )
    client_integrity_hash = models.CharField(
        max_length=64, blank=True, default="", verbose_name="اثر انگشت یکپارچگی",
        help_text="هش SHA-256 بستهٔ تصویر+مختصات+زمان که سمت کلاینت محاسبه شده است.",
    )
    # ────────────────────────────────────────────────────────────

    # ── NLP Fields ──────────────────────────────────────────────
    nlp_meta = models.JSONField(
        null=True, blank=True,
        verbose_name="متادیتای NLP",
    )
    nlp_suggested_category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="nlp_suggested_reports",
        verbose_name="دسته پیشنهادی NLP",
    )
    nlp_category_confidence = models.FloatField(
        null=True, blank=True,
        verbose_name="ضریب اطمینان NLP",
    )
    # ────────────────────────────────────────────────────────────

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین به‌روزرسانی")

    def __str__(self):
        return f"گزارش #{self.id} — {self.get_status_display()}"

    class Meta:
        verbose_name = "گزارش"
        verbose_name_plural = "گزارش‌ها"
        ordering = ["-created_at"]

    @property
    def nlp_sentiment(self):
        if self.nlp_meta:
            return self.nlp_meta.get("sentiment_label_fa")
        return None

    @property
    def nlp_crisis_keywords(self):
        if self.nlp_meta:
            return self.nlp_meta.get("crisis_keywords_found", [])
        return []
