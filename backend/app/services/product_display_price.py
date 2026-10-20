"""
List/filter display price — mirrors ProductListSerializer.get_min_price.

Rules:
- price_on_request → NULL (no fixed price)
- else min over active variants of Coalesce(variant.price_toman, product.price_toman)
- if no active variants → product.price_toman
"""

from django.db.models import (
    BigIntegerField,
    Case,
    F,
    IntegerField,
    Min,
    OuterRef,
    Q,
    Subquery,
    Value,
    When,
)
from django.db.models.functions import Coalesce

from app.models import ProductVariant

DISPLAY_PRICE_ANNOTATION = "display_price"


def _min_active_variant_effective_price_subquery():
    return Subquery(
        ProductVariant.objects.filter(product_id=OuterRef("pk"), is_active=True)
        .annotate(eff=Coalesce(F("price_toman"), OuterRef("price_toman")))
        .values("product_id")
        .annotate(min_eff=Min("eff"))
        .values("min_eff")[:1],
        output_field=BigIntegerField(),
    )


def annotate_display_price(queryset):
    """Annotate queryset with display_price (same semantics as card min_price)."""
    if DISPLAY_PRICE_ANNOTATION in queryset.query.annotations:
        return queryset
    variant_min = _min_active_variant_effective_price_subquery()
    return queryset.annotate(
        **{
            DISPLAY_PRICE_ANNOTATION: Case(
                When(price_on_request=True, then=Value(None)),
                default=Coalesce(variant_min, F("price_toman")),
                output_field=BigIntegerField(null=True),
            )
        }
    )


def noprice_sort_flag():
    """1 = push to end when sorting by price (on-request / missing / non-positive)."""
    return Case(
        When(
            Q(price_on_request=True)
            | Q(**{f"{DISPLAY_PRICE_ANNOTATION}__isnull": True})
            | Q(**{f"{DISPLAY_PRICE_ANNOTATION}__lte": 0}),
            then=Value(1),
        ),
        default=Value(0),
        output_field=IntegerField(),
    )
