"""Shared helpers for the UrbanHelper test-suite.

Kept at the project root (``/app/testkit.py``) rather than inside an app so all
four Django apps can import it without creating a dependency between them.
"""

from __future__ import annotations

import contextlib
import io
import re
from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models.signals import post_save
from django.utils import timezone


@contextlib.contextmanager
def no_auto_nlp():
    """Temporarily detach the automatic NLP analysis from ``Report`` saves.

    ``nlp.signals.run_nlp_on_new_report`` runs *synchronously* on every newly
    created report and rewrites ``nlp_meta``, ``is_urgent`` and even
    ``category``. That is exactly the production behaviour we want exercised —
    but only in the tests that are *about* it. Everywhere else it would make
    fixtures non-deterministic (a description containing «خطر» would silently
    flip ``is_urgent``), so fixture builders and unit tests switch it off.
    """
    from nlp.signals import run_nlp_on_new_report
    from reports.models import Report

    post_save.disconnect(run_nlp_on_new_report, sender=Report)
    try:
        yield
    finally:
        post_save.connect(run_nlp_on_new_report, sender=Report)


class NoAutoNLPMixin:
    """Mixin for TestCase classes that need inert report creation."""

    @classmethod
    def setUpClass(cls):
        cls._nlp_guard = no_auto_nlp()
        cls._nlp_guard.__enter__()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._nlp_guard.__exit__(None, None, None)

# A point inside Tehran — every fixture uses the same neighbourhood so distance
# filtering tests have a meaningful frame of reference.
TEHRAN_LNG = 51.3890
TEHRAN_LAT = 35.6892


def make_image(name: str = "capture.jpg", size=(12, 12), color=(220, 140, 40)) -> SimpleUploadedFile:
    """A real (tiny) JPEG. Django's ImageField rejects non-image bytes, so the
    fixture has to be a genuine image rather than arbitrary content."""
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="JPEG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/jpeg")


def make_user(username="citizen", password="test-pass-1234", **extra) -> User:
    return User.objects.create_user(username=username, password=password, **extra)


def make_staff(username="staff", password="test-pass-1234", **extra) -> User:
    return User.objects.create_user(
        username=username, password=password, is_staff=True, **extra
    )


def make_category(name="خرابی آسفالت", description=""):
    from reports.models import Category

    return Category.objects.create(name=name, description=description)


def make_report(
    *,
    user=None,
    category=None,
    description="چاله بزرگ در خیابان اصلی",
    lng=TEHRAN_LNG,
    lat=TEHRAN_LAT,
    status="SUBMITTED",
    with_image=True,
    **extra,
):
    """Create a Report directly through the ORM (bypassing the API).

    Automatic NLP analysis is suppressed so the fixture is exactly what the
    caller asked for; tests about the NLP pipeline create reports themselves.
    """
    from reports.models import Report

    with no_auto_nlp():
        return Report.objects.create(
            user=user,
            category=category,
            description=description,
            location=Point(lng, lat, srid=4326),
            image_before=make_image() if with_image else None,
            status=status,
            **extra,
        )


def report_payload(**overrides) -> dict:
    """A valid multipart body for ``POST /api/reports/``."""
    payload = {
        "description": "چاله عمیق وسط خیابان، خطر تصادف",
        "location": f"POINT({TEHRAN_LNG} {TEHRAN_LAT})",
        "image_before": make_image(),
        "capture_source": "CAMERA",
        "captured_at": (timezone.now() - timedelta(seconds=30)).isoformat(),
        "gps_accuracy": 12.5,
        "client_integrity_hash": "a" * 64,
    }
    payload.update(overrides)
    return {k: v for k, v in payload.items() if v is not None}


def auth(client, user):
    """Attach a real JWT for ``user`` to an APIClient (exercises the same auth
    path production clients use, unlike ``force_authenticate``)."""
    from rest_framework_simplejwt.tokens import RefreshToken

    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def access_token_for(user) -> str:
    from rest_framework_simplejwt.tokens import RefreshToken

    return str(RefreshToken.for_user(user).access_token)


def properties(response_data: dict) -> dict:
    """Pull ``.properties`` out of a GeoJSON Feature response body."""
    return response_data.get("properties", response_data)


_WKT_POINT = re.compile(r"POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)", re.I)


def geometry_lng_lat(geometry) -> tuple[float, float] | None:
    """Read ``(lng, lat)`` out of a serialized geometry.

    The API currently emits EWKT (``"SRID=4326;POINT (51.389 35.6892)"``) rather
    than a GeoJSON geometry object — see
    ``reports.tests.test_serializers.GeometryEncodingDeviationTests`` for the
    cause and the one-line fix. Both encodings are accepted here so the rest of
    the suite keeps asserting *the coordinates*, which is the part that actually
    matters, and stays green either way.
    """
    if not geometry:
        return None
    if isinstance(geometry, dict):
        coords = geometry.get("coordinates") or []
        return (coords[0], coords[1]) if len(coords) >= 2 else None
    match = _WKT_POINT.search(str(geometry))
    return (float(match.group(1)), float(match.group(2))) if match else None
