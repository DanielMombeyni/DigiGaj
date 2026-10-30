# Torob crawler integration

## Findings and scope

The storefront was a client-rendered React SPA. `Seo.jsx` used `useEffect`, so
product metadata was absent from the initial HTTP document. The static
`frontend/public/sitemap.xml` contained relative static-page links and no product
URLs; it did not meet discovery requirements. No existing JavaScript-free product
discovery route was found. Product publication is controlled by `is_active` and
the storefront's `products` page setting; there is no separate draft/private flag.

No checkout, payment, order, reservation, inventory, dependency, or database schema
changes are part of this implementation. No migration is required.

## Files changed

All paths below are relative to `D:\Files\Project\store`:

| File | Purpose |
| --- | --- |
| `backend/app/services/product_metadata.py` | Shared offer, image, warranty and canonical presentation |
| `backend/app/views/product_html.py` | Initial HTML, sitemap index/pages and robots responses |
| `backend/app/templates/shop/product_head.html` | Escaped HTML metadata and JSON-LD |
| `backend/config/urls.py` | Public document/discovery routes |
| `backend/config/settings/components/base.py` | Internal frontend shell URL setting |
| `backend/app/serializers/__init__.py` | Same metadata/default variant in detail API |
| `backend/app/tests/test_product_crawler.py` | HTTP, pricing, variant, escaping, discovery and DB regressions |
| `frontend/index.html` | Head insertion markers |
| `frontend/src/components/common/Seo.jsx` | Client metadata, canonical, structured data and cleanup |
| `frontend/src/pages/shop/ProductDetailPage.jsx` | Initial offer and metadata for selected variant |
| `frontend/vite.config.js` | Development routing |
| `frontend/scripts/check-product-crawler-build.mjs` | Repeatable in-memory production shell/proxy regression check |
| `frontend/nginx.conf` | Frontend-container routing |
| `deploy/nginx/http.conf` | HTTP proxy routing |
| `deploy/nginx/https.conf` | HTTP and HTTPS proxy routing |
| `docker-compose.dev.yml` | Development internal shell endpoint |
| `docs/torob-crawler.md` | Audit, contract, verification and handoff notes |

## Routes

- `/products/<slug>`: existing public URL, now served by Django with product head
  metadata inserted into the current React HTML shell. A trailing slash also works.
- `/sitemap.xml`: public XML sitemap index.
- `/sitemap-products.xml?p=1`: public product sitemap, 5,000 products per page.
  The index links every page, including empty-catalog page 1. Products are ordered
  by `-created_at, -pk`, independent of merchandising/display priority.
- `/robots.txt`: existing disallow rules retained; sitemap URL becomes absolute.

All URLs are unauthenticated. Inactive/missing products return HTTP 404. Disabling
the products storefront page returns 404 for product documents and removes
products from discovery. The sitemap includes active out-of-stock and
contact-for-price products; their metadata does not describe them as purchasable.

The old static XML file is retained, but the configured development/production
routes take precedence over it. Do not deploy only a static frontend without the
Django document/discovery proxy rules.

## Rendering and deployment

Django obtains `/index.html` from the internal frontend service and replaces the
single `product-seo:start` / `product-seo:end` comment block. This preserves the
exact deployed asset hashes, styles, scripts and React application. It does not
fetch a user-controlled URL, forward user cookies, execute JavaScript or serve
different HTML to bots. `/index.html` stays on the frontend to avoid proxy loops.

- `FRONTEND_URL`: canonical public storefront origin, e.g. `https://digigadg.ir`.
  It supplies canonical URLs, image origins and sitemap links. Confirm this value
  for the actual deployment; request Host headers do not control published URLs.
- `FRONTEND_HTML_URL`: fixed internal shell endpoint. Default production value:
  `http://frontend/index.html`. Development Compose overrides this with
  `http://frontend:5173/index.html`.
- Outside Docker, set `FRONTEND_HTML_URL=http://127.0.0.1:5173/index.html` when
  running a local Vite server. The backend must be able to reach that endpoint.
- Vite and both production proxy configurations route product documents and
  sitemap/robots requests to Django. Product lists and frontend assets retain
  their existing routes. The frontend nginx configuration supports the same routes.
- Both frontend and backend/proxy changes must be released together. No deployment
  was performed during implementation.

If the frontend shell is unavailable, redirects, or lacks exactly one insertion
block, product documents return 503 with `Retry-After: 30`, rather than a misleading
200 SPA document. Product responses use `Cache-Control: no-store` to avoid stale
prices and stock. Each product document adds an internal frontend request (5-second
timeout); this availability dependency is intentional. Sitemap queries retrieve
only URL/timestamp fields and paginate in SQL.

## Metadata contract

