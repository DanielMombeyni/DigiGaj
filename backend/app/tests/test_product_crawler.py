"""Raw HTTP regressions with real unsaved models; database access stays blocked."""

import json
from datetime import datetime, timezone
from html.parser import HTMLParser
from http.client import HTTPConnection
from pathlib import Path
from threading import Thread
from unittest.mock import MagicMock
from wsgiref.simple_server import WSGIRequestHandler, make_server
from xml.etree import ElementTree

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.handlers.wsgi import WSGIHandler
from django.db.models import QuerySet

from app.models import (
    Product,
    ProductAttribute,
    ProductColor,
    ProductImage,
    ProductVariant,
)
from app.services.product_metadata import product_metadata
from app.views import product_html


class Head(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.meta = {}
        self.canonical = []
        self.json_ld = []
        self.in_json = False
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            key = attrs.get("name") or attrs.get("property")
            self.meta.setdefault(key, []).append(attrs.get("content"))
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs["href"])
        if tag == "script" and attrs.get("id") == "seo-jsonld":
            self.in_json = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.in_json = False

    def handle_data(self, data):
        if self.in_json:
            self.json_ld.append(data)


@pytest.fixture
def product():
    product = Product(
        pk=2234,
        name='Gadget "A" & <B>',
        slug="gadget-a",
        price_toman=120000,
        stock=3,
        brand="Acme",
    )
    product._prefetched_objects_cache = {
        key: [] for key in ("colors", "sizes", "variants", "images", "attributes")
    }
    return product


@pytest.fixture(autouse=True)
def crawler_settings(settings, monkeypatch):
    settings.FRONTEND_URL = "https://store.example"
    settings.FRONTEND_HTML_URL = "http://frontend/index.html"
    settings.ALLOWED_HOSTS = ["testserver", "127.0.0.1"]
    monkeypatch.setattr(
        product_html,
        "get_public_pages_settings",
        lambda: {"enabled": {"products": True}},
    )


@pytest.fixture
def document(monkeypatch, product):
    queryset = MagicMock(spec=QuerySet)
    queryset.model = Product
    queryset.prefetch_related.return_value = queryset
    queryset.get.return_value = product
    monkeypatch.setattr(product_html, "public_products", lambda: queryset)
    shell = (
        Path(__file__).resolve().parents[3] / "frontend" / "index.html"
    ).read_bytes()
    upstream = MagicMock(status_code=200, content=shell)
    fetch = MagicMock(return_value=upstream)
    monkeypatch.setattr(product_html.requests, "get", fetch)
    return queryset, fetch


def parse(response):
    assert response.status_code == 200
    return Head(response.content.decode())


def test_initial_html_identity_price_and_no_duplicate_tags(client, document, product):
    product.compare_at_price_toman = 150000
    response = client.get("/products/gadget-a")
    head = parse(response)
    assert head.meta["product_id"] == ["2234"]
    assert head.meta["product_name"] == [product.name]
    assert head.meta["product_price"] == ["120000"]
    assert head.meta["product_old_price"] == ["150000"]
    assert head.meta["availability"] == ["instock"]
    assert head.meta["og:type"] == ["product"]
    assert head.canonical == ["https://store.example/products/gadget-a"]
    assert "guarantee" not in head.meta
    assert "og:image" not in head.meta
    assert all(len(values) == 1 for values in head.meta.values())
    assert '<div id="root"></div>' in response.content.decode()
    assert "/src/main.jsx" in response.content.decode()
    assert response["Cache-Control"] == "no-store"
    assert json.loads("".join(head.json_ld))["offers"]["price"] == "1200000"
    document[1].assert_called_once_with(
        "http://frontend/index.html", timeout=5, allow_redirects=False
    )


@pytest.mark.parametrize("old", [None, 100000, 120000])
def test_no_invented_old_price(client, document, product, old):
    product.compare_at_price_toman = old
    assert "product_old_price" not in parse(client.get("/products/gadget-a")).meta


@pytest.mark.parametrize(
    "field,value", [("stock", 0), ("price_on_request", True), ("price_toman", 0)]
)
def test_unavailable_and_contact_price(client, document, product, field, value):
    setattr(product, field, value)
    head = parse(client.get("/products/gadget-a"))
    assert head.meta["availability"] == ["outofstock"]
    if field != "stock":
        assert "product_price" not in head.meta
        assert "price" not in json.loads("".join(head.json_ld))["offers"]


