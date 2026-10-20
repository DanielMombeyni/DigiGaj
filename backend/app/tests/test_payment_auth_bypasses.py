"""Phase 1B: paid-status, guest-order, staff permission, callback provider tests."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from app.models import (
    Order,
    OrderItem,
    PaymentGatewayConfig,
    Product,
    PurchaseTransaction,
    StaffRole,
    UserProfile,
)
from app.services.order_payment_access import (
    manual_status_change_error,
    parse_positive_quantity,
    user_can_initiate_order_payment,
)
from app.services.payment_service import PaymentService

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_a(db):
    return User.objects.create_user("usera2", "a2@example.com", "Pass-12345")


@pytest.fixture
def user_b(db):
    return User.objects.create_user("userb2", "b2@example.com", "Pass-12345")


@pytest.fixture
def staff_orders(db):
    role = StaffRole.objects.create(name="Orders", slug="orders-only", pages=["orders"])
    user = User.objects.create_user(
        "stafford", "ord@example.com", "Pass-12345", is_staff=True
    )
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.staff_role = role
    profile.save(update_fields=["staff_role", "updated_at"])
    return user


@pytest.fixture
def staff_products_only(db):
    role = StaffRole.objects.create(
        name="Products", slug="products-only", pages=["products"]
    )
    user = User.objects.create_user(
        "staffprod", "prod@example.com", "Pass-12345", is_staff=True
    )
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.staff_role = role
    profile.save(update_fields=["staff_role", "updated_at"])
    return user


@pytest.fixture
def staff_super(db):
    return User.objects.create_user(
        "supers", "s@example.com", "Pass-12345", is_staff=True, is_superuser=True
    )


@pytest.fixture
def product(db):
    return Product.objects.create(
        name="Auth Bypass Gadget",
        slug="auth-bypass-gadget",
        sku="SKU-AUTH-1",
        price_toman=50_000,
        stock=5,
        is_active=True,
    )


@pytest.fixture
def order_for(user_a, product):
    def _make(user="default", total=50_000, status=Order.Status.PENDING):
        owner = user_a if user == "default" else user
        order = Order.objects.create(
            user=owner,
            order_number=f"GS-AUTH-{Order.objects.count() + 1}",
            status=status,
            full_name="Test",
            phone="09121111111",
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
                "authority": "AUTH-BYPASS-1",
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
        return ({"ok": True, "ref_id": "REF-BYPASS", "raw": {}}, None)

    monkeypatch.setattr(
        "app.services.payment_service.PaymentFacade.verify_payment",
        classmethod(_verify),
    )


# --- Pure helpers (no DB) ---


def test_manual_status_blocks_paid_transition():
    err = manual_status_change_error(Order.Status.PENDING, Order.Status.PAID)
    assert err
    assert manual_status_change_error(Order.Status.PENDING, Order.Status.PROCESSING) is None
    assert manual_status_change_error(Order.Status.PAID, Order.Status.PAID) is None


def test_parse_positive_quantity_rejects_invalid():
    assert parse_positive_quantity(0)[1]
    assert parse_positive_quantity(-1)[1]
    assert parse_positive_quantity("x")[1]
    assert parse_positive_quantity(101)[1]
    assert parse_positive_quantity(3) == (3, None)


# --- set_status paid ---


@pytest.mark.django_db
def test_set_status_rejects_paid(api_client, staff_orders, order_for):
    order = order_for()
    api_client.force_authenticate(user=staff_orders)
    res = api_client.patch(
        f"/api/v1/orders/{order.id}/status/",
        {"status": "paid"},
        format="json",
    )
    assert res.status_code == 400
    order.refresh_from_db()
    assert order.status == Order.Status.PENDING


@pytest.mark.django_db
def test_set_status_allows_processing(api_client, staff_orders, order_for, card_gateway, mock_start):
    order = order_for()
    # Mark paid via legitimate activation first
    request = type("R", (), {"user": order.user})()
    data, err = PaymentService.create_purchase(
        request=request, gateway="card", order=order
    )
    assert err is None
    PaymentService.confirm_payment_by_tracking(data["tracking_number"], force_admin=True)
    order.refresh_from_db()
    assert order.status == Order.Status.PAID

    api_client.force_authenticate(user=staff_orders)
    res = api_client.patch(
        f"/api/v1/orders/{order.id}/status/",
        {"status": "processing"},
        format="json",
    )
    assert res.status_code == 200
    order.refresh_from_db()
    assert order.status == Order.Status.PROCESSING


# --- Guest order payment ---


@pytest.mark.django_db
def test_unrelated_user_cannot_pay_guest_order(
    api_client, user_a, order_for, card_gateway, mock_start
):
    guest_order = order_for(user=None)
    assert guest_order.user_id is None
    assert user_can_initiate_order_payment(user_a, guest_order) is False

    api_client.force_authenticate(user=user_a)
    res = api_client.post(
        "/api/v1/payment/purchase/",
        {"gateway": "card", "order_id": guest_order.id},
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_staff_with_orders_can_pay_guest_order(
    api_client, staff_orders, order_for, card_gateway, mock_start
):
    guest_order = order_for(user=None)
    api_client.force_authenticate(user=staff_orders)
    res = api_client.post(
        "/api/v1/payment/purchase/",
        {"gateway": "card", "order_id": guest_order.id},
        format="json",
    )
    assert res.status_code == 201


@pytest.mark.django_db
def test_owner_can_pay_own_order(api_client, user_a, order_for, card_gateway, mock_start):
    order = order_for(user=user_a)
    api_client.force_authenticate(user=user_a)
    res = api_client.post(
        "/api/v1/payment/purchase/",
        {"gateway": "card", "order_id": order.id},
        format="json",
    )
    assert res.status_code == 201


# --- Product path / quantity ---


@pytest.mark.django_db
def test_product_purchase_invalid_quantity(api_client, user_a, product, card_gateway):
    api_client.force_authenticate(user=user_a)
    res = api_client.post(
        "/api/v1/payment/purchase/",
        {"gateway": "card", "product_id": product.id, "quantity": 0},
        format="json",
    )
    assert res.status_code == 400
    assert "تعداد" in str(res.data.get("detail", res.data))


@pytest.mark.django_db
def test_create_purchase_rejects_product_path(user_a, product, card_gateway, mock_start):
    request = type("R", (), {"user": user_a})()
    data, err = PaymentService.create_purchase(
        request=request, gateway="card", product=product, quantity=1
    )
    assert data is None
    assert "خرید مستقیم" in (err or "")


# --- Staff permission ---


@pytest.mark.django_db
def test_staff_without_orders_page_cannot_pay_others_order(
    api_client, staff_products_only, user_a, order_for, card_gateway, mock_start
):
    order = order_for(user=user_a)
    api_client.force_authenticate(user=staff_products_only)
    res = api_client.post(
        "/api/v1/payment/purchase/",
        {"gateway": "card", "order_id": order.id},
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_staff_with_orders_page_can_pay_others_order(
    api_client, staff_orders, user_a, order_for, card_gateway, mock_start
):
    order = order_for(user=user_a)
    api_client.force_authenticate(user=staff_orders)
    res = api_client.post(
        "/api/v1/payment/purchase/",
        {"gateway": "card", "order_id": order.id},
        format="json",
    )
    assert res.status_code == 201


# --- Callback provider mismatch ---


@pytest.mark.django_db
def test_callback_provider_mismatch_rejected(
    api_client, user_a, order_for, zarinpal_gateway, mock_start, mock_verify_ok
):
    order = order_for(user=user_a)
    request = type("R", (), {"user": user_a})()
    data, err = PaymentService.create_purchase(
        request=request, gateway="zarinpal", order=order
    )
    assert err is None
    tracking = data["tracking_number"]

    # Wrong provider in URL
    bad = api_client.get(
        f"/api/v1/payment/callback/zibal/?tracking={tracking}&Authority=AUTH-BYPASS-1"
    )
    assert bad.status_code == 200
    tx = PurchaseTransaction.objects.get(tracking_number=tracking)
    assert tx.status == PurchaseTransaction.Status.PENDING
    order.refresh_from_db()
    assert order.status == Order.Status.PENDING

    good = api_client.get(
        f"/api/v1/payment/callback/zarinpal/?tracking={tracking}&Authority=AUTH-BYPASS-1"
    )
    assert good.status_code == 200
    tx.refresh_from_db()
    assert tx.status == PurchaseTransaction.Status.SUCCESS
