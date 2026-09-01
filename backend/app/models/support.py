from django.conf import settings
from django.db import models
from django.utils.crypto import get_random_string

from .category import TimeStampedModel


class SupportTicket(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "باز"
        IN_PROGRESS = "in_progress", "در حال بررسی"
        ANSWERED = "answered", "پاسخ‌داده‌شده"
        CLOSED = "closed", "بسته‌شده"

    class Priority(models.TextChoices):
        LOW = "low", "کم"
        NORMAL = "normal", "عادی"
        HIGH = "high", "بالا"

    ticket_number = models.CharField(max_length=24, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="support_tickets",
        on_delete=models.SET_NULL,
    )
    full_name = models.CharField(max_length=180)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    subject = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True
    )
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.NORMAL
    )

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "تیکت پشتیبانی"
        verbose_name_plural = "تیکت‌های پشتیبانی"
        indexes = [
            models.Index(fields=["status", "-updated_at"]),
        ]

    def __str__(self):
        return self.ticket_number

    @staticmethod
    def generate_number() -> str:
        return f"TK-{get_random_string(8).upper()}"


class TicketMessage(TimeStampedModel):
    ticket = models.ForeignKey(
        SupportTicket, related_name="messages", on_delete=models.CASCADE
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="ticket_messages",
        on_delete=models.SET_NULL,
    )
    is_staff_reply = models.BooleanField(default=False)
    body = models.TextField()

    class Meta:
        ordering = ["created_at"]
        verbose_name = "پیام تیکت"
        verbose_name_plural = "پیام‌های تیکت"

    def __str__(self):
        return f"{self.ticket_id}:{self.pk}"
