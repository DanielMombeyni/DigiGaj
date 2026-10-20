"""Regression tests for shop product list filters (display price + rating)."""

import pytest
from rest_framework.test import APIClient

from app.filters.product import ProductFilter, ProductOrderingFilter
from app.models import Category, Product, ProductColor, ProductVariant
from app.services.product_display_price import annotate_display_price
from app.serializers import ProductListSerializer


@pytest.fixture
def api():
    return APIClient()


def _product(**kwargs):
    n = Product.objects.count() + 1
    defaults = {
        "name": f"Gadget {n}",
        "slug": f"gadget-{n}",
        "sku": f"SKU-PF-{n}",
        "price_toman": 1_000_000,
        "stock": 5,
        "is_active": True,
        "rating": 0,
    }
    defaults.update(kwargs)
    return Product.objects.create(**defaults)


def _variant(product, *, price=None, is_active=True, color_name="default"):
    color = ProductColor.objects.create(
        product=product,
        name=f"{color_name}-{ProductColor.objects.filter(product=product).count()}",
    )
    return ProductVariant.objects.create(
        product=product,
        color=color,
        price_toman=price,
        stock=3,
        is_active=is_active,
    )


@pytest.mark.django_db
def test_display_price_annotation_matches_serializer_min_price():
    base = _product(price_toman=5_000_000)
    _variant(base, price=2_000_000, color_name="a")
    _variant(base, price=3_000_000, color_name="b")
    _variant(base, price=500_000, is_active=False, color_name="off")

    plain = _product(price_toman=750_000, slug="plain-no-var", sku="SKU-PLAIN")
    on_req = _product(
        price_toman=9_000_000,
        price_on_request=True,
        slug="on-req",
        sku="SKU-OR",
    )

    qs = annotate_display_price(Product.objects.filter(id__in=[base.id, plain.id, on_req.id]))
    by_id = {p.id: p for p in qs}

    assert by_id[base.id].display_price == 2_000_000
    assert ProductListSerializer(base).data["min_price"] == 2_000_000

    assert by_id[plain.id].display_price == 750_000
    assert ProductListSerializer(plain).data["min_price"] == 750_000

    assert by_id[on_req.id].display_price is None
    assert ProductListSerializer(on_req).data["min_price"] is None


@pytest.mark.django_db
def test_min_max_price_filter_uses_variant_display_price():
    cheap_variant = _product(price_toman=10_000_000, slug="v-cheap", sku="SKU-VC")
    _variant(cheap_variant, price=1_500_000)

    expensive_base = _product(price_toman=8_000_000, slug="exp-base", sku="SKU-EB")

    on_req = _product(
        price_toman=100_000,
        price_on_request=True,
        slug="or-price",
        sku="SKU-OR2",
    )

    qs = Product.objects.filter(id__in=[cheap_variant.id, expensive_base.id, on_req.id])
    filtered = ProductFilter(
        data={"max_price": "2000000"},
        queryset=qs,
    ).qs
    ids = set(filtered.values_list("id", flat=True))
    assert cheap_variant.id in ids
    assert expensive_base.id not in ids
    assert on_req.id not in ids

    filtered_min = ProductFilter(
        data={"min_price": "7000000"},
        queryset=qs,
    ).qs
    ids_min = set(filtered_min.values_list("id", flat=True))
    assert expensive_base.id in ids_min
    assert cheap_variant.id not in ids_min


@pytest.mark.django_db
def test_price_ordering_uses_display_price():
    high_base_low_var = _product(price_toman=9_000_000, slug="ord-a", sku="SKU-OA")
    _variant(high_base_low_var, price=1_000_000)

    mid = _product(price_toman=3_000_000, slug="ord-b", sku="SKU-OB")
    low = _product(price_toman=500_000, slug="ord-c", sku="SKU-OC")

    class _Req:
        query_params = {"ordering": "price_toman"}

    qs = Product.objects.filter(id__in=[high_base_low_var.id, mid.id, low.id])
    ordered = ProductOrderingFilter().filter_queryset(_Req(), qs, view=None)
    slugs = list(ordered.values_list("slug", flat=True))
    assert slugs == ["ord-c", "ord-a", "ord-b"]


