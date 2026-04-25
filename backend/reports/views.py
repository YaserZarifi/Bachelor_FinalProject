from rest_framework import viewsets
from .models import Category, Report
from .serializers import CategorySerializer, ReportSerializer

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    # Categories should only be readable via API; creation happens in the admin panel
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class ReportViewSet(viewsets.ModelViewSet):
    # Enable full CRUD operations for reports, ordering newest first
    queryset = Report.objects.all().order_by('-created_at')
    serializer_class = ReportSerializer
