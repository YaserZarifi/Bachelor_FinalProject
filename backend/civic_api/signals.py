import logging

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from civic_api.ws_broadcast import broadcast_report_update
from reports.models import Report

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Report)
def stash_old_status(sender, instance: Report, **kwargs):
    """Remember the previous status so post_save can detect a real change."""
    if not instance.pk:
        instance._old_status = None
        return
    try:
        instance._old_status = (
            Report.objects.filter(pk=instance.pk)
            .values_list("status", flat=True)
            .first()
        )
    except Exception:  # pragma: no cover - defensive
        instance._old_status = None


@receiver(post_save, sender=Report)
def notify_report_subscribers(sender, instance: Report, created, **kwargs):
    # Always push live updates over the WebSocket channel.
    try:
        broadcast_report_update(instance)
    except Exception as e:
        logger.warning("WebSocket broadcast failed: %s", e, exc_info=True)

    # Fire a mobile push only when an existing report's status actually changed.
    old_status = getattr(instance, "_old_status", None)
    if not created and old_status is not None and old_status != instance.status:
        try:
            from pushnotify.tasks import send_status_push

            send_status_push.delay(instance.id, instance.status)
        except Exception as e:
            logger.warning("Push enqueue failed: %s", e, exc_info=True)
