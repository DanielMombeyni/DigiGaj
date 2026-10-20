"""Send event SMS through the active Signal template. Failures never raise to callers."""

from __future__ import annotations

import logging

from django.db import IntegrityError, transaction
from rest_framework.exceptions import ValidationError

from app.models import Order, SmsDispatchClaim, SmsLog, SmsTemplate
from app.services.sms_params import (
    build_parameters_from_bindings,
    redact_params,
)
from app.services.sms_templates import (
    get_signal_client,
    render_text,
    signal_ready,
)
from app.sms.signal.exceptions import SignalSmsError

logger = logging.getLogger("app.sms")

# Structured fallback reasons — never include OTP/token values.
FALLBACK_NO_TEMPLATE = "no_enabled_template"
FALLBACK_SIGNAL_NOT_READY = "signal_not_ready"


def _log(
    phone: str,
    event: str,
    ok: bool,
    error: str = "",
    template: SmsTemplate | None = None,
    *,
    actor=None,
    batch_id: str = "",
    fallback_reason: str = "",
    recipient_user=None,
) -> None:
    try:
        SmsLog.objects.create(
            phone=(phone or "")[:20],
            event=(event or "")[:40],
            status=SmsLog.Status.SENT if ok else SmsLog.Status.FAILED,
            error=(error or "")[:500],
            template=template,
            actor=actor,
            batch_id=(batch_id or "")[:64],
            fallback_reason=(fallback_reason or "")[:80],
            recipient_user=recipient_user,
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


def _event_claim_key(
    event: str, phone: str, context: dict, *, template_id: int | None = None
) -> str | None:
    """Stable logical identity for order-scoped SMS (durable claim table)."""
    order_no = str(
        (context or {}).get("order_number")
        or (context or {}).get("order_id")
        or ""
    ).strip()
    if not order_no:
        return None
    status_code = str(
        (context or {}).get("status_code")
        or (context or {}).get("status")
        or ""
    ).strip()[:40]
    phone_part = str(phone or "").strip()[-20:]
    tpl = str(template_id or 0)
    # Keep under 191 chars for unique index.
    return f"{event}|{tpl}|{order_no}|{status_code}|{phone_part}"[:191]


def _claim_send_slot(claim_key: str, event: str, phone: str) -> SmsDispatchClaim | None:
    """
    Atomically reserve a send slot.
    Returns a claim row to proceed, or None to skip (already sent / in flight).
    Failed claims may be retried.
    """
    try:
        return SmsDispatchClaim.objects.create(
            claim_key=claim_key,
            event=(event or "")[:40],
            phone=(phone or "")[:20],
            status=SmsDispatchClaim.Status.PENDING,
        )
    except IntegrityError:
        existing = SmsDispatchClaim.objects.filter(claim_key=claim_key).first()
        if not existing:
            return None
        if existing.status in {
            SmsDispatchClaim.Status.SENT,
            SmsDispatchClaim.Status.PENDING,
        }:
            return None
        # Previous definite failure — reclaim for retry.
        updated = SmsDispatchClaim.objects.filter(
            pk=existing.pk, status=SmsDispatchClaim.Status.FAILED
        ).update(status=SmsDispatchClaim.Status.PENDING, error="")
        if not updated:
            return None
        existing.refresh_from_db()
        return existing


def _finish_claim(claim: SmsDispatchClaim | None, *, ok: bool, error: str = "") -> None:
    if not claim:
        return
    try:
        claim.status = (
            SmsDispatchClaim.Status.SENT if ok else SmsDispatchClaim.Status.FAILED
        )
        claim.error = (error or "")[:500]
        claim.save(update_fields=["status", "error", "updated_at"])
    except Exception:
        logger.exception("sms claim update failed key=%s", claim.claim_key)


def _deliver(phone: str, template: SmsTemplate, context: dict) -> tuple[bool, str]:
    phone = str(phone or "").strip()
    if not phone:
        return False, "شماره مقصد خالی است."
    if not template.is_enabled:
        return False, "قالب غیرفعال است."
    if not signal_ready():
        return False, "سرویس سیگنال آماده نیست."
    try:
        client = get_signal_client()
        if template.mode == SmsTemplate.Mode.PATTERN:
            keys = [str(k).strip() for k in (template.param_keys or []) if str(k).strip()]
            if not keys:
                return False, "برای قالب الگو، نام پارامترها را در پنل پیامک وارد کنید."
            if not template.pattern_id:
                return False, "شناسه الگوی سیگنال تنظیم نشده است."
            try:
                params = build_parameters_from_bindings(
                    keys,
                    template.param_bindings or {},
                    context=context,
                    require_all=True,
                )
            except ValidationError as exc:
                detail = getattr(exc, "detail", None)
                if isinstance(detail, dict):
                    msg = next(iter(detail.values()), "پارامتر نامعتبر است")
                    if isinstance(msg, (list, tuple)):
                        msg = msg[0] if msg else "پارامتر نامعتبر است"
                    return False, str(msg)
                return False, "پارامترهای قالب ناقص است."
            if template.event in {
                SmsTemplate.Event.LOGIN_OTP,
                SmsTemplate.Event.SIGNUP_OTP,
                SmsTemplate.Event.FORGOT_PASSWORD,
            } and not any(str(v).strip() for v in params.values()):
                return False, "مقدار کد برای پارامترهای الگو خالی است."
            logger.info(
                "sms pattern send event=%s template=%s params=%s",
                template.event,
                template.id,
                redact_params(params),
            )
            client.send_pattern(phone, template.pattern_id, params)
        else:
            text = render_text(template.body_text, context).strip()
            code = str((context or {}).get("code") or "").strip()
            if (
                code
                and template.event
                in {
                    SmsTemplate.Event.LOGIN_OTP,
                    SmsTemplate.Event.SIGNUP_OTP,
                    SmsTemplate.Event.FORGOT_PASSWORD,
                }
                and code not in text
            ):
                text = f"{text}\nکد: {code}".strip() if text else f"کد تأیید: {code}"
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
        "otp": code,
        "token": code,
        "name": name or "کاربر",
        "phone": phone,
        "link": "",
    }
    template = pick_template(SmsTemplate.Event.FORGOT_PASSWORD, SmsTemplate.Target.CUSTOMER)
    if template and signal_ready():
        ok, err = _deliver(phone, template, context)
        _log(phone, SmsTemplate.Event.FORGOT_PASSWORD, ok, err, template)
        return ok, err or None

    reason = FALLBACK_NO_TEMPLATE if not template else FALLBACK_SIGNAL_NOT_READY

    from app.services.sms_service import SmsProviderService

    ok, err = SmsProviderService.send_otp(phone, code)
    _log(
        phone,
        SmsTemplate.Event.FORGOT_PASSWORD,
        ok,
        err or "",
        template,
        fallback_reason=reason,
    )
    return ok, err


