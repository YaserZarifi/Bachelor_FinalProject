from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import Category, Report

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description']

class ReportSerializer(GeoFeatureModelSerializer):
    # Read-only field to expose the category name alongside its ID
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Report
        geo_field = 'location'
        fields = [
            'id', 'user', 'category', 'category_name', 'description',
            'location', 'image_before', 'image_after',
            'status', 'is_urgent', 'created_at', 'updated_at'
        ]
