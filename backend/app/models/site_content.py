from django.db import models
from .category import TimeStampedModel


class SitePage(TimeStampedModel):
    slug = models.SlugField(unique=True, allow_unicode=True)
    title = models.CharField(max_length=200)
    body = models.TextField()
    is_published = models.BooleanField(default=True)

    class Meta:
        verbose_name = "صفحه"
        verbose_name_plural = "صفحات"

    def __str__(self):
        return self.title


class Banner(TimeStampedModel):
    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=300, blank=True)
    image = models.ImageField(upload_to="banners/", blank=True, null=True)
    link_url = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order"]


class SiteSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.key
