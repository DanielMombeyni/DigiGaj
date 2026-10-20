"""Phase 0/1 payment integrity and access-control regression tests (mocked gateways)."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from rest_framework.test import APIClient

from app.models import (
    Order,
    OrderItem,
    PaymentGatewayConfig,
    Product,
    PurchaseTransaction,
)
from app.services.payment_service import PaymentService
from app.utils.security import validate_production_secret_key

User = get_user_model()


@pytest.fixture
def user_a(db):
    return User.objects.create_user("usera", "a@example.com", "Pass-12345")


@pytest.fixture
def user_b(db):
    return User.objects.create_user("userb", "b@example.com", "Pass-12345")


@pytest.fixture
def staff_tx(db):
    user = User.objects.create_user(
        "stafftx", "staff@example.com", "Pass-12345", is_staff=True, is_superuser=True
    )
    return user


@pytest.fixture
def product(db):
    return Product.objects.create(
        name="Test Gadget",
        slug="test-gadget",
        sku="SKU-TEST-1",
        price_toman=100_000,
        stock=10,
        is_active=True,
    )


@pytest.fixture
def order_for(user_a, product):
    def _make(user=None, total=100_000, status=Order.Status.PENDING):
        owner = user if user is not None else user_a
        order = Order.objects.create(
            user=owner,
            order_number=f"GS-TEST-{owner.id}-{Order.objects.count() + 1}",
            status=status,
            full_name="Test User",
            phone="09120000000",
            address="Tehran",
            subtotal_toman=total,
            total_toman=total,
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            product_name=product.name,
            unit_price_toman=total,
            quantity=1,
            line_total_toman=total,
        )
        return order

    return _make


@pytest.fixture
def card_gateway(db):
    return PaymentGatewayConfig.objects.create(
        provider_type="card",
        display_name="Card",
        is_enabled_web=True,
        is_enabled_app=True,
        credentials={"card_number": "6037990000000000", "card_holder": "Test"},
    )


@pytest.fixture
def zarinpal_gateway(db):
    return PaymentGatewayConfig.objects.create(
        provider_type="zarinpal",
        display_name="Zarinpal",
        is_enabled_web=True,
        is_enabled_app=True,
        credentials={"merchant_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"},
    )


@pytest.fixture
def mock_start(monkeypatch):
    def _start(cls=None, **kwargs):
        return (
            {
                "authority": "AUTH-TEST-1",
                "payment_url": "https://example.test/pay",
                "extra": {},
                "raw": {},
            },
            None,
        )

    monkeypatch.setattr(
        "app.services.payment_service.PaymentFacade.start_payment",
        classmethod(_start),
    )


@pytest.fixture
def mock_verify_ok(monkeypatch):
    def _verify(cls=None, **kwargs):
        return ({"ok": True, "ref_id": "REF-OK", "raw": {}}, None)

    monkeypatch.setattr(
        "app.services.payment_service.PaymentFacade.verify_payment",
        classmethod(_verify),
    )


@pytest.fixture
def api_client():
    return APIClient()


def _auth(client, user):
    client.force_authenticate(user=user)
    return client


# --- Phase 0: secret validation (no Django settings reload required) ---


def test_production_secret_rejects_defaults_and_short_keys():
    with pytest.raises(ImproperlyConfigured):
        validate_production_secret_key("insecure-dev-key-change-me")
    with pytest.raises(ImproperlyConfigured):
        validate_production_secret_key("change-me-in-production-use-long-random-string")
    with pytest.raises(ImproperlyConfigured):
        validate_production_secret_key("short")
    with pytest.raises(ImproperlyConfigured):
        validate_production_secret_key("")
    validate_production_secret_key("a" * 32)  # accepts long non-default


# --- Phase 1: amount integrity ---


@pytest.mark.django_db
def test_reject_arbitrary_amount_toman(api_client, user_a, card_gateway, mock_start):
    _auth(api_client, user_a)
    res = api_client.post(
        "/api/v1/payment/purchase/",
        {"gateway": "card", "amount_toman": 1},
        format="json",
    )
    assert res.status_code == 400
    assert "سفارش" in str(res.data.get("detail", res.data))


@pytest.mark.django_db
def test_create_purchase_service_rejects_amount_only(user_a, card_gateway, mock_start):
    request = type("R", (), {"user": user_a})()
    data, err = PaymentService.create_purchase(
        request=request,
        gateway="card",
        order=None,
        product=None,
    )
    assert data is None
    assert err


@pytest.mark.django_db
def test_order_based_purchase_uses_order_total(
    api_client, user_a, order_for, card_gateway, mock_start
):
    order = order_for(total=250_000)
    _auth(api_client, user_a)
    res = api_client.post(
        "/api/v1/payment/purchase/",
        {
            "gateway": "card",
            "order_id": order.id,
            "amount_toman": 1,  # must be ignored
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.data["amount"] == 250_000
    tx = PurchaseTransaction.objects.get(tracking_number=res.data["tracking_number"])
    assert tx.amount == 250_000
    assert tx.order_id == order.id


@pytest.mark.django_db
def test_product_based_purchase_is_disabled(
    api_client, user_a, product, card_gateway, mock_start
):
    _auth(api_client, user_a)
    res = api_client.post(
        "/api/v1/payment/purchase/",
        {
            "gateway": "card",
            "product_id": product.id,
            "quantity": 2,
            "amount_toman": 1,
        },
        format="json",
    )
    assert res.status_code == 400
    assert "خرید مستقیم" in str(res.data.get("detail", res.data))


@pytest.mark.django_db
def test_status_denied_for_other_user(
    api_client, user_a, user_b, order_for, card_gateway, mock_start
):
    order = order_for(user=user_a)
    request = type("R", (), {"user": user_a})()
    data, err = PaymentService.create_purchase(
        request=request, gateway="card", order=order
    )
    assert err is None
    tracking = data["tracking_number"]

    _auth(api_client, user_b)
    denied = api_client.get(f"/api/v1/payment/status/{tracking}/")
    assert denied.status_code == 403


@pytest.mark.django_db
def test_status_allowed_for_owner(
    api_client, user_a, order_for, card_gateway, mock_start
):
    order = order_for(user=user_a)
    request = type("R", (), {"user": user_a})()
    data, err = PaymentService.create_purchase(
        request=request, gateway="card", order=order
    )
    assert err is None
    _auth(api_client, user_a)
    ok = api_client.get(f"/api/v1/payment/status/{data['tracking_number']}/")
    assert ok.status_code == 200
    assert ok.data["tracking_number"] == data["tracking_number"]


@pytest.mark.django_db
def test_confirm_denied_for_other_user(
    api_client, user_a, user_b, order_for, zarinpal_gateway, mock_start, mock_verify_ok
):
    order = order_for(user=user_a)
    request = type("R", (), {"user": user_a})()
    data, err = PaymentService.create_purchase(
        request=request, gateway="zarinpal", order=order
    )
    assert err is None
    _auth(api_client, user_b)
    denied = api_client.post(
        "/api/v1/payment/confirm/",
        {"tracking_number": data["tracking_number"]},
        format="json",
    )
    assert denied.status_code == 403


@pytest.mark.django_db
def test_card_confirm_succeeds_for_authorized_staff(
    api_client, user_a, staff_tx, order_for, card_gateway, mock_start
):
    order = order_for(user=user_a)
    request = type("R", (), {"user": user_a})()
    data, err = PaymentService.create_purchase(
        request=request, gateway="card", order=order
    )
    assert err is None
    tracking = data["tracking_number"]

    _auth(api_client, staff_tx)
    confirmed = api_client.post(
        "/api/v1/payment/admin/card-confirm/",
        {"tracking_number": tracking},
        format="json",
    )
    assert confirmed.status_code == 200
    assert confirmed.data["status"] == PurchaseTransaction.Status.SUCCESS
    order.refresh_from_db()
    assert order.status == Order.Status.PAID


@pytest.mark.django_db
def test_card_confirm_rejected_for_gateway_tx(
    api_client, user_a, staff_tx, order_for, zarinpal_gateway, mock_start
):
    order = order_for(user=user_a)
    request = type("R", (), {"user": user_a})()
    data, err = PaymentService.create_purchase(
        request=request, gateway="zarinpal", order=order
    )
    assert err is None
    _auth(api_client, staff_tx)
    denied = api_client.post(
        "/api/v1/payment/admin/card-confirm/",
        {"tracking_number": data["tracking_number"]},
        format="json",
    )
    assert denied.status_code == 400
    assert "کارت" in str(denied.data.get("detail", denied.data))


@pytest.mark.django_db
def test_force_admin_rejected_for_non_card_in_service(
    user_a, order_for, zarinpal_gateway, mock_start
):
    order = order_for(user=user_a)
    request = type("R", (), {"user": user_a})()
    data, err = PaymentService.create_purchase(
        request=request, gateway="zarinpal", order=order
    )
    assert err is None
    out, err2 = PaymentService.confirm_payment_by_tracking(
        data["tracking_number"], force_admin=True
    )
    assert out is None
    assert err2


@pytest.mark.django_db
def test_gateway_callback_confirms_and_is_idempotent(
    api_client, user_a, order_for, zarinpal_gateway, mock_start, mock_verify_ok
):
    order = order_for(user=user_a)
    request = type("R", (), {"user": user_a})()
    data, err = PaymentService.create_purchase(
        request=request, gateway="zarinpal", order=order
    )
    assert err is None
    tracking = data["tracking_number"]

    first = api_client.get(
        f"/api/v1/payment/callback/zarinpal/?tracking={tracking}&Authority=AUTH-TEST-1"
    )
    assert first.status_code == 200
    tx = PurchaseTransaction.objects.get(tracking_number=tracking)
    assert tx.status == PurchaseTransaction.Status.SUCCESS
    order.refresh_from_db()
    assert order.status == Order.Status.PAID

    second = api_client.get(
        f"/api/v1/payment/callback/zarinpal/?tracking={tracking}&Authority=AUTH-TEST-1"
    )
    assert second.status_code == 200
    assert PurchaseTransaction.objects.filter(
        tracking_number=tracking, status=PurchaseTransaction.Status.SUCCESS
    ).count() == 1
    # Accounting should not double-create on idempotent activate
    from app.models import AccountingEntry

    assert AccountingEntry.objects.filter(transaction=tx).count() == 1
