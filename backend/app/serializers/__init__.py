from rest_framework import serializers
from app.models import (
    AccountingEntry,
    Banner,
    Category,
    DiscountCode,
    Order,
    OrderItem,
    Product,
    ProductAttribute,
    ProductColor,
    ProductImage,
    ProductSize,
    ProductVariant,
    PurchaseTransaction,
    SitePage,
    SiteSetting,
)
from app.payment.utils import absolute_media_url as _abs_media
from app.services.product_options_service import ProductOptionsService


class CategorySerializer(serializers.ModelSerializer):
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        allow_null=True,
        required=False,
    )
    parent_name = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "image",
            "parent",
            "parent_name",
            "children_count",
            "is_active",
            "sort_order",
        )

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        else:
            data = dict(data)
        parent = data.get("parent")
        if parent in ("", "null", "None", None):
            data["parent"] = None
        return super().to_internal_value(data)

    def validate_parent(self, parent):
        if parent is None:
            return parent
        instance = getattr(self, "instance", None)
        if instance and parent.pk == instance.pk:
            raise serializers.ValidationError("دسته نمی‌تواند والد خودش باشد.")
        if instance:
            current = parent
            seen = set()
            while current is not None:
                if current.pk == instance.pk:
                    raise serializers.ValidationError(
                        "نمی‌توانید یک زیرمجموعه را به‌عنوان والد انتخاب کنید."
                    )
                if current.pk in seen:
                    break
                seen.add(current.pk)
                current = current.parent
        return parent

    def get_parent_name(self, obj):
        parent = getattr(obj, "parent", None)
        return parent.name if parent else None

    def get_children_count(self, obj):
        annotated = getattr(obj, "children_count", None)
        if annotated is not None:
            return annotated
        return obj.children.count()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["image"] = (
            _abs_media(instance.image.url, self.context.get("request"))
            if instance.image
            else None
        )
        return data

    def update(self, instance, validated_data):
        request = self.context.get("request")
        if request is not None:
            clear = request.data.get("clear_image")
            if str(clear).lower() in ("1", "true", "yes"):
                if instance.image:
                    instance.image.delete(save=False)
                validated_data["image"] = None
        return super().update(instance, validated_data)


class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ("id", "image", "alt", "is_primary", "sort_order", "color")

    def get_image(self, obj):
        if not obj.image:
            return None
        return _abs_media(obj.image.url, self.context.get("request"))


class ProductColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductColor
        fields = ("id", "name", "hex_code", "sort_order")


class ProductSizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductSize
        fields = ("id", "name", "sort_order")


class ProductVariantSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)
    effective_price = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = (
            "id",
            "color",
            "size",
            "price_toman",
            "effective_price",
            "stock",
            "sku",
            "is_active",
            "option_key",
            "label",
        )

    def get_effective_price(self, obj):
        return obj.effective_price()


class ProductAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAttribute
        fields = ("id", "name", "value", "sort_order")


class ProductListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    primary_image = serializers.SerializerMethodField()
    in_stock = serializers.BooleanField(read_only=True)
    has_options = serializers.BooleanField(read_only=True)
    min_price = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "slug",
            "short_description",
            "brand",
            "condition",
            "price_toman",
            "min_price",
            "compare_at_price_toman",
            "price_on_request",
            "stock",
            "in_stock",
            "has_options",
            "is_active",
            "is_featured",
            "rating",
            "category",
            "category_name",
            "primary_image",
        )

    def get_primary_image(self, obj):
        # Use .all() so prefetch_related cache is reused (filter() forces N+1)
        images = list(obj.images.all())
        if not images:
            return None
        img = next((i for i in images if i.is_primary), images[0])
        return _abs_media(img.image.url, self.context.get("request"))

    def get_min_price(self, obj):
        if obj.price_on_request:
            return None
        prices = []
        for v in obj.variants.all():
            if not v.is_active:
                continue
            # Prefer variant price; fall back to parent product (avoid v.product N+1)
            prices.append(v.price_toman if v.price_toman is not None else obj.price_toman)
        if prices:
            return min(prices)
        return obj.price_toman


