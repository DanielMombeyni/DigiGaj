"""Send event SMS through the active Signal template. Failures never raise to callers."""

from __future__ import annotations

import logging

from django.db import transaction

from app.models import Order, SmsLog, SmsTemplate
from app.services.sms_templates import get_signal_client, render_text, signal_ready
from app.sms.signal.exceptions import SignalSmsError

logger = logging.getLogger("app.sms")


def _log(phone: str, event: str, ok: bool, error: str = "", template: SmsTemplate | None = None) -> None:
    try:
        SmsLog.objects.create(
            phone=(phone or "")[:20],
            event=(event or "")[:40],
            status=SmsLog.Status.SENT if ok else SmsLog.Status.FAILED,
            error=(error or "")[:500],
            template=template,
        )
    except Exception:
        logger.exception("sms log write failed")


def pick_template(event: str, target: str) -> SmsTemplate | None:
    row = (
        SmsTemplate.objects.filter(event=event, target_user=target, is_enabled=True)
        .order_by("sort_order", "id")
        .first()
    )
    if row or target == SmsTemplate.Target.ALL:
        return row
    return (
        SmsTemplate.objects.filter(
            event=event,
            target_user=SmsTemplate.Target.ALL,
            is_enabled=True,
        )
        .order_by("sort_order", "id")
        .first()
    )


def _deliver(phone: str, template: SmsTemplate, context: dict) -> tuple[bool, str]:
    phone = str(phone or "").strip()
    if not phone:
        return False, "شماره مقصد خالی است."
    if not signal_ready():
        return False, "سرویس سیگنال آماده نیست."
    try:
        client = get_signal_client()
        if template.mode == SmsTemplate.Mode.PATTERN:
            keys = list(template.param_keys or [])
            params = {key: str(context.get(key, "")) for key in keys}
            client.send_pattern(phone, template.pattern_id, params)
        else:
            text = render_text(template.body_text, context).strip()
            if not text:
                return False, "متن قالب خالی است."
            client.send_sms(phone, text)
        return True, ""
    except SignalSmsError as exc:
        return False, str(exc)
    except Exception:
        logger.exception("sms deliver failed event=%s", template.event)
        return False, "ارسال پیامک ناموفق بود."


def send_password_reset_otp(phone: str, code: str, name: str = "") -> tuple[bool, str | None]:
    """Send the forgot-password template. The numeric code is always in the text."""
    context = {
        "code": code,
        "name": name or "کاربر",
        "phone": phone,
        "link": "",
    }
    template = pick_template(SmsTemplate.Event.FORGOT_PASSWORD, SmsTemplate.Target.CUSTOMER)
    if template and signal_ready() and template.mode == SmsTemplate.Mode.TEXT:
        rendered = render_text(template.body_text, context).strip()
        if code not in rendered:
            rendered = f"{rendered}\nکد بازیابی: {code}".strip() if rendered else f"کد بازیابی رمز: {code}"
        try:
            get_signal_client().send_sms(phone, rendered)
            _log(phone, SmsTemplate.Event.FORGOT_PASSWORD, True, "", template)
            return True, None
        except SignalSmsError as exc:
            _log(phone, SmsTemplate.Event.FORGOT_PASSWORD, False, str(exc), template)
            return False, str(exc)
        except Exception:
            logger.exception("password reset sms failed")
            _log(phone, SmsTemplate.Event.FORGOT_PASSWORD, False, "ارسال پیامک ناموفق بود.", template)
            return False, "ارسال پیامک ناموفق بود."

    if template and signal_ready():
        ok, err = _deliver(phone, template, context)
        _log(phone, SmsTemplate.Event.FORGOT_PASSWORD, ok, err, template)
        return ok, err or None

    from app.services.sms_service import SmsProviderService

    ok, err = SmsProviderService.send_otp(phone, code)
    if not ok:
        _log(phone, SmsTemplate.Event.FORGOT_PASSWORD, False, err or "", template)
    return ok, err


