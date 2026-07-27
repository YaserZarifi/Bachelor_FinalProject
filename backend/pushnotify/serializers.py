from rest_framework import serializers

from .expo import is_expo_token


class RegisterDeviceSerializer(serializers.Serializer):
    expo_token = serializers.CharField(max_length=255)
    platform = serializers.ChoiceField(
        choices=["ios", "android", "unknown"], required=False, default="unknown"
    )
    # Optional: bind this device to a single guest report.
    report_id = serializers.IntegerField(required=False)
    guest_token = serializers.CharField(required=False, allow_blank=True)

    def validate_expo_token(self, value):
        if not is_expo_token(value):
            raise serializers.ValidationError("توکن اعلان Expo نامعتبر است.")
        return value


class UnregisterDeviceSerializer(serializers.Serializer):
    expo_token = serializers.CharField(max_length=255)