RELATED_PRODUCT_LIMIT = 4
RELATED_PRODUCT_PREFETCH = ("images", "variants", "colors", "sizes")


def _related_product_queryset():
    return Product.objects.select_related("category").prefetch_related(*RELATED_PRODUCT_PREFETCH)


class ProductDetailSerializer(ProductListSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    colors = ProductColorSerializer(many=True, read_only=True)
    sizes = ProductSizeSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    attributes = ProductAttributeSerializer(many=True, read_only=True)
    similar_products = serializers.SerializerMethodField()
    recommended_products = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + (
            "description",
            "specs",
            "meta",
            "images",
            "colors",
            "sizes",
            "variants",
            "attributes",
            "similar_products",
            "recommended_products",
            "created_at",
        )

    def _serialize_related(self, queryset):
        return ProductListSerializer(
            queryset, many=True, context=self.context
        ).data

    def get_similar_products(self, obj):
        base = _related_product_queryset().filter(is_active=True).exclude(pk=obj.pk)
        picked = []
        seen = {obj.pk}

        def take(qs, limit):
            nonlocal picked
            need = limit - len(picked)
            if need <= 0:
                return
            # Slice in SQL — iterating an unsliced QS can load the full table
            for product in qs[: need + len(seen)]:
                if product.pk in seen:
                    continue
                picked.append(product)
                seen.add(product.pk)
                if len(picked) >= limit:
                    break

        take(
            base.filter(category_id=obj.category_id).order_by("-rating", "-created_at"),
            RELATED_PRODUCT_LIMIT,
        )
        if obj.brand and len(picked) < RELATED_PRODUCT_LIMIT:
            take(
                base.filter(brand__iexact=obj.brand).order_by("-rating", "-created_at"),
                RELATED_PRODUCT_LIMIT,
            )
        if len(picked) < RELATED_PRODUCT_LIMIT:
            take(base.order_by("-rating", "-created_at"), RELATED_PRODUCT_LIMIT)

        return self._serialize_related(picked)

    def get_recommended_products(self, obj):
        qs = (
            _related_product_queryset()
            .filter(is_active=True, is_featured=True)
            .exclude(pk=obj.pk)
            .order_by("-rating", "-created_at")[:RELATED_PRODUCT_LIMIT]
        )
        return self._serialize_related(qs)


class ProductWriteSerializer(serializers.ModelSerializer):
    colors = serializers.ListField(child=serializers.DictField(), required=False)
    sizes = serializers.ListField(child=serializers.DictField(), required=False)
    variants = serializers.ListField(child=serializers.DictField(), required=False)
    attributes = serializers.ListField(child=serializers.DictField(), required=False)

    class Meta:
        model = Product
        fields = (
            "category",
            "name",
            "slug",
            "short_description",
            "description",
            "brand",
            "condition",
            "price_toman",
            "compare_at_price_toman",
            "price_on_request",
            "stock",
            "is_active",
            "is_featured",
            "rating",
            "specs",
            "meta",
            "colors",
            "sizes",
            "variants",
            "attributes",
        )

    def validate(self, attrs):
        por = attrs.get(
            "price_on_request",
            getattr(self.instance, "price_on_request", False),
        )
        price = attrs.get(
            "price_toman",
            getattr(self.instance, "price_toman", None),
        )
        if por:
            attrs["price_toman"] = 0
            attrs["compare_at_price_toman"] = None
        elif price is not None and int(price) <= 0:
            raise serializers.ValidationError(
                {"price_toman": "قیمت باید بیشتر از صفر باشد"}
            )
        return attrs

    def create(self, validated_data):
        options = {
            "colors": validated_data.pop("colors", None),
            "sizes": validated_data.pop("sizes", None),
            "variants": validated_data.pop("variants", None),
            "attributes": validated_data.pop("attributes", None),
        }
        if not validated_data.get("sku"):
            import uuid

            validated_data["sku"] = f"P-{uuid.uuid4().hex[:12].upper()}"
        product = Product.objects.create(**validated_data)
        ProductOptionsService.sync(
            product,
            {k: v for k, v in options.items() if v is not None},
        )
        return product

    def update(self, instance, validated_data):
        options = {
            "colors": validated_data.pop("colors", None),
            "sizes": validated_data.pop("sizes", None),
            "variants": validated_data.pop("variants", None),
            "attributes": validated_data.pop("attributes", None),
        }
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        ProductOptionsService.sync(
            instance,
            {k: v for k, v in options.items() if v is not None},
        )
        return instance

    def to_representation(self, instance):
        # Re-fetch with prefetch so detail response does not N+1 after sync
        product = (
            Product.objects.select_related("category")
            .prefetch_related(
                "images",
                "colors",
                "sizes",
                "variants__color",
                "variants__size",
                "attributes",
            )
            .get(pk=instance.pk)
        )
        return ProductDetailSerializer(product, context=self.context).data


class DiscountCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountCode
        fields = "__all__"
        read_only_fields = ("used_count", "created_at", "updated_at")


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product",
            "variant",
            "product_name",
            "variant_label",
            "unit_price_toman",
            "quantity",
            "line_total_toman",
            "price_pending",
        )


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    tracking_code = serializers.CharField(source="order_number", read_only=True)
    has_price_pending = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "tracking_code",
            "status",
            "full_name",
            "phone",
            "email",
            "address",
            "province",
            "city",
            "postal_code",
            "notes",
            "subtotal_toman",
            "discount_toman",
            "shipping_toman",
            "total_toman",
            "items",
            "has_price_pending",
            "created_at",
        )

    def get_has_price_pending(self, obj):
        items = obj.items.all()
        return any(i.price_pending for i in items)


