# ==============================================================
# views.py
# API endpoint برای تحلیل مستقیم متن و گزارش‌های موجود
# ==============================================================

from __future__ import annotations
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view

from .service import analyze_report
from reports.models import Category


class AnalyzeTextView(APIView):
    """
    POST /api/nlp/analyze/
    تحلیل مستقیم یک متن بدون نیاز به ذخیره گزارش.
    مناسب برای frontend که می‌خواهد real-time feedback بدهد.

    Request body:
        { "text": "متن گزارش شهروند" }

    Response:
        {
            "is_urgent": bool,
            "crisis_score": int,
            "crisis_keywords_found": [...],
            "suggested_category": str | null,
            "category_confidence": float,
            "category_source": str,
            "sentiment": {
                "label": str,
                "label_fa": str,
                "score": float,
                "intensity": float
            },
            "used_ai_fallback": bool
        }
    """

    def post(self, request):
        text = request.data.get("text", "").strip()
        if not text:
            return Response(
                {"error": "فیلد 'text' الزامی است."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(text) > 5000:
            return Response(
                {"error": "متن نمی‌تواند بیشتر از ۵۰۰۰ کاراکتر باشد."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        available_categories = list(
            Category.objects.values_list("name", flat=True)
        )

        result = analyze_report(text=text, available_categories=available_categories)

        return Response({
            "is_urgent": result.is_urgent,
            "crisis_score": result.crisis_score,
            "crisis_keywords_found": result.crisis_keywords_found,
            "suggested_category": result.suggested_category,
            "category_confidence": result.category_confidence,
            "category_source": result.category_source,
            "sentiment": {
                "label": result.sentiment_label,
                "label_fa": result.sentiment_label_fa,
                "score": result.sentiment_score,
                "intensity": result.sentiment_intensity,
            },
            "used_ai_fallback": result.used_ai_fallback,
        })


class ReAnalyzeReportView(APIView):
    """
    POST /api/nlp/reanalyze/<report_id>/
    تحلیل مجدد یک گزارش موجود (مثلاً پس از ویرایش متن).
    فقط برای ادمین/مدیر.
    """

    def post(self, request, report_id: int):
        from reports.models import Report

        try:
            report = Report.objects.get(pk=report_id)
        except Report.DoesNotExist:
            return Response(
                {"error": f"گزارش با شناسه {report_id} یافت نشد."},
                status=status.HTTP_404_NOT_FOUND,
            )

        available_categories = list(
            Category.objects.values_list("name", flat=True)
        )

        result = analyze_report(
            text=report.description,
            available_categories=available_categories,
        )

        # اعمال تغییرات
        update_fields = []

        if result.is_urgent != report.is_urgent:
            report.is_urgent = result.is_urgent
            update_fields.append("is_urgent")

        if result.suggested_category:
            try:
                new_cat = Category.objects.get(name=result.suggested_category)
                if report.category != new_cat:
                    report.category = new_cat
                    update_fields.append("category")
            except Category.DoesNotExist:
                pass

        if update_fields:
            report.save(update_fields=update_fields)

        return Response({
            "report_id": report_id,
            "updated_fields": update_fields,
            "nlp_result": {
                "is_urgent": result.is_urgent,
                "crisis_score": result.crisis_score,
                "crisis_keywords_found": result.crisis_keywords_found,
                "suggested_category": result.suggested_category,
                "category_confidence": result.category_confidence,
                "category_source": result.category_source,
                "sentiment": {
                    "label": result.sentiment_label,
                    "label_fa": result.sentiment_label_fa,
                    "score": result.sentiment_score,
                    "intensity": result.sentiment_intensity,
                },
                "used_ai_fallback": result.used_ai_fallback,
            },
        })
