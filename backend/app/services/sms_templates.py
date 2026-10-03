"""Admin SMS templates + Signal send helpers."""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from django.conf import settings
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from app.models import SmsProviderConfig, SmsTemplate
from app.sms.drivers.signal import SignalSmsDriver
from app.sms.signal import SignalSmsService
from app.sms.signal.exceptions import SignalSmsConfigError, SignalSmsError

logger = logging.getLogger("app.sms")

PLACEHOLDERS = [
    {"key": "name", "label": "نام"},
    {"key": "order_id", "label": "شناسه سفارش"},
    {"key": "status", "label": "وضعیت"},
    {"key": "code", "label": "کد"},
    {"key": "link", "label": "لینک"},
    {"key": "customer_name", "label": "نام مشتری"},
    {"key": "phone", "label": "شماره موبایل"},
    {"key": "order_number", "label": "شماره سفارش"},
    {"key": "amount", "label": "مبلغ"},
]

_TOKEN_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{([a-zA-Z0-9_]+)\}")

SAMPLE_BY_EVENT = {
    "login_otp": {"code": "123456", "name": "علی رضایی", "phone": "09120000000"},
    "forgot_password": {
        "name": "علی رضایی",
        "link": "https://example.com/reset-password/sample",
        "code": "sample-token",
        "phone": "09120000000",
    },
    "order_status_changed": {
        "order_id": "GS-1001",
        "status": "ارسال‌شده",
        "name": "علی رضایی",
        "phone": "09120000000",
    },
    "custom": {"name": "علی رضایی", "code": "123456", "phone": "09120000000"},
}

EVENT_TARGETS = {
    "login_otp": ("customer", "all"),
    "forgot_password": ("customer", "admin", "all"),
    "order_status_changed": ("customer", "admin", "all"),
}


def get_signal_client() -> SignalSmsService:
    """
    Build a Signal client from the Signal provider row (if any) or .env.
    Prefers an enabled Signal config, otherwise any saved Signal row, else env only.
    """
    cfg = (
        SmsProviderConfig.objects.filter(provider_type="signal")
        .order_by("-is_enabled", "sort_order", "id")
        .first()
    )
    creds = (cfg.credentials if cfg else {}) or {}
    api_key = SignalSmsDriver._resolve_api_key(creds)
    sender = SignalSmsDriver._resolve_sender(creds)
    if not api_key:
        raise SignalSmsConfigError(
            "کلید API سیگنال تنظیم نشده است. در تنظیمات سرویس پیامک یا .env مقدار دهید."
        )
    if not sender:
        raise SignalSmsConfigError(
            "شماره خط ارسال سیگنال تنظیم نشده است (SIGNAL_SMS_FROM یا فرم سرویس پیامک)."
        )
    return SignalSmsService(api_key=api_key, sender=sender)


def signal_ready() -> bool:
    try:
        get_signal_client()
        return True
    except SignalSmsConfigError:
        return False


