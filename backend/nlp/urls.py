# urls.py
from django.urls import path
from .views import AnalyzeTextView, ReAnalyzeReportView

urlpatterns = [
    path("analyze/", AnalyzeTextView.as_view(), name="nlp-analyze"),
    path("reanalyze/<int:report_id>/", ReAnalyzeReportView.as_view(), name="nlp-reanalyze"),
]
