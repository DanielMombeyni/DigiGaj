import django_filters
from django.db.models import Exists, OuterRef, Q
from rest_framework.filters import OrderingFilter

from app.models import Category, Product, ProductColor, ProductVariant
from app.services.product_display_price import (
    DISPLAY_PRICE_ANNOTATION,
    annotate_display_price,
    noprice_sort_flag,
)


def category_with_descendants(category_id: int) -> list[int]:
    """BFS: category id + all descendant subcategory ids (bounded tree)."""
    ids = [int(category_id)]
    frontier = [int(category_id)]
    while frontier:
        children = list(
            Category.objects.filter(parent_id__in=frontier).values_list("id", flat=True)[:200]
        )
        frontier = [cid for cid in children if cid not in ids]
        ids.extend(frontier)
        if len(ids) > 500:
            break
    return ids


class ProductOrderingFilter(OrderingFilter):
    """
    Storefront ordering:

    - No ``ordering`` query param → view default
      (``-display_priority``, ``-created_at``) plus stable ``id``.
    - Explicit ``-created_at`` / ``created_at`` → recency only (no priority).
    - ``price_toman`` / ``-price_toman`` → display_price semantics; no priority.

    ``display_priority`` is intentionally omitted from public ``ordering_fields``.
    """

    def filter_queryset(self, request, queryset, view):
        ordering = self.get_ordering(request, queryset, view)
        if not ordering:
            return queryset.order_by("-display_priority", "-created_at", "id")

        needs_display = any(f in ("price_toman", "-price_toman") for f in ordering)
        if needs_display:
            queryset = annotate_display_price(queryset)

        noprice = noprice_sort_flag()
        parts = []
        for field in ordering:
            if field == "price_toman":
                parts.append(noprice)
                parts.append(DISPLAY_PRICE_ANNOTATION)
            elif field == "-price_toman":
                parts.append(noprice)
                parts.append(f"-{DISPLAY_PRICE_ANNOTATION}")
            else:
                parts.append(field)
        if "id" not in parts and "-id" not in parts:
            parts.append("id")
        return queryset.order_by(*parts)


class ProductFilter(django_filters.FilterSet):
    category = django_filters.NumberFilter(method="filter_category")
    category_exact = django_filters.NumberFilter(field_name="category_id")
    uncategorized = django_filters.BooleanFilter(method="filter_uncategorized")
    min_price = django_filters.NumberFilter(method="filter_min_price")
    max_price = django_filters.NumberFilter(method="filter_max_price")
    min_rating = django_filters.NumberFilter(method="filter_min_rating")
    brand = django_filters.CharFilter(field_name="brand", lookup_expr="iexact")
    brands = django_filters.CharFilter(method="filter_brands")
    colors = django_filters.CharFilter(method="filter_colors")
    in_stock = django_filters.BooleanFilter(method="filter_in_stock")
    condition = django_filters.CharFilter(field_name="condition")
    is_featured = django_filters.BooleanFilter(field_name="is_featured")
    is_active = django_filters.BooleanFilter(field_name="is_active")

    class Meta:
        model = Product
        fields = (
            "category",
            "category_exact",
            "uncategorized",
            "min_price",
            "max_price",
            "min_rating",
            "brand",
            "brands",
            "colors",
            "in_stock",
            "condition",
            "is_featured",
            "is_active",
        )

    def filter_category(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(category_id__in=category_with_descendants(value))

    def filter_uncategorized(self, queryset, name, value):
        if value:
            return queryset.filter(category__isnull=True)
        return queryset

    def filter_min_price(self, queryset, name, value):
        if value is None:
            return queryset
        queryset = annotate_display_price(queryset)
        return queryset.filter(**{f"{DISPLAY_PRICE_ANNOTATION}__gte": value})

    def filter_max_price(self, queryset, name, value):
        if value is None:
            return queryset
        queryset = annotate_display_price(queryset)
        return queryset.filter(**{f"{DISPLAY_PRICE_ANNOTATION}__lte": value})

    def filter_min_rating(self, queryset, name, value):
        """
        rating defaults to 0 for unrated products. A minimum-star filter must not
        treat unrated (0) as satisfying any positive threshold.
        """
        if value is None:
            return queryset
        return queryset.filter(rating__gte=value).exclude(rating=0)

    def filter_brands(self, queryset, name, value):
        """Comma-separated list of brand names (case-insensitive exact match)."""
        if not value:
            return queryset
        brands = [b.strip() for b in value.split(",") if b.strip()]
        if not brands:
            return queryset
        condition = Q()
        for brand in brands:
            condition |= Q(brand__iexact=brand)
        return queryset.filter(condition)

    def filter_colors(self, queryset, name, value):
        """
        Comma-separated list of color hex codes (e.g. "#ff0000,#00ff00").
        A product matches if any of its colors matches any of the given hex codes.
        """
        if not value:
            return queryset
        hexes = {h.strip().lower() for h in value.split(",") if h.strip()}
        if not hexes:
            return queryset
        matching_colors = ProductColor.objects.filter(hex_code__in=hexes)
        return queryset.filter(Exists(matching_colors.filter(product_id=OuterRef("pk"))))

    def filter_in_stock(self, queryset, name, value):
        """
        Boolean filter: products that are currently in stock.
        A product is in stock if any of its active variants has stock > 0,
        or if the product itself (no variants) has stock > 0.
        """
        if value is None:
            return queryset
        stocked_variant = ProductVariant.objects.filter(
            product_id=OuterRef("pk"), is_active=True, stock__gt=0
        )
        any_variant = ProductVariant.objects.filter(product_id=OuterRef("pk"))
        queryset = queryset.annotate(
            _has_stocked_variant=Exists(stocked_variant),
            _has_any_variant=Exists(any_variant),
        )
        if value:
            return queryset.filter(Q(_has_stocked_variant=True) | Q(_has_any_variant=False, stock__gt=0))
        return queryset.filter(
            Q(_has_stocked_variant=False) & (Q(_has_any_variant=True) | Q(stock__lte=0))
        )

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        if self.data.get("min_price") not in (None, "") or self.data.get("max_price") not in (
            None,
            "",
        ):
            qs = qs.filter(price_on_request=False)
        return qs