def serialize_template(row: SmsTemplate) -> dict:
    return {
        "id": row.id,
        "key": row.key,
        "name": row.name,
        "event": row.event,
        "event_label": row.get_event_display(),
        "target_user": row.target_user,
        "target_label": row.get_target_user_display(),
        "mode": row.mode,
        "mode_label": row.get_mode_display(),
        "body_text": row.body_text,
        "pattern_id": row.pattern_id,
        "param_keys": list(row.param_keys or []),
        "sample_params": dict(row.sample_params or {}),
        "notes": row.notes,
        "is_enabled": row.is_enabled,
        "sort_order": row.sort_order,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def list_templates() -> list[dict]:
    return [serialize_template(row) for row in SmsTemplate.objects.all()[:200]]


def catalog_payload() -> dict:
    balance = None
    balance_error = None
    ready = signal_ready()
    if ready:
        try:
            balance = get_signal_client().check_balance()
        except SignalSmsError as exc:
            balance_error = str(exc)
        except Exception:
            logger.exception("Signal balance check failed")
            balance_error = "استعلام اعتبار ناموفق بود."
    return {
        "placeholders": list(PLACEHOLDERS),
        "modes": [{"key": k, "label": v} for k, v in SmsTemplate.Mode.choices],
        "events": [{"key": k, "label": v} for k, v in SmsTemplate.Event.choices],
        "targets": [{"key": k, "label": v} for k, v in SmsTemplate.Target.choices],
        "samples": SAMPLE_BY_EVENT,
        "signal_ready": ready,
        "balance": balance,
        "balance_error": balance_error,
        "docs_url": SignalSmsDriver.docs_url,
        "from_hint": str(getattr(settings, "SIGNAL_SMS_FROM", "") or ""),
    }


def _unique_key(name: str) -> str:
    base = slugify(name, allow_unicode=False) or "sms"
    base = base[:60]
    if not SmsTemplate.objects.filter(key=base).exists():
        return base
    return f"{base[:50]}-{uuid.uuid4().hex[:6]}"


def _parse_param_keys(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        parts = re.split(r"[,|\s]+", raw.strip())
        return [p.strip() for p in parts if p.strip()]
    if isinstance(raw, (list, tuple)):
        return [str(p).strip() for p in raw if str(p).strip()]
    raise ValidationError({"param_keys": "فرمت پارامترها نامعتبر است."})


def _parse_sample_params(raw: Any) -> dict:
    if raw is None or raw == "":
        return {}
    if isinstance(raw, dict):
        return {str(k).strip(): str(v) for k, v in raw.items() if str(k).strip()}
    raise ValidationError({"sample_params": "نمونه پارامتر باید آبجکت باشد."})


def _validate_mode_payload(mode: str, payload: dict) -> tuple[str, int | None, list, dict]:
    valid = {c.value for c in SmsTemplate.Mode}
    if mode not in valid:
        raise ValidationError({"mode": "نوع قالب نامعتبر است."})

    body = str(payload.get("body_text") or "").strip()
    pattern_raw = payload.get("pattern_id")
    pattern_id = None
    if pattern_raw not in (None, ""):
        try:
            pattern_id = int(str(pattern_raw).strip())
        except (TypeError, ValueError):
            raise ValidationError({"pattern_id": "شناسه الگو باید عدد باشد."})

    param_keys = _parse_param_keys(payload.get("param_keys"))
    sample_params = _parse_sample_params(payload.get("sample_params"))

    if mode == SmsTemplate.Mode.TEXT:
        if not body:
            raise ValidationError({"body_text": "متن پیامک برای قالب متنی الزامی است."})
        return body, None, param_keys, sample_params

    if not pattern_id:
        raise ValidationError({"pattern_id": "شناسه الگوی سیگنال الزامی است."})
    if not param_keys:
        raise ValidationError(
            {"param_keys": "نام پارامترهای الگو را دقیقاً مثل پنل سیگنال، با ویرگول وارد کنید."}
        )
    return body, pattern_id, param_keys, sample_params


def create_template(payload: dict) -> SmsTemplate:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")
    name = str(payload.get("name") or "").strip()
    if not name:
        raise ValidationError({"name": "نام قالب الزامی است."})
    mode = str(payload.get("mode") or SmsTemplate.Mode.TEXT).strip()
    body, pattern_id, param_keys, sample_params = _validate_mode_payload(mode, payload)
    event = _parse_choice(
        payload.get("event"), SmsTemplate.Event, "event", SmsTemplate.Event.CUSTOM
    )
    target = _parse_choice(
        payload.get("target_user"),
        SmsTemplate.Target,
        "target_user",
        SmsTemplate.Target.CUSTOMER,
    )

    row = SmsTemplate(
        key=_unique_key(name),
        name=name[:160],
        event=event,
        target_user=target,
        mode=mode,
        body_text=_clean_text(body),
        pattern_id=pattern_id,
        param_keys=param_keys,
        sample_params=sample_params,
        notes=_clean_text(payload.get("notes") or "", limit=255),
        is_enabled=bool(payload.get("is_enabled", True)),
        sort_order=SmsTemplate.objects.count(),
    )
    from django.db import transaction

    with transaction.atomic():
        _enforce_single_active(row)
        row.save()
    return row


def update_template(row: SmsTemplate, payload: dict) -> SmsTemplate:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")

    if "name" in payload and payload["name"] is not None:
        name = str(payload["name"]).strip()
        if not name:
            raise ValidationError({"name": "نام قالب الزامی است."})
        row.name = name[:160]

    if "notes" in payload and payload["notes"] is not None:
        row.notes = _clean_text(payload["notes"], limit=255)

    if "event" in payload and payload["event"] is not None:
        row.event = _parse_choice(payload["event"], SmsTemplate.Event, "event", row.event)

    if "target_user" in payload and payload["target_user"] is not None:
        row.target_user = _parse_choice(
            payload["target_user"], SmsTemplate.Target, "target_user", row.target_user
        )

    if "is_enabled" in payload and payload["is_enabled"] is not None:
        row.is_enabled = bool(payload["is_enabled"])

    mode_changing = "mode" in payload or "body_text" in payload or "pattern_id" in payload
    if mode_changing or "param_keys" in payload or "sample_params" in payload:
        mode = str(payload.get("mode") or row.mode).strip()
        merged = {
            "body_text": payload["body_text"] if "body_text" in payload else row.body_text,
            "pattern_id": payload["pattern_id"] if "pattern_id" in payload else row.pattern_id,
            "param_keys": payload["param_keys"] if "param_keys" in payload else row.param_keys,
            "sample_params": payload["sample_params"]
            if "sample_params" in payload
            else row.sample_params,
        }
        body, pattern_id, param_keys, sample_params = _validate_mode_payload(mode, merged)
        row.mode = mode
        row.body_text = body
        row.pattern_id = pattern_id
        row.param_keys = param_keys
        row.sample_params = sample_params

    from django.db import transaction

    with transaction.atomic():
        _enforce_single_active(row)
        row.save()
    return row


def delete_template(row: SmsTemplate) -> None:
    row.delete()


def render_text(template: str, context: dict[str, Any]) -> str:
    def repl(match: re.Match) -> str:
        key = match.group(1) or match.group(2)
        value = resolve_context_value(key, context)
        if value != "":
            return _clean_text(value, limit=300)
        if key in context and context[key] is not None:
            return _clean_text(context[key], limit=300)
        return match.group(0)

    return _TOKEN_RE.sub(repl, template or "")


def _clean_text(value: Any, limit: int = 700) -> str:
    text = str(value or "").replace("\x00", "")
    return text[:limit]


def _norm_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(key or "").lower())


# Signal pattern param names often differ from our context keys (otp vs code).
_PARAM_ALIASES: dict[str, set[str]] = {
    "code": {
        "code",
        "otp",
        "token",
        "pin",
        "password",
        "verificationcode",
        "verifycode",
        "authcode",
        "passcode",
        "smscode",
    },
    "name": {
        "name",
        "customername",
        "fullname",
        "username",
        "fullname",
        "fullname",
    },
    "phone": {"phone", "mobile", "number", "msisdn", "mobilenumber"},
    "order_id": {"orderid", "ordernumber", "order", "ordercode"},
    "status": {"status", "orderstatus", "state"},
    "link": {"link", "url", "resetlink", "reseturl"},
    "amount": {"amount", "price", "total", "payable"},
    "previous_status": {"previousstatus", "oldstatus"},
    "customer_name": {"customername", "name", "fullname", "fullname"},
    "order_number": {"ordernumber", "orderid", "order"},
}


def resolve_context_value(param_key: str, context: dict[str, Any] | None) -> str:
    """Map a template/pattern param name onto the best value from context."""
    data = context if isinstance(context, dict) else {}
    key = str(param_key or "").strip()
    if not key:
        return ""

    raw = data.get(key)
    if raw is not None and str(raw).strip() != "":
        return str(raw)

    lower_map = {str(k).lower(): v for k, v in data.items()}
    raw = lower_map.get(key.lower())
    if raw is not None and str(raw).strip() != "":
        return str(raw)

    wanted = _norm_key(key)
    for semantic, aliases in _PARAM_ALIASES.items():
        bucket = {_norm_key(semantic), *aliases}
        if wanted not in bucket:
            continue
        for candidate in (semantic, *sorted(aliases)):
            for ck, cv in data.items():
                if _norm_key(ck) == _norm_key(candidate) and str(cv or "").strip():
                    return str(cv)
            cv = data.get(semantic)
            if cv is not None and str(cv).strip():
                return str(cv)
    return ""


def build_pattern_parameters(
    param_keys: list[str] | tuple[str, ...] | None,
    context: dict[str, Any] | None,
    *,
    event: str = "",
) -> dict[str, str]:
    """
    Build Signal pattern parameters from the admin-configured key names.
    Fills values from context using exact keys and common aliases (otp←code).
    """
    keys = [str(k).strip() for k in (param_keys or []) if str(k).strip()]
    data = dict(context or {})
    params = {key: resolve_context_value(key, data) for key in keys}

    code = str(data.get("code") or "").strip()
    otp_events = {
        SmsTemplate.Event.LOGIN_OTP,
        SmsTemplate.Event.FORGOT_PASSWORD,
        SmsTemplate.Event.CUSTOM,
        "login_otp",
        "forgot_password",
        "custom",
    }
    if code and event in otp_events:
        empties = [k for k, v in params.items() if not str(v).strip()]
        code_aliases = _PARAM_ALIASES["code"]
        for key in empties:
            if _norm_key(key) in code_aliases or len(keys) == 1:
                params[key] = code
        if empties and not any(str(v).strip() for v in params.values()):
            params[empties[0]] = code

    return params


def sample_context(event: str) -> dict[str, str]:
    base = dict(SAMPLE_BY_EVENT.get(event) or SAMPLE_BY_EVENT["custom"])
    return {k: str(v) for k, v in base.items()}


def preview_template(row: SmsTemplate, params: dict | None = None) -> dict:
    merged = {**sample_context(row.event), **dict(row.sample_params or {}), **(params or {})}
    if row.mode == SmsTemplate.Mode.PATTERN:
        keys = list(row.param_keys or []) or list(merged.keys())
        pattern_params = build_pattern_parameters(keys, merged, event=row.event)
        rendered = " ".join(f"{key}={pattern_params.get(key, '')}" for key in keys)
    else:
        rendered = render_text(row.body_text, merged)
    return {"text": rendered, "context": {k: str(v) for k, v in merged.items()}}


def _parse_choice(raw, choices, field: str, default: str) -> str:
    value = str(raw or default).strip()
    valid = {c.value for c in choices}
    if value not in valid:
        raise ValidationError({field: "مقدار نامعتبر است."})
    return value


def _enforce_single_active(row: SmsTemplate) -> None:
    if not row.is_enabled or row.event == SmsTemplate.Event.CUSTOM:
        return
    (
        SmsTemplate.objects.filter(
            event=row.event,
            target_user=row.target_user,
            is_enabled=True,
        )
        .exclude(pk=row.pk)
        .update(is_enabled=False)
    )


def _normalize_phones(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        parts = re.split(r"[,;\s]+", raw.strip())
        return [p.strip() for p in parts if p.strip()]
    if isinstance(raw, (list, tuple)):
        return [str(p).strip() for p in raw if str(p).strip()]
    raise ValidationError({"phones": "فرمت شماره‌ها نامعتبر است."})


def send_quick(
    *,
    phones: Any,
    message: str | None = None,
    pattern_id: int | str | None = None,
    parameters: dict | None = None,
) -> dict:
    numbers = _normalize_phones(phones)
    if not numbers:
        raise ValidationError({"phones": "حداقل یک شماره موبایل وارد کنید."})

    client = get_signal_client()
    try:
        if pattern_id not in (None, ""):
            if len(numbers) != 1:
                raise ValidationError(
                    {"phones": "ارسال با الگو فقط برای یک شماره در هر درخواست پشتیبانی می‌شود."}
                )
            data = client.send_pattern(
                numbers[0],
                pattern_id,
                parameters or {},
            )
            return {"mode": "pattern", "result": data}

        text = str(message or "").strip()
        if not text:
            raise ValidationError({"message": "متن پیامک الزامی است."})
        if len(numbers) == 1:
            data = client.send_sms(numbers[0], text)
        else:
            data = client.send_bulk(numbers, text)
        return {"mode": "text", "result": data}
    except SignalSmsError:
        raise
    except ValidationError:
        raise
    except Exception as exc:
        logger.exception("Quick SMS send failed")
        raise ValidationError({"detail": str(exc) or "ارسال پیامک ناموفق بود."}) from exc


def send_template_test(
    row: SmsTemplate,
    phone: str,
    *,
    params: dict | None = None,
) -> dict:
    phone = str(phone or "").strip()
    if not phone:
        raise ValidationError({"phone": "شماره موبایل الزامی است."})
    if not row.is_enabled:
        raise ValidationError({"detail": "این قالب غیرفعال است."})

    client = get_signal_client()
    merged = {**(row.sample_params or {}), **(params or {})}
    merged.setdefault("phone", phone)

    try:
        if row.mode == SmsTemplate.Mode.PATTERN:
            if not row.pattern_id:
                raise ValidationError({"pattern_id": "شناسه الگو برای این قالب تنظیم نشده است."})
            keys = [str(k).strip() for k in (row.param_keys or []) if str(k).strip()]
            if not keys:
                raise ValidationError(
                    {"param_keys": "نام پارامترهای الگو را با ویرگول وارد کنید."}
                )
            pattern_params = build_pattern_parameters(keys, merged, event=row.event)
            data = client.send_pattern(phone, row.pattern_id, pattern_params)
            return {"mode": "pattern", "result": data, "parameters": pattern_params}

        text = render_text(row.body_text, merged)
        if not text.strip():
            raise ValidationError({"body_text": "متن قالب خالی است."})
        data = client.send_sms(phone, text)
        return {"mode": "text", "result": data}
    except SignalSmsError:
        raise
    except ValidationError:
        raise
    except Exception as exc:
        logger.exception("Template SMS test failed")
        raise ValidationError({"detail": str(exc) or "ارسال آزمایشی ناموفق بود."}) from exc


def fetch_balance() -> dict:
    client = get_signal_client()
    return client.check_balance()
