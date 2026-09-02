from django.db import models

from .category import TimeStampedModel


class EmailTemplate(TimeStampedModel):
    class Event(models.TextChoices):
        ORDER_CREATED = "order_created", "ثبت سفارش"
        ORDER_PAID = "order_paid", "پرداخت موفق"
        ORDER_STATUS_CHANGED = "order_status_changed", "تغییر وضعیت سفارش"
        TICKET_CREATED = "ticket_created", "ثبت تیکت پشتیبانی"
        TICKET_REPLIED = "ticket_replied", "پاسخ تیکت"
        USER_REGISTERED = "user_registered", "ثبت‌نام مشتری"
        CUSTOM = "custom", "سفارشی (فقط ارسال آزمایشی)"

    key = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    event = models.CharField(max_length=40, choices=Event.choices, db_index=True)
    trigger_status = models.CharField(max_length=20, blank=True)
    subject = models.CharField(max_length=255)
    body_html = models.TextField()
    is_enabled = models.BooleanField(default=True)
    is_builtin = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "قالب ایمیل"
        verbose_name_plural = "قالب‌های ایمیل"
        indexes = [
            models.Index(fields=["event", "is_enabled"], name="app_email_event_enabled_idx"),
        ]

    def __str__(self):
        return self.name
