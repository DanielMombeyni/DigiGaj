from __future__ import annotations

from copy import deepcopy

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework.exceptions import ValidationError

from app.models import SiteSetting

STOREFRONT_KEY = "storefront"

DEFAULT_AUTH_METHODS = {
    "username_password": True,
    "email_password": False,
    "phone_password": False,
    "phone_otp": False,
}

DEFAULT_CONFIG = {
    "auth_methods": dict(DEFAULT_AUTH_METHODS),
    "company_phone": "",
    "company_email": "",
    "company_address": "",
    "enamad_html": "",
    "google_enabled": False,
    "google_client_id": "",
    "google_client_secret": "",
    "google_phone_required": False,
}


def _optional_text(value) -> str:
    return str(value or "").strip()


def _optional_email(value) -> str:
    email = _optional_text(value)
    if not email:
        return ""
    try:
        validate_email(email)
    except DjangoValidationError:
        raise ValidationError({"company_email": "ایمیل شرکت نامعتبر است."})
    return email


def _normalize(raw: dict | None) -> dict:
    data = deepcopy(DEFAULT_CONFIG)
    if not isinstance(raw, dict):
        return data

    auth = raw.get("auth_methods") or {}
    if isinstance(auth, dict):
        for key in DEFAULT_AUTH_METHODS:
            if key in auth:
                data["auth_methods"][key] = bool(auth[key])

    data["company_phone"] = _optional_text(raw.get("company_phone"))
    data["company_email"] = _optional_text(raw.get("company_email"))
    data["company_address"] = _optional_text(raw.get("company_address"))
    data["enamad_html"] = _optional_text(raw.get("enamad_html"))
    data["google_enabled"] = bool(raw.get("google_enabled"))
    data["google_client_id"] = _optional_text(raw.get("google_client_id"))
    data["google_client_secret"] = str(raw.get("google_client_secret") or "")
    data["google_phone_required"] = bool(raw.get("google_phone_required"))
    return data


def sms_available() -> bool:
    """True when an enabled provider is ready, or Signal credentials in .env can send."""
    from django.core.cache import cache

    cached = cache.get("storefront:sms_available")
    if cached is not None:
        return bool(cached)
    try:
        from app.services.sms_service import SmsProviderService

        if SmsProviderService.is_available():
            ok = True
        else:
            from app.services.sms_templates import signal_ready

            ok = signal_ready()
    except Exception:
        ok = False
    cache.set("storefront:sms_available", ok, 60)
    return ok


def effective_auth_methods(auth: dict | None = None) -> dict:
    """Stored auth flags with phone_otp forced off when SMS is unavailable."""
    base = auth if auth is not None else get_storefront_config()["auth_methods"]
    out = {
        key: bool(base.get(key, DEFAULT_AUTH_METHODS[key]))
        for key in DEFAULT_AUTH_METHODS
    }
    try:
        sms_ok = sms_available()
    except Exception:
        sms_ok = False
    if out.get("phone_otp") and not sms_ok:
        out["phone_otp"] = False
    return out


def validate_auth_methods(auth: dict) -> dict:
    normalized = {
        key: bool(auth.get(key, DEFAULT_AUTH_METHODS[key]))
        for key in DEFAULT_AUTH_METHODS
    }
    if normalized.get("phone_otp") and not sms_available():
        raise ValidationError(
            {
                "auth_methods": "ورود با رمز یک‌بارمصرف نیاز به سرویس پیامک فعال و تنظیم‌شده دارد."
            }
        )
    if not any(normalized.values()):
        raise ValidationError(
            {"auth_methods": "حداقل یک روش ورود باید فعال باشد."}
        )
    return normalized


def sync_phone_otp_with_sms() -> None:
    """Turn off stored phone_otp when no SMS provider is usable."""
    if sms_available():
        return
    row = SiteSetting.objects.filter(key=STOREFRONT_KEY).first()
    if not row or not isinstance(row.value, dict):
        return
    auth = row.value.get("auth_methods") or {}
    if not auth.get("phone_otp"):
        return
    value = deepcopy(row.value)
    value["auth_methods"] = {**auth, "phone_otp": False}
    row.value = value
    row.save(update_fields=["value", "updated_at"])


def get_storefront_config() -> dict:
    row = SiteSetting.objects.filter(key=STOREFRONT_KEY).first()
    return _normalize(row.value if row else None)


