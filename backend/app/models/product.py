from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from .category import Category, TimeStampedModel


class Product(TimeStampedModel):
    class Condition(models.TextChoices):
        NEW = "new", "نو"
        LIKE_NEW = "like_new", "در حد نو"
        USED = "used", "کارکرده"
        REFURBISHED = "refurbished", "بازسازی‌شده"

    category = models.ForeignKey(
        Category,
        related_name="products",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255, verbose_name="نام محصول")
    slug = models.SlugField(max_length=280, unique=True, allow_unicode=True)
    sku = models.CharField(max_length=64, unique=True, blank=True)
    short_description = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    brand = models.CharField(max_length=120, blank=True)
    condition = models.CharField(
        max_length=20, choices=Condition.choices, default=Condition.NEW
    )
    price_toman = models.PositiveBigIntegerField(
        validators=[MinValueValidator(0)], verbose_name="قیمت پایه (تومان)"
    )
    price_on_request = models.BooleanField(
        default=False,
        verbose_name="قیمت با تماس",
        help_text="اگر فعال باشد قیمت ثابت ندارد و باید با فروشگاه تماس گرفته شود",
    )
    compare_at_price_toman = models.PositiveBigIntegerField(
        null=True, blank=True, verbose_name="قیمت قبل تخفیف"
    )
    stock = models.PositiveIntegerField(
        default=0, help_text="موجودی پایه وقتی تنوع رنگ/سایز تعریف نشده"
    )
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    rating = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
        verbose_name="امتیاز",
        help_text="۰ تا ۵ ستاره",
    )
    specs = models.JSONField(default=dict, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "محصول"
        verbose_name_plural = "محصولات"
        indexes = [
            models.Index(fields=["is_active", "is_featured"]),
            models.Index(fields=["category", "is_active"]),
            models.Index(fields=["is_active", "price_toman"]),
            models.Index(fields=["is_active", "-created_at"]),
        ]

    def __str__(self):
        return self.name

    @property
    def has_options(self):
        # Uses prefetch cache when available (list/detail views)
        return bool(self.colors.all()) or bool(self.sizes.all())

    @property
    def in_stock(self):
        if self.has_options:
            # Iterate prefetched variants — avoid .filter() which bypasses cache (N+1)
            return any(v.is_active and v.stock > 0 for v in self.variants.all())
        return self.stock > 0

    def available_stock(self, variant=None):
        from django.db.models import Sum

        if variant is not None:
            return variant.stock if variant.is_active else 0
        if self.has_options:
            return (
                self.variants.filter(is_active=True).aggregate(total=Sum("stock"))[
                    "total"
                ]
                or 0
            )
        return self.stock

    def resolve_variant(self, *, color_id=None, size_id=None, variant_id=None):
        qs = self.variants.filter(is_active=True)
        if variant_id:
            return qs.filter(pk=variant_id).first()
        qs = qs.filter(color_id=color_id, size_id=size_id)
        return qs.first()

    def resolve_price(self, variant=None):
        if variant is not None and variant.price_toman is not None:
            return variant.price_toman
        return self.price_toman


class ProductColor(TimeStampedModel):
    product = models.ForeignKey(
        Product, related_name="colors", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=80)
    hex_code = models.CharField(max_length=7, blank=True, help_text="#RRGGBB")
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "رنگ محصول"
        verbose_name_plural = "رنگ‌های محصول"

    def __str__(self):
        return f"{self.product_id}:{self.name}"


class ProductSize(TimeStampedModel):
    product = models.ForeignKey(
        Product, related_name="sizes", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=80)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "سایز محصول"
        verbose_name_plural = "سایزهای محصول"

    def __str__(self):
        return f"{self.product_id}:{self.name}"


class ProductVariant(TimeStampedModel):
    """یک ترکیب اختیاری رنگ/سایز با قیمت و موجودی مستقل (قیمت خالی = قیمت پایه)."""

    product = models.ForeignKey(
        Product, related_name="variants", on_delete=models.CASCADE
    )
    color = models.ForeignKey(
        ProductColor,
        null=True,
        blank=True,
        related_name="variants",
        on_delete=models.CASCADE,
    )
    size = models.ForeignKey(
        ProductSize,
        null=True,
        blank=True,
        related_name="variants",
        on_delete=models.CASCADE,
    )
    price_toman = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text="خالی = استفاده از قیمت پایه محصول",
    )
    stock = models.PositiveIntegerField(default=0)
    sku = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
    # Stable unique key for (color, size) including nulls
    option_key = models.CharField(max_length=64, db_index=True)

    class Meta:
        ordering = ["id"]
        verbose_name = "تنوع محصول"
        verbose_name_plural = "تنوع‌های محصول"
        constraints = [
            models.UniqueConstraint(
                fields=["product", "option_key"],
                name="uniq_product_variant_option_key",
            )
        ]

    def __str__(self):
        return f"{self.product_id}:{self.option_key}"

    @staticmethod
    def make_option_key(color_id=None, size_id=None) -> str:
        return f"c{color_id or 0}-s{size_id or 0}"

    def save(self, *args, **kwargs):
        self.option_key = self.make_option_key(
            self.color_id, self.size_id
        )
        super().save(*args, **kwargs)

    @property
    def label(self) -> str:
        parts = []
        if self.color_id:
            parts.append(self.color.name)
        if self.size_id:
            parts.append(self.size.name)
        return " / ".join(parts) if parts else "پیش‌فرض"

    def effective_price(self) -> int:
        if self.price_toman is not None:
            return self.price_toman
        return self.product.price_toman


class ProductAttribute(TimeStampedModel):
    """ویژگی‌های نمایشی محصول (گارانتی، جنس، …)."""

    product = models.ForeignKey(
        Product, related_name="attributes", on_delete=models.CASCADE
    )
    name = models.CharField(max_length=120)
    value = models.CharField(max_length=255)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "ویژگی محصول"
        verbose_name_plural = "ویژگی‌های محصول"

    def __str__(self):
        return f"{self.name}: {self.value}"


class ProductImage(TimeStampedModel):
    product = models.ForeignKey(
        Product, related_name="images", on_delete=models.CASCADE
    )
    color = models.ForeignKey(
        ProductColor,
        null=True,
        blank=True,
        related_name="images",
        on_delete=models.SET_NULL,
    )
    image = models.ImageField(upload_to="products/")
    alt = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
