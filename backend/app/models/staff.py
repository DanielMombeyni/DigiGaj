from django.db import models
from django.utils.text import slugify

from .category import TimeStampedModel


class StaffRole(TimeStampedModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.CharField(max_length=255, blank=True)
    pages = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "نقش پرسنل"
        verbose_name_plural = "نقش‌های پرسنل"

    def __str__(self):
        return self.name

    def ensure_slug(self):
        if self.slug:
            return
        base = slugify(self.name, allow_unicode=True) or "role"
        candidate = base[:120]
        n = 1
        while StaffRole.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
            n += 1
            candidate = f"{base[:110]}-{n}"
        self.slug = candidate
