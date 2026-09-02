from __future__ import annotations

import os
import uuid
from copy import deepcopy

from django.core.files.storage import default_storage
from rest_framework.exceptions import ValidationError

from app.models import SitePage, SiteSetting
from app.payment.utils import absolute_media_url
from app.services.home_content import (
    ensure_store_defaults,
    get_home_hero,
    get_store_settings,
    save_home_hero,
)

from app.services.theme import (
    COLOR_KEYS,
    COLOR_LABELS,
    THEME_CHOICES,
    normalize_hex,
    normalize_theme,
    resolve_colors,
    theme_catalog,
)

PUBLIC_PAGES_KEY = "public_pages"
SITE_ICON_UPLOAD = "site/icon/"
MAX_ICON_BYTES = 2 * 1024 * 1024
ALLOWED_ICON_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/x-icon",
    "image/vnd.microsoft.icon",
}

PAGE_REGISTRY = [
    {"key": "home", "label": "صفحه اصلی", "path": "/"},
    {"key": "products", "label": "محصولات", "path": "/products"},
    {"key": "categories", "label": "دسته‌بندی‌ها", "path": "/categories"},
    {"key": "about", "label": "درباره ما", "path": "/about"},
    {"key": "contact", "label": "تماس با ما", "path": "/contact"},
    {"key": "cart", "label": "سبد خرید", "path": "/cart"},
    {"key": "login", "label": "ورود", "path": "/login"},
    {"key": "register", "label": "ثبت‌نام", "path": "/register"},
]

DEFAULT_ENABLED = {item["key"]: True for item in PAGE_REGISTRY}
DEFAULT_PUBLIC_PAGES = {
    "enabled": deepcopy(DEFAULT_ENABLED),
    "site_icon": "",
    "theme": "classic",
    "colors": {},
}


def media_url(path: str | None) -> str | None:
    return absolute_media_url(path)


def _storage_path(path: str | None) -> str | None:
    if not path:
        return None
    text = str(path).strip()
    if not text:
        return None
    if text.startswith("/media/"):
        return text[len("/media/") :]
    if text.startswith("media/"):
        return text[len("media/") :]
    return text


def _delete_file(path: str | None) -> None:
    rel = _storage_path(path)
    if rel and default_storage.exists(rel):
        default_storage.delete(rel)


def _normalize_enabled(raw: dict | None) -> dict:
    enabled = deepcopy(DEFAULT_ENABLED)
    if isinstance(raw, dict):
        for key in DEFAULT_ENABLED:
            if key in raw:
                enabled[key] = bool(raw[key])
    return enabled


def _normalize(raw: dict | None) -> dict:
    data = deepcopy(DEFAULT_PUBLIC_PAGES)
    if not isinstance(raw, dict):
        return data
    data["enabled"] = _normalize_enabled(raw.get("enabled"))
    if raw.get("site_icon") is not None:
        data["site_icon"] = str(raw["site_icon"]).strip()
    theme = str(raw.get("theme") or "classic").strip().lower()
    data["theme"] = theme if theme in THEME_CHOICES else "classic"
    colors_raw = raw.get("colors")
    if isinstance(colors_raw, dict):
        cleaned = {}
        for key in COLOR_KEYS:
            if key in colors_raw and colors_raw[key] is not None and str(colors_raw[key]).strip():
                try:
                    cleaned[key] = normalize_hex(colors_raw[key])
                except ValidationError:
                    continue
        data["colors"] = cleaned
    else:
        data["colors"] = {}
    return data


def appearance_payload(settings: dict | None = None) -> dict:
    settings = settings or get_public_pages_settings()
    theme = settings.get("theme") or "classic"
    colors = resolve_colors(theme, settings.get("colors"))
    return {
        "theme": theme,
        "colors": colors,
        "themes": theme_catalog(),
        "color_fields": [
            {"key": key, "label": COLOR_LABELS.get(key, key)} for key in COLOR_KEYS
        ],
    }


def get_public_pages_settings() -> dict:
    row = SiteSetting.objects.filter(key=PUBLIC_PAGES_KEY).first()
    return _normalize(row.value if row else None)


def _cms_pages() -> list[dict]:
    rows = SitePage.objects.order_by("slug").values("slug", "title", "is_published")
    out = []
    for row in rows:
        slug = row["slug"]
        out.append(
            {
                "key": f"cms:{slug}",
                "slug": slug,
                "label": row["title"] or slug,
                "path": f"/pages/{slug}",
                "enabled": bool(row["is_published"]),
            }
        )
    return out


def public_pages_payload() -> dict:
    settings = get_public_pages_settings()
    enabled = dict(settings["enabled"])
    for cms in _cms_pages():
        enabled[cms["key"]] = cms["enabled"]
    appearance = appearance_payload(settings)
    return {
        "enabled": enabled,
        "site_icon": media_url(settings.get("site_icon")),
        "theme": appearance["theme"],
        "colors": appearance["colors"],
    }


