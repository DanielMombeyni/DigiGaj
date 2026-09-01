from __future__ import annotations

from app.sms.http_client import post_json
from app.sms.base import BaseSmsDriver


class SmsIrDriver(BaseSmsDriver):
    """SMS.ir — Verify API: https://api.sms.ir/v1/send/verify"""

    provider_type = "smsir"
    label = "SMS.ir"
    docs_url = "https://sms.ir/web-service/"
    site_url = "https://sms.ir"
    credential_schema = [
        {
            "key": "api_key",
            "label": "کلید API",
            "required": True,
            "secret": True,
            "hint": "از بخش برنامه‌نویسان پنل SMS.ir",
        },
        {
            "key": "template_id",
            "label": "شناسه قالب Verify",
            "required": True,
            "hint": "TemplateId تعریف‌شده در ارسال سریع / تأییدیه",
        },
        {
            "key": "param_name",
            "label": "نام پارامتر قالب",
            "required": False,
            "hint": "پیش‌فرض CODE — باید با نام متغیر قالب یکی باشد",
        },
    ]

    VERIFY_URL = "https://api.sms.ir/v1/send/verify"

    @classmethod
    def validate_credentials(cls, creds: dict) -> tuple[bool, str | None]:
        if not (creds.get("api_key") or "").strip():
            return False, "کلید API الزامی است"
        tid = str(creds.get("template_id") or "").strip()
        if not tid:
            return False, "شناسه قالب الزامی است"
        try:
            int(tid)
        except ValueError:
            return False, "شناسه قالب باید عدد باشد"
        return True, None

    @classmethod
    def send_otp(cls, *, phone: str, code: str, creds: dict) -> tuple[bool, str | None]:
        ok, err = cls.validate_credentials(creds)
        if not ok:
            return False, err

        param_name = (creds.get("param_name") or "CODE").strip() or "CODE"
        payload = {
            "mobile": phone,
            "templateId": int(str(creds["template_id"]).strip()),
            "parameters": [{"name": param_name, "value": str(code)}],
        }
        data, http_err = post_json(
            cls.VERIFY_URL,
            payload,
            headers={
                "x-api-key": str(creds["api_key"]).strip(),
                "Accept": "text/plain",
            },
        )
        if http_err and data is None:
            return False, http_err

        if isinstance(data, dict):
            status_code = data.get("status")
            if status_code == 1 or str(status_code) == "1":
                return True, None
            msg = data.get("message") or http_err or "ارسال پیامک ناموفق بود"
            return False, str(msg)

        return False, http_err or "پاسخ نامعتبر از SMS.ir"