@pytest.mark.django_db
def test_min_rating_excludes_unrated_zero():
    unrated = _product(rating=0, slug="rate-0", sku="SKU-R0")
    rated = _product(rating=4, slug="rate-4", sku="SKU-R4")
    low = _product(rating=1, slug="rate-1", sku="SKU-R1")

    qs = Product.objects.filter(id__in=[unrated.id, rated.id, low.id])
    filtered = ProductFilter(data={"min_rating": "3"}, queryset=qs).qs
    ids = set(filtered.values_list("id", flat=True))
    assert rated.id in ids
    assert unrated.id not in ids
    assert low.id not in ids

    at_one = ProductFilter(data={"min_rating": "1"}, queryset=qs).qs
    ids_one = set(at_one.values_list("id", flat=True))
    assert unrated.id not in ids_one
    assert rated.id in ids_one
    assert low.id in ids_one


@pytest.mark.django_db
def test_products_list_api_price_filter(api):
    p = _product(price_toman=10_000_000, slug="api-v", sku="SKU-API-V")
    _variant(p, price=1_200_000)
    other = _product(price_toman=5_000_000, slug="api-plain", sku="SKU-API-P")

    res = api.get("/api/v1/products/", {"max_price": 2_000_000, "page_size": 50})
    assert res.status_code == 200
    results = res.data.get("results", res.data)
    slugs = {row["slug"] for row in results}
    assert "api-v" in slugs
    assert "api-plain" not in slugs
    hit = next(row for row in results if row["slug"] == "api-v")
    assert hit["min_price"] == 1_200_000


@pytest.mark.django_db
def test_price_stats_includes_category_descendants_and_excludes_on_request(api):
    root = Category.objects.create(name="Root", slug="root-ps", sort_order=1)
    child = Category.objects.create(name="Child", slug="child-ps", parent=root, sort_order=1)
    other = Category.objects.create(name="Other", slug="other-ps", sort_order=2)

    in_child = _product(price_toman=2_000_000, slug="ps-child", sku="SKU-PS-C", category=child)
    in_root = _product(price_toman=8_000_000, slug="ps-root", sku="SKU-PS-R", category=root)
    elsewhere = _product(price_toman=500_000, slug="ps-other", sku="SKU-PS-O", category=other)
    on_req = _product(
        price_toman=100_000,
        price_on_request=True,
        slug="ps-or",
        sku="SKU-PS-OR",
        category=child,
    )
    _variant(in_child, price=1_500_000)

    all_res = api.get("/api/v1/products/price-stats/")
    assert all_res.status_code == 200
    assert all_res.data["has_priced_products"] is True
    assert all_res.data["min_price"] == 500_000
    assert all_res.data["max_price"] == 8_000_000

    root_res = api.get("/api/v1/products/price-stats/", {"category": root.id})
    assert root_res.status_code == 200
    assert root_res.data["has_priced_products"] is True
    # Child variant display (1.5M) + root base (8M); excludes on-request and other category
    assert root_res.data["min_price"] == 1_500_000
    assert root_res.data["max_price"] == 8_000_000

    child_res = api.get("/api/v1/products/price-stats/", {"category": child.id})
    assert child_res.status_code == 200
    assert child_res.data["min_price"] == 1_500_000
    assert child_res.data["max_price"] == 1_500_000

    empty = Category.objects.create(name="Empty", slug="empty-ps", sort_order=9)
    empty_res = api.get("/api/v1/products/price-stats/", {"category": empty.id})
    assert empty_res.status_code == 200
    assert empty_res.data["has_priced_products"] is False
    assert empty_res.data["min_price"] is None
    assert empty_res.data["max_price"] is None

    assert elsewhere.id and on_req.id and in_root.id