def google_credentials(cfg: dict | None = None) -> dict:
    """Resolved Google OAuth credentials. Admin values win; .env is the fallback."""
    from django.conf import settings

    data = cfg if cfg is not None else get_storefront_config()
    client_id = data.get("google_client_id") or str(
        getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or ""
    )
    secret = data.get("google_client_secret") or str(
        getattr(settings, "GOOGLE_OAUTH_CLIENT_SECRET", "") or ""
    )
    client_id = str(client_id).strip()
    secret = str(secret).strip()
    return {
        "enabled": bool(data.get("google_enabled") and client_id and secret),
        "requested": bool(data.get("google_enabled")),
        "client_id": client_id,
        "client_secret": secret,
        "phone_required": bool(data.get("google_phone_required")),
        "secret_from_env": not bool(data.get("google_client_secret")) and bool(secret),
        "client_id_from_env": not bool(data.get("google_client_id")) and bool(client_id),
    }


def admin_storefront_config() -> dict:
    from app.payment.utils import mask_secret

    cfg = get_storefront_config()
    creds = google_credentials(cfg)
    stored_secret = cfg.get("google_client_secret") or ""
    return {
        **cfg,
        "google_client_secret": mask_secret(stored_secret) if stored_secret else "",
        "google_secret_from_env": creds["secret_from_env"],
        "google_client_id_from_env": creds["client_id_from_env"],
        "google_ready": creds["enabled"],
        "sms_available": sms_available(),
    }


def public_storefront_config() -> dict:
    """Public payload: hide empty company fields; expose auth + enamad + pages."""
    from app.services.public_pages import public_pages_payload

    cfg = get_storefront_config()
    pages_cfg = public_pages_payload()
    google = google_credentials(cfg)
    out = {
        "auth_methods": effective_auth_methods(cfg["auth_methods"]),
        "enamad_html": cfg["enamad_html"],
        "pages": pages_cfg["enabled"],
        "site_icon": pages_cfg["site_icon"],
        "theme": pages_cfg.get("theme") or "green",
        "colors": pages_cfg.get("colors") or {},
        "google_login": {
            "enabled": google["enabled"],
            "client_id": google["client_id"] if google["enabled"] else "",
            "phone_required": google["phone_required"],
        },
    }
    if cfg["company_phone"]:
        out["company_phone"] = cfg["company_phone"]
    if cfg["company_email"]:
        out["company_email"] = cfg["company_email"]
    if cfg["company_address"]:
        out["company_address"] = cfg["company_address"]
    return out


def save_storefront_config(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")

    from app.payment.utils import is_masked_value

    existing_row = SiteSetting.objects.filter(key=STOREFRONT_KEY).first()
    existing = _normalize(existing_row.value if existing_row else None)

    auth = validate_auth_methods(payload.get("auth_methods") or {})
    google_enabled = (
        bool(payload["google_enabled"])
        if "google_enabled" in payload
        else existing["google_enabled"]
    )
    if "google_client_id" in payload:
        google_client_id = _optional_text(payload.get("google_client_id"))
    else:
        google_client_id = existing["google_client_id"]

    if "google_client_secret" not in payload:
        google_client_secret = existing["google_client_secret"]
    else:
        incoming = payload.get("google_client_secret")
        if incoming in (None, "") or is_masked_value(incoming):
            google_client_secret = (
                existing["google_client_secret"] if is_masked_value(incoming) else ""
            )
            if incoming in (None, ""):
                google_client_secret = ""
        else:
            google_client_secret = str(incoming).strip()

    phone_required = (
        bool(payload["google_phone_required"])
        if "google_phone_required" in payload
        else existing["google_phone_required"]
    )

    preview = {
        **existing,
        "google_enabled": google_enabled,
        "google_client_id": google_client_id,
        "google_client_secret": google_client_secret,
        "google_phone_required": phone_required,
    }
    resolved = google_credentials(preview)
    if google_enabled and not resolved["client_id"]:
        raise ValidationError(
            {"detail": "برای فعال‌کردن ورود گوگل، Client ID را وارد کنید یا در .env قرار دهید."}
        )
    if google_enabled and not resolved["client_secret"]:
        raise ValidationError(
            {"detail": "برای فعال‌کردن ورود گوگل، Client Secret را وارد کنید یا در .env قرار دهید."}
        )

    value = {
        "auth_methods": auth,
        "company_phone": _optional_text(payload.get("company_phone")),
        "company_email": _optional_email(payload.get("company_email")),
        "company_address": _optional_text(payload.get("company_address")),
        "enamad_html": _optional_text(payload.get("enamad_html")),
        "google_enabled": google_enabled,
        "google_client_id": google_client_id,
        "google_client_secret": google_client_secret,
        "google_phone_required": phone_required,
    }
    SiteSetting.objects.update_or_create(
        key=STOREFRONT_KEY,
        defaults={"value": value},
    )
    return get_storefront_config()


def ensure_storefront_defaults() -> None:
    if not SiteSetting.objects.filter(key=STOREFRONT_KEY).exists():
        SiteSetting.objects.create(key=STOREFRONT_KEY, value=deepcopy(DEFAULT_CONFIG))
