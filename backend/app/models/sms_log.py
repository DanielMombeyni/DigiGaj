from django.conf import settings
from django.db import models

from .category import TimeStampedModel
from .sms_template import SmsTemplate


class SmsLog(TimeStampedModel):
    class Status(models.TextChoices):
        SENT = "sent", "ارسال‌شده"
        FAILED = "failed", "ناموفق"
        QUEUED = "queued", "در صف"

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
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sms_logs",
        verbose_name="ادمین ارسال‌کننده",
    )
    batch_id = models.CharField(max_length=64, blank=True, db_index=True)
    fallback_reason = models.CharField(max_length=80, blank=True)
    recipient_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="received_sms_logs",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "گزارش پیامک"
        verbose_name_plural = "گزارش پیامک‌ها"
        indexes = [
            models.Index(fields=["-created_at"], name="app_sms_log_created_idx"),
            models.Index(fields=["batch_id", "-created_at"], name="app_sms_log_batch_idx"),
        ]

    def __str__(self):
        return f"{self.event} {self.phone} {self.status}"
