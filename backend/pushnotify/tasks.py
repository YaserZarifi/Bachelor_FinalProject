import logging

from celery import shared_task
from django.apps import apps

from .expo import send_push_messages

logger = logging.getLogger(__name__)

# Mirror of reports.models.Report.STATUS_CHOICES (Farsi labels) so the worker
# does not need to import the model just to render a label.
STATUS_LABELS = {
    "SUBMITTED": "ثبت شده",
    "UNDER_REVIEW": "در حال بررسی",
    "ASSIGNED": "ارجاع داده‌شده",
    "IN_PROGRESS": "در حال اقدام",
    "RESOLVED": "حل‌شده",
    "CLOSED": "مختومه",
}


def _collect_tokens(report) -> set[str]:
    """All active Expo tokens that should hear about this report:
    the owner's devices plus any guest devices subscribed to it."""
    PushDevice = apps.get_model("pushnotify", "PushDevice")
    ReportSubscription = apps.get_model("pushnotify", "ReportSubscription")

    tokens: set[str] = set()
    if report.user_id:
        tokens.update(
            PushDevice.objects.filter(
                user_id=report.user_id, is_active=True
            ).values_list("expo_token", flat=True)
        )
    tokens.update(
        ReportSubscription.objects.filter(
            report_id=report.id, device__is_active=True
        ).values_list("device__expo_token", flat=True)
    )
    return tokens


@shared_task(name="pushnotify.tasks.send_status_push")
def send_status_push(report_id, new_status):
    """Notify every device subscribed to a report that its status changed."""
    Report = apps.get_model("reports", "Report")
    try:
        report = Report.objects.get(id=report_id)
    except Report.DoesNotExist:
        logger.warning("[Push] Report %s not found", report_id)
        return

    tokens = _collect_tokens(report)
    if not tokens:
        return

    label = STATUS_LABELS.get(new_status, new_status)
    title = "وضعیت گزارش شما به‌روز شد"
    body = f"گزارش #{report_id} اکنون «{label}» است."

    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
            "channelId": "status-updates",
            "data": {
                "type": "report_status",
                "report_id": report_id,
                "status": new_status,
            },
        }
        for token in tokens
    ]

    tickets = send_push_messages(messages)
    logger.info("[Push] Sent %s status notifications for report %s", len(tickets), report_id)
