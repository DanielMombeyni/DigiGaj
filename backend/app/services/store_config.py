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
    return data


def sms_available() -> bool:
    from app.services.sms_service import SmsProviderService

    return SmsProviderService.is_available()


def effective_auth_methods(auth: dict | None = None) -> dict:
    """Stored auth flags with phone_otp forced off when SMS is unavailable."""
    base = auth if auth is not None else get_storefront_config()["auth_methods"]
    out = {
        key: bool(base.get(key, DEFAULT_AUTH_METHODS[key]))
        for key in DEFAULT_AUTH_METHODS
    }
    if out.get("phone_otp") and not sms_available():
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


def admin_storefront_config() -> dict:
    cfg = get_storefront_config()
    return {
        **cfg,
        "sms_available": sms_available(),
    }


def public_storefront_config() -> dict:
    """Public payload: hide empty company fields; expose auth + enamad + pages."""
    from app.services.public_pages import public_pages_payload

    cfg = get_storefront_config()
    pages_cfg = public_pages_payload()
    out = {
        "auth_methods": effective_auth_methods(cfg["auth_methods"]),
        "enamad_html": cfg["enamad_html"],
        "pages": pages_cfg["enabled"],
        "site_icon": pages_cfg["site_icon"],
        "theme": pages_cfg.get("theme") or "classic",
        "colors": pages_cfg.get("colors") or {},
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

    auth = validate_auth_methods(payload.get("auth_methods") or {})
    value = {
        "auth_methods": auth,
        "company_phone": _optional_text(payload.get("company_phone")),
        "company_email": _optional_email(payload.get("company_email")),
        "company_address": _optional_text(payload.get("company_address")),
        "enamad_html": _optional_text(payload.get("enamad_html")),
    }
    SiteSetting.objects.update_or_create(
        key=STOREFRONT_KEY,
        defaults={"value": value},
    )
    return get_storefront_config()


def ensure_storefront_defaults() -> None:
    if not SiteSetting.objects.filter(key=STOREFRONT_KEY).exists():
        SiteSetting.objects.create(key=STOREFRONT_KEY, value=deepcopy(DEFAULT_CONFIG))
