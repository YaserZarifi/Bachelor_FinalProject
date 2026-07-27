from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("reports", "0004_report_capture_metadata"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PushDevice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("expo_token", models.CharField(max_length=255, unique=True, verbose_name="توکن اعلان Expo")),
                ("platform", models.CharField(choices=[("ios", "iOS"), ("android", "Android"), ("unknown", "نامشخص")], default="unknown", max_length=12, verbose_name="سکو")),
                ("is_active", models.BooleanField(default=True, verbose_name="فعال")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="آخرین به‌روزرسانی")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="push_devices", to=settings.AUTH_USER_MODEL, verbose_name="کاربر")),
            ],
            options={
                "verbose_name": "دستگاه اعلان",
                "verbose_name_plural": "دستگاه‌های اعلان",
            },
        ),
        migrations.CreateModel(
            name="ReportSubscription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت")),
                ("device", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="subscriptions", to="pushnotify.pushdevice", verbose_name="دستگاه")),
                ("report", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="push_subscriptions", to="reports.report", verbose_name="گزارش")),
            ],
            options={
                "verbose_name": "اشتراک گزارش",
                "verbose_name_plural": "اشتراک‌های گزارش",
                "unique_together": {("report", "device")},
            },
        ),
    ]
