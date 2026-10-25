"""Public product presentation shared by HTML and the React detail API.

Catalog amounts are tomans. Coupon codes are checkout discounts, not public
product discounts; compare_at_price_toman is a manually maintained old price.
"""

from urllib.parse import urljoin, urlsplit

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.urls import reverse
from django.utils.encoding import iri_to_uri

from app.payment.utils import absolute_media_url


def storefront_url(path):
    base = settings.FRONTEND_URL.rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ImproperlyConfigured("FRONTEND_URL must be an absolute HTTP(S) URL")
    return iri_to_uri(urljoin(base + "/", path))


def product_url(product):
    return storefront_url(reverse("public-product", kwargs={"slug": product.slug}))


def product_metadata(product):
    colors = list(product.colors.all())
    sizes = list(product.sizes.all())
    has_options = bool(colors or sizes)
    variants = [v for v in product.variants.all() if v.is_active]
    # Match isPriceOnRequest / checkout: a zero base or zero advertised minimum
    # is not a fixed-price offer, even if a variant has a positive override.
    on_request = product.price_on_request or product.price_toman == 0
    if variants and min(product.resolve_price(v) for v in variants) == 0:
        on_request = True

    selected = None
    if has_options:
        color_ids = {c.pk for c in colors}
        size_ids = {s.pk for s in sizes}
        eligible = [
            v
            for v in variants
            if (v.color_id is None or v.color_id in color_ids)
            and (v.size_id is None or v.size_id in size_ids)
        ]
        # Prefer the cheapest purchasable offer; keep a deterministic display
        # price when every variant is sold out. React selects this same variant.
        stocked = [v for v in eligible if v.stock > 0 and product.resolve_price(v) > 0]
        selected = min(
            stocked or eligible,
            key=lambda v: (product.resolve_price(v), v.pk),
            default=None,
        )

    price = None if on_request else product.resolve_price(selected)
    stock = selected.stock if selected else (0 if has_options else product.stock)
    available = bool(
        product.is_active and stock > 0 and price and (not has_options or selected)
    )
    old_price = product.compare_at_price_toman
    if price is None or not old_price or old_price <= price:
        old_price = None

    images = sorted(
        product.images.all(), key=lambda i: (not i.is_primary, i.sort_order, i.pk)
    )
    image = None
    for row in images:
        # A stale ImageField path is not a publicly retrievable image.
        if row.image and row.image.storage.exists(row.image.name):
            image = storefront_url(absolute_media_url(row.image.url))
            break

    guarantee = next(
        (
            a.value.strip()
            for a in product.attributes.all()
            if a.name.strip().casefold()
            in {"گارانتی", "ضمانت", "guarantee", "warranty"}
            and a.value.strip()
        ),
        None,
    )
    if not guarantee and not list(product.attributes.all()):
        # This fallback is also displayed by ProductDetailPage when attributes
        # are absent. Arbitrary internal meta keys are never published.
        specs = product.specs if isinstance(product.specs, dict) else {}
        guarantee = next(
            (
                str(v).strip()
                for k, v in specs.items()
                if k.strip().casefold() in {"گارانتی", "ضمانت", "guarantee", "warranty"}
                and isinstance(v, str)
                and v.strip()
            ),
            None,
        )

    return {
        "product_id": str(product.pk),
        "product_name": product.name,
        "price": price,
        "old_price": old_price,
        "availability": "instock" if available else "outofstock",
        "image": image,
        "guarantee": guarantee,
        "url": product_url(product),
        "color_id": selected.color_id if selected else None,
        "size_id": selected.size_id if selected else None,
    }
