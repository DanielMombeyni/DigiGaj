import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

User = get_user_model()
PHONE = "09120000000"


@pytest.fixture
def otp_ready(monkeypatch):
    monkeypatch.setattr(
        "app.views.auth_otp.effective_auth_methods",
        lambda: {"phone_otp": True},
    )
    monkeypatch.setattr(
        "app.views.auth_otp.send_login_otp",
        lambda phone, code: (True, None),
    )


@pytest.mark.django_db
def test_otp_is_hashed_and_verifies(api, otp_ready, settings):
    settings.DEBUG = True
    issued = api.post("/api/v1/auth/otp/request/", {"phone": PHONE}, format="json")
    assert issued.status_code == 200
    code = issued.data["debug_code"]
    stored = cache.get(f"otp:{PHONE}")
    assert stored["hash"] != code
    assert code not in str(stored)

    denied = api.post(
        "/api/v1/auth/otp/verify/",
        {"phone": PHONE, "code": "000000" if code != "000000" else "111111"},
        format="json",
    )
    assert denied.status_code == 400

    ok = api.post(
        "/api/v1/auth/otp/verify/",
        {"phone": PHONE, "code": code},
        format="json",
    )
    assert ok.status_code == 200
    assert ok.data["access"]
    assert User.objects.filter(profile__phone=PHONE).count() == 1


@pytest.mark.django_db
def test_otp_resend_cooldown_and_attempt_limit(api, otp_ready, settings):
    settings.DEBUG = True
    first = api.post("/api/v1/auth/otp/request/", {"phone": PHONE}, format="json")
    assert first.status_code == 200
    again = api.post("/api/v1/auth/otp/request/", {"phone": PHONE}, format="json")
    assert again.status_code == 429

    for _ in range(4):
        bad = api.post(
            "/api/v1/auth/otp/verify/",
            {"phone": PHONE, "code": "000000"},
            format="json",
        )
        assert bad.status_code == 400
    locked = api.post(
        "/api/v1/auth/otp/verify/",
        {"phone": PHONE, "code": "000000"},
        format="json",
    )
    assert locked.status_code == 429


@pytest.mark.django_db
def test_password_reset_otp_sets_new_password(api, settings, monkeypatch):
    settings.DEBUG = True
    monkeypatch.setattr(
        "app.views.auth_otp.send_password_reset_otp",
        lambda phone, code, name="": (True, None),
    )
    user = User.objects.create_user("buyer", "buyer@example.com", "Old-pass-123")
    from app.models import UserProfile

    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.phone = PHONE
    profile.save(update_fields=["phone"])

    issued = api.post("/api/v1/auth/password/otp/request/", {"phone": PHONE}, format="json")
    assert issued.status_code == 200
    code = issued.data["debug_code"]
    stored = cache.get(f"pwd-otp:{PHONE}")
    assert code not in str(stored)

    changed = api.post(
        "/api/v1/auth/password/otp/confirm/",
        {
            "phone": PHONE,
            "code": code,
            "new_password1": "New-pass-12345",
            "new_password2": "New-pass-12345",
        },
        format="json",
    )
    assert changed.status_code == 200
    user.refresh_from_db()
    assert user.check_password("New-pass-12345")
