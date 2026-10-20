"""Regression tests for Product.display_priority storefront ordering."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from app.filters.product import ProductOrderingFilter
from app.models import Category, Product, DISPLAY_PRIORITY_MAX
from app.services.product_display_price import annotate_display_price

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def staff_api(db):
    user = User.objects.create_user(
        "prio-staff",
        "prio-staff@example.com",
        "Pass-12345",
        is_staff=True,
        is_superuser=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _product(**kwargs):
    n = Product.objects.count() + 1
    defaults = {
        "name": f"Prio Gadget {n}",
        "slug": f"prio-gadget-{n}",
        "sku": f"SKU-PRIO-{n}",
        "price_toman": 1_000_000 + n,
        "stock": 5,
        "is_active": True,
        "display_priority": 0,
    }
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


class _Req:
    def __init__(self, ordering=None):
        self.query_params = {}
        if ordering is not None:
            self.query_params["ordering"] = ordering


class _View:
    ordering_fields = ["price_toman", "created_at", "name"]
    ordering = ["-display_priority", "-created_at"]


def _ordered_slugs(qs, ordering=None):
    return list(
        ProductOrderingFilter()
        .filter_queryset(_Req(ordering), qs, _View())
        .values_list("slug", flat=True)
    )


@pytest.mark.django_db
def test_default_ordering_by_display_priority():
    low = _product(slug="prio-low", sku="SKU-PL", display_priority=1, price_toman=100)
    high = _product(slug="prio-high", sku="SKU-PH", display_priority=10, price_toman=200)
    mid = _product(slug="prio-mid", sku="SKU-PM", display_priority=5, price_toman=300)
    qs = Product.objects.filter(id__in=[low.id, high.id, mid.id])
    assert _ordered_slugs(qs, ordering=None) == ["prio-high", "prio-mid", "prio-low"]


@pytest.mark.django_db
def test_equal_priority_falls_back_to_newest_then_id():
    older = _product(slug="prio-old", sku="SKU-PO", display_priority=3)
    newer = _product(slug="prio-new", sku="SKU-PN", display_priority=3)
    Product.objects.filter(pk=older.pk).update(
        created_at=timezone.now() - timedelta(days=2)
    )
    Product.objects.filter(pk=newer.pk).update(created_at=timezone.now())
    qs = Product.objects.filter(id__in=[older.id, newer.id])
    assert _ordered_slugs(qs, ordering=None) == ["prio-new", "prio-old"]


@pytest.mark.django_db
def test_priority_zero_products_remain_visible():
    boosted = _product(slug="prio-boost", sku="SKU-PB", display_priority=2)
    plain = _product(slug="prio-plain", sku="SKU-PP", display_priority=0)
    qs = Product.objects.filter(id__in=[boosted.id, plain.id])
    slugs = _ordered_slugs(qs, ordering=None)
    assert slugs == ["prio-boost", "prio-plain"]
    assert set(slugs) == {"prio-boost", "prio-plain"}


@pytest.mark.django_db
def test_explicit_newest_ignores_display_priority():
    old_high = _product(slug="old-high", sku="SKU-OH", display_priority=99)
    new_low = _product(slug="new-low", sku="SKU-NL", display_priority=0)
    Product.objects.filter(pk=old_high.pk).update(
        created_at=timezone.now() - timedelta(days=5)
    )
    Product.objects.filter(pk=new_low.pk).update(created_at=timezone.now())
    qs = Product.objects.filter(id__in=[old_high.id, new_low.id])
    assert _ordered_slugs(qs, ordering="-created_at") == ["new-low", "old-high"]


@pytest.mark.django_db
def test_explicit_price_ordering_ignores_display_priority():
    expensive = _product(
        slug="exp-prio", sku="SKU-EP", display_priority=50, price_toman=9_000_000
    )
    cheap = _product(
        slug="cheap-prio", sku="SKU-CP", display_priority=0, price_toman=100_000
    )
    qs = annotate_display_price(
        Product.objects.filter(id__in=[expensive.id, cheap.id])
    )
    assert _ordered_slugs(qs, ordering="price_toman") == ["cheap-prio", "exp-prio"]
    assert _ordered_slugs(qs, ordering="-price_toman") == ["exp-prio", "cheap-prio"]


@pytest.mark.django_db
def test_category_and_search_with_priority(api):
    cat = Category.objects.create(name="Prio Cat", slug="prio-cat", is_active=True)
    other = Category.objects.create(name="Other", slug="prio-other", is_active=True)
    a = _product(
        slug="cat-high",
        sku="SKU-CH",
        display_priority=8,
        category=cat,
        name="Alpha Widget",
        brand="Acme",
    )
    b = _product(
        slug="cat-low",
        sku="SKU-CL",
        display_priority=1,
        category=cat,
        name="Beta Widget",
        brand="Acme",
    )
    _product(
        slug="other-cat",
        sku="SKU-OC",
        display_priority=100,
        category=other,
        name="Gamma Widget",
    )

    res = api.get(
        "/api/v1/products/",
        {"category": cat.id, "search": "Widget", "page_size": 50},
    )
    assert res.status_code == 200
    results = res.data.get("results", res.data)
    slugs = [row["slug"] for row in results]
    assert slugs == ["cat-high", "cat-low"]
    assert res.data.get("count") == 2


@pytest.mark.django_db
def test_inactive_excluded_for_public(api):
    _product(slug="vis-active", sku="SKU-VA", display_priority=5, is_active=True)
    _product(slug="vis-off", sku="SKU-VO", display_priority=99, is_active=False)
    res = api.get("/api/v1/products/", {"page_size": 50})
    assert res.status_code == 200
    slugs = {row["slug"] for row in res.data.get("results", res.data)}
    assert "vis-active" in slugs
    assert "vis-off" not in slugs


@pytest.mark.django_db
def test_public_cannot_write_display_priority(api):
    p = _product(slug="pub-write", sku="SKU-PW", display_priority=0)
    res = api.patch(
        f"/api/v1/products/{p.slug}/",
        {"display_priority": 50},
        format="json",
    )
    assert res.status_code in (401, 403)
    p.refresh_from_db()
    assert p.display_priority == 0


@pytest.mark.django_db
def test_staff_can_update_display_priority(staff_api):
    p = _product(slug="staff-write", sku="SKU-SW", display_priority=0)
    res = staff_api.patch(
        f"/api/v1/products/{p.slug}/",
        {"display_priority": 42},
        format="json",
    )
    assert res.status_code == 200
    p.refresh_from_db()
    assert p.display_priority == 42


@pytest.mark.django_db
def test_display_priority_validation_bounds(staff_api):
    p = _product(slug="bound-prio", sku="SKU-BP", display_priority=0)
    over = staff_api.patch(
        f"/api/v1/products/{p.slug}/",
        {"display_priority": DISPLAY_PRIORITY_MAX + 1},
        format="json",
    )
    assert over.status_code == 400

    neg = staff_api.patch(
        f"/api/v1/products/{p.slug}/",
        {"display_priority": -1},
        format="json",
    )
    assert neg.status_code == 400

    frac = staff_api.patch(
        f"/api/v1/products/{p.slug}/",
        {"display_priority": 1.5},
        format="json",
    )
    assert frac.status_code == 400

    p.refresh_from_db()
    assert p.display_priority == 0


@pytest.mark.django_db
def test_list_api_default_uses_priority_and_pagination(api):
    for i in range(3):
        _product(
            slug=f"page-prio-{i}",
            sku=f"SKU-PG-{i}",
            display_priority=i,
            price_toman=1000 + i,
        )
    res = api.get("/api/v1/products/", {"page_size": 2})
    assert res.status_code == 200
    assert res.data["count"] >= 3
    assert len(res.data["results"]) == 2
    first_slugs = [r["slug"] for r in res.data["results"]]
    # Highest priority first among our fixtures (2 then 1 on first page if only these…)
    assert first_slugs[0] == "page-prio-2"


@pytest.mark.django_db
def test_model_field_default_and_max_constant():
    assert DISPLAY_PRIORITY_MAX == 9999
    p = _product(slug="model-default", sku="SKU-MD")
    assert p.display_priority == 0
    field = Product._meta.get_field("display_priority")
    assert field.default == 0


@pytest.mark.django_db
def test_authenticated_non_staff_cannot_patch_display_priority():
    user = User.objects.create_user(
        "prio-customer",
        "prio-customer@example.com",
        "Pass-12345",
        is_staff=False,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    p = _product(slug="cust-write", sku="SKU-CW", display_priority=3)
    res = client.patch(
        f"/api/v1/products/{p.slug}/",
        {"display_priority": 99},
        format="json",
    )
    assert res.status_code == 403
    p.refresh_from_db()
    assert p.display_priority == 3


@pytest.mark.django_db
def test_public_ordering_param_cannot_control_display_priority(api):
    """
    display_priority is not in ordering_fields, so client params are stripped
    and the list falls back to the store recommendation default (highest first).
    """
    low = _product(slug="ord-low", sku="SKU-OL", display_priority=1, price_toman=100)
    high = _product(slug="ord-high", sku="SKU-OH2", display_priority=20, price_toman=200)
    mid = _product(slug="ord-mid", sku="SKU-OM", display_priority=5, price_toman=150)
    ids = {low.id, high.id, mid.id}

    def slugs_for(ordering_param):
        res = api.get(
            "/api/v1/products/",
            {"ordering": ordering_param, "page_size": 50},
        )
        assert res.status_code == 200
        return [
            row["slug"]
            for row in res.data.get("results", res.data)
            if row["id"] in ids
        ]

    # Ascending priority would be low→mid→high if the public param were honored.
    assert slugs_for("display_priority") == ["ord-high", "ord-mid", "ord-low"]
    assert slugs_for("-display_priority") == ["ord-high", "ord-mid", "ord-low"]


@pytest.mark.django_db
def test_default_ordering_id_tiebreak_when_priority_and_created_equal():
    first = _product(slug="tie-a", sku="SKU-TA", display_priority=4)
    second = _product(slug="tie-b", sku="SKU-TB", display_priority=4)
    assert first.id < second.id
    fixed = timezone.now()
    Product.objects.filter(id__in=[first.id, second.id]).update(
        display_priority=4,
        created_at=fixed,
    )
    qs = Product.objects.filter(id__in=[first.id, second.id])
    assert _ordered_slugs(qs, ordering=None) == ["tie-a", "tie-b"]
