import django_filters
from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework.filters import OrderingFilter

from app.models import Category, Product


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
    When sorting by price, push products without a fixed price
    (price_on_request or price_toman <= 0) to the end of the list.
    """

    def filter_queryset(self, request, queryset, view):
        ordering = self.get_ordering(request, queryset, view)
        if not ordering:
            return queryset

        needs_noprice_last = any(f in ("price_toman", "-price_toman") for f in ordering)
        if not needs_noprice_last:
            return queryset.order_by(*ordering)

        queryset = queryset.annotate(
            _noprice=Case(
                When(Q(price_on_request=True) | Q(price_toman__lte=0), then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )
        )
        final = []
        for field in ordering:
            if field in ("price_toman", "-price_toman"):
                final.append("_noprice")
            final.append(field)
        return queryset.order_by(*final)


class ProductFilter(django_filters.FilterSet):
    category = django_filters.NumberFilter(method="filter_category")
    category_exact = django_filters.NumberFilter(field_name="category_id")
    uncategorized = django_filters.BooleanFilter(method="filter_uncategorized")
    min_price = django_filters.NumberFilter(field_name="price_toman", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price_toman", lookup_expr="lte")
    min_rating = django_filters.NumberFilter(field_name="rating", lookup_expr="gte")
    brand = django_filters.CharFilter(field_name="brand", lookup_expr="iexact")
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

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        if self.data.get("min_price") not in (None, "") or self.data.get("max_price") not in (
            None,
            "",
        ):
            qs = qs.filter(price_on_request=False)
        return qs
