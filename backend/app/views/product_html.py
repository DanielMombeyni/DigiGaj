"""Crawler-readable product pages using the deployed frontend's exact shell."""

import json
import logging
import re
from xml.etree.ElementTree import Element, SubElement, tostring

import requests
from django.conf import settings
from django.core.paginator import InvalidPage, Paginator
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.views.decorators.http import require_safe

from app.models import Product
from app.services.product_metadata import product_metadata, product_url, storefront_url
from app.services.public_pages import get_public_pages_settings

logger = logging.getLogger(__name__)
SEO_BLOCK = re.compile(
    r"<!-- product-seo:start -->.*?<!-- product-seo:end -->", re.DOTALL
)
SITEMAP_PAGE_SIZE = 5000
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"


def public_products():
    if not get_public_pages_settings()["enabled"]["products"]:
        return Product.objects.none()
    return Product.objects.filter(is_active=True).order_by("-created_at", "-pk")


@require_safe
def product_detail_html(request, slug):
    product = get_object_or_404(
        public_products().prefetch_related(
            "colors", "sizes", "variants", "images", "attributes"
        ),
        slug=slug,
    )
    metadata = product_metadata(product)
    description = product.short_description or product.description or product.name
    offer = {
        "@type": "Offer",
        "priceCurrency": "IRR",
        "url": metadata["url"],
        "availability": "https://schema.org/"
        + ("InStock" if metadata["availability"] == "instock" else "OutOfStock"),
    }
    if metadata["price"] is not None:
        offer["price"] = str(metadata["price"] * 10)
    structured = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "description": description,
        "offers": offer,
    }
    if metadata["image"]:
        structured["image"] = metadata["image"]
    if product.brand:
        structured["brand"] = {"@type": "Brand", "name": product.brand}
    # Prevent closing a script element through product-controlled text.
    json_ld = (
        json.dumps(structured, ensure_ascii=True)
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )
    head = render_to_string(
        "shop/product_head.html",
        {
            "product": product,
            "metadata": metadata,
            "description": description,
            "json_ld": json_ld,
        },
    )
    try:
        # Fixed operator-configured internal URL; no user URL, headers, cookies
        # or query strings are forwarded. /index.html avoids product proxy loops.
        upstream = requests.get(
            settings.FRONTEND_HTML_URL, timeout=5, allow_redirects=False
        )
        if upstream.status_code != 200:
            raise ValueError("Frontend shell unavailable")
        shell = upstream.content.decode("utf-8")
        if len(SEO_BLOCK.findall(shell)) != 1:
            raise ValueError("Frontend shell missing its unique SEO insertion marker")
    except (requests.RequestException, ValueError, UnicodeError):
        logger.exception("Unable to load product HTML shell")
        return HttpResponse(
            "Product page temporarily unavailable",
            status=503,
            headers={"Retry-After": "30"},
        )
    html = SEO_BLOCK.sub(lambda _: head, shell, count=1)
    response = HttpResponse(html)
    response["Cache-Control"] = "no-store"
    return response


def _xml_response(root):
    return HttpResponse(
        tostring(root, encoding="utf-8", xml_declaration=True),
        content_type="application/xml",
    )


@require_safe
def sitemap_index(request):
    pages = Paginator(public_products().only("pk"), SITEMAP_PAGE_SIZE).num_pages
    root = Element("sitemapindex", xmlns=SITEMAP_NS)
    for page in range(1, pages + 1):
        item = SubElement(root, "sitemap")
        SubElement(item, "loc").text = storefront_url(f"/sitemap-products.xml?p={page}")
    return _xml_response(root)


@require_safe
def product_sitemap(request):
    paginator = Paginator(
        public_products().only("pk", "slug", "updated_at", "created_at"),
        SITEMAP_PAGE_SIZE,
    )
    try:
        page = paginator.page(request.GET.get("p", "1"))
    except (InvalidPage, ValueError, TypeError):
        raise Http404("Sitemap page not found")
    root = Element("urlset", xmlns=SITEMAP_NS)
    for product in page:
        item = SubElement(root, "url")
        SubElement(item, "loc").text = product_url(product)
        SubElement(item, "lastmod").text = product.updated_at.isoformat()
    return _xml_response(root)


@require_safe
def robots_txt(request):
    # Preserve the existing sensitive-route exclusions.
    paths = [
        "/panel-dashboard",
        "/panel-dashboard/login",
        "/admin",
        "/login",
        "/checkout",
        "/cart",
        "/payment/",
    ]
    body = "User-agent: *\nAllow: /\n" + "".join(
        f"Disallow: {path}\n" for path in paths
    )
    return HttpResponse(
        body + "\nSitemap: " + storefront_url("/sitemap.xml") + "\n",
        content_type="text/plain",
    )
