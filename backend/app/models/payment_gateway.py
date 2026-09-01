from django.conf import settings
from django.db import models
from .category import TimeStampedModel
from .order import Order


class PaymentGatewayConfig(TimeStampedModel):
    class Provider(models.TextChoices):
        ZARINPAL = "zarinpal", "زرین‌پال"
        ZIBAL = "zibal", "زیبال"
        PAYPING = "payping", "پی‌پینگ"
        CARD = "card", "کارت‌به‌کارت"

    provider_type = models.CharField(
        max_length=32, choices=Provider.choices, unique=True
    )
    display_name = models.CharField(max_length=120)
    is_enabled_app = models.BooleanField(default=False)
    is_enabled_web = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    logo = models.ImageField(upload_to="gateways/", blank=True, null=True)
    credentials = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["sort_order", "provider_type"]
        verbose_name = "درگاه پرداخت"
        verbose_name_plural = "درگاه‌های پرداخت"

    def __str__(self):
        return self.display_name or self.provider_type


class PurchaseTransaction(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "در انتظار"
        SUCCESS = "success", "موفق"
        FAILED = "failed", "ناموفق"
        REFUNDED = "refunded", "مسترد"

    class Platform(models.TextChoices):
        WEB = "web", "وب"
        APP = "app", "اپ"

    tracking_number = models.CharField(max_length=64, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="purchases",
        on_delete=models.SET_NULL,
    )
    order = models.ForeignKey(
        Order,
        null=True,
        blank=True,
        related_name="transactions",
        on_delete=models.SET_NULL,
    )
    gateway = models.CharField(max_length=32)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    platform = models.CharField(
        max_length=8, choices=Platform.choices, default=Platform.WEB
    )
    amount = models.PositiveBigIntegerField(verbose_name="مبلغ (تومان)")
    authority = models.CharField(max_length=128, blank=True)
    ref_id = models.CharField(max_length=128, blank=True)
    payment_url = models.TextField(blank=True)
    callback_payload = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["gateway", "authority"]),
            models.Index(fields=["status", "created_at"]),
        ]
        verbose_name = "تراکنش پرداخت"
        verbose_name_plural = "تراکنش‌های پرداخت"

    def __str__(self):
        return self.tracking_number