def get_admin_storefront_pages() -> dict:
    ensure_store_defaults()
    ensure_public_pages_defaults()
    settings = get_public_pages_settings()
    hero = get_home_hero()
    pages = []
    for item in PAGE_REGISTRY:
        key = item["key"]
        entry = {
            "key": key,
            "label": item["label"],
            "path": item["path"],
            "enabled": settings["enabled"].get(key, True),
            "kind": "route",
        }
        if key == "home":
            entry["hero"] = hero
        pages.append(entry)

    for cms in _cms_pages():
        pages.append(
            {
                "key": cms["key"],
                "label": cms["label"],
                "path": cms["path"],
                "enabled": cms["enabled"],
                "kind": "cms",
                "slug": cms["slug"],
            }
        )

    appearance = appearance_payload(settings)
    return {
        "site_icon": media_url(settings.get("site_icon")),
        "pages": pages,
        "theme": appearance["theme"],
        "colors": appearance["colors"],
        "themes": appearance["themes"],
        "color_fields": appearance["color_fields"],
    }


def _save_site_icon(image_file) -> str:
    content_type = getattr(image_file, "content_type", "") or ""
    if content_type and content_type not in ALLOWED_ICON_TYPES:
        raise ValidationError({"site_icon": "فرمت آیکون باید PNG، JPG، WebP، GIF، SVG یا ICO باشد."})
    if image_file.size > MAX_ICON_BYTES:
        raise ValidationError({"site_icon": "حداکثر حجم آیکون ۲ مگابایت است."})

    ext = os.path.splitext(getattr(image_file, "name", "") or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico"):
        ext = ".png"
    name = f"{uuid.uuid4().hex}{ext}"
    return default_storage.save(f"{SITE_ICON_UPLOAD}{name}", image_file)


def save_page_enabled(page_key: str, enabled: bool) -> dict:
    key = str(page_key or "").strip()
    if not key:
        raise ValidationError({"page_key": "کلید صفحه الزامی است."})

    if key.startswith("cms:"):
        slug = key[4:]
        page = SitePage.objects.filter(slug=slug).first()
        if not page:
            raise ValidationError({"page_key": "صفحه یافت نشد."})
        page.is_published = bool(enabled)
        page.save(update_fields=["is_published", "updated_at"])
        return get_admin_storefront_pages()

    if key not in DEFAULT_ENABLED:
        raise ValidationError({"page_key": "صفحه نامعتبر است."})

    settings = get_public_pages_settings()
    settings["enabled"][key] = bool(enabled)
    SiteSetting.objects.update_or_create(key=PUBLIC_PAGES_KEY, defaults={"value": settings})
    return get_admin_storefront_pages()


def save_enabled_map(enabled_map: dict) -> dict:
    if not isinstance(enabled_map, dict):
        raise ValidationError({"enabled": "داده نامعتبر است."})

    settings = get_public_pages_settings()
    changed_static = False
    for page_key, value in enabled_map.items():
        key = str(page_key).strip()
        if key.startswith("cms:"):
            slug = key[4:]
            page = SitePage.objects.filter(slug=slug).first()
            if page:
                page.is_published = bool(value)
                page.save(update_fields=["is_published", "updated_at"])
        elif key in DEFAULT_ENABLED:
            settings["enabled"][key] = bool(value)
            changed_static = True

    if changed_static:
        SiteSetting.objects.update_or_create(key=PUBLIC_PAGES_KEY, defaults={"value": settings})
    return get_admin_storefront_pages()


def save_site_icon(*, image_file=None, clear_icon: bool = False) -> dict:
    settings = get_public_pages_settings()
    if clear_icon:
        _delete_file(settings.get("site_icon"))
        settings["site_icon"] = ""
    elif image_file:
        _delete_file(settings.get("site_icon"))
        settings["site_icon"] = _save_site_icon(image_file)
    SiteSetting.objects.update_or_create(key=PUBLIC_PAGES_KEY, defaults={"value": settings})
    return get_admin_storefront_pages()


def save_appearance(*, theme: str | None = None, colors: dict | None = None, apply_preset: bool = False) -> dict:
    settings = get_public_pages_settings()
    if theme is not None:
        settings["theme"] = normalize_theme(theme)
    if apply_preset:
        # Selecting a theme resets custom overrides to the preset palette
        settings["colors"] = {}
    elif colors is not None:
        if not isinstance(colors, dict):
            raise ValidationError({"colors": "داده رنگ نامعتبر است."})
        cleaned = {}
        for key in COLOR_KEYS:
            if key in colors and colors[key] is not None and str(colors[key]).strip():
                cleaned[key] = normalize_hex(colors[key])
        settings["colors"] = cleaned
    SiteSetting.objects.update_or_create(key=PUBLIC_PAGES_KEY, defaults={"value": settings})
    return get_admin_storefront_pages()


def save_storefront_home(
    payload: dict,
    *,
    image_file=None,
    clear_image: bool = False,
    enabled: bool | None = None,
) -> dict:
    save_home_hero(payload, image_file=image_file, clear_image=clear_image)
    if enabled is not None:
        save_page_enabled("home", enabled)
    return get_admin_storefront_pages()


def is_public_page_enabled(page_key: str) -> bool:
    key = str(page_key or "").strip()
    if not key:
        return True
    if key.startswith("cms:"):
        slug = key[4:]
        page = SitePage.objects.filter(slug=slug).only("is_published").first()
        return page.is_published if page else False
    settings = get_public_pages_settings()
    return settings["enabled"].get(key, True)


def ensure_public_pages_defaults() -> None:
    row = SiteSetting.objects.filter(key=PUBLIC_PAGES_KEY).first()
    if not row:
        SiteSetting.objects.create(key=PUBLIC_PAGES_KEY, value=deepcopy(DEFAULT_PUBLIC_PAGES))
        return
    merged = _normalize(row.value)
    if merged != row.value:
        row.value = merged
        row.save(update_fields=["value", "updated_at"])
