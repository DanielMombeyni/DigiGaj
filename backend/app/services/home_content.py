from __future__ import annotations

import os
import uuid
from copy import deepcopy

from django.core.files.storage import default_storage
from rest_framework.exceptions import ValidationError

from app.models import SiteSetting
from app.payment.utils import public_api_base

STORE_KEY = "store"
HERO_IMAGE_UPLOAD = "home-hero/"
MAX_HERO_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_HERO_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

DEFAULT_STORE = {
    "name": "دیجی گج",
    "tagline": "فروشگاه تخصصی گجت و لوازم دیجیتال",
    "phone": "",
    "email": "",
    "address": "",
    "hero_glass_title": "اتمسفر دیجیتال",
    "hero_glass_subtitle": "تجربه خرید گجت، متفاوت",
    "hero_glass_image": "",
}


def _normalize(raw: dict | None) -> dict:
    data = deepcopy(DEFAULT_STORE)
    if not isinstance(raw, dict):
        return data
    for key in DEFAULT_STORE:
        if key in raw and raw[key] is not None:
            if key.startswith("hero_"):
                data[key] = str(raw[key]).strip()
            elif key in ("name", "tagline", "phone", "email", "address"):
                data[key] = str(raw[key]).strip()
            else:
                data[key] = raw[key]
    return data


def hero_image_url(path: str | None) -> str | None:
    if not path:
        return None
    text = str(path).strip()
    if not text:
        return None
    if text.startswith("http"):
        return text
    base = public_api_base()
    if text.startswith("/media/"):
        return f"{base}{text}"
    if text.startswith("/"):
        return f"{base}{text}"
    return f"{base}/media/{text.lstrip('/')}"


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


def _delete_hero_image(path: str | None) -> None:
    rel = _storage_path(path)
    if rel and default_storage.exists(rel):
        default_storage.delete(rel)


def get_store_settings() -> dict:
    row = SiteSetting.objects.filter(key=STORE_KEY).first()
    return _normalize(row.value if row else None)


def public_store_settings() -> dict:
    store = get_store_settings()
    out = dict(store)
    out["hero_glass_image"] = hero_image_url(store.get("hero_glass_image"))
    return out


def get_home_hero() -> dict:
    store = get_store_settings()
    return {
        "title": store["hero_glass_title"] or DEFAULT_STORE["hero_glass_title"],
        "subtitle": store["hero_glass_subtitle"] or DEFAULT_STORE["hero_glass_subtitle"],
        "image": hero_image_url(store.get("hero_glass_image")),
    }


def _save_hero_image(image_file) -> str:
    content_type = getattr(image_file, "content_type", "") or ""
    if content_type and content_type not in ALLOWED_HERO_IMAGE_TYPES:
        raise ValidationError({"image": "فرمت تصویر باید JPG، PNG، WebP یا GIF باشد."})
    if image_file.size > MAX_HERO_IMAGE_BYTES:
        raise ValidationError({"image": "حداکثر حجم تصویر ۵ مگابایت است."})

    ext = os.path.splitext(getattr(image_file, "name", "") or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    return default_storage.save(f"{HERO_IMAGE_UPLOAD}{name}", image_file)


def save_home_hero(payload: dict, *, image_file=None, clear_image: bool = False) -> dict:
    if not isinstance(payload, dict):
        raise ValidationError("داده نامعتبر است.")
    title = str(payload.get("title") or "").strip()
    subtitle = str(payload.get("subtitle") or "").strip()
    if not title:
        raise ValidationError({"title": "عنوان الزامی است."})
    if not subtitle:
        raise ValidationError({"subtitle": "توضیح کوتاه الزامی است."})
    if len(title) > 120:
        raise ValidationError({"title": "عنوان حداکثر ۱۲۰ کاراکتر."})
    if len(subtitle) > 200:
        raise ValidationError({"subtitle": "توضیح حداکثر ۲۰۰ کاراکتر."})

    store = get_store_settings()
    store["hero_glass_title"] = title
    store["hero_glass_subtitle"] = subtitle

    if clear_image:
        _delete_hero_image(store.get("hero_glass_image"))
        store["hero_glass_image"] = ""
    elif image_file:
        _delete_hero_image(store.get("hero_glass_image"))
        store["hero_glass_image"] = _save_hero_image(image_file)

    SiteSetting.objects.update_or_create(key=STORE_KEY, defaults={"value": store})
    return get_home_hero()


def ensure_store_defaults() -> None:
    row = SiteSetting.objects.filter(key=STORE_KEY).first()
    if not row:
        SiteSetting.objects.create(key=STORE_KEY, value=deepcopy(DEFAULT_STORE))
        return
    merged = _normalize(row.value)
    if merged != row.value:
        row.value = merged
        row.save(update_fields=["value", "updated_at"])
