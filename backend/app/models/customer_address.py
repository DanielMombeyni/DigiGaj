from django.conf import settings
from django.db import models

from .category import TimeStampedModel

MAX_CUSTOMER_ADDRESSES = 5


class CustomerAddress(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="addresses",
        on_delete=models.CASCADE,
    )
    label = models.CharField(max_length=60, blank=True)
    full_name = models.CharField(max_length=180)
    phone = models.CharField(max_length=20)
    address = models.TextField()
    province = models.CharField(max_length=80, blank=True, default="")
    city = models.CharField(max_length=80, blank=True, default="")
    postal_code = models.CharField(max_length=20, blank=True, default="")
    is_active = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-is_active", "-updated_at"]
        verbose_name = "آدرس مشتری"
        verbose_name_plural = "آدرس‌های مشتری"
        indexes = [
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.label or self.city or self.pk}"
