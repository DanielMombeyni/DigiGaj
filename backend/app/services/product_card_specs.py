"""Normalize and validate product card display specification slots (max 4)."""

from __future__ import annotations

from rest_framework.exceptions import ValidationError

CARD_SPECS_KEY = "card_display"
CARD_SPECS_MAX = 4


def extract_card_specs_from_specs(specs) -> list[dict]:
    """Read card slots from Product.specs without treating legacy key/value pairs as rows."""
    if not isinstance(specs, dict):
        return []
    raw = specs.get(CARD_SPECS_KEY)
    if raw is None:
        raw = specs.get("card_specs")
    return normalize_card_specs(raw, raise_validation=False)


def normalize_card_specs(raw, *, raise_validation: bool = True) -> list[dict]:
    """
    Return up to 4 ordered {title, value} dicts.

    - Fully empty slots (both blank after trim) are dropped.
    - Title XOR value (one filled) raises ValidationError when raise_validation=True.
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        if raise_validation:
            raise ValidationError(
                {"card_specs": "مشخصات نمایشی کارت باید یک فهرست باشد."}
            )
        return []

    out: list[dict] = []
    for i, item in enumerate(raw[:CARD_SPECS_MAX]):
        if not isinstance(item, dict):
            if raise_validation:
                raise ValidationError(
                    {"card_specs": f"ردیف {i + 1} مشخصات کارت نامعتبر است."}
                )
            continue
        title = str(item.get("title") or item.get("name") or "").strip()
        value = str(item.get("value") or "").strip()
        if not title and not value:
            continue
        if not title or not value:
            if raise_validation:
                raise ValidationError(
                    {
                        "card_specs": (
                            f"ردیف {i + 1}: هم «عنوان» و هم «مقدار» باید پر شوند "
                            "یا هر دو خالی بمانند."
                        )
                    }
                )
            continue
        out.append({"title": title[:120], "value": value[:255]})
    return out


def merge_card_specs_into_specs(specs, card_specs: list[dict]) -> dict:
    """Preserve legacy specs keys; set/replace card_display list."""
    base = dict(specs) if isinstance(specs, dict) else {}
    base.pop("card_specs", None)
    if card_specs:
        base[CARD_SPECS_KEY] = card_specs
    else:
        base.pop(CARD_SPECS_KEY, None)
    return base
