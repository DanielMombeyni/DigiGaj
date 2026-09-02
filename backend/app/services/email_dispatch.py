from __future__ import annotations

import html
import logging
import re

from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError

from app.models import Order, SupportTicket
from app.services.email_smtp import get_email_smtp, send_html_email, smtp_is_ready
from app.services.email_templates import matching_templates
from app.services.home_content import get_store_settings

logger = logging.getLogger("app.email")

_TOKEN = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def format_toman(amount) -> str:
    try:
        value = int(amount or 0)
    except (TypeError, ValueError):
        value = 0
    return f"{value:,} تومان"


def render_subject(text: str, context: dict[str, str]) -> str:
    def repl(match: re.Match) -> str:
        key = match.group(1)
        if key not in context:
            return match.group(0)
        return str(context[key] or "")

    return _TOKEN.sub(repl, text or "")


def render_html(text: str, context: dict[str, str]) -> str:
    def repl(match: re.Match) -> str:
        key = match.group(1)
        if key not in context:
            return match.group(0)
        return html.escape(str(context[key] or ""), quote=True).replace("\n", "<br>")

    return _TOKEN.sub(repl, text or "")


def _store_context() -> dict[str, str]:
    store = get_store_settings()
    url = str(getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    return {
        "store_name": str(store.get("name") or "فروشگاه"),
        "store_url": url,
    }


def order_context(order: Order, extra: dict | None = None) -> dict[str, str]:
    extra = extra or {}
    items = []
    for item in order.items.all():
        label = item.product_name
        if item.variant_label:
            label = f"{label} ({item.variant_label})"
        items.append(f"• {label} × {item.quantity} — {format_toman(item.line_total_toman)}")
    address_parts = [
        order.province,
        order.city,
        order.address,
        f"کدپستی {order.postal_code}" if order.postal_code else "",
    ]
    address = "، ".join(p for p in address_parts if p)
    status_label = order.get_status_display()
    previous = extra.get("previous_status") or ""
    previous_label = ""
    if previous:
        previous_label = dict(Order.Status.choices).get(previous, previous)
    ctx = _store_context()
    ctx.update(
        {
            "customer_name": order.full_name or (order.user.get_username() if order.user_id else ""),
            "customer_email": order.email or (order.user.email if order.user_id else ""),
            "customer_phone": order.phone or "",
            "order_number": order.order_number,
            "order_status": status_label,
            "previous_status": previous_label,
            "order_total": format_toman(order.total_toman),
            "order_items": "\n".join(items),
            "order_address": address,
            "ticket_number": "",
            "ticket_subject": "",
            "ticket_message": "",
        }
    )
    return ctx


def ticket_context(ticket: SupportTicket, extra: dict | None = None) -> dict[str, str]:
    extra = extra or {}
    name = ticket.full_name
    if ticket.user_id:
        name = name or ticket.user.get_full_name() or ticket.user.get_username()
    ctx = _store_context()
    ctx.update(
        {
            "customer_name": name or "",
            "customer_email": ticket.email or (ticket.user.email if ticket.user_id else ""),
            "customer_phone": ticket.phone or "",
            "order_number": "",
            "order_status": "",
            "previous_status": "",
            "order_total": "",
            "order_items": "",
            "order_address": "",
            "ticket_number": ticket.ticket_number,
            "ticket_subject": ticket.subject,
            "ticket_message": extra.get("message") or "",
        }
    )
    return ctx


def user_context(user) -> dict[str, str]:
    name = (user.get_full_name() or "").strip() or user.get_username()
    ctx = _store_context()
    ctx.update(
        {
            "customer_name": name,
            "customer_email": user.email or "",
            "customer_phone": "",
            "order_number": "",
            "order_status": "",
            "previous_status": "",
            "order_total": "",
            "order_items": "",
            "order_address": "",
            "ticket_number": "",
            "ticket_subject": "",
            "ticket_message": "",
        }
    )
    return ctx


def sample_context() -> dict[str, str]:
    store = _store_context()
    store.update(
        {
            "customer_name": "علی رضایی",
            "customer_email": "ali@example.com",
            "customer_phone": "09120000000",
            "order_number": "GS-TEST1234",
            "order_status": "ارسال‌شده",
            "previous_status": "در حال آماده‌سازی",
            "order_total": format_toman(1250000),
            "order_items": "• هدفون بی‌سیم × 1 — 1,250,000 تومان",
            "order_address": "تهران، خیابان نمونه",
            "ticket_number": "TK-1001",
            "ticket_subject": "پیگیری سفارش",
            "ticket_message": "سفارش شما بررسی شد.",
        }
    )
    return store


def recipient_for_order(order: Order) -> str:
    email = (order.email or "").strip()
    if email:
        return email
    if order.user_id and order.user.email:
        return order.user.email.strip()
    return ""


def recipient_for_ticket(ticket: SupportTicket) -> str:
    email = (ticket.email or "").strip()
    if email:
        return email
    if ticket.user_id and ticket.user.email:
        return ticket.user.email.strip()
    return ""


def queue_mail_event(event: str, target: str, target_id: int, extra: dict | None = None) -> None:
    payload = extra or {}

    def _enqueue():
        from app.tasks.email import send_mail_event

        try:
            send_mail_event.delay(event, target, int(target_id), payload)
        except Exception:
            logger.exception("email celery enqueue failed")
            try:
                send_mail_event(event, target, int(target_id), payload)
            except Exception:
                logger.exception("email sync send failed")

    transaction.on_commit(_enqueue)


def dispatch_event(event: str, target: str, target_id: int, extra: dict | None = None) -> int:
    cfg = get_email_smtp()
    if not cfg["enabled"] or not smtp_is_ready(cfg):
        return 0

    extra = extra or {}
    context, to_email, status = _load_target(target, target_id, extra)
    if not to_email or context is None:
        return 0

    sent = 0
    for template in matching_templates(event, status=status):
        try:
            send_html_email(
                to_email=to_email,
                subject=render_subject(template.subject, context),
                html_body=render_html(template.body_html, context),
            )
            sent += 1
        except Exception:
            logger.exception("email template %s failed", template.key)
    return sent


def _load_target(target: str, target_id: int, extra: dict) -> tuple[dict | None, str, str]:
    if target == "order":
        try:
            order = (
                Order.objects.select_related("user")
                .prefetch_related("items")
                .get(pk=target_id)
            )
        except Order.DoesNotExist:
            return None, "", ""
        return order_context(order, extra), recipient_for_order(order), order.status
    if target == "ticket":
        try:
            ticket = SupportTicket.objects.select_related("user").get(pk=target_id)
        except SupportTicket.DoesNotExist:
            return None, "", ""
        return ticket_context(ticket, extra), recipient_for_ticket(ticket), ""
    if target == "user":
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(pk=target_id)
        except User.DoesNotExist:
            return None, "", ""
        email = (user.email or "").strip()
        return user_context(user), email, ""
    return None, "", ""


def send_template_test(template: EmailTemplate, to_email: str) -> None:
    cfg = get_email_smtp()
    if not smtp_is_ready(cfg):
        raise ValidationError("ابتدا تنظیمات SMTP را کامل کنید.")
    if not cfg["enabled"]:
        raise ValidationError("ارسال ایمیل در تنظیمات خاموش است.")
    context = sample_context()
    send_html_email(
        to_email=to_email,
        subject=render_subject(template.subject, context),
        html_body=render_html(template.body_html, context),
    )