def test_primary_image_absolute_and_missing_image_skipped(
    client, document, product, settings
):
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }
    default_storage.save("products/real.jpg", ContentFile(b"image"))
    product._prefetched_objects_cache["images"] = [
        ProductImage(pk=1, image="products/missing.jpg", is_primary=True),
        ProductImage(pk=2, image="products/real.jpg", sort_order=1),
    ]
    head = parse(client.get("/products/gadget-a"))
    assert head.meta["og:image"] == ["https://store.example/media/products/real.jpg"]
    assert json.loads("".join(head.json_ld))["image"] == head.meta["og:image"][0]


def test_warranty_and_html_script_escaping(client, document, product):
    product.name = '</script><script>alert("x")</script> & "Gadget"'
    product._prefetched_objects_cache["attributes"] = [
        ProductAttribute(name="گارانتی", value='Actual "Warranty" <24>')
    ]
    response = client.get("/products/gadget-a")
    head = parse(response)
    assert head.meta["product_name"] == [product.name]
    assert head.meta["guarantee"] == ['Actual "Warranty" <24>']
    assert product.name not in response.content.decode()
    assert json.loads("".join(head.json_ld))["name"] == product.name


def test_warranty_from_visible_specs_only(product):
    product.specs = {"warranty": "Actual guarantee"}
    assert product_metadata(product)["guarantee"] == "Actual guarantee"
    product._prefetched_objects_cache["attributes"] = [
        ProductAttribute(name="material", value="steel")
    ]
    assert product_metadata(product)["guarantee"] is None


def test_variant_price_availability_and_shared_api_default(client, document, product):
    product._prefetched_objects_cache["colors"] = [
        ProductColor(pk=1, name="Red"),
        ProductColor(pk=2, name="Blue"),
    ]
    product._prefetched_objects_cache["variants"] = [
        ProductVariant(pk=1, color_id=1, price_toman=50000, stock=0),
        ProductVariant(pk=2, color_id=2, price_toman=140000, stock=2),
        ProductVariant(pk=3, color_id=1, price_toman=10000, stock=10, is_active=False),
    ]
    metadata = product_metadata(product)
    assert (metadata["price"], metadata["color_id"], metadata["availability"]) == (
        140000,
        2,
        "instock",
    )
    head = parse(client.get("/products/gadget-a"))
    assert head.meta["product_price"] == ["140000"]
    from app.serializers import ProductDetailSerializer

    assert ProductDetailSerializer().get_crawler_metadata(product) == metadata
    product._prefetched_objects_cache["variants"][1].stock = 0
    assert product_metadata(product)["availability"] == "outofstock"


def test_variant_base_fallback_and_missing_combination(product):
    product._prefetched_objects_cache["colors"] = [ProductColor(pk=1, name="Red")]
    product._prefetched_objects_cache["variants"] = [
        ProductVariant(pk=1, color_id=1, stock=2)
    ]
    assert product_metadata(product)["price"] == product.price_toman
    product._prefetched_objects_cache["variants"] = []
    assert product_metadata(product)["availability"] == "outofstock"


def test_unknown_or_unpublished_document_returns_404(client, document):
    document[0].get.side_effect = Product.DoesNotExist
    assert client.get("/products/not-public").status_code == 404
    document[1].assert_not_called()


def test_public_queryset_filters_and_newest_order(monkeypatch):
    queryset = product_html.public_products()
    assert queryset.query.order_by == ("-created_at", "-pk")
    assert "is_active" in str(queryset.query)
    monkeypatch.setattr(
        product_html,
        "get_public_pages_settings",
        lambda: {"enabled": {"products": False}},
    )
    assert product_html.public_products().query.is_empty()


@pytest.mark.parametrize(
    "shell_status,content", [(503, b"unavailable"), (200, b"<html></html>")]
)
def test_missing_frontend_fails_with_503(client, document, shell_status, content):
    document[1].return_value.status_code = shell_status
    document[1].return_value.content = content
    assert client.get("/products/gadget-a").status_code == 503


def test_frontend_timeout_and_head_request(client, document):
    import requests

    assert client.head("/products/gadget-a").status_code == 200
    document[1].side_effect = requests.Timeout("internal frontend unavailable")
    response = client.get("/products/gadget-a")
    assert response.status_code == 503 and response["Retry-After"] == "30"


def test_zero_variant_price_is_not_advertised_as_purchasable(product):
    product._prefetched_objects_cache["colors"] = [ProductColor(pk=1, name="Red")]
    product._prefetched_objects_cache["variants"] = [
        ProductVariant(pk=1, color_id=1, stock=2, price_toman=0)
    ]
    metadata = product_metadata(product)
    assert metadata["price"] is None
    assert metadata["availability"] == "outofstock"


