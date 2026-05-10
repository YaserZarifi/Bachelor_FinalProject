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
    category_name = serializers.CharField(source="category.name", read_only=True)
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

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        new_status = attrs.get("status")

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
