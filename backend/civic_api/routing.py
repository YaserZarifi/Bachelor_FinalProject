from django.urls import re_path

from civic_api.consumers import ReportConsumer

websocket_urlpatterns = [
    re_path(r"ws/reports/(?P<report_id>\d+)/$", ReportConsumer.as_asgi()),
]
