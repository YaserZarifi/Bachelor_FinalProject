import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from civic_api.ws_broadcast import broadcast_report_update
from reports.models import Report

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Report)
def notify_report_subscribers(sender, instance: Report, **kwargs):
    try:
        broadcast_report_update(instance)
    except Exception as e:
        logger.warning("WebSocket broadcast failed: %s", e, exc_info=True)
