from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

from app.models import UserProfile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def notify_user_registered(sender, instance, created, **kwargs):
    if not created or instance.is_staff or not (instance.email or "").strip():
        return
    from app.services.email_dispatch import queue_mail_event

    queue_mail_event("user_registered", "user", instance.pk)
