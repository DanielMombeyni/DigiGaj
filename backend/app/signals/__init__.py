from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.conf import settings

from app.models import Order, UserProfile


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


@receiver(pre_save, sender=Order)
def remember_order_status(sender, instance, update_fields=None, **kwargs):
    instance._skip_status_sms = False
    if update_fields is not None and "status" not in update_fields:
        instance._skip_status_sms = True
        return
    if not instance.pk:
        instance._previous_status = None
        return
    instance._previous_status = (
        sender.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
    )


@receiver(post_save, sender=Order)
def notify_order_status_sms(sender, instance, created, **kwargs):
    if created or getattr(instance, "_skip_status_sms", False):
        return
    previous = getattr(instance, "_previous_status", None)
    if previous is None or previous == instance.status:
        return
    try:
        from app.services.sms_dispatch import queue_order_status_sms

        queue_order_status_sms(instance, previous)
    except Exception:
        import logging

        logging.getLogger("app.sms").exception("order status sms schedule failed")
