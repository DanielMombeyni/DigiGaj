"""Phase 6 audit-fix regression tests (unit + django_db)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from rest_framework.exceptions import ValidationError

from app.models.order import Order
from app.services.sms_params import (
    MANUAL_SEND_RATE_LIMIT,
    atomic_cache_add,
    atomic_rate_increment,
    sanitize_manual_params,
    validate_client_request_id,
)
from app.services.sms_dispatch import queue_order_status_sms


def test_client_request_id_format():
    assert validate_client_request_id("abcd1234") == "abcd1234"
    with pytest.raises(ValidationError):
        validate_client_request_id("short")
    with pytest.raises(ValidationError):
        validate_client_request_id("bad id!!")


def test_sanitize_manual_rejects_extra_and_trusted_override():
    cleaned = sanitize_manual_params(
        param_keys=["note", "otp"],
        bindings={"note": "manual", "otp": "context.code"},
        raw={"note": "hello"},
        require_values=True,
    )
    assert cleaned == {"note": "hello"}

    with pytest.raises(ValidationError):
        sanitize_manual_params(
            param_keys=["note"],
            bindings={"note": "manual"},
            raw={"note": "x", "amount": "999"},
            require_values=True,
        )

    with pytest.raises(ValidationError):
        sanitize_manual_params(
            param_keys=["otp"],
            bindings={"otp": "manual"},
            raw={},
            require_values=True,
        )


def test_sanitize_rejects_binding_manual_on_trusted_name():
    # Even if misconfigured as manual, trusted key names are blocked.
    with pytest.raises(ValidationError):
        sanitize_manual_params(
            param_keys=["amount"],
            bindings={"amount": "manual"},
            raw={"amount": "1"},
            require_values=True,
        )


def test_atomic_cache_add_and_rate(settings):
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "sms-phase6",
        }
    }
    from django.core.cache import cache

    cache.clear()
    assert atomic_cache_add("k1", "1", 60) is True
    assert atomic_cache_add("k1", "1", 60) is False
    n1 = atomic_rate_increment("rate1", window=60, limit=MANUAL_SEND_RATE_LIMIT)
    n2 = atomic_rate_increment("rate1", window=60, limit=MANUAL_SEND_RATE_LIMIT)
    assert n1 == 1
    assert n2 == 2


def test_queue_order_status_skips_paid():
    order = Order(
        order_number="GS-P6-1",
        status=Order.Status.PAID,
        full_name="A",
        phone="09120001122",
    )
    with patch("app.services.sms_dispatch.queue_sms_event") as queued:
        queue_order_status_sms(order, previous_status=Order.Status.PENDING)
        queued.assert_not_called()


def test_queue_order_status_allows_processing():
    order = Order(
        order_number="GS-P6-2",
        status=Order.Status.PROCESSING,
        full_name="A",
        phone="09120001122",
    )
    with patch("app.services.sms_dispatch.queue_sms_event") as queued:
        queue_order_status_sms(order, previous_status=Order.Status.PAID)
        queued.assert_called_once()
        assert queued.call_args[0][0] == "order_status_changed"


def test_confirm_true_only_logic():
    """Mirror AdminSmsSendTemplateView gate without HTTP stack."""

    def accept(confirm):
        return confirm is True

    assert accept(True) is True
    assert accept(False) is False
    assert accept("true") is False
    assert accept("false") is False
    assert accept(1) is False
    assert accept(None) is False


@pytest.mark.django_db
def test_manual_extra_key_rejected():
    from django.contrib.auth import get_user_model

    from app.models import SmsTemplate, UserProfile
    from app.services.sms_templates import send_template_to_users

    User = get_user_model()
    actor = User.objects.create_user(username="p6admin", password="x", is_staff=True)
    user = User.objects.create_user(username="p6cust", password="x")
    UserProfile.objects.update_or_create(user=user, defaults={"phone": "09121112233"})
    tpl = SmsTemplate.objects.create(
        key="p6-manual",
        name="m",
        event=SmsTemplate.Event.CUSTOM,
        mode=SmsTemplate.Mode.PATTERN,
        pattern_id=9,
        param_keys=["note"],
        param_bindings={"note": "manual"},
        is_enabled=True,
    )
    with (
        patch("app.services.sms_templates.signal_ready", return_value=True),
        patch("app.services.sms_templates.get_signal_client", return_value=MagicMock()),
        pytest.raises(ValidationError) as exc,
    ):
        send_template_to_users(
            template=tpl,
            user_ids=[user.id],
            actor=actor,
            manual_params={"note": "ok", "amount": "1"},
            client_request_id="req12345",
        )
    assert "غیرمجاز" in str(exc.value.detail)


@pytest.mark.django_db
def test_manual_duplicate_returns_same_result():
    from django.contrib.auth import get_user_model
    from django.core.cache import cache

    from app.models import SmsTemplate, UserProfile
    from app.services.sms_templates import send_template_to_users

    cache.clear()
    User = get_user_model()
    actor = User.objects.create_user(username="p6dup", password="x", is_staff=True)
    user = User.objects.create_user(username="p6dupc", password="x")
    UserProfile.objects.update_or_create(user=user, defaults={"phone": "09125556677"})
    tpl = SmsTemplate.objects.create(
        key="p6-dup",
        name="d",
        event=SmsTemplate.Event.CUSTOM,
        mode=SmsTemplate.Mode.TEXT,
        body_text="hi {{name}}",
        is_enabled=True,
    )
    mock = MagicMock()
    with (
        patch("app.services.sms_templates.signal_ready", return_value=True),
        patch("app.services.sms_templates.get_signal_client", return_value=mock),
    ):
        first = send_template_to_users(
            template=tpl,
            user_ids=[user.id],
            actor=actor,
            client_request_id="dupreq01",
        )
        second = send_template_to_users(
            template=tpl,
            user_ids=[user.id],
            actor=actor,
            client_request_id="dupreq01",
        )
    assert first["sent"] == 1
    assert second.get("duplicate") is True
    assert second["batch_id"] == first["batch_id"]
    assert mock.send_sms.call_count == 1


@pytest.mark.django_db
def test_dispatch_claim_blocks_second_send():
    from app.models import SmsDispatchClaim, SmsTemplate
    from app.services import sms_dispatch

    tpl = SmsTemplate.objects.create(
        key="p6-claim",
        name="c",
        event=SmsTemplate.Event.ORDER_PAID,
        mode=SmsTemplate.Mode.TEXT,
        body_text="paid {{order_number}}",
        target_user=SmsTemplate.Target.CUSTOMER,
        is_enabled=True,
    )
    ctx = {
        "order_number": "GS-CLAIM-1",
        "status_code": "paid",
        "name": "A",
    }
    mock = MagicMock()
    with (
        patch.object(sms_dispatch, "signal_ready", return_value=True),
        patch.object(sms_dispatch, "get_signal_client", return_value=mock),
    ):
        n1 = sms_dispatch.dispatch_sms_event("order_paid", ctx, "09120001122")
        n2 = sms_dispatch.dispatch_sms_event("order_paid", ctx, "09120001122")
    assert n1 == 1
    assert n2 == 0
    assert mock.send_sms.call_count == 1
    assert SmsDispatchClaim.objects.filter(event="order_paid").count() == 1
