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
    {"key": "customer_name", "label": "نام مشتری"},
    {"key": "phone", "label": "شماره موبایل"},
    {"key": "order_number", "label": "شماره سفارش"},
    {"key": "code", "label": "کد تأیید"},
    {"key": "amount", "label": "مبلغ"},
    {"key": "status", "label": "وضعیت"},
]

_TOKEN_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


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
        # allow empty but warn via optional — still OK for patterns with no vars
        pass
    return body, pattern_id, param_keys, sample_params


def create_template(payload: dict) -> SmsTemplate:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")
    name = str(payload.get("name") or "").strip()
    if not name:
        raise ValidationError({"name": "نام قالب الزامی است."})
    mode = str(payload.get("mode") or SmsTemplate.Mode.TEXT).strip()
    body, pattern_id, param_keys, sample_params = _validate_mode_payload(mode, payload)

    row = SmsTemplate(
        key=_unique_key(name),
        name=name[:160],
        mode=mode,
        body_text=body,
        pattern_id=pattern_id,
        param_keys=param_keys,
        sample_params=sample_params,
        notes=str(payload.get("notes") or "").strip()[:255],
        is_enabled=bool(payload.get("is_enabled", True)),
        sort_order=SmsTemplate.objects.count(),
    )
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
        row.notes = str(payload["notes"]).strip()[:255]

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

    row.save()
    return row


def delete_template(row: SmsTemplate) -> None:
    row.delete()


def render_text(template: str, context: dict[str, Any]) -> str:
    def repl(match: re.Match) -> str:
        key = match.group(1)
        if key in context and context[key] is not None:
            return str(context[key])
        return match.group(0)

    return _TOKEN_RE.sub(repl, template or "")


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
            # Ensure declared keys exist (empty string if missing)
            pattern_params = {}
            keys = list(row.param_keys or []) or list(merged.keys())
            for key in keys:
                pattern_params[key] = str(merged.get(key, ""))
            data = client.send_pattern(phone, row.pattern_id, pattern_params)
            return {"mode": "pattern", "result": data}

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
