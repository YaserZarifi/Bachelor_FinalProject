from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ReportViewSet

# Initialize the router for automatic RESTful endpoint generation
router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'reports', ReportViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
