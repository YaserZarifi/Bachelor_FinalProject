"""Authentication endpoints: registration, JWT issue/refresh, and the identity
claims the SPAs read straight out of the access token."""

import json

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from testkit import make_staff, make_user


def decode_jwt_payload(token: str) -> dict:
    """Decode (without verifying) — mirrors `decodeJwt()` in the SPA clients."""
    import base64

    part = token.split(".")[1]
    part += "=" * (-len(part) % 4)
    return json.loads(base64.urlsafe_b64decode(part))


class RegistrationTests(TestCase):
    URL = "/api/auth/register/"

    def setUp(self):
        self.client = APIClient()

    def test_anonymous_visitor_can_register(self):
        response = self.client.post(
            self.URL,
            {"username": "shahrvand", "email": "a@b.com", "password": "strong-pass-1"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(username="shahrvand").exists())

    def test_password_is_hashed_not_stored_in_clear(self):
        self.client.post(
            self.URL, {"username": "u1", "email": "a@b.com", "password": "strong-pass-1"}
        )
        user = User.objects.get(username="u1")
        self.assertNotEqual(user.password, "strong-pass-1")
        self.assertTrue(user.check_password("strong-pass-1"))

    def test_password_is_never_echoed_back(self):
        response = self.client.post(
            self.URL, {"username": "u2", "email": "a@b.com", "password": "strong-pass-1"}
        )
        self.assertNotIn("password", response.data)

    def test_short_password_is_rejected(self):
        response = self.client.post(
            self.URL, {"username": "u3", "email": "a@b.com", "password": "short"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data)

    def test_duplicate_username_is_rejected(self):
        make_user(username="taken")
        response = self.client.post(
            self.URL, {"username": "taken", "email": "a@b.com", "password": "strong-pass-1"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("username", response.data)

    def test_username_is_required(self):
        response = self.client.post(self.URL, {"password": "strong-pass-1"})
        self.assertEqual(response.status_code, 400)

    def test_new_accounts_are_never_staff(self):
        self.client.post(
            self.URL,
            {
                "username": "sneaky",
                "email": "a@b.com",
                "password": "strong-pass-1",
                "is_staff": True,
            },
        )
        self.assertFalse(User.objects.get(username="sneaky").is_staff)


class TokenIssueTests(TestCase):
    URL = "/api/auth/token/"

    def setUp(self):
        self.client = APIClient()
        self.user = make_user(username="ali", password="test-pass-1234")

    def test_valid_credentials_return_an_access_and_refresh_pair(self):
        response = self.client.post(
            self.URL, {"username": "ali", "password": "test-pass-1234"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_wrong_password_is_rejected(self):
        response = self.client.post(self.URL, {"username": "ali", "password": "nope"})
        self.assertEqual(response.status_code, 401)

    def test_unknown_user_is_rejected(self):
        response = self.client.post(
            self.URL, {"username": "ghost", "password": "test-pass-1234"}
        )
        self.assertEqual(response.status_code, 401)

    def test_access_token_embeds_the_username(self):
        # The SPAs display the real username without a `/me` round-trip.
        response = self.client.post(
            self.URL, {"username": "ali", "password": "test-pass-1234"}
        )
        self.assertEqual(decode_jwt_payload(response.data["access"])["username"], "ali")

    def test_access_token_embeds_the_staff_flag(self):
        make_staff(username="modir", password="test-pass-1234")
        response = self.client.post(
            self.URL, {"username": "modir", "password": "test-pass-1234"}
        )
        self.assertTrue(decode_jwt_payload(response.data["access"])["is_staff"])

    def test_citizen_token_is_not_marked_staff(self):
        response = self.client.post(
            self.URL, {"username": "ali", "password": "test-pass-1234"}
        )
        self.assertFalse(decode_jwt_payload(response.data["access"])["is_staff"])

    def test_token_carries_the_user_id(self):
        response = self.client.post(
            self.URL, {"username": "ali", "password": "test-pass-1234"}
        )
        # SimpleJWT serialises the primary key as a string in the claim.
        self.assertEqual(
            str(decode_jwt_payload(response.data["access"])["user_id"]), str(self.user.id)
        )

    def test_inactive_user_cannot_obtain_a_token(self):
        self.user.is_active = False
        self.user.save()
        response = self.client.post(
            self.URL, {"username": "ali", "password": "test-pass-1234"}
        )
        self.assertEqual(response.status_code, 401)


class TokenRefreshTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        make_user(username="ali", password="test-pass-1234")
        self.refresh = self.client.post(
            "/api/auth/token/", {"username": "ali", "password": "test-pass-1234"}
        ).data["refresh"]

    def test_refresh_returns_a_new_access_token(self):
        response = self.client.post("/api/auth/token/refresh/", {"refresh": self.refresh})
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)

    def test_garbage_refresh_token_is_rejected(self):
        response = self.client.post("/api/auth/token/refresh/", {"refresh": "not-a-token"})
        self.assertEqual(response.status_code, 401)

    def test_refresh_tokens_are_not_rotated(self):
        # SIMPLE_JWT.ROTATE_REFRESH_TOKENS is False, so the SPA keeps using the
        # refresh token it already stored.
        response = self.client.post("/api/auth/token/refresh/", {"refresh": self.refresh})
        self.assertNotIn("refresh", response.data)


class HealthEndpointTests(TestCase):
    """The mobile offline outbox distinguishes "internet is up" from "the API
    server answers" by hitting this probe."""

    def test_health_is_public_and_reports_ok(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


class ApiDocumentationTests(TestCase):
    def test_openapi_schema_is_served(self):
        response = self.client.get("/api/schema/")
        self.assertEqual(response.status_code, 200)

    def test_swagger_ui_is_served(self):
        response = self.client.get("/api/docs/")
        self.assertEqual(response.status_code, 200)
