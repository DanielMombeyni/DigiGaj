from __future__ import annotations

from copy import deepcopy

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
    "company_address": "",
    "enamad_html": "",
}


def _normalize(raw: dict | None) -> dict:
    data = deepcopy(DEFAULT_CONFIG)
    if not isinstance(raw, dict):
        return data

    auth = raw.get("auth_methods") or {}
    if isinstance(auth, dict):
        for key in DEFAULT_AUTH_METHODS:
            if key in auth:
                data["auth_methods"][key] = bool(auth[key])

    data["company_phone"] = str(raw.get("company_phone") or "").strip()
    data["company_address"] = str(raw.get("company_address") or "").strip()
    data["enamad_html"] = str(raw.get("enamad_html") or "").strip()
    return data


def validate_auth_methods(auth: dict) -> dict:
    normalized = {
        key: bool(auth.get(key, DEFAULT_AUTH_METHODS[key]))
        for key in DEFAULT_AUTH_METHODS
    }
    if not any(normalized.values()):
        raise ValidationError(
            {"auth_methods": "حداقل یک روش ورود باید فعال باشد."}
        )
    return normalized


def get_storefront_config() -> dict:
    row = SiteSetting.objects.filter(key=STOREFRONT_KEY).first()
    return _normalize(row.value if row else None)


def public_storefront_config() -> dict:
    """Public payload: hide empty company fields; expose auth + enamad + pages."""
    from app.services.public_pages import public_pages_payload

    cfg = get_storefront_config()
    pages_cfg = public_pages_payload()
    out = {
        "auth_methods": cfg["auth_methods"],
        "enamad_html": cfg["enamad_html"],
        "pages": pages_cfg["enabled"],
        "site_icon": pages_cfg["site_icon"],
        "theme": pages_cfg.get("theme") or "classic",
        "colors": pages_cfg.get("colors") or {},
    }
    if cfg["company_phone"]:
        out["company_phone"] = cfg["company_phone"]
    if cfg["company_address"]:
        out["company_address"] = cfg["company_address"]
    return out


def save_storefront_config(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")

    auth = validate_auth_methods(payload.get("auth_methods") or {})
    value = {
        "auth_methods": auth,
        "company_phone": str(payload.get("company_phone") or "").strip(),
        "company_address": str(payload.get("company_address") or "").strip(),
        "enamad_html": str(payload.get("enamad_html") or "").strip(),
    }
    SiteSetting.objects.update_or_create(
        key=STOREFRONT_KEY,
        defaults={"value": value},
    )
    return get_storefront_config()


def ensure_storefront_defaults() -> None:
    if not SiteSetting.objects.filter(key=STOREFRONT_KEY).exists():
        SiteSetting.objects.create(key=STOREFRONT_KEY, value=deepcopy(DEFAULT_CONFIG))
