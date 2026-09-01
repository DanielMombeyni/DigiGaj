from django.conf import settings
from django.db import models
from .category import TimeStampedModel
from .order import Order
from .payment_gateway import PurchaseTransaction


class AccountingEntry(TimeStampedModel):
    class EntryType(models.TextChoices):
        INCOME = "income", "درآمد"
        EXPENSE = "expense", "هزینه"
        REFUND = "refund", "استرداد"
        ADJUSTMENT = "adjustment", "تعدیل"

    entry_type = models.CharField(max_length=16, choices=EntryType.choices)
    title = models.CharField(max_length=255)
    amount_toman = models.BigIntegerField()
    description = models.TextField(blank=True)
    order = models.ForeignKey(
        Order, null=True, blank=True, on_delete=models.SET_NULL, related_name="ledger"
    )
    transaction = models.ForeignKey(
        PurchaseTransaction,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ledger",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    occurred_at = models.DateTimeField()
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-occurred_at"]
        verbose_name = "سند حسابداری"
        verbose_name_plural = "اسناد حسابداری"

    def __str__(self):
        return f"{self.title} ({self.amount_toman})"
