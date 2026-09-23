from django.db import models

from .category import TimeStampedModel


class SmsTemplate(TimeStampedModel):
    class Mode(models.TextChoices):
        TEXT = "text", "متن آزاد"
        PATTERN = "pattern", "الگوی سیگنال"

    key = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    mode = models.CharField(
        max_length=16, choices=Mode.choices, default=Mode.TEXT, db_index=True
    )
    body_text = models.TextField(
        blank=True,
        help_text="متن آزاد؛ از {{متغیر}} برای جایگذاری استفاده کنید",
    )
    pattern_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="شناسه الگوی ثبت‌شده در پنل سیگنال",
    )
    # Ordered list of parameter names for Signal pattern, e.g. ["otp", "name"]
    param_keys = models.JSONField(default=list, blank=True)
    # Default/sample values for test sends, e.g. {"otp": "1234"}
    sample_params = models.JSONField(default=dict, blank=True)
    notes = models.CharField(max_length=255, blank=True)
    is_enabled = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "قالب پیامک"
        verbose_name_plural = "قالب‌های پیامک"
        indexes = [
            models.Index(fields=["mode", "is_enabled"], name="app_sms_tpl_mode_en_idx"),
        ]

    def __str__(self):
        return self.name
