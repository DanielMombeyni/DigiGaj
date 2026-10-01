from celery import shared_task

from app.services.sms_dispatch import dispatch_sms_event


@shared_task(ignore_result=True)
def send_sms_event(event: str, context: dict | None = None, customer_phone: str = ""):
    try:
        return dispatch_sms_event(event, context or {}, customer_phone or "")
    except Exception:
        return 0