def _send_otp_event(event: str, phone: str, code: str, name: str = "") -> tuple[bool, str | None]:
    context = {
        "code": code,
        "otp": code,
        "token": code,
        "name": name or "",
        "phone": phone,
    }
    template = pick_template(event, SmsTemplate.Target.CUSTOMER)
    if template and signal_ready():
        ok, err = _deliver(phone, template, context)
        _log(phone, event, ok, err, template)
        return ok, err or None

    reason = FALLBACK_NO_TEMPLATE if not template else FALLBACK_SIGNAL_NOT_READY

    from app.services.sms_service import SmsProviderService

    ok, err = SmsProviderService.send_otp(phone, code)
    _log(phone, event, ok, err or "", template, fallback_reason=reason)
    return ok, err


def send_login_otp(phone: str, code: str, name: str = "") -> tuple[bool, str | None]:
    """Prefer the enabled login_otp template; fill pattern params from code."""
    return _send_otp_event(SmsTemplate.Event.LOGIN_OTP, phone, code, name=name)


def send_signup_otp(phone: str, code: str, name: str = "") -> tuple[bool, str | None]:
    """Prefer the enabled signup_otp template for registration verification."""
    return _send_otp_event(SmsTemplate.Event.SIGNUP_OTP, phone, code, name=name)


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
    """
    Send enabled templates for an event.

    Order-scoped events use durable SmsDispatchClaim rows for at-most-once
    *attempts after a successful provider ack*. Provider-side ambiguity
    (e.g. timeout after accept) cannot be made exactly-once without provider
    idempotency keys — we document that limit and prefer not to auto-retry
    PENDING claims held by another worker.
    """
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
            claim_key = _event_claim_key(
                event, phone, context or {}, template_id=template.id
            )
            claim = None
            if claim_key:
                claim = _claim_send_slot(claim_key, event, phone)
                if claim is None:
                    logger.info(
                        "sms skip duplicate/in-flight event=%s phone=%s",
                        event,
                        phone[-4:],
                    )
                    continue
            try:
                ok, err = _deliver(phone, template, context)
            except Exception:
                logger.exception("sms event deliver crashed")
                ok, err = False, "ارسال پیامک ناموفق بود."
            _log(phone, event, ok, err, template)
            _finish_claim(claim, ok=ok, error=err)
            if ok:
                sent += 1
    return sent


