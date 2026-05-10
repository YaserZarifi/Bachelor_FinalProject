"""Broadcast report updates to Channels groups."""
from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def broadcast_report_update(report, event_name: str = "report.updated") -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    payload = {
        "type": "report.event",
        "event": event_name,
        "report_id": report.id,
        "status": report.status,
        "is_urgent": report.is_urgent,
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
    }
    async_to_sync(channel_layer.group_send)(f"report_{report.id}", payload)
