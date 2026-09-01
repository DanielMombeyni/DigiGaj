import django_filters

from app.models import Product


class ProductFilter(django_filters.FilterSet):
    category = django_filters.NumberFilter(field_name="category_id")
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
