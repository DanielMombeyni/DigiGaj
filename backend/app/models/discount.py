from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from .category import TimeStampedModel


class DiscountCode(TimeStampedModel):
    class DiscountType(models.TextChoices):
        PERCENT = "percent", "درصدی"
        FIXED = "fixed", "مبلغ ثابت"

    code = models.CharField(max_length=64, unique=True, verbose_name="کد")
    description = models.CharField(max_length=255, blank=True)
    discount_type = models.CharField(
        max_length=16, choices=DiscountType.choices, default=DiscountType.PERCENT
    )
    value = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        help_text="درصد یا مبلغ تومان",
    )
    max_percent = models.PositiveIntegerField(
        default=100, validators=[MaxValueValidator(100)]
    )
    min_order_toman = models.PositiveBigIntegerField(default=0)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "کد تخفیف"
        verbose_name_plural = "کدهای تخفیف"

    def __str__(self):
        return self.code

    def is_valid_now(self):
        now = timezone.now()
        if not self.is_active:
            return False
        if self.starts_at and now < self.starts_at:
            return False
        if self.ends_at and now > self.ends_at:
            return False
        if self.max_uses is not None and self.used_count >= self.max_uses:
            return False
        return True

    def calculate_discount(self, amount_toman: int) -> int:
        if amount_toman < self.min_order_toman:
            return 0
        if self.discount_type == self.DiscountType.PERCENT:
            raw = int(amount_toman * min(self.value, self.max_percent) / 100)
            return min(raw, amount_toman)
        return min(self.value, amount_toman)
