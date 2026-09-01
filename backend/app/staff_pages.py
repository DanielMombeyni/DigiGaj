"""Admin panel page keys used for role-based access."""

ADMIN_PAGES = (
    ("dashboard", "داشبورد"),
    ("products", "محصولات"),
    ("categories", "دسته‌بندی‌ها"),
    ("discounts", "کد تخفیف"),
    ("orders", "سفارش‌ها"),
    ("accounting", "حسابداری"),
    ("gateways", "درگاه‌ها"),
    ("transactions", "تراکنش‌ها"),
    ("tickets", "پشتیبانی"),
    ("settings", "تنظیمات"),
    ("personnel", "پرسنل و نقش‌ها"),
    ("customers", "مشتریان"),
    ("storefront", "صفحات فروشگاه"),
)

ADMIN_PAGE_KEYS = frozenset(k for k, _ in ADMIN_PAGES)
ADMIN_PAGE_LABELS = {k: label for k, label in ADMIN_PAGES}


def normalize_pages(pages):
    if not pages:
        return []
    if not isinstance(pages, (list, tuple)):
        return []
    seen = set()
    out = []
    for key in pages:
        k = str(key).strip()
        if k in ADMIN_PAGE_KEYS and k not in seen:
            seen.add(k)
            out.append(k)
    return out
