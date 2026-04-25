from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin
from .models import Category, Report

admin.site.register(Category)

@admin.register(Report)
class ReportAdmin(GISModelAdmin):
    list_display = ('id', 'category', 'status', 'is_urgent', 'created_at')
    list_filter = ('status', 'is_urgent', 'category')
