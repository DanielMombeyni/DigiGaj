"""Phase 9: order_created SMS event registration and dispatch wiring."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.models.order import Order
from app.models.sms_template import SmsTemplate
from app.services.sms_dispatch import (
    queue_order_created_sms,
    queue_order_paid_sms,
)
from app.services.sms_templates import EVENT_TARGETS, SAMPLE_BY_EVENT


def test_order_created_registered_in_event_enum():
    keys = dict(SmsTemplate.Event.choices)
    assert "order_created" in keys
    assert keys["order_created"] == "ثبت سفارش"
    assert SmsTemplate.Event.ORDER_CREATED == "order_created"


def test_order_created_in_catalog_samples_and_targets():
    assert "order_created" in SAMPLE_BY_EVENT
    sample = SAMPLE_BY_EVENT["order_created"]
    assert sample.get("order_number") or sample.get("order_id")
    assert "amount" in sample
    assert "name" in sample
    assert "status" in sample
    assert EVENT_TARGETS["order_created"] == ("customer", "admin", "all")
    # Tracking / payment refs must not appear as inventable sample keys.
    assert "tracking" not in sample
    assert "payment_ref" not in sample


def test_queue_order_created_pending_queues_once():
    order = Order(
        order_number="GS-OC-1",
        status=Order.Status.PENDING,
        full_name="Buyer",
        phone="09120001122",
        total_toman=25000,
    )
    with patch("app.services.sms_dispatch.queue_sms_event") as queued:
        queue_order_created_sms(order)
        queued.assert_called_once()
        event, context, phone = queued.call_args[0]
        assert event == SmsTemplate.Event.ORDER_CREATED
        assert phone == "09120001122"
        assert context["order_number"] == "GS-OC-1"
        assert context["amount"] == "25000"
        assert context["status_code"] == Order.Status.PENDING
        assert "tracking" not in context


def test_queue_order_created_awaiting_price():
    order = Order(
        order_number="GS-OC-2",
        status=Order.Status.AWAITING_PRICE,
        full_name="Buyer",
        phone="09120003344",
        total_toman=0,
    )
    with patch("app.services.sms_dispatch.queue_sms_event") as queued:
        queue_order_created_sms(order)
        queued.assert_called_once()
        assert queued.call_args[0][0] == "order_created"
        assert queued.call_args[0][1]["status_code"] == Order.Status.AWAITING_PRICE


def test_queue_order_created_noop_without_order():
    with patch("app.services.sms_dispatch.queue_sms_event") as queued:
        queue_order_created_sms(None)  # type: ignore[arg-type]
        queued.assert_not_called()


def test_payment_activate_path_still_uses_order_paid_not_created():
    order = Order(
        order_number="GS-OC-PAID",
        status=Order.Status.PAID,
        full_name="Buyer",
        phone="09120001122",
        total_toman=1000,
    )
    with patch("app.services.sms_dispatch.queue_sms_event") as queued:
        queue_order_paid_sms(order)
        queued.assert_called_once()
        assert queued.call_args[0][0] == "order_paid"
        assert queued.call_args[0][0] != "order_created"


def test_create_order_queues_sms_only_on_success_path():
    """Structural guard: empty-cart return precedes SMS; SMS sits with email."""
    import inspect

    from app.services.order_service import OrderService

    src = inspect.getsource(OrderService.create_order)
    assert "if not items:" in src
    assert "queue_order_created_sms" in src
    assert "queue_mail_event" in src
    assert src.index("if not items:") < src.index("queue_order_created_sms")
    assert src.index("queue_mail_event") < src.index("queue_order_created_sms")


@pytest.mark.django_db
def test_create_order_empty_cart_does_not_queue_sms():
    from app.services.order_service import OrderService

    with (
        patch("app.services.email_dispatch.queue_mail_event") as mail,
        patch("app.services.sms_dispatch.queue_order_created_sms") as sms,
    ):
        order, err = OrderService.create_order(
            user=None,
            items=[],
            full_name="X",
            phone="09120001122",
            address="addr",
        )
        assert order is None
        assert err
        mail.assert_not_called()
        sms.assert_not_called()


@pytest.mark.django_db
def test_catalog_exposes_order_created_event():
    from app.services.sms_templates import catalog_payload

    payload = catalog_payload()
    keys = {row["key"] for row in payload["events"]}
    assert "order_created" in keys
    assert "order_created" in payload["samples"]


@pytest.mark.django_db
def test_disabled_order_created_template_skips_provider():
    from app.services.sms_dispatch import dispatch_sms_event

    SmsTemplate.objects.filter(event="order_created").delete()
    SmsTemplate.objects.create(
        key="order_created_disabled",
        name="ثبت سفارش (خاموش)",
        event=SmsTemplate.Event.ORDER_CREATED,
        target_user=SmsTemplate.Target.CUSTOMER,
        mode=SmsTemplate.Mode.TEXT,
        body_text="سفارش {order_number}",
        is_enabled=False,
    )
    mock_client = MagicMock()
    with (
        patch("app.services.sms_dispatch.signal_ready", return_value=True),
        patch("app.services.sms_dispatch.get_signal_client", return_value=mock_client),
    ):
        sent = dispatch_sms_event(
            SmsTemplate.Event.ORDER_CREATED,
            {
                "order_number": "GS-OC-OFF",
                "order_id": "GS-OC-OFF",
                "status_code": "pending",
                "status": "در انتظار پرداخت",
                "name": "Buyer",
                "amount": "1",
            },
            "09120001122",
        )
    assert sent == 0
    mock_client.send_sms.assert_not_called()
    mock_client.send_pattern.assert_not_called()


@pytest.mark.django_db
def test_create_order_success_queues_order_created_once(settings):
    from django.contrib.auth import get_user_model

    from app.models import Product
    from app.services.order_service import OrderService

    User = get_user_model()
    user = User.objects.create_user(username="oc_buyer", password="x")
    product = Product.objects.create(
        name="OC Item",
        slug="oc-item-1",
        sku="SKU-OC-1",
        price_toman=5000,
        stock=5,
        is_active=True,
    )
    with (
        patch("app.services.email_dispatch.queue_mail_event") as mail,
        patch("app.services.sms_dispatch.queue_order_created_sms") as sms,
    ):
        order, err = OrderService.create_order(
            user=user,
            items=[{"product_id": product.pk, "quantity": 1}],
            full_name="Buyer",
            phone="09120001122",
            address="Tehran",
        )
    assert err is None
    assert order is not None
    assert order.status == Order.Status.PENDING
    mail.assert_called_once_with("order_created", "order", order.pk)
    sms.assert_called_once_with(order)


@pytest.mark.django_db
def test_create_order_awaiting_price_also_queues_sms():
    from django.contrib.auth import get_user_model

    from app.models import Product
    from app.services.order_service import OrderService

    User = get_user_model()
    user = User.objects.create_user(username="oc_await", password="x")
    product = Product.objects.create(
        name="OC Quote",
        slug="oc-quote-1",
        sku="SKU-OC-Q1",
        price_toman=0,
        stock=3,
        is_active=True,
        price_on_request=True,
    )
    with patch("app.services.sms_dispatch.queue_order_created_sms") as sms:
        with patch("app.services.email_dispatch.queue_mail_event"):
            order, err = OrderService.create_order(
                user=user,
                items=[{"product_id": product.pk, "quantity": 1}],
                full_name="Buyer",
                phone="09120005566",
                address="Tehran",
            )
    assert err is None
    assert order is not None
    assert order.status == Order.Status.AWAITING_PRICE
    sms.assert_called_once_with(order)
