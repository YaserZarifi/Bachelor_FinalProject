# ==============================================================
# reports/models.py  (به‌روز‌شده با فیلد nlp_meta)
# ==============================================================

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

    # ── شهروند ──────────────────────────────────────────────────
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name="کاربر"
    )

    # ── محتوا ───────────────────────────────────────────────────
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name="دسته‌بندی"
    )
    description = models.TextField(verbose_name="توضیحات")
    location = models.PointField(srid=4326, verbose_name="موقعیت مکانی")
    image_before = models.ImageField(
        upload_to='reports/before/', verbose_name="تصویر قبل"
    )
    image_after = models.ImageField(
        upload_to='reports/after/', blank=True, null=True,
        verbose_name="تصویر بعد"
    )

    # ── وضعیت ───────────────────────────────────────────────────
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='SUBMITTED',
        verbose_name="وضعیت"
    )
    is_urgent = models.BooleanField(default=False, verbose_name="فوری")

    # ── نتایج NLP ← فیلد جدید ───────────────────────────────────
    nlp_meta = models.JSONField(
        null=True, blank=True,
        verbose_name="متادیتای NLP",
        help_text=(
            "نتیجه خودکار تحلیل هوش مصنوعی شامل: "
            "دسته‌بندی، امتیاز بحران، احساسات"
        ),
    )
    # دسته‌ای که توسط NLP پیشنهاد شده (برای مقایسه با دسته انتخاب‌شده)
    nlp_suggested_category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="nlp_suggested_reports",
        verbose_name="دسته پیشنهادی NLP",
    )
    nlp_category_confidence = models.FloatField(
        null=True, blank=True,
        verbose_name="ضریب اطمینان NLP",
    )

    # ── زمان‌ها ──────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین به‌روزرسانی")

    def __str__(self):
        return f"گزارش #{self.id} — {self.get_status_display()}"

    class Meta:
        verbose_name = "گزارش"
        verbose_name_plural = "گزارش‌ها"
        ordering = ["-created_at"]

    # ── Property helpers ─────────────────────────────────────────
    @property
    def nlp_sentiment(self) -> str | None:
        """احساس غالب متن گزارش"""
        if self.nlp_meta:
            return self.nlp_meta.get("sentiment_label_fa")
        return None

    @property
    def nlp_crisis_keywords(self) -> list[str]:
        """کلمات بحرانی شناسایی‌شده"""
        if self.nlp_meta:
            return self.nlp_meta.get("crisis_keywords_found", [])
        return []

    @property
    def nlp_category_source(self) -> str | None:
        """منبع دسته‌بندی: sklearn / ai_api / unknown"""
        if self.nlp_meta:
            return self.nlp_meta.get("category_source")
        return None
