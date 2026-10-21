"""Per-color product image: API exposure, upload/clear endpoints, persistence."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from app.models import Product, ProductColor, ProductVariant

# 1x1 transparent GIF — a valid image file Pillow accepts
GIF_BYTES = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04"
    b"\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D"
    b"\x01\x00;"
)


def _upload(name="color.gif"):
    return SimpleUploadedFile(name, GIF_BYTES, content_type="image/gif")


@pytest.fixture
def media_root(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def staff_api():
    from django.contrib.auth import get_user_model

    client = APIClient()
    user = get_user_model().objects.create_user(
        "coloradmin", "coloradmin@example.com", "x", is_staff=True, is_superuser=True
    )
    client.force_authenticate(user=user)
    return client


def _product_with_colors(count=2):
    n = Product.objects.count() + 1
    product = Product.objects.create(
        name=f"ColorProd {n}",
        slug=f"colorprod-{n}",
        sku=f"SKU-CI-{n}",
        price_toman=100_000,
        stock=5,
    )
    colors = [
        ProductColor.objects.create(
            product=product, name=f"color-{i}", hex_code="#112233", sort_order=i
        )
        for i in range(count)
    ]
    for c in colors:
        ProductVariant.objects.create(product=product, color=c, stock=2)
    return product, colors


def _detail(api_client, slug):
    res = api_client.get(f"/api/v1/products/{slug}/")
    assert res.status_code == 200
    return res.json()


@pytest.mark.django_db
def test_detail_exposes_per_color_image(api, media_root):
    product, colors = _product_with_colors()
    colors[0].image.save("red.gif", _upload("red.gif"), save=True)

    data = _detail(api, product.slug)
    by_id = {c["id"]: c for c in data["colors"]}
    assert by_id[colors[0].id]["image"] is not None
    assert "red" in by_id[colors[0].id]["image"]
    # Color without an assigned image → null (frontend falls back to default)
    assert by_id[colors[1].id]["image"] is None


@pytest.mark.django_db
def test_staff_upload_sets_image_and_persists_across_reload(staff_api, api, media_root):
    product, colors = _product_with_colors()
    url = f"/api/v1/products/{product.slug}/colors/{colors[1].id}/image/"

    res = staff_api.post(url, {"image": _upload("blue.gif")}, format="multipart")
    assert res.status_code == 201
    assert res.json()["image"] is not None

    colors[1].refresh_from_db()
    assert bool(colors[1].image)

    # Persisted through a fresh (unauthenticated) detail fetch
    data = _detail(api, product.slug)
    by_id = {c["id"]: c for c in data["colors"]}
    assert by_id[colors[1].id]["image"] is not None


@pytest.mark.django_db
def test_staff_upload_replaces_previous_file(staff_api, media_root):
    product, colors = _product_with_colors()
    url = f"/api/v1/products/{product.slug}/colors/{colors[0].id}/image/"

    first = staff_api.post(url, {"image": _upload("one.gif")}, format="multipart")
    assert first.status_code == 201
    colors[0].refresh_from_db()
    old_path = colors[0].image.path

    second = staff_api.post(url, {"image": _upload("two.gif")}, format="multipart")
    assert second.status_code == 201
    colors[0].refresh_from_db()
    assert colors[0].image.path != old_path
    import os

    assert not os.path.exists(old_path)


@pytest.mark.django_db
def test_staff_delete_clears_image(staff_api, api, media_root):
    product, colors = _product_with_colors()
    url = f"/api/v1/products/{product.slug}/colors/{colors[0].id}/image/"
    staff_api.post(url, {"image": _upload("x.gif")}, format="multipart")

    res = staff_api.delete(url)
    assert res.status_code == 200
    assert res.json()["image"] is None

    colors[0].refresh_from_db()
    assert not colors[0].image

    data = _detail(api, product.slug)
    by_id = {c["id"]: c for c in data["colors"]}
    assert by_id[colors[0].id]["image"] is None


@pytest.mark.django_db
def test_upload_requires_file(staff_api, media_root):
    product, colors = _product_with_colors()
    url = f"/api/v1/products/{product.slug}/colors/{colors[0].id}/image/"
    res = staff_api.post(url, {}, format="multipart")
    assert res.status_code == 400


@pytest.mark.django_db
def test_unknown_or_foreign_color_returns_404(staff_api, media_root):
    product, _ = _product_with_colors()
    other, other_colors = _product_with_colors()

    res = staff_api.post(
        f"/api/v1/products/{product.slug}/colors/999999/image/",
        {"image": _upload("x.gif")},
        format="multipart",
    )
    assert res.status_code == 404

    # A color that exists but belongs to a different product
    res = staff_api.post(
        f"/api/v1/products/{product.slug}/colors/{other_colors[0].id}/image/",
        {"image": _upload("x.gif")},
        format="multipart",
    )
    assert res.status_code == 404


@pytest.mark.django_db
def test_anonymous_cannot_set_or_clear_color_image(api, media_root):
    product, colors = _product_with_colors()
    url = f"/api/v1/products/{product.slug}/colors/{colors[0].id}/image/"

    res = api.post(url, {"image": _upload("x.gif")}, format="multipart")
    assert res.status_code in (401, 403)
    res = api.delete(url)
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_product_write_sync_preserves_color_image(staff_api, api, media_root):
    """Admin full-form saves (colors re-sync) must not wipe image assignments."""
    product, colors = _product_with_colors()
    staff_api.post(
        f"/api/v1/products/{product.slug}/colors/{colors[0].id}/image/",
        {"image": _upload("keep.gif")},
        format="multipart",
    )

    res = staff_api.patch(
        f"/api/v1/products/{product.slug}/",
        {
            "colors": [
                {"id": colors[0].id, "name": "renamed", "hex_code": "#445566", "sort_order": 0},
                {"id": colors[1].id, "name": colors[1].name, "hex_code": "#112233", "sort_order": 1},
            ]
        },
        format="json",
    )
    assert res.status_code == 200

    data = _detail(api, product.slug)
    by_name = {c["name"]: c for c in data["colors"]}
    assert by_name["renamed"]["image"] is not None
    assert by_name["color-1"]["image"] is None