def send_login_otp(phone: str, code: str) -> tuple[bool, str | None]:
    """
    Prefer the enabled login_otp template (customer, else all).
    If Signal is not ready, keep the existing provider OTP path.
    """
    context = {"code": code, "name": "", "phone": phone}
    template = pick_template(SmsTemplate.Event.LOGIN_OTP, SmsTemplate.Target.CUSTOMER)
    if template and signal_ready():
        ok, err = _deliver(phone, template, context)
        _log(phone, SmsTemplate.Event.LOGIN_OTP, ok, err, template)
        return ok, err or None

    from app.services.sms_service import SmsProviderService

    ok, err = SmsProviderService.send_otp(phone, code)
    if not ok:
        _log(phone, SmsTemplate.Event.LOGIN_OTP, False, err or "", template)
    return ok, err


def _admin_phone() -> str:
    from app.services.store_config import get_storefront_config

    return str(get_storefront_config().get("company_phone") or "").strip()


def _phones_for(template: SmsTemplate, customer_phone: str) -> list[str]:
    phones: list[str] = []
    if template.target_user in {SmsTemplate.Target.CUSTOMER, SmsTemplate.Target.ALL}:
        if customer_phone:
            phones.append(customer_phone)
    if template.target_user in {SmsTemplate.Target.ADMIN, SmsTemplate.Target.ALL}:
        admin = _admin_phone()
        if admin and admin not in phones:
            phones.append(admin)
    return phones


def dispatch_sms_event(event: str, context: dict, customer_phone: str = "") -> int:
    sent = 0
    try:
        templates = list(
            SmsTemplate.objects.filter(event=event, is_enabled=True).order_by(
                "sort_order", "id"
            )[:10]
        )
    except Exception:
        logger.exception("sms template lookup failed")
        return 0
    for template in templates:
        for phone in _phones_for(template, customer_phone):
            try:
                ok, err = _deliver(phone, template, context)
            except Exception:
                logger.exception("sms event deliver crashed")
                ok, err = False, "ارسال پیامک ناموفق بود."
            _log(phone, event, ok, err, template)
            if ok:
                sent += 1
    return sent


def queue_sms_event(event: str, context: dict, customer_phone: str = "") -> None:
    payload = {k: str(v) if v is not None else "" for k, v in (context or {}).items()}
    phone = str(customer_phone or "")

    def _enqueue():
        from app.tasks.sms import send_sms_event

        try:
            send_sms_event.delay(event, payload, phone)
        except Exception:
            logger.exception("sms celery enqueue failed")
            try:
                dispatch_sms_event(event, payload, phone)
            except Exception:
                logger.exception("sms sync send failed")

    try:
        transaction.on_commit(_enqueue)
    except Exception:
        logger.exception("sms schedule failed")


def queue_forgot_password_sms(user) -> None:
    profile = getattr(user, "profile", None)
    phone = (getattr(profile, "phone", "") or "").strip()
    if not phone:
        return
    from django.conf import settings
    from django.contrib.auth.tokens import default_token_generator
    from allauth.account.utils import user_pk_to_url_str

    token = default_token_generator.make_token(user)
    uid = user_pk_to_url_str(user)
    base = str(getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    link = f"{base}/reset-password/{uid}/{token}"
    name = (user.get_full_name() or "").strip() or user.get_username()
    queue_sms_event(
        SmsTemplate.Event.FORGOT_PASSWORD,
        {"name": name, "link": link, "code": token, "phone": phone},
        phone,
    )


def queue_order_status_sms(order: Order, previous_status: str = "") -> None:
    name = order.full_name or ""
    context = {
        "order_id": order.order_number,
        "status": order.get_status_display(),
        "name": name,
        "order_number": order.order_number,
        "customer_name": name,
        "phone": order.phone or "",
        "previous_status": previous_status or "",
    }
    queue_sms_event(SmsTemplate.Event.ORDER_STATUS_CHANGED, context, order.phone or "")
