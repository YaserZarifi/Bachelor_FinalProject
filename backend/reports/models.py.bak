from django.contrib.gis.db import models
from django.contrib.auth.models import User

class Category(models.Model):
    # Name of the category (e.g., Pothole, Lighting, Trash)
    name = models.CharField(max_length=100)
    # Optional detailed description
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class Report(models.Model):
    # State Machine for the report lifecycle
    STATUS_CHOICES = [
        ('SUBMITTED', 'Submitted'),
        ('UNDER_REVIEW', 'Under Review'),
        ('ASSIGNED', 'Assigned'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
    ]

    # Nullable user field allows anonymous/guest citizens to submit reports
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)

    # Core report details
    description = models.TextField()

    # PostGIS spatial field to store exact GPS coordinates
    location = models.PointField(srid=4326)

    # Initial image taken by the citizen
    image_before = models.ImageField(upload_to='reports/before/')
    # Image uploaded by the contractor after fixing the issue
    image_after = models.ImageField(upload_to='reports/after/', blank=True, null=True)

    # Tracking and NLP prioritization fields
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SUBMITTED')
    is_urgent = models.BooleanField(default=False)

    # Auto-generated timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Report {self.id} - {self.get_status_display()}"
