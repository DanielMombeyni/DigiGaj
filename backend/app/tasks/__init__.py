from celery import shared_task

from .email import send_mail_event  # noqa: F401


@shared_task
def ping():
    return "pong"
