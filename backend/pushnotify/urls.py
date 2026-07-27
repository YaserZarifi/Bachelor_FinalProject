from django.urls import path

from .views import RegisterDeviceView, UnregisterDeviceView

urlpatterns = [
    path("register/", RegisterDeviceView.as_view(), name="push-register"),
    path("unregister/", UnregisterDeviceView.as_view(), name="push-unregister"),
]
