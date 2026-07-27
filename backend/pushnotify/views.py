from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from civic_api.guest_tokens import verify_guest_token
from reports.models import Report

from .models import PushDevice, ReportSubscription
from .serializers import RegisterDeviceSerializer, UnregisterDeviceSerializer


class RegisterDeviceView(APIView):
    """Register (or refresh) an Expo push token.

    Anonymous citizens may bind the device to a single guest report by sending
    ``report_id`` + ``guest_token``. Signed-in users are notified for all of
    their own reports automatically, so they only need to send ``expo_token``.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterDeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user if request.user.is_authenticated else None
        device, _ = PushDevice.objects.update_or_create(
            expo_token=data["expo_token"],
            defaults={
                "platform": data.get("platform", "unknown"),
                "is_active": True,
                **({"user": user} if user else {}),
            },
        )

        subscribed_report = None
        report_id = data.get("report_id")
        guest_token = data.get("guest_token")
        if report_id and guest_token:
            if verify_guest_token(report_id, guest_token) and Report.objects.filter(
                id=report_id
            ).exists():
                ReportSubscription.objects.get_or_create(
                    report_id=report_id, device=device
                )
                subscribed_report = report_id

        return Response(
            {"registered": True, "subscribed_report": subscribed_report},
            status=status.HTTP_200_OK,
        )


class UnregisterDeviceView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UnregisterDeviceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        PushDevice.objects.filter(
            expo_token=serializer.validated_data["expo_token"]
        ).update(is_active=False)
        return Response({"unregistered": True}, status=status.HTTP_200_OK)
