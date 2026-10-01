from django.db import models

from .category import TimeStampedModel
from .sms_template import SmsTemplate


class SmsLog(TimeStampedModel):
    class Status(models.TextChoices):
        SENT = "sent", "ارسال‌شده"
        FAILED = "failed", "ناموفق"

    phone = models.CharField(max_length=20, db_index=True, verbose_name="شماره")
    event = models.CharField(max_length=40, db_index=True, verbose_name="رویداد")
    status = models.CharField(
        max_length=16, choices=Status.choices, db_index=True, verbose_name="وضعیت"
    )
    error = models.CharField(max_length=500, blank=True, verbose_name="خطا")
    template = models.ForeignKey(
        SmsTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="logs",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "گزارش پیامک"
        verbose_name_plural = "گزارش پیامک‌ها"
        indexes = [
            models.Index(fields=["-created_at"], name="app_sms_log_created_idx"),
        ]

    def __str__(self):
        return f"{self.event} {self.phone} {self.status}"