class Products(list):
    def only(self, *fields):
        return self


def test_sitemap_pagination_absolute_urls_escaping_and_robots(client, monkeypatch):
    products = Products(
        [
            Product(
                pk=n,
                name=str(n),
                slug=f"کالا-{n}",
                created_at=datetime(2026, 1, n, tzinfo=timezone.utc),
                updated_at=datetime(2026, 1, n, tzinfo=timezone.utc),
            )
            for n in [3, 2, 1]
        ]
    )
    monkeypatch.setattr(product_html, "public_products", lambda: products)
    monkeypatch.setattr(product_html, "SITEMAP_PAGE_SIZE", 2)
    ns = {"s": product_html.SITEMAP_NS}
    index = ElementTree.fromstring(client.get("/sitemap.xml").content)
    assert [n.text for n in index.findall("s:sitemap/s:loc", ns)] == [
        "https://store.example/sitemap-products.xml?p=1",
        "https://store.example/sitemap-products.xml?p=2",
    ]
    urls = []
    for page in (1, 2):
        response = client.get(f"/sitemap-products.xml?p={page}")
        assert response.status_code == 200
        urls.extend(
            n.text
            for n in ElementTree.fromstring(response.content).findall("s:url/s:loc", ns)
        )
    assert len(urls) == 3 and len(set(urls)) == 3
    assert urls[0].endswith("-3") and urls[-1].endswith("-1")
    assert all(url.startswith("https://store.example/products/%") for url in urls)
    for page in ("0", "-1", "3", "bad"):
        assert client.get(f"/sitemap-products.xml?p={page}").status_code == 404
    robots = client.get("/robots.txt").content.decode()
    assert "Disallow: /admin" in robots
    assert "Sitemap: https://store.example/sitemap.xml" in robots


def test_real_loopback_http_response_contains_metadata(document):
    class QuietHandler(WSGIRequestHandler):
        def log_message(self, *args):
            pass

    with make_server(
        "127.0.0.1", 0, WSGIHandler(), handler_class=QuietHandler
    ) as server:
        server.timeout = 5
        thread = Thread(target=server.handle_request, daemon=True)
        thread.start()
        connection = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
        try:
            connection.request("GET", "/products/gadget-a")
            response = connection.getresponse()
            assert response.status == 200
            head = Head(response.read().decode())
            assert head.meta["product_id"] == ["2234"]
            assert head.meta["product_price"] == ["120000"]
        finally:
            connection.close()
            thread.join(timeout=5)


@pytest.mark.django_db
def test_database_discovery_excludes_inactive_and_orders_newest(client, monkeypatch):
    """Only run after the documented isolated Postgres runtime checklist."""
    monkeypatch.setattr(product_html, "SITEMAP_PAGE_SIZE", 2)
    rows = [
        Product.objects.create(
            name=f"Product {n}", slug=f"product-{n}", price_toman=100, stock=1
        )
        for n in range(3)
    ]
    Product.objects.create(
        name="Private", slug="private", price_toman=100, is_active=False
    )
    Product.objects.filter(pk=rows[0].pk).update(display_priority=9999)
    urls = []
    ns = {"s": product_html.SITEMAP_NS}
    for page in (1, 2):
        response = client.get(f"/sitemap-products.xml?p={page}")
        assert response.status_code == 200
        urls.extend(
            n.text
            for n in ElementTree.fromstring(response.content).findall("s:url/s:loc", ns)
        )
    assert urls == [f"https://store.example/products/product-{n}" for n in (2, 1, 0)]
    assert client.get("/products/private").status_code == 404


@pytest.mark.django_db
def test_database_detail_raw_html_and_disabled_storefront(client, monkeypatch):
    product = Product.objects.create(
        name="Public product", slug="public-product", price_toman=123000, stock=1
    )
    shell = (
        Path(__file__).resolve().parents[3] / "frontend" / "index.html"
    ).read_bytes()
    monkeypatch.setattr(
        product_html.requests,
        "get",
        MagicMock(return_value=MagicMock(status_code=200, content=shell)),
    )
    head = parse(client.get("/products/public-product"))
    assert head.meta["product_id"] == [str(product.pk)]
    assert head.meta["product_price"] == ["123000"]
    monkeypatch.setattr(
        product_html,
        "get_public_pages_settings",
        lambda: {"enabled": {"products": False}},
    )
    assert client.get("/products/public-product").status_code == 404
    assert b"public-product" not in client.get("/sitemap-products.xml").content