class CreateOrderSerializer(serializers.Serializer):
    items = serializers.ListField(child=serializers.DictField(), min_length=1)
    full_name = serializers.CharField(max_length=180)
    phone = serializers.CharField(max_length=20)
    address = serializers.CharField()
    province = serializers.CharField()
    city = serializers.CharField()
    postal_code = serializers.CharField()
    email = serializers.EmailField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    discount_code = serializers.CharField(required=False, allow_blank=True)
    shipping_toman = serializers.IntegerField(required=False, default=0)
    gateway = serializers.CharField(required=False, allow_blank=True)
    platform = serializers.ChoiceField(
        choices=["web", "app"], required=False, default="web"
    )


    def validate(self, attrs):
        errors = {}
        for field, label in (
            ("address", "آدرس کامل"),
            ("province", "استان"),
            ("city", "شهر"),
            ("postal_code", "کد پستی"),
        ):
            val = (attrs.get(field) or "").strip()
            if not val:
                errors[field] = f"{label} الزامی است."
            else:
                attrs[field] = val
        postal = attrs.get("postal_code", "")
        if postal and (not postal.isdigit() or len(postal) != 10):
            errors["postal_code"] = "کد پستی باید ۱۰ رقم باشد."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class AccountingEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingEntry
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")


class SitePageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SitePage
        fields = ("id", "slug", "title", "body", "is_published", "updated_at")


class BannerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = ("id", "title", "subtitle", "image", "link_url", "is_active", "sort_order")


class SiteSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSetting
        fields = ("key", "value", "updated_at")


class PurchaseTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseTransaction
        fields = (
            "id",
            "tracking_number",
            "gateway",
            "status",
            "platform",
            "amount",
            "authority",
            "ref_id",
            "payment_url",
            "metadata",
            "created_at",
            "activated_at",
        )
