"""Focused SMS template/dispatch tests — unit + django_db when available."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from rest_framework.exceptions import ValidationError

from app.services.sms_params import (
    ALLOWED_SOURCE_KEYS,
    MANUAL_SEND_MAX_RECIPIENTS,
    build_parameters_from_bindings,
    normalize_phone,
    phone_ok,
    redact_params,
    validate_param_bindings,
    validate_param_keys,
)
from app.services.sms_templates import build_pattern_parameters


def test_normalize_and_validate_iranian_phone():
    assert normalize_phone("0912-345-6789") == "09123456789"
    assert normalize_phone("+989123456789") == "09123456789"
    assert phone_ok("09123456789")
    assert not phone_ok("9123456789")
    assert not phone_ok("02112345678")


def test_param_keys_reject_invalid_names():
    with pytest.raises(ValidationError):
        validate_param_keys(["bad-name"])
    with pytest.raises(ValidationError):
        validate_param_keys(["1otp"])
    assert validate_param_keys(["otp", "name"]) == ["otp", "name"]


def test_param_bindings_reject_unknown_source():
    with pytest.raises(ValidationError):
        validate_param_bindings({"otp": "order.user.password"}, ["otp"])
    with pytest.raises(ValidationError):
        validate_param_bindings({"otp": "context.code"}, ["name"])
    out = validate_param_bindings({"otp": "context.code"}, ["otp"])
    assert out["otp"] == "context.code"
    assert "context.code" in ALLOWED_SOURCE_KEYS


def test_build_parameters_require_all_and_manual():
    params = build_parameters_from_bindings(
        ["otp", "name"],
        {"otp": "context.code", "name": "manual"},
        context={"code": "112233"},
        manual_params={"name": "علی"},
        require_all=True,
    )
    assert params["otp"] == "112233"
    assert params["name"] == "علی"
    with pytest.raises(ValidationError):
        build_parameters_from_bindings(
            ["otp"],
            {"otp": "context.code"},
            context={},
            require_all=True,
        )


def test_redact_sensitive_params():
    safe = redact_params({"otp": "999888", "name": "Ali", "link": "https://x/secret"})
    assert safe["otp"] == "***"
    assert safe["link"] == "***"
    assert safe["name"] == "Ali"


def test_legacy_pattern_aliases_still_work():
    params = build_pattern_parameters(["otp"], {"code": "654321"}, event="login_otp")
    assert params["otp"] == "654321"


def test_manual_send_max_constant():
    assert MANUAL_SEND_MAX_RECIPIENTS == 100


@pytest.mark.django_db
def test_otp_fallback_records_reason(settings):
    from app.models import SmsLog
    from app.services import sms_dispatch

    with (
        patch.object(sms_dispatch, "pick_template", return_value=None),
        patch.object(sms_dispatch, "signal_ready", return_value=False),
        patch("app.services.sms_service.SmsProviderService.send_otp", return_value=(True, None)),
    ):
        ok, err = sms_dispatch.send_login_otp("09121111111", "123456", name="Test")
    assert ok is True
    assert err is None
    row = SmsLog.objects.filter(event="login_otp", phone="09121111111").order_by("-id").first()
    assert row is not None
    assert row.fallback_reason == sms_dispatch.FALLBACK_NO_TEMPLATE
    assert "123456" not in (row.error or "")


@pytest.mark.django_db
def test_manual_send_rejects_over_100(api_client=None):
    from django.contrib.auth import get_user_model
    from app.models import SmsTemplate
    from app.services.sms_templates import send_template_to_users

    User = get_user_model()
    actor = User.objects.create_user(username="smsadmin", password="x", is_staff=True)
    tpl = SmsTemplate.objects.create(
        key="manual-hello",
        name="سلام",
        event=SmsTemplate.Event.CUSTOM,
        mode=SmsTemplate.Mode.TEXT,
        body_text="سلام {{name}} لغو 11",
        is_enabled=True,
    )
    with pytest.raises(ValidationError) as exc:
        send_template_to_users(
            template=tpl,
            user_ids=list(range(1, 102)),
            actor=actor,
            manual_params={},
            client_request_id="req-over1",
        )
    assert "100" in str(exc.value.detail)


@pytest.mark.django_db
def test_manual_send_partial_and_audit():
    from django.contrib.auth import get_user_model

    from app.models import SmsLog, SmsTemplate, UserProfile
    from app.services.sms_templates import send_template_to_users

    User = get_user_model()
    actor = User.objects.create_user(username="smsadmin2", password="x", is_staff=True)
    u_ok = User.objects.create_user(username="cust_ok", password="x")
    u_bad = User.objects.create_user(username="cust_bad", password="x")
    UserProfile.objects.update_or_create(user=u_ok, defaults={"phone": "09123334455"})
    UserProfile.objects.update_or_create(user=u_bad, defaults={"phone": "123"})

    tpl = SmsTemplate.objects.create(
        key="manual-hi",
        name="سلام",
        event=SmsTemplate.Event.CUSTOM,
        mode=SmsTemplate.Mode.TEXT,
        body_text="سلام {{name}}",
        is_enabled=True,
    )

    mock_client = MagicMock()
    with (
        patch("app.services.sms_templates.signal_ready", return_value=True),
        patch("app.services.sms_templates.get_signal_client", return_value=mock_client),
    ):
        result = send_template_to_users(
            template=tpl,
            user_ids=[u_ok.id, u_bad.id],
            actor=actor,
            client_request_id="batch-partial-01",
        )

    assert result["sent"] == 1
    assert result["failed"] == 1
    assert result["batch_id"] == "batch-partial-01"
    mock_client.send_sms.assert_called_once()
    logs = list(SmsLog.objects.filter(batch_id="batch-partial-01"))
    assert len(logs) == 2
    assert any(l.actor_id == actor.id for l in logs)
    assert any(l.status == SmsLog.Status.SENT for l in logs)
    assert any(l.status == SmsLog.Status.FAILED for l in logs)


@pytest.mark.django_db
def test_manual_send_duplicate_request_id():
    from django.contrib.auth import get_user_model
    from django.core.cache import cache

    from app.models import SmsTemplate, UserProfile
    from app.services.sms_templates import send_template_to_users

    cache.clear()
    User = get_user_model()
    actor = User.objects.create_user(username="smsadmin3", password="x", is_staff=True)
    user = User.objects.create_user(username="cust_dup", password="x")
    UserProfile.objects.update_or_create(user=user, defaults={"phone": "09125556677"})
    tpl = SmsTemplate.objects.create(
        key="manual-dup",
        name="دوباره",
        event=SmsTemplate.Event.CUSTOM,
        mode=SmsTemplate.Mode.TEXT,
        body_text="hi",
        is_enabled=True,
    )
    mock_client = MagicMock()
    with (
        patch("app.services.sms_templates.signal_ready", return_value=True),
        patch("app.services.sms_templates.get_signal_client", return_value=mock_client),
    ):
        first = send_template_to_users(
            template=tpl,
            user_ids=[user.id],
            actor=actor,
            client_request_id="same-req1",
        )
        second = send_template_to_users(
            template=tpl,
            user_ids=[user.id],
            actor=actor,
            client_request_id="same-req1",
        )
    assert first["sent"] == 1
    assert second.get("duplicate") is True
    assert mock_client.send_sms.call_count == 1


@pytest.mark.django_db
def test_order_paid_queue_uses_event(settings):
    from django.contrib.auth import get_user_model

    from app.models import Order
    from app.services.sms_dispatch import queue_order_paid_sms

    User = get_user_model()
    user = User.objects.create_user(username="buyer", password="x")
    order = Order.objects.create(
        user=user,
        order_number="GS-SMS-PAID-1",
        status=Order.Status.PAID,
        full_name="Buyer",
        phone="09120001122",
        total_toman=10000,
    )
    with patch("app.services.sms_dispatch.queue_sms_event") as queued:
        queue_order_paid_sms(order)
        queued.assert_called_once()
        assert queued.call_args[0][0] == "order_paid"
        assert queued.call_args[0][1]["amount"] == "10000"


@pytest.mark.django_db
def test_shipment_queue_only_for_shipped_delivered():
    from app.models import Order
    from app.services.sms_dispatch import queue_order_shipment_sms

    order = Order(
        order_number="GS-SHIP-1",
        status=Order.Status.PROCESSING,
        full_name="A",
        phone="09120001122",
    )
    with patch("app.services.sms_dispatch.queue_sms_event") as queued:
        queue_order_shipment_sms(order)
        queued.assert_not_called()
        order.status = Order.Status.SHIPPED
        queue_order_shipment_sms(order)
        assert queued.call_args[0][0] == "order_shipped"
        order.status = Order.Status.DELIVERED
        queue_order_shipment_sms(order)
        assert queued.call_args[0][0] == "order_delivered"


@pytest.mark.django_db
def test_pattern_template_create_does_not_require_body():
    from app.services.sms_templates import create_template, serialize_template

    row = create_template(
        {
            "name": "OTP Pattern",
            "mode": "pattern",
            "event": "login_otp",
            "target_user": "customer",
            "pattern_id": 42,
            "param_keys": ["otp"],
            "param_bindings": {"otp": "context.code"},
            "body_text": "",
            "is_enabled": True,
        }
    )
    data = serialize_template(row)
    assert data["body_text"] == ""
    assert data["pattern_id"] == 42
    assert data["param_bindings"]["otp"] == "context.code"
