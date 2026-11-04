"""JavaScript-free editorial pages, isolated from the storefront shell."""

import json
from xml.etree.ElementTree import Element, SubElement

from django.http import Http404, HttpResponsePermanentRedirect
from django.shortcuts import render
from django.views.decorators.http import require_safe

from app.content.blog import ARTICLES
from app.services.product_metadata import storefront_url
from app.views.product_html import SITEMAP_NS, _xml_response


@require_safe
def blog_page(request, slug=None):
    article = next((item for item in ARTICLES if item["slug"] == slug), None)
    if slug is not None and article is None:
        raise Http404("Article not found")
    path = f"/blog/{slug}/" if slug else "/blog/"
    if request.path != path:
        return HttpResponsePermanentRedirect(path)
    canonical = storefront_url(path)
    title = article["title"] if article else "مجله دیجی‌گج؛ راهنمای انتخاب و خرید گجت"
    description = article["description"] if article else "راهنماهای کاربردی انتخاب لوازم جانبی، شارژ و صدا؛ برای مقایسه آگاهانه پیش از خرید از دیجی‌گج."
    structured = {
        "@context": "https://schema.org",
        "@type": "BlogPosting" if article else "Blog",
        "name": title,
        "url": canonical,
        "description": description,
        "inLanguage": "fa-IR",
        "publisher": {"@type": "Organization", "name": "دیجی‌گج", "url": storefront_url("/")},
    }
    if article:
        structured.update({
            "headline": title,
            "datePublished": article["published"],
            "dateModified": article["updated"],
            "author": {"@type": "Organization", "name": "تحریریه دیجی‌گج"},
            "mainEntityOfPage": canonical,
        })
    json_ld = json.dumps(structured, ensure_ascii=True).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    return render(request, "blog/page.html", {
        "article": article, "articles": ARTICLES, "title": title,
        "description": description, "canonical": canonical, "json_ld": json_ld,
        "store_url": storefront_url("/"),
    })


@require_safe
def blog_sitemap(request):
    root = Element("urlset", xmlns=SITEMAP_NS)
    index = SubElement(root, "url")
    SubElement(index, "loc").text = storefront_url("/blog/")
    for article in ARTICLES:
        item = SubElement(root, "url")
        SubElement(item, "loc").text = storefront_url(f'/blog/{article["slug"]}/')
        SubElement(item, "lastmod").text = article["updated"]
    return _xml_response(root)
