from django.conf import settings
from django.db import models

from reports.models import Report


class PushDevice(models.Model):
    """An Expo push token registered by a citizen's mobile device.

    A device may belong to a signed-in user (notified for all their reports) or
    stay anonymous and subscribe to individual guest reports via
    :class:`ReportSubscription`.
    """

    PLATFORM_CHOICES = [
        ("ios", "iOS"),
        ("android", "Android"),
        ("unknown", "نامشخص"),
    ]

    expo_token = models.CharField(
        max_length=255, unique=True, verbose_name="توکن اعلان Expo"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="push_devices",
        verbose_name="کاربر",
    )
    platform = models.CharField(
        max_length=12, choices=PLATFORM_CHOICES, default="unknown",
        verbose_name="سکو",
    )
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین به‌روزرسانی")

    class Meta:
        verbose_name = "دستگاه اعلان"
        verbose_name_plural = "دستگاه‌های اعلان"

    def __str__(self):
        owner = self.user.username if self.user else "guest"
        return f"{owner} — {self.expo_token[:18]}…"


class ReportSubscription(models.Model):
    """Binds a (usually anonymous) device to a single guest report so it can be
    notified when that specific report changes status."""

    report = models.ForeignKey(
        Report, on_delete=models.CASCADE, related_name="push_subscriptions",
        verbose_name="گزارش",
    )
    device = models.ForeignKey(
        PushDevice, on_delete=models.CASCADE, related_name="subscriptions",
        verbose_name="دستگاه",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت")

    class Meta:
        verbose_name = "اشتراک گزارش"
        verbose_name_plural = "اشتراک‌های گزارش"
        unique_together = ("report", "device")

    def __str__(self):
        return f"گزارش #{self.report_id} ← {self.device_id}"
