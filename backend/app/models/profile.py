from django.conf import settings
from django.db import models
from .category import TimeStampedModel


class UserProfile(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, related_name="profile", on_delete=models.CASCADE
    )
    phone = models.CharField(max_length=20, blank=True)
    national_id = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    staff_role = models.ForeignKey(
        "app.StaffRole",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="members",
    )

    def __str__(self):
        return f"Profile({self.user_id})"