def queue_sms_event(event: str, context: dict, customer_phone: str = "") -> None:
    payload = {k: str(v) if v is not None else "" for k, v in (context or {}).items()}
    # Never put raw secrets into celery kwargs beyond what's needed; strip long tokens in link-only events is OK
    # but OTP codes must remain for OTP events when queued (forgot link path uses token in context).
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


def _order_context(order: Order, previous_status: str = "") -> dict:
    name = order.full_name or ""
    order_no = order.order_number or ""
    status = order.get_status_display()
    return {
        "order_id": order_no,
        "order_number": order_no,
        "orderId": order_no,
        "status": status,
        "order_status": status,
        "status_code": order.status,
        "name": name,
        "customer_name": name,
        "fullname": name,
        "phone": order.phone or "",
        "mobile": order.phone or "",
        "previous_status": previous_status or "",
        "previous_status_code": previous_status or "",
        "amount": str(order.total_toman or 0),
    }


def queue_order_created_sms(order: Order) -> None:
    """
    Order-registration SMS — call only after OrderService successfully creates
    an order. Covers initial PENDING and AWAITING_PRICE; does not mean payment.
    """
    if not order:
        return
    phone = (order.phone or "").strip()
    context = _order_context(order)
    queue_sms_event(SmsTemplate.Event.ORDER_CREATED, context, phone)


def queue_order_status_sms(order: Order, previous_status: str = "") -> None:
    """
    Generic order-status SMS.

    Policy: transitions *to* PAID are notified only via ``order_paid``
    (from PaymentService.activate) to avoid duplicate customer SMS for the
    same logical payment success. Other status changes remain intact.
    """
    if order.status == Order.Status.PAID:
        return
    context = _order_context(order, previous_status)
    queue_sms_event(SmsTemplate.Event.ORDER_STATUS_CHANGED, context, order.phone or "")


def queue_order_paid_sms(order: Order) -> None:
    """Authoritative payment-success SMS — call only after order is persisted as paid."""
    if not order or order.status != Order.Status.PAID:
        return
    phone = (order.phone or "").strip()
    context = _order_context(order, previous_status=Order.Status.PENDING)
    queue_sms_event(SmsTemplate.Event.ORDER_PAID, context, phone)


def queue_order_shipment_sms(order: Order, previous_status: str = "") -> None:
    """Shipment/delivery SMS for authoritative Order.status transitions only."""
    if not order:
        return
    if order.status == Order.Status.SHIPPED:
        event = SmsTemplate.Event.ORDER_SHIPPED
    elif order.status == Order.Status.DELIVERED:
        event = SmsTemplate.Event.ORDER_DELIVERED
    else:
        return
    context = _order_context(order, previous_status)
    queue_sms_event(event, context, order.phone or "")
