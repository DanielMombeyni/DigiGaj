import django_filters

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


class ProductFilter(django_filters.FilterSet):
    category = django_filters.NumberFilter(method="filter_category")
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

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        if self.data.get("min_price") not in (None, "") or self.data.get("max_price") not in (
            None,
            "",
        ):
            qs = qs.filter(price_on_request=False)
        return qs
