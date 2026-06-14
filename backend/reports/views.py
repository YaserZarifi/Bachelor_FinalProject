from rest_framework import viewsets
from .models import Category, Report
from .serializers import CategorySerializer, ReportSerializer
from nlp.tasks import process_report_nlp

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
...
class ReportViewSet(viewsets.ModelViewSet):
    # Enable full CRUD operations for reports, ordering newest first
    queryset = Report.objects.all().order_by('-created_at')
    serializer_class = ReportSerializer

    def perform_create(self, serializer):
        report = serializer.save()
        # Set user if authenticated
        if self.request.user.is_authenticated:
            report.user = self.request.user
            report.save()
            
        # Trigger background NLP analysis
        process_report_nlp.delay(report.id)
