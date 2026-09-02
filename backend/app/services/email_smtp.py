from __future__ import annotations

from copy import deepcopy

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError

from app.models import SiteSetting
from app.payment.utils import is_masked_value, mask_secret

SMTP_KEY = "email_smtp"

DEFAULT_SMTP = {
    "enabled": False,
    "host": "",
    "port": 587,
    "username": "",
    "password": "",
    "use_tls": True,
    "use_ssl": False,
    "from_email": "",
    "from_name": "",
    "timeout": 20,
}


def _optional_text(value) -> str:
    return str(value or "").strip()


def _required_email(value, field: str) -> str:
    email = _optional_text(value)
    if not email:
        raise ValidationError({field: "ایمیل الزامی است."})
    try:
        validate_email(email)
    except DjangoValidationError:
        raise ValidationError({field: "ایمیل نامعتبر است."})
    return email


def _normalize(raw: dict | None) -> dict:
    data = deepcopy(DEFAULT_SMTP)
    if not isinstance(raw, dict):
        return data
    data["enabled"] = bool(raw.get("enabled"))
    data["host"] = _optional_text(raw.get("host"))
    try:
        port = int(raw.get("port") or 587)
    except (TypeError, ValueError):
        port = 587
    data["port"] = port if 1 <= port <= 65535 else 587
    data["username"] = _optional_text(raw.get("username"))
    data["password"] = str(raw.get("password") or "")
    data["use_ssl"] = bool(raw.get("use_ssl"))
    data["use_tls"] = False if data["use_ssl"] else bool(raw.get("use_tls", True))
    data["from_email"] = _optional_text(raw.get("from_email"))
    data["from_name"] = _optional_text(raw.get("from_name"))
    try:
        timeout = int(raw.get("timeout") or 20)
    except (TypeError, ValueError):
        timeout = 20
    data["timeout"] = timeout if 5 <= timeout <= 120 else 20
    return data


def get_email_smtp() -> dict:
    row = SiteSetting.objects.filter(key=SMTP_KEY).first()
    return _normalize(row.value if row else None)


def smtp_is_ready(cfg: dict | None = None) -> bool:
    data = cfg or get_email_smtp()
    return bool(data["host"] and data["from_email"])


def admin_email_smtp() -> dict:
    cfg = get_email_smtp()
    out = dict(cfg)
    if out["password"]:
        out["password"] = mask_secret(out["password"])
    out["is_ready"] = smtp_is_ready(cfg)
    return out


def save_email_smtp(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")

    current = get_email_smtp()
    password = payload.get("password")
    if password is None or is_masked_value(password) or str(password).strip() == "":
        password = current["password"]
    else:
        password = str(password)

    from_email = _optional_text(payload.get("from_email"))
    if from_email:
        from_email = _required_email(from_email, "from_email")
    value = _normalize(
        {
            **payload,
            "from_email": from_email,
            "password": password,
        }
    )
    if value["enabled"] and not smtp_is_ready(value):
        raise ValidationError(
            {"enabled": "برای فعال‌سازی، میزبان SMTP و ایمیل فرستنده الزامی است."}
        )
    SiteSetting.objects.update_or_create(key=SMTP_KEY, defaults={"value": value})
    return get_email_smtp()


def ensure_email_smtp_defaults() -> None:
    if not SiteSetting.objects.filter(key=SMTP_KEY).exists():
        SiteSetting.objects.create(key=SMTP_KEY, value=deepcopy(DEFAULT_SMTP))


def _from_header(cfg: dict) -> str:
    email = cfg["from_email"] or getattr(settings, "DEFAULT_FROM_EMAIL", "")
    name = cfg["from_name"]
    if name and email:
        return f"{name} <{email}>"
    return email


def smtp_connection(cfg: dict | None = None):
    data = cfg or get_email_smtp()
    return get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host=data["host"],
        port=data["port"],
        username=data["username"] or None,
        password=data["password"] or None,
        use_tls=data["use_tls"],
        use_ssl=data["use_ssl"],
        timeout=data["timeout"],
        fail_silently=False,
    )


def send_html_email(*, to_email: str, subject: str, html_body: str) -> None:
    cfg = get_email_smtp()
    if not cfg["enabled"]:
        raise ValidationError("ارسال ایمیل در تنظیمات خاموش است.")
    if not smtp_is_ready(cfg):
        raise ValidationError("تنظیمات SMTP ناقص است.")
    to = _required_email(to_email, "to")

    text = (
        html_body.replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
    )
    msg = EmailMultiAlternatives(
        subject=subject.strip() or "پیام فروشگاه",
        body=text,
        from_email=_from_header(cfg),
        to=[to],
        connection=smtp_connection(cfg),
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send()


def send_test_email(to_email: str) -> None:
    send_html_email(
        to_email=to_email,
        subject="ایمیل آزمایشی فروشگاه",
        html_body=(
            '<div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;'
            'padding:24px;color:#1f2937">'
            "<p>اگر این پیام را می‌بینید، تنظیمات SMTP درست کار می‌کند.</p>"
            "</div>"
        ),
    )
