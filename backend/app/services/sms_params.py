"""Allowlisted SMS template parameter sources and safe resolution."""

from __future__ import annotations

import re
from typing import Any

from rest_framework.exceptions import ValidationError

# Explicit sources only — never ORM paths or executable expressions.
ALLOWED_PARAM_SOURCES: dict[str, str] = {
    "context.code": "کد تأیید / مقدار کد در context رویداد",
    "context.name": "نام در context رویداد",
    "context.phone": "شماره در context رویداد",
    "context.order_number": "شماره سفارش",
    "context.order_id": "شناسه سفارش (معادل شماره)",
    "context.status": "وضعیت سفارش (برچسب)",
    "context.previous_status": "وضعیت قبلی",
    "context.amount": "مبلغ (از context معتبر رویداد)",
    "context.link": "لینک (مثلاً بازیابی رمز)",
    "context.customer_name": "نام مشتری در context",
    "recipient.name": "نام نمایشی گیرنده",
    "recipient.phone": "شماره موبایل گیرنده",
    "recipient.username": "نام کاربری گیرنده",
    "recipient.first_name": "نام گیرنده",
    "recipient.last_name": "نام خانوادگی گیرنده",
    "manual": "مقدار دستی مجاز از پنل ادمین",
}

ALLOWED_SOURCE_KEYS = frozenset(ALLOWED_PARAM_SOURCES)

# Param names accepted on templates (Signal panel names may use aliases).
ALLOWED_PARAM_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,39}$")

SENSITIVE_PARAM_HINTS = frozenset(
    {
        "code",
        "otp",
        "token",
        "pin",
        "password",
        "passcode",
        "link",
        "url",
        "resetlink",
        "reseturl",
        "verificationcode",
        "verifycode",
        "authcode",
        "smscode",
    }
)

_PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

MANUAL_SEND_MAX_RECIPIENTS = 100
MANUAL_SEND_RATE_LIMIT = 10
MANUAL_SEND_RATE_WINDOW = 600
MANUAL_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
MANUAL_PARAM_MAX_LEN = 200

# Context keys that must never be overridden by client-supplied manual_params.
TRUSTED_CONTEXT_KEYS = frozenset(
    {
        "order_id",
        "order_number",
        "orderId",
        "status",
        "order_status",
        "status_code",
        "previous_status",
        "previous_status_code",
        "amount",
        "phone",
        "mobile",
        "code",
        "otp",
        "token",
        "link",
    }
)


def normalize_phone(value: str) -> str:
    text = str(value or "").translate(_PERSIAN_DIGITS)
    digits = "".join(ch for ch in text if ch.isdigit())
    if digits.startswith("98") and len(digits) >= 12:
        digits = "0" + digits[2:]
    elif digits.startswith("9") and len(digits) == 10:
        digits = "0" + digits
    return digits


def phone_ok(phone: str) -> bool:
    return bool(re.fullmatch(r"09\d{9}", phone or ""))


def is_sensitive_key(key: str) -> bool:
    compact = re.sub(r"[^a-z0-9]", "", str(key or "").lower())
    return compact in SENSITIVE_PARAM_HINTS


def redact_params(params: dict[str, Any] | None) -> dict[str, str]:
    """Safe copy for logs/API — never include raw OTP/token/link values."""
    out: dict[str, str] = {}
    for key, value in (params or {}).items():
        k = str(key)
        if is_sensitive_key(k):
            out[k] = "***"
        else:
            out[k] = str(value if value is not None else "")[:120]
    return out


