"""Unit tests for card display specs helpers + list serializer field (no DB writes)."""

import pytest
from rest_framework.exceptions import ValidationError

from app.models import Product
from app.serializers import ProductListSerializer
from app.services.product_card_specs import (
    CARD_SPECS_MAX,
    extract_card_specs_from_specs,
    merge_card_specs_into_specs,
    normalize_card_specs,
)


def test_normalize_drops_empty_and_keeps_order():
    slots = normalize_card_specs(
        [
            {"title": "  ظرفیت ", "value": " ۱۰۰۰۰ "},
            {"title": "", "value": ""},
            {"title": "توان", "value": "۲۰W"},
        ]
    )
    assert slots == [
        {"title": "ظرفیت", "value": "۱۰۰۰۰"},
        {"title": "توان", "value": "۲۰W"},
    ]


def test_normalize_rejects_partial_slot():
    with pytest.raises(ValidationError) as exc:
        normalize_card_specs([{"title": "ظرفیت", "value": ""}])
    assert "عنوان" in str(exc.value.detail)


def test_normalize_null_and_missing_safe():
    assert normalize_card_specs(None) == []
    assert normalize_card_specs([]) == []
    assert extract_card_specs_from_specs(None) == []
    assert extract_card_specs_from_specs("bad") == []


def test_normalize_caps_at_four_and_mixed_units():
    raw = [
        {"title": f"L{i}", "value": f"{i}000 mAh / 20W"}
        for i in range(1, 7)
    ]
    slots = normalize_card_specs(raw)
    assert len(slots) == CARD_SPECS_MAX
    assert slots[0]["title"] == "L1"
    assert slots[3]["value"] == "4000 mAh / 20W"


def test_extract_ignores_legacy_dict_keys():
    assert extract_card_specs_from_specs({"warranty": "۱۸ ماه"}) == []
    assert extract_card_specs_from_specs(
        {
            "warranty": "۱۸ ماه",
            "card_display": [{"title": "ظرفیت", "value": "۱۰۰۰۰"}],
        }
    ) == [{"title": "ظرفیت", "value": "۱۰۰۰۰"}]


def test_merge_preserves_legacy_keys():
    merged = merge_card_specs_into_specs(
        {"warranty": "۱۸ ماه"},
        [{"title": "A", "value": "1"}],
    )
    assert merged["warranty"] == "۱۸ ماه"
    assert merged["card_display"] == [{"title": "A", "value": "1"}]
    cleared = merge_card_specs_into_specs(merged, [])
    assert "card_display" not in cleared
    assert cleared["warranty"] == "۱۸ ماه"


def test_list_serializer_includes_card_specs_from_specs_json():
    """Card payloads carry card_specs inline from Product.specs — no per-card fetch."""
    product = Product(
        name="پاوربانک تست مشخصات کارت خیلی طولانی برای دو خط",
        slug="card-specs-unit",
        sku="CARD-SPECS-UNIT",
        price_toman=1_000_000,
        specs={
            "warranty": "۱۸ ماه",
            "card_display": [
                {"title": "ظرفیت", "value": "۱۰۰۰۰ mAh"},
                {"title": "توان خروجی", "value": "۲۰W"},
            ],
        },
    )
    # Call field getter only (full .data would touch related managers / DB)
    assert "card_specs" in ProductListSerializer.Meta.fields
    assert ProductListSerializer().get_card_specs(product) == [
        {"title": "ظرفیت", "value": "۱۰۰۰۰ mAh"},
        {"title": "توان خروجی", "value": "۲۰W"},
    ]


def test_list_serializer_empty_card_specs_for_legacy_products():
    product = Product(
        name="قدیمی",
        slug="legacy-no-card-specs",
        sku="LEGACY-CARD",
        price_toman=100_000,
        specs={},
    )
    assert ProductListSerializer().get_card_specs(product) == []
