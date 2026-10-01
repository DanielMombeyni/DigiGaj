import pytest
from django.contrib.auth import get_user_model

from app.models import SiteSetting, UserProfile
from app.services.store_config import STOREFRONT_KEY, admin_storefront_config

User = get_user_model()


def _enable_google():
    SiteSetting.objects.update_or_create(
        key=STOREFRONT_KEY,
        defaults={
            "value": {
                "auth_methods": {"username_password": True},
                "google_enabled": True,
                "google_client_id": "client-id.apps.googleusercontent.com",
                "google_client_secret": "super-secret-value",
                "google_phone_required": True,
            }
        },
    )


@pytest.mark.django_db
def test_google_creates_user_then_links_same_email(api, monkeypatch):
    _enable_google()

    def claims_for(sub, email="buyer@example.com"):
        return {
            "sub": sub,
            "email": email,
            "email_verified": True,
            "iss": "https://accounts.google.com",
            "aud": "client-id.apps.googleusercontent.com",
            "given_name": "Ali",
            "family_name": "Rezaei",
        }

    monkeypatch.setattr(
        "app.views.google_auth.exchange_code",
        lambda **kwargs: claims_for("sub-1"),
    )
    first = api.post(
        "/api/v1/auth/google/",
        {
            "code": "code",
            "code_verifier": "a" * 50,
            "redirect_uri": "http://localhost:5173/login/google/callback",
        },
        format="json",
    )
    assert first.status_code == 200
    assert first.data["access"]
    assert first.data["phone_missing"] is True
    assert first.data["phone_required"] is True
    assert User.objects.filter(email="buyer@example.com").count() == 1

    existing = User.objects.get(email="buyer@example.com")
    existing.set_password("keep-me")
    existing.save(update_fields=["password"])

    monkeypatch.setattr(
        "app.views.google_auth.exchange_code",
        lambda **kwargs: claims_for("sub-1"),
    )
    second = api.post(
        "/api/v1/auth/google/",
        {
            "code": "code",
            "code_verifier": "a" * 50,
            "redirect_uri": "http://localhost:5173/login/google/callback",
        },
        format="json",
    )
    assert second.status_code == 200
    assert User.objects.filter(email="buyer@example.com").count() == 1
    existing.refresh_from_db()
    assert existing.check_password("keep-me")

    other = User.objects.create_user("local", "buyer@example.com", "local-pass")
    # create_user allows a second row because email is not unique; link must pick the first.
    monkeypatch.setattr(
        "app.views.google_auth.exchange_code",
        lambda **kwargs: claims_for("sub-2", "other@example.com"),
    )
    created = api.post(
        "/api/v1/auth/google/",
        {
            "code": "code",
            "code_verifier": "b" * 50,
            "redirect_uri": "http://localhost:5173/login/google/callback",
        },
        format="json",
    )
    assert created.status_code == 200
    linked = UserProfile.objects.get(google_sub="sub-2")
    assert linked.user.email == "other@example.com"
    assert other.email == "buyer@example.com"
    assert UserProfile.objects.filter(google_sub="sub-1").count() == 1


@pytest.mark.django_db
def test_google_links_existing_email_without_duplicate(api, monkeypatch):
    _enable_google()
    user = User.objects.create_user("shopper", "shop@example.com", "pass-12345")
    monkeypatch.setattr(
        "app.views.google_auth.exchange_code",
        lambda **kwargs: {
            "sub": "google-sub",
            "email": "Shop@Example.com",
            "email_verified": True,
            "iss": "accounts.google.com",
            "aud": "client-id.apps.googleusercontent.com",
        },
    )
    response = api.post(
        "/api/v1/auth/google/",
        {
            "code": "code",
            "code_verifier": "c" * 50,
            "redirect_uri": "http://localhost:5173/login/google/callback",
        },
        format="json",
    )
    assert response.status_code == 200
    assert User.objects.filter(email__iexact="shop@example.com").count() == 1
    user.refresh_from_db()
    assert user.profile.google_sub == "google-sub"
    assert user.check_password("pass-12345")


@pytest.mark.django_db
def test_google_disabled_and_secret_hidden(api):
    _enable_google()
    public = api.get("/api/v1/storefront/config/")
    body = public.content.decode()
    assert "super-secret-value" not in body
    assert public.data["google_login"]["client_id"]
    assert public.data["google_login"]["enabled"] is True

    admin = admin_storefront_config()
    assert "super-secret-value" not in admin["google_client_secret"]
    assert admin["google_client_secret"].startswith("••••")

    SiteSetting.objects.filter(key=STOREFRONT_KEY).update(
        value={
            "auth_methods": {"username_password": True},
            "google_enabled": False,
            "google_client_id": "client-id.apps.googleusercontent.com",
            "google_client_secret": "super-secret-value",
        }
    )
    denied = api.post(
        "/api/v1/auth/google/",
        {
            "code": "code",
            "code_verifier": "d" * 50,
            "redirect_uri": "http://localhost:5173/login/google/callback",
        },
        format="json",
    )
    assert denied.status_code == 400


@pytest.mark.django_db
def test_google_signup_asks_for_required_profile(api, monkeypatch):
    _enable_google()
    monkeypatch.setattr(
        "app.views.google_auth.exchange_code",
        lambda **kwargs: {
            "sub": "new-google",
            "email": "new@example.com",
            "email_verified": True,
            "iss": "https://accounts.google.com",
            "aud": "client-id.apps.googleusercontent.com",
        },
    )
    created = api.post(
        "/api/v1/auth/google/",
        {
            "code": "code",
            "code_verifier": "e" * 50,
            "redirect_uri": "http://localhost:5173/login/google/callback",
        },
        format="json",
    )
    assert created.status_code == 200
    assert created.data["created"] is True
    assert created.data["profile_incomplete"] is True

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {created.data['access']}")
    saved = api.post(
        "/api/v1/me/google-profile/",
        {
            "first_name": "علی",
            "last_name": "رضایی",
            "username": "ali.rezaei",
            "phone": "09121112233",
        },
        format="json",
    )
    assert saved.status_code == 200
    assert saved.data["profile_incomplete"] is False
    user = User.objects.get(email="new@example.com")
    assert user.first_name == "علی"
    assert user.last_name == "رضایی"
    assert user.username == "ali.rezaei"
    assert user.profile.phone == "09121112233"
