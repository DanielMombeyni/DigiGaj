from celery import shared_task

from app.services.email_dispatch import dispatch_event


@shared_task(ignore_result=True)
def send_mail_event(event: str, target: str, target_id: int, extra: dict | None = None):
    return dispatch_event(event, target, target_id, extra or {})
