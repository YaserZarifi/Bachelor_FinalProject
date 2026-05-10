from __future__ import annotations

import urllib.parse

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from civic_api.guest_tokens import verify_guest_token
from reports.models import Report


@database_sync_to_async
def _get_report(pk: int):
    try:
        return Report.objects.get(pk=pk)
    except Report.DoesNotExist:
        return None


class ReportConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.report_id = int(self.scope["url_route"]["kwargs"]["report_id"])
        query = urllib.parse.parse_qs(self.scope.get("query_string", b"").decode())
        guest_token = (query.get("guest_token") or [None])[0]
        jwt_token = (query.get("access") or [None])[0]

        report = await _get_report(self.report_id)
        if report is None:
            await self.close(code=4404)
            return

        user = self.scope.get("user")
        allowed = False
        if getattr(user, "is_authenticated", False) and report.user_id == user.id:
            allowed = True
        elif jwt_token:
            try:
                validated = AccessToken(jwt_token)
                uid = validated.get("user_id")
                if uid and report.user_id == int(uid):
                    allowed = True
            except (InvalidToken, TokenError, TypeError, ValueError):
                allowed = False
        if not allowed and guest_token:
            ok = await database_sync_to_async(verify_guest_token)(self.report_id, guest_token)
            allowed = ok

        if not allowed:
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(f"report_{self.report_id}", self.channel_name)
        await self.accept()
        await self.send_json(
            {
                "event": "subscribed",
                "report_id": self.report_id,
            }
        )

    async def disconnect(self, code):
        await self.channel_layer.group_discard(f"report_{self.report_id}", self.channel_name)

    async def report_event(self, event):
        await self.send_json(
            {
                "event": event.get("event", "report.updated"),
                "report_id": event.get("report_id"),
                "status": event.get("status"),
                "is_urgent": event.get("is_urgent"),
                "updated_at": event.get("updated_at"),
            }
        )
