import logging
from celery import shared_task
from django.apps import apps
from .service import analyze_report

logger = logging.getLogger(__name__)

@shared_task(name="nlp.tasks.process_report_nlp")
def process_report_nlp(report_id):
    """
    Background task to analyze a report using NLP and update its fields.
    """
    Report = apps.get_model('reports', 'Report')
    Category = apps.get_model('reports', 'Category')
    
    try:
        report = Report.objects.get(id=report_id)
    except Report.DoesNotExist:
        logger.error(f"[NLP Task] Report {report_id} not found.")
        return

    logger.info(f"[NLP Task] Analyzing report {report_id}...")
    
    available_categories = list(Category.objects.values_list('name', flat=True))
    
    result = analyze_report(report.description, available_categories=available_categories)
    
    # Update NLP fields
    report.nlp_meta = result.to_dict()
    
    # Update is_urgent if detected
    if result.is_urgent:
        report.is_urgent = True
        
    # Suggested category logic
    if result.suggested_category:
        try:
            cat = Category.objects.filter(name=result.suggested_category).first()
            if cat:
                report.nlp_suggested_category = cat
                report.nlp_category_confidence = result.category_confidence
        except Exception as e:
            logger.warning(f"[NLP Task] Could not map suggested category '{result.suggested_category}': {e}")

    report.save()
    logger.info(f"[NLP Task] Report {report_id} updated with NLP results.")
