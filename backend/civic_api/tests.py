from django.test import SimpleTestCase


class SmokeTests(SimpleTestCase):
    def test_import_civic_api(self):
        import civic_api.viewsets  # noqa: F401
