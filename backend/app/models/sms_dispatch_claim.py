"""Durable at-most-once claim records for order-scoped SMS events."""

from django.db import models

from .category import TimeStampedModel


class SmsDispatchClaim(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "در حال ارسال"
        SENT = "sent", "ارسال‌شده"
        FAILED = "failed", "ناموفق"

    claim_key = models.CharField(max_length=191, unique=True, db_index=True)
    event = models.CharField(max_length=40, db_index=True)
    phone = models.CharField(max_length=20, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    error = models.CharField(max_length=500, blank=True)

    class Meta:
        verbose_name = "ادعای ارسال پیامک رویداد"
        verbose_name_plural = "ادعاهای ارسال پیامک رویداد"

    def __str__(self):
        return f"{self.claim_key} ({self.status})"
