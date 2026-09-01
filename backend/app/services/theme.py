"""Storefront theme presets and color token helpers."""

from __future__ import annotations

import re
from copy import deepcopy

from rest_framework.exceptions import ValidationError

HEX_RE = re.compile(r"^#([0-9a-fA-F]{6})$")

THEME_CHOICES = ("classic", "green", "dark")

# Semantic tokens mapped to CSS variables / Tailwind via ThemeApplier
COLOR_KEYS = (
    "copper_400",
    "copper_500",
    "copper_600",
    "copper_700",
    "sea_400",
    "sea_500",
    "sea_600",
    "ink_950",
    "ink_900",
    "ink_800",
    "ink_700",
    "mist_50",
    "mist_100",
    "mist_200",
)

THEME_PRESETS: dict[str, dict[str, str]] = {
    # Current copper / sea look
    "classic": {
        "copper_400": "#e8a87c",
        "copper_500": "#d97757",
        "copper_600": "#c45c3e",
        "copper_700": "#a34830",
        "sea_400": "#5b9fd4",
        "sea_500": "#3b82b6",
        "sea_600": "#2f6a96",
        "ink_950": "#0b1220",
        "ink_900": "#111827",
        "ink_800": "#1f2937",
        "ink_700": "#374151",
        "mist_50": "#f6f7f9",
        "mist_100": "#eef1f5",
        "mist_200": "#dce3ec",
    },
    # Fresh green / teal
    "green": {
        "copper_400": "#6ee7b7",
        "copper_500": "#10b981",
        "copper_600": "#059669",
        "copper_700": "#047857",
        "sea_400": "#5eead4",
        "sea_500": "#14b8a6",
        "sea_600": "#0f766e",
        "ink_950": "#052e1c",
        "ink_900": "#064e3b",
        "ink_800": "#065f46",
        "ink_700": "#047857",
        "mist_50": "#f0fdf7",
        "mist_100": "#dcfce7",
        "mist_200": "#bbf7d0",
    },
    # Dark surfaces + warm accent
    "dark": {
        "copper_400": "#f0b089",
        "copper_500": "#e8956a",
        "copper_600": "#d97757",
        "copper_700": "#b85a3c",
        "sea_400": "#7eb8e0",
        "sea_500": "#5b9fd4",
        "sea_600": "#3b82b6",
        "ink_950": "#f3f4f6",
        "ink_900": "#e5e7eb",
        "ink_800": "#d1d5db",
        "ink_700": "#9ca3af",
        "mist_50": "#0b1220",
        "mist_100": "#111827",
        "mist_200": "#1f2937",
    },
}

COLOR_LABELS = {
    "copper_400": "اکسنت روشن",
    "copper_500": "اکسنت اصلی",
    "copper_600": "اکسنت تیره",
    "copper_700": "اکسنت خیلی تیره",
    "sea_400": "ثانویه روشن",
    "sea_500": "ثانویه اصلی",
    "sea_600": "ثانویه تیره",
    "ink_950": "متن خیلی تیره",
    "ink_900": "متن تیره",
    "ink_800": "متن متوسط",
    "ink_700": "متن ملایم",
    "mist_50": "پس‌زمینه",
    "mist_100": "سطح روشن",
    "mist_200": "حاشیه / سطح",
}


def normalize_hex(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValidationError({"colors": "رنگ خالی است."})
    if not text.startswith("#"):
        text = f"#{text}"
    if len(text) == 4 and HEX_RE.match(f"#{text[1]*2}{text[2]*2}{text[3]*2}"):
        text = f"#{text[1]*2}{text[2]*2}{text[3]*2}"
    if not HEX_RE.match(text):
        raise ValidationError({"colors": f"رنگ نامعتبر: {value}"})
    return text.lower()


def normalize_theme(theme: str | None) -> str:
    key = str(theme or "classic").strip().lower()
    if key not in THEME_CHOICES:
        raise ValidationError({"theme": "تم نامعتبر است. گزینه‌ها: classic، green، dark"})
    return key


def normalize_colors(raw: dict | None) -> dict:
    base = deepcopy(THEME_PRESETS["classic"])
    if not isinstance(raw, dict):
        return base
    for key in COLOR_KEYS:
        if key in raw and raw[key] is not None and str(raw[key]).strip():
            base[key] = normalize_hex(raw[key])
    return base


def resolve_colors(theme: str, colors: dict | None) -> dict:
    theme_key = theme if theme in THEME_CHOICES else "classic"
    resolved = deepcopy(THEME_PRESETS[theme_key])
    if isinstance(colors, dict):
        for key in COLOR_KEYS:
            if key in colors and colors[key] is not None and str(colors[key]).strip():
                try:
                    resolved[key] = normalize_hex(colors[key])
                except ValidationError:
                    pass
    return resolved


def theme_catalog() -> list[dict]:
    labels = {
        "classic": "کلاسیک (فعلی)",
        "green": "سبز",
        "dark": "دارک",
    }
    return [
        {
            "id": key,
            "label": labels[key],
            "colors": deepcopy(THEME_PRESETS[key]),
        }
        for key in THEME_CHOICES
    ]
