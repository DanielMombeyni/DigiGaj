from django.db import models

from .category import TimeStampedModel


class SmsProviderConfig(TimeStampedModel):
    class Provider(models.TextChoices):
        FARAPAYAMAK = "farapayamak", "فراپیامک"
        SMSIR = "smsir", "SMS.ir"

    provider_type = models.CharField(
        max_length=32, choices=Provider.choices, unique=True
    )
    display_name = models.CharField(max_length=120)
    is_enabled = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    credentials = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["sort_order", "provider_type"]
        verbose_name = "سرویس پیامک"
        verbose_name_plural = "سرویس‌های پیامک"

    def __str__(self):
        return self.display_name or self.provider_type
