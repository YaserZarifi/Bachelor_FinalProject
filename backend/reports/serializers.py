from django.conf import settings
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from .models import Category, Report


ALLOWED_STATUS_TRANSITIONS = {
    "SUBMITTED": {"UNDER_REVIEW", "ASSIGNED"},
    "UNDER_REVIEW": {"SUBMITTED", "ASSIGNED", "IN_PROGRESS"},
    "ASSIGNED": {"IN_PROGRESS", "UNDER_REVIEW"},
    "IN_PROGRESS": {"RESOLVED", "ASSIGNED"},
    "RESOLVED": {"CLOSED", "IN_PROGRESS"},
    "CLOSED": set(),
}


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "description"]


class ReportSerializer(GeoFeatureModelSerializer):
    category_name = serializers.SerializerMethodField(read_only=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), allow_null=True, required=False
    )
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    nlp_sentiment = serializers.CharField(read_only=True)
    nlp_crisis_keywords = serializers.JSONField(read_only=True)

    class Meta:
        model = Report
        geo_field = "location"
        fields = [
            "id",
            "user",
            "category",
            "category_name",
            "description",
            "location",
            "image_before",
            "image_after",
            "status",
            "is_urgent",
            "capture_source",
            "captured_at",
            "gps_accuracy",
            "client_integrity_hash",
            "nlp_meta",
            "nlp_suggested_category",
            "nlp_category_confidence",
            "nlp_sentiment",
            "nlp_crisis_keywords",
            "created_at",
            "updated_at",
        ]
        read_only_fields = (
            "nlp_meta",
            "nlp_suggested_category",
            "nlp_category_confidence",
            "nlp_sentiment",
            "nlp_crisis_keywords",
            "created_at",
            "updated_at",
            "is_urgent",
        )

    # Trusted-capture metadata may only be set once, at creation time. Staff
    # edits must never rewrite the original capture record.
    _CAPTURE_FIELDS = (
        "capture_source",
        "captured_at",
        "gps_accuracy",
        "client_integrity_hash",
    )

    def update(self, instance, validated_data):
        for field in self._CAPTURE_FIELDS:
            validated_data.pop(field, None)
        return super().update(instance, validated_data)

    def get_category_name(self, obj):
        cat = getattr(obj, "category", None)
        return cat.name if cat else None

    def validate_gps_accuracy(self, value):
        """Refuse coordinates too coarse to have come from GPS.

        The client already filters these out, but the check has to exist here
        too: a report created straight against the API (or by a patched client)
        behind a VPN would otherwise store the exit node's city as the incident
        location. Only enforced on create — the field is immutable afterwards.
        """
        if self.instance is None and value is not None:
            ceiling = getattr(settings, "MAX_REPORT_GPS_ACCURACY_M", 200)
            if value > ceiling:
                raise serializers.ValidationError(
                    f"دقت موقعیت (±{round(value)} متر) برای ثبت گزارش کافی نیست. "
                    "موقعیت باید از GPS دستگاه خوانده شود، نه از روی آدرس اینترنتی (IP). "
                    "اگر VPN روشن است آن را خاموش کنید و دوباره تلاش کنید."
                )
        return value

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        new_status = attrs.get("status")

        # An in-app camera capture must carry a verifiable GPS radius; without
        # one the accuracy gate above would be trivially bypassed by omission.
        if instance is None:
            if attrs.get("capture_source") == "CAMERA" and attrs.get("gps_accuracy") is None:
                raise serializers.ValidationError(
                    {"gps_accuracy": "برای ثبت تصویر دوربین، دقت موقعیت GPS الزامی است."}
                )

        if user and user.is_staff and instance is not None and new_status is not None:
            old = instance.status
            allowed = ALLOWED_STATUS_TRANSITIONS.get(old, set())
            if new_status != old and new_status not in allowed:
                raise serializers.ValidationError(
                    {"status": f"انتقال از {old} به {new_status} مجاز نیست."}
                )
            if new_status == "RESOLVED" and not attrs.get("image_after") and not instance.image_after:
                raise serializers.ValidationError(
                    {"image_after": "برای وضعیت حل‌شده، تصویر بعد الزامی است."}
                )

        return attrs


class ReportTransitionSerializer(serializers.Serializer):
    """Staff-only status transition + optional evidence image (multipart)."""

    status = serializers.ChoiceField(choices=[c[0] for c in Report.STATUS_CHOICES])
    image_after = serializers.ImageField(required=False, allow_null=True)

    def validate(self, attrs):
        report = self.context["report"]
        old = report.status
        new_status = attrs["status"]
        if new_status == old:
            return attrs
        allowed = ALLOWED_STATUS_TRANSITIONS.get(old, set())
        if new_status not in allowed:
            raise serializers.ValidationError(
                {"status": f"انتقال از {old} به {new_status} مجاز نیست."}
            )
        img = attrs.get("image_after")
        if new_status == "RESOLVED" and not img and not report.image_after:
            raise serializers.ValidationError(
                {"image_after": "برای وضعیت حل‌شده، تصویر بعد الزامی است."}
            )
        return attrs
