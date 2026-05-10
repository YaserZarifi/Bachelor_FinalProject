from django.urls import path, include
from rest_framework.routers import DefaultRouter

from civic_api.viewsets import CategoryViewSet, ReportViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'reports', ReportViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
