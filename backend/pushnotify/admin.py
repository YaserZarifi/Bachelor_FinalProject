from django.contrib import admin

from .models import PushDevice, ReportSubscription


@admin.register(PushDevice)
class PushDeviceAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "platform", "is_active", "created_at")
    list_filter = ("platform", "is_active")
    search_fields = ("expo_token", "user__username")


@admin.register(ReportSubscription)
class ReportSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("id", "report", "device", "created_at")
    search_fields = ("report__id", "device__expo_token")
