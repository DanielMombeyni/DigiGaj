from __future__ import annotations

from django.conf import settings


def toman_to_rial(amount_toman: int) -> int:
    return int(amount_toman) * 10


def public_api_base() -> str:
    return getattr(settings, "PUBLIC_API_BASE", "http://localhost:8000").rstrip("/")


def callback_url_for(provider: str, tracking: str) -> str:
    return (
        f"{public_api_base()}/api/v1/payment/callback/{provider}/"
        f"?tracking={tracking}"
    )


def app_return_url(status: str, tracking: str) -> str:
    scheme = getattr(settings, "APP_DEEP_LINK_SCHEME", "gadgetstore")
    return f"{scheme}://payment/{status}?tracking={tracking}"


def detect_platform(request) -> str:
    platform = (
        getattr(request, "client_platform", None)
        or request.headers.get("X-Client-Platform")
        or request.headers.get("X-Platform")
        or request.query_params.get("platform")
        or request.data.get("platform")
        or "web"
    )
    platform = str(platform).lower().strip()
    return platform if platform in ("web", "app") else "web"


def mask_secret(value: str | None, visible: int = 4) -> str:
    if not value:
        return ""
    value = str(value)
    if len(value) <= visible:
        return "••••"
    return "••••" + value[-visible:]


def is_masked_value(value) -> bool:
    return isinstance(value, str) and value.startswith("••••")
