import json
from xml.etree import ElementTree

import pytest

from app.content.blog import ARTICLES


@pytest.fixture(autouse=True)
def blog_origin(settings):
    settings.FRONTEND_URL = "https://digigadg.ir"


def test_blog_index_contains_crawlable_articles_and_store_link(client):
    response = client.get("/blog/")
    html = response.content.decode()
    assert response.status_code == 200
    assert '<html lang="fa" dir="rtl">' in html
    assert 'href="https://digigadg.ir/"' in html
    for article in ARTICLES:
        assert f'/blog/{article["slug"]}/' in html
        assert article["title"] in html
    assert 'rel="canonical" href="https://digigadg.ir/blog/"' in html


@pytest.mark.parametrize("article", ARTICLES)
def test_article_is_complete_without_javascript(client, article):
    response = client.get(f'/blog/{article["slug"]}/')
    html = response.content.decode()
    assert response.status_code == 200
    for heading, text in article["sections"]:
        assert heading in html
        assert text in html
    raw = html.split('<script type="application/ld+json">')[1].split('</script>')[0]
    data = json.loads(raw)
    assert data["@type"] == "BlogPosting"
    assert data["dateModified"] == article["updated"]
    assert data["url"] == f'https://digigadg.ir/blog/{article["slug"]}/'
    assert 'src="' not in html


def test_blog_sitemap_is_separate_and_has_only_canonical_blog_urls(client):
    response = client.get("/sitemap-blog.xml")
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    root = ElementTree.fromstring(response.content)
    urls = [node.text for node in root.findall("s:url/s:loc", ns)]
    assert urls == ["https://digigadg.ir/blog/"] + [
        f'https://digigadg.ir/blog/{article["slug"]}/' for article in ARTICLES
    ]
    assert len(urls) == len(set(urls))


def test_missing_article_is_404_and_slashless_urls_redirect(client):
    assert client.get("/blog/missing/").status_code == 404
    for path in ["/blog", f'/blog/{ARTICLES[0]["slug"]}']:
        response = client.get(path)
        assert response.status_code == 301
        assert response["Location"] == path + "/"
    assert client.head("/blog/").status_code == 200
    assert client.post("/blog/").status_code == 405
