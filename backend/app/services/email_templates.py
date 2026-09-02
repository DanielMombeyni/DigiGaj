from __future__ import annotations

import uuid

from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from app.models import EmailTemplate, Order
from app.services.email_defaults import BUILTIN_TEMPLATES, PLACEHOLDERS


def event_catalog() -> list[dict]:
    statuses = [{"key": value, "label": label} for value, label in Order.Status.choices]
    items = []
    for value, label in EmailTemplate.Event.choices:
        items.append(
            {
                "key": value,
                "label": label,
                "has_status_filter": value == EmailTemplate.Event.ORDER_STATUS_CHANGED,
                "statuses": statuses
                if value == EmailTemplate.Event.ORDER_STATUS_CHANGED
                else [],
            }
        )
    return items


def serialize_template(row: EmailTemplate) -> dict:
    return {
        "id": row.id,
        "key": row.key,
        "name": row.name,
        "event": row.event,
        "event_label": row.get_event_display(),
        "trigger_status": row.trigger_status,
        "subject": row.subject,
        "body_html": row.body_html,
        "is_enabled": row.is_enabled,
        "is_builtin": row.is_builtin,
        "sort_order": row.sort_order,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def ensure_builtin_templates() -> None:
    existing = set(
        EmailTemplate.objects.filter(is_builtin=True).values_list("key", flat=True)
    )
    to_create = []
    for item in BUILTIN_TEMPLATES:
        if item["key"] in existing:
            continue
        to_create.append(
            EmailTemplate(
                key=item["key"],
                name=item["name"],
                event=item["event"],
                subject=item["subject"],
                body_html=item["body_html"],
                is_enabled=True,
                is_builtin=True,
                sort_order=item["sort_order"],
            )
        )
    if to_create:
        EmailTemplate.objects.bulk_create(to_create)


def list_templates() -> list[dict]:
    ensure_builtin_templates()
    return [
        serialize_template(row)
        for row in EmailTemplate.objects.all()[:200]
    ]


def catalog_payload() -> dict:
    ensure_builtin_templates()
    return {
        "events": event_catalog(),
        "placeholders": list(PLACEHOLDERS),
        "smtp_ready": _smtp_ready(),
    }


def _smtp_ready() -> bool:
    from app.services.email_smtp import get_email_smtp, smtp_is_ready

    cfg = get_email_smtp()
    return bool(cfg["enabled"] and smtp_is_ready(cfg))


def _unique_key(name: str) -> str:
    base = slugify(name, allow_unicode=False) or "email"
    base = base[:60]
    if not EmailTemplate.objects.filter(key=base).exists():
        return base
    return f"{base[:50]}-{uuid.uuid4().hex[:6]}"


def _validate_event(event: str) -> str:
    valid = {choice.value for choice in EmailTemplate.Event}
    if event not in valid:
        raise ValidationError({"event": "نوع ایمیل نامعتبر است."})
    return event


def _validate_status(event: str, status: str) -> str:
    status = str(status or "").strip()
    if event != EmailTemplate.Event.ORDER_STATUS_CHANGED:
        return ""
    if not status:
        return ""
    valid = {choice.value for choice in Order.Status}
    if status not in valid:
        raise ValidationError({"trigger_status": "وضعیت سفارش نامعتبر است."})
    return status


def create_template(payload: dict) -> EmailTemplate:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")
    name = str(payload.get("name") or "").strip()
    if not name:
        raise ValidationError({"name": "نام قالب الزامی است."})
    event = _validate_event(str(payload.get("event") or "").strip())
    subject = str(payload.get("subject") or "").strip()
    body = str(payload.get("body_html") or "").strip()
    if not subject:
        raise ValidationError({"subject": "موضوع ایمیل الزامی است."})
    if not body:
        raise ValidationError({"body_html": "متن ایمیل الزامی است."})

    row = EmailTemplate(
        key=_unique_key(name),
        name=name[:160],
        event=event,
        trigger_status=_validate_status(event, payload.get("trigger_status")),
        subject=subject[:255],
        body_html=body,
        is_enabled=bool(payload.get("is_enabled", True)),
        is_builtin=False,
        sort_order=EmailTemplate.objects.count(),
    )
    row.save()
    return row


def update_template(row: EmailTemplate, payload: dict) -> EmailTemplate:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")
    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": "نام قالب الزامی است."})
        row.name = name[:160]
    if "subject" in payload:
        subject = str(payload.get("subject") or "").strip()
        if not subject:
            raise ValidationError({"subject": "موضوع ایمیل الزامی است."})
        row.subject = subject[:255]
    if "body_html" in payload:
        body = str(payload.get("body_html") or "").strip()
        if not body:
            raise ValidationError({"body_html": "متن ایمیل الزامی است."})
        row.body_html = body
    if "is_enabled" in payload:
        row.is_enabled = bool(payload.get("is_enabled"))
    if not row.is_builtin:
        if "event" in payload and payload.get("event") is not None:
            row.event = _validate_event(str(payload.get("event") or "").strip())
        if "trigger_status" in payload or "event" in payload:
            row.trigger_status = _validate_status(row.event, payload.get("trigger_status"))
    elif "trigger_status" in payload:
        row.trigger_status = _validate_status(row.event, payload.get("trigger_status"))
    row.save()
    return row


def delete_template(row: EmailTemplate) -> None:
    if row.is_builtin:
        raise ValidationError("قالب‌های پیش‌فرض را نمی‌توان حذف کرد؛ غیرفعال کنید.")
    row.delete()


def matching_templates(event: str, *, status: str = "") -> list[EmailTemplate]:
    qs = EmailTemplate.objects.filter(event=event, is_enabled=True)
    if event == EmailTemplate.Event.ORDER_STATUS_CHANGED:
        if status:
            qs = qs.filter(trigger_status__in=["", status])
        else:
            qs = qs.filter(trigger_status="")
    return list(qs[:50])