| HTML field | Source / omission rule |
| --- | --- |
| `product_id` | Stable database primary key, decimal string |
| `product_name` | Actual name, HTML-escaped |
| `og:image` | Existing primary image, otherwise first existing gallery image; absolute public `/media/` URL. Omitted if none exists |
| `product_price` | Current offer price in **tomans**, plain integer; omitted for contact-for-price / zero-price products |
| `product_old_price` | Manual `compare_at_price_toman`, only when greater than current fixed price |
| `availability` | Exactly `instock` for a positive fixed-price stocked offer; otherwise `outofstock` |
| `guarantee` | Nonempty displayed attribute named `گارانتی`, `ضمانت`, `guarantee` or `warranty` (case-insensitive); otherwise a displayed string spec with the same name when no attributes exist; omitted when absent |

Example from the isolated HTTP regression fixture, not from a real catalog:

```html
<meta name="product_id" content="2234" data-product-meta>
<meta name="product_name" content="Gadget &quot;A&quot; &amp; &lt;B&gt;" data-product-meta>
<meta name="product_price" content="120000" data-product-meta>
<meta name="product_old_price" content="150000" data-product-meta>
<meta name="availability" content="instock" data-product-meta>
```

Images and warranty are conditional, rather than fabricated to fill fields.
Canonical/Open Graph tags are unique. JSON-LD uses the existing **IRR** convention,
so its price is tomans multiplied by ten. Embedded JSON escapes HTML-sensitive
characters; template attributes use Django autoescaping. React updates the same
tags and JSON-LD, including when the user selects another variant, and removes
product-specific tags when leaving the product page.

### Variants and domain limitations

The shared `product_metadata` service selects the cheapest active, stocked,
positive-price variant belonging to the product's defined options. React selects
that same color/size on first load. When every eligible variant is sold out,
the cheapest eligible variant supplies a display price with `outofstock`. Without
options, base price and stock apply. Missing combinations are unavailable.

The existing product UI treats a zero active-variant minimum as contact-for-price;
checkout also treats a zero base price as awaiting price. Such products have no
advertised fixed price and are `outofstock`, even if another variant has a price.
This conservative presentation does not change purchase rules.

There is no timed per-product sale model. Comparison prices are manually entered
and cannot be independently proven to be historical transaction prices. Coupon
start/end dates and usage limits apply at checkout and are not product sale prices.
Catalog administrators remain responsible for truthful comparison prices and
warranty values. Images are checked against configured storage; public CDN/proxy
accessibility still requires deployment verification. No public media URL was fetched.

The provided support requirements do not explicitly specify the money unit.
Torob meta prices follow the storefront's toman unit; confirm the unit with the
merchant's Torob configuration/support before activating ingestion. No new field
or warranty claim was invented.

## Verification

Executed from `backend`:

```powershell
.\.venv\Scripts\python.exe -B -m pytest app/tests/test_product_crawler.py app/tests/test_product_card_specs.py -m "not django_db" -v -p no:cacheprovider
.\.venv\Scripts\python.exe -B -m ruff check --no-cache app/services/product_metadata.py app/views/product_html.py app/tests/test_product_crawler.py
```

The regression suite checks Django's raw response plus an actual loopback WSGI
HTTP response using an HTTP client without JavaScript. Real unsaved product models
and in-memory image storage are used; query results and the internal frontend
response are mocked. Database connections stay blocked by pytest and the existing
connection guard. This proves HTTP rendering behavior, not production DB contents
or a running nginx/PostgreSQL deployment.

Two additional `django_db` tests cover real query ordering/publication, detail
metadata and disabled-storefront exclusion. They were **not run** because an
explicitly verified isolated Postgres stack was unavailable. Read
[sms-test-isolation.md](sms-test-isolation.md) and complete its runtime checklist
before executing those tests. Never point them at the real app database.

Frontend commands executed from `frontend`:

```powershell
node scripts/check-product-crawler-build.mjs
node scripts/check-product-list-query.mjs
node scripts/check-price-bounds.mjs
node scripts/check-product-card-specs.mjs
```

The first command builds Vite in memory (no output files), verifies production
head insertion markers and checks development proxy paths/loop avoidance.
Final results: 28 backend tests passed, 2 database tests deselected; Ruff passed;
all four frontend checks passed. Docker/nginx runtime validation
was unavailable on this host. Git status/diff inspection was attempted but failed
with Git's unsafe-ownership warning, including per-command safe.directory attempts;
no global Git setting was changed and no reset/clean/stash was used.

## Torob handoff after deployment

Submit the publicly verified sitemap index. With the repository's configured
production domain, the candidate is `https://digigadg.ir/sitemap.xml`.
This is a **deployment target, not a verified working public URL**.

After deployment, fetch that URL unauthenticated, follow every sitemap child,
and fetch representative product URLs without JavaScript. Confirm HTTP 200, the
correct public canonical/image origins, matching toman prices, availability,
warranty omission/presence, and image accessibility. Confirm inactive products
return 404. Only then send the sitemap URL to Torob. Do not use a localhost URL
or `/api/v1/products/` as the handoff URL.
