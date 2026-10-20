"""Shared security helpers for configuration validation."""

from __future__ import annotations

from django.core.exceptions import ImproperlyConfigured

# Known insecure defaults that must never be used when DJANGO_ENV=production.
KNOWN_INSECURE_SECRET_KEYS = frozenset(
    {
        "",
        "insecure-dev-key-change-me",
        "change-me-in-production-use-long-random-string",
        "django-insecure",
        "secret",
        "changeme",
    }
)

MIN_PRODUCTION_SECRET_KEY_LENGTH = 32


def validate_production_secret_key(secret: str | None) -> None:
    """
    Fail fast when production would run with a missing, short, or known-default SECRET_KEY.
    Safe to call from settings; raises ImproperlyConfigured on failure.
    """
    value = str(secret or "").strip()
    if not value or value in KNOWN_INSECURE_SECRET_KEYS:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY must be set to a unique non-default value in production."
        )
    if len(value) < MIN_PRODUCTION_SECRET_KEY_LENGTH:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY must be at least "
            f"{MIN_PRODUCTION_SECRET_KEY_LENGTH} characters in production."
        )
    # Catch common "django-insecure-..." style keys even if longer than the minimum.
    lowered = value.lower()
    if lowered.startswith("django-insecure") or "insecure-dev-key" in lowered:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY looks like a development placeholder; set a strong production key."
        )
