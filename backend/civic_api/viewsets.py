from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_gis.filters import DistanceToPointFilter

from civic_api.guest_tokens import issue_guest_token, verify_guest_token
from reports.models import Category, Report
from reports.serializers import (
    CategorySerializer,
    ReportSerializer,
    ReportTransitionSerializer,
)


class IsStaffUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_staff)


class AllowRetrieveReport(permissions.BasePermission):
    """Staff, owner, or valid guest_token query param."""

    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        if view.action != "retrieve":
            return True
        if request.user.is_staff:
            return True
        if request.user.is_authenticated and getattr(obj, "user_id", None) == request.user.id:
            return True
        token = request.query_params.get("guest_token")
        if token and verify_guest_token(obj.pk, token):
            return True
        return False


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all().order_by("-created_at")
    serializer_class = ReportSerializer
    distance_filter_field = "location"
    filter_backends = (DistanceToPointFilter,)
    bbox_filter_field = "location" # Optional: for map bounds filtering

    def get_permissions(self):
        if self.action == "create":
            return [permissions.AllowAny()]
        if self.action == "retrieve":
            return [AllowRetrieveReport()]
        if self.action == "list":
            return [permissions.IsAuthenticated()]
        if self.action in ("update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsStaffUser()]
        if self.action == "transition":
            return [permissions.IsAuthenticated(), IsStaffUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff:
            return qs
        if user.is_authenticated:
            return qs.filter(user=user)
        return qs.none()

    def get_object(self):
        if self.action == "retrieve" and self.request.query_params.get("guest_token"):
            pk = self.kwargs.get("pk")
            obj = get_object_or_404(Report, pk=pk)
            self.check_object_permissions(self.request, obj)
            return obj
        return super().get_object()

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        self._issued_guest_token = None
        report = serializer.save(user=user)
        if user is None:
            self._issued_guest_token = issue_guest_token(report.id)

    def create(self, request, *args, **kwargs):
        self._issued_guest_token = None
        response = super().create(request, *args, **kwargs)
        token = getattr(self, "_issued_guest_token", None)
        if token and hasattr(response, "data"):
            data = response.data
            if isinstance(data, dict):
                if "properties" in data and isinstance(data["properties"], dict):
                    data["properties"]["guest_access_token"] = token
                else:
                    data["guest_access_token"] = token
        return response

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated, IsStaffUser],
    )
    def transition(self, request, pk=None):
        report = self.get_object()
        serializer = ReportTransitionSerializer(
            data=request.data,
            context={"report": report},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        report.status = data["status"]
        if data.get("image_after"):
            report.image_after = data["image_after"]
        report.save()
        out = ReportSerializer(report, context={"request": request})
        return Response(out.data, status=status.HTTP_200_OK)