def validate_param_keys(keys: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in keys or []:
        key = str(raw or "").strip()
        if not key:
            continue
        if not ALLOWED_PARAM_NAME_RE.match(key):
            raise ValidationError(
                {"param_keys": f"نام پارامتر نامعتبر است: {key[:40]}"}
            )
        if key.lower() in seen:
            continue
        seen.add(key.lower())
        cleaned.append(key)
    return cleaned


def validate_param_bindings(bindings: Any, param_keys: list[str]) -> dict[str, str]:
    if bindings is None or bindings == "":
        bindings = {}
    if not isinstance(bindings, dict):
        raise ValidationError({"param_bindings": "نگاشت پارامتر باید آبجکت باشد."})
    out: dict[str, str] = {}
    key_set = {k.lower(): k for k in param_keys}
    for raw_key, raw_source in bindings.items():
        key = str(raw_key or "").strip()
        source = str(raw_source or "").strip()
        if not key:
            continue
        if key.lower() not in key_set and key not in param_keys:
            raise ValidationError(
                {"param_bindings": f"پارامتر «{key}» در لیست param_keys نیست."}
            )
        if source not in ALLOWED_SOURCE_KEYS:
            raise ValidationError(
                {
                    "param_bindings": (
                        f"منبع «{source}» مجاز نیست. فقط منابع allowlist پشتیبانی می‌شوند."
                    )
                }
            )
        canon = key_set.get(key.lower(), key)
        out[canon] = source
    return out


def default_source_for_param(param_key: str) -> str:
    """Heuristic default when admin did not set an explicit binding."""
    from app.services.sms_templates import _norm_key, _PARAM_ALIASES

    wanted = _norm_key(param_key)
    for semantic, aliases in _PARAM_ALIASES.items():
        bucket = {_norm_key(semantic), *aliases}
        if wanted in bucket:
            if semantic in {"code"}:
                return "context.code"
            if semantic in {"name", "customer_name"}:
                return "context.name"
            if semantic == "phone":
                return "context.phone"
            if semantic in {"order_id", "order_number"}:
                return "context.order_number"
            if semantic == "status":
                return "context.status"
            if semantic == "link":
                return "context.link"
            if semantic == "amount":
                return "context.amount"
            if semantic == "previous_status":
                return "context.previous_status"
    return "manual"


def resolve_bound_value(
    source: str,
    *,
    context: dict[str, Any] | None,
    recipient: dict[str, Any] | None = None,
    manual_params: dict[str, Any] | None = None,
    param_key: str = "",
) -> str:
    if source not in ALLOWED_SOURCE_KEYS:
        return ""
    ctx = context if isinstance(context, dict) else {}
    rec = recipient if isinstance(recipient, dict) else {}
    manual = manual_params if isinstance(manual_params, dict) else {}

    if source.startswith("context."):
        field = source.split(".", 1)[1]
        from app.services.sms_templates import resolve_context_value

        # Prefer exact context key; fall back to alias resolver.
        raw = ctx.get(field)
        if raw is not None and str(raw).strip() != "":
            return str(raw)
        return resolve_context_value(field, ctx) or resolve_context_value(param_key, ctx)

    if source.startswith("recipient."):
        field = source.split(".", 1)[1]
        raw = rec.get(field)
        return str(raw).strip() if raw is not None else ""

    if source == "manual":
        if param_key and param_key in manual:
            return str(manual.get(param_key) or "").strip()
        # also allow case-insensitive
        lower = {str(k).lower(): v for k, v in manual.items()}
        raw = lower.get(str(param_key).lower())
        return str(raw or "").strip()

    return ""


def build_parameters_from_bindings(
    param_keys: list[str],
    bindings: dict[str, str] | None,
    *,
    context: dict[str, Any] | None,
    recipient: dict[str, Any] | None = None,
    manual_params: dict[str, Any] | None = None,
    require_all: bool = True,
) -> dict[str, str]:
    """Resolve provider parameters; raise ValidationError if required values missing."""
    keys = validate_param_keys(param_keys)
    binding_map = dict(bindings or {})
    params: dict[str, str] = {}
    missing: list[str] = []

    for key in keys:
        source = binding_map.get(key) or default_source_for_param(key)
        if source not in ALLOWED_SOURCE_KEYS:
            raise ValidationError(
                {"param_bindings": f"منبع نامعتبر برای پارامتر «{key}»."}
            )
        value = resolve_bound_value(
            source,
            context=context,
            recipient=recipient,
            manual_params=manual_params,
            param_key=key,
        )
        if not str(value).strip():
            # Legacy alias fill for context-backed OTP-like keys
            from app.services.sms_templates import resolve_context_value

            value = resolve_context_value(key, context or {})
        params[key] = str(value or "").strip()
        if require_all and not params[key]:
            missing.append(key)

    if missing:
        raise ValidationError(
            {
                "parameters": (
                    "مقدار پارامترهای الزامی خالی است: " + ", ".join(missing[:12])
                )
            }
        )
    return params


def recipient_dict_from_user(user) -> dict[str, str]:
    profile = getattr(user, "profile", None)
    phone = normalize_phone(getattr(profile, "phone", "") or "")
    full = (user.get_full_name() or "").strip()
    return {
        "name": full or user.get_username() or "",
        "phone": phone,
        "username": user.get_username() or "",
        "first_name": (user.first_name or "").strip(),
        "last_name": (user.last_name or "").strip(),
    }


def catalog_param_sources() -> list[dict[str, str]]:
    return [{"key": k, "label": v} for k, v in ALLOWED_PARAM_SOURCES.items()]


def validate_client_request_id(raw: Any) -> str:
    value = str(raw or "").strip()
    if not MANUAL_REQUEST_ID_RE.match(value):
        raise ValidationError(
            {
                "client_request_id": (
                    "شناسه درخواست باید ۸ تا ۶۴ نویسه و فقط شامل حروف، عدد، _ و - باشد."
                )
            }
        )
    return value


def manual_keys_for_template(param_keys: list[str], bindings: dict[str, str] | None) -> list[str]:
    binding_map = dict(bindings or {})
    out: list[str] = []
    for key in validate_param_keys(param_keys):
        source = binding_map.get(key) or default_source_for_param(key)
        if source == "manual":
            out.append(key)
    return out


def sanitize_manual_params(
    *,
    param_keys: list[str],
    bindings: dict[str, str] | None,
    raw: Any,
    require_values: bool = True,
) -> dict[str, str]:
    """
    Accept only keys explicitly bound (or defaulted) to source ``manual``.
    Reject extras and trusted-context overrides.
    """
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ValidationError({"manual_params": "پارامترهای دستی باید آبجکت باشد."})

    allowed = set(manual_keys_for_template(param_keys, bindings))
    incoming_keys = {str(k).strip() for k in raw.keys() if str(k).strip()}
    unexpected = sorted(incoming_keys - allowed)
    if unexpected:
        raise ValidationError(
            {
                "manual_params": (
                    "کلیدهای غیرمجاز در پارامتر دستی: " + ", ".join(unexpected[:12])
                )
            }
        )

    cleaned: dict[str, str] = {}
    for key in allowed:
        if key in TRUSTED_CONTEXT_KEYS:
            raise ValidationError(
                {"manual_params": f"پارامتر «{key}» قابل تأمین دستی نیست."}
            )
        value = str(raw.get(key) or "").replace("\x00", "").strip()
        if len(value) > MANUAL_PARAM_MAX_LEN:
            raise ValidationError(
                {"manual_params": f"مقدار «{key}» بیش از حد طولانی است."}
            )
        if require_values and not value:
            raise ValidationError(
                {"manual_params": f"پارامتر دستی «{key}» الزامی است."}
            )
        cleaned[key] = value
    return cleaned


def atomic_cache_add(key: str, value: Any, timeout: int) -> bool:
    """Atomic reserve: True if this caller won the key."""
    from django.core.cache import cache

    return bool(cache.add(key, value, timeout))


def atomic_rate_increment(key: str, *, window: int, limit: int) -> int:
    """
    Increment a rate counter atomically when the backend supports incr.
    Returns the new count after this call.
    """
    from django.core.cache import cache

    if cache.add(key, 1, window):
        return 1
    try:
        return int(cache.incr(key))
    except ValueError:
        # Key expired between add and incr, or non-int value.
        cache.set(key, 1, window)
        return 1
    except Exception:
        # Backend without incr (should be rare with RedisCache); fail closed.
        raise ValidationError(
            {"detail": "محدودیت نرخ ارسال در دسترس نیست. کمی بعد دوباره تلاش کنید."}
        )
