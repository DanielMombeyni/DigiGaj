from django.conf import settings
from django.db import models
from .category import TimeStampedModel
from .discount import DiscountCode
from .product import Product


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "در انتظار پرداخت"
        PAID = "paid", "پرداخت‌شده"
        PROCESSING = "processing", "در حال آماده‌سازی"
        SHIPPED = "shipped", "ارسال‌شده"
        DELIVERED = "delivered", "تحویل‌شده"
        CANCELLED = "cancelled", "لغو‌شده"
        REFUNDED = "refunded", "مسترد"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="orders",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    order_number = models.CharField(max_length=32, unique=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    full_name = models.CharField(max_length=180)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    province = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    discount_code = models.ForeignKey(
        DiscountCode, null=True, blank=True, on_delete=models.SET_NULL
    )
    subtotal_toman = models.PositiveBigIntegerField(default=0)
    discount_toman = models.PositiveBigIntegerField(default=0)
    shipping_toman = models.PositiveBigIntegerField(default=0)
    total_toman = models.PositiveBigIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "سفارش"
        verbose_name_plural = "سفارش‌ها"

    def __str__(self):
        return self.order_number


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(
        Product, related_name="order_items", on_delete=models.PROTECT
    )
    variant = models.ForeignKey(
        "app.ProductVariant",
        null=True,
        blank=True,
        related_name="order_items",
        on_delete=models.SET_NULL,
    )
    product_name = models.CharField(max_length=255)
    variant_label = models.CharField(max_length=120, blank=True)
    unit_price_toman = models.PositiveBigIntegerField()
    quantity = models.PositiveIntegerField(default=1)
    line_total_toman = models.PositiveBigIntegerField()

    def __str__(self):
        return f"{self.product_name} x{self.quantity}"
