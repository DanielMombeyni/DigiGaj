from __future__ import annotations

from django.conf import settings

from app.sms.base import BaseSmsDriver
from app.sms.signal import SignalSmsService
from app.sms.signal.exceptions import SignalSmsError


class SignalSmsDriver(BaseSmsDriver):
    """
    Signal SMS (Transmitor) driver for admin SMS providers / OTP.

    API key may come from admin credentials or SIGNAL_SMS_API_KEY (.env).
    Keys are valid 365 days; creating a new key expires the previous one.
    """

    provider_type = "signal"
    label = "سیگنال SMS"
    docs_url = "https://transmitor.signalads.com/document#description/introduction"
    site_url = "https://signalads.com"
    credential_schema = [
        {
            "key": "api_key",
            "label": "کلید API",
            "required": False,
            "secret": True,
            "hint": (
                "اختیاری اگر SIGNAL_SMS_API_KEY در .env تنظیم شده باشد. "
                "اعتبار کلید ۳۶۵ روز است؛ ساخت کلید جدید، کلید قبلی را منقضی می‌کند."
            ),
        },
        {
            "key": "from_number",
            "label": "شماره خط ارسال",
            "required": False,
            "hint": "اختیاری اگر SIGNAL_SMS_FROM در .env تنظیم شده باشد (مثلاً 9890005274)",
        },
        {
            "key": "message_template",
            "label": "متن پیامک OTP",
            "required": False,
            "type": "textarea",
            "hint": "از {code} برای جای کد استفاده کنید — در صورت خالی بودن از الگوی خدماتی استفاده می‌شود",
        },
        {
            "key": "pattern_id",
            "label": "شناسه الگوی خدماتی (اختیاری)",
            "required": False,
            "hint": "اگر پر باشد، ارسال از طریق /api_v1/sms/pattern/send انجام می‌شود",
        },
        {
            "key": "pattern_param",
            "label": "نام پارامتر الگو",
            "required": False,
            "hint": "پیش‌فرض otp — باید با متغیر قالب در پنل سیگنال یکی باشد",
        },
    ]

    @classmethod
    def _resolve_api_key(cls, creds: dict) -> str:
        return (
            str(creds.get("api_key") or "").strip()
            or str(getattr(settings, "SIGNAL_SMS_API_KEY", "") or "").strip()
        )

    @classmethod
    def _resolve_sender(cls, creds: dict) -> str:
        return (
            str(creds.get("from_number") or "").strip()
            or str(getattr(settings, "SIGNAL_SMS_FROM", "") or "").strip()
        )

    @classmethod
    def validate_credentials(cls, creds: dict) -> tuple[bool, str | None]:
        if not cls._resolve_api_key(creds or {}):
            return (
                False,
                "کلید API الزامی است (در فرم یا متغیر محیطی SIGNAL_SMS_API_KEY)",
            )
        if not cls._resolve_sender(creds or {}):
            return (
                False,
                "شماره خط ارسال الزامی است (در فرم یا متغیر محیطی SIGNAL_SMS_FROM)",
            )
        pattern_id = str((creds or {}).get("pattern_id") or "").strip()
        if pattern_id:
            try:
                int(pattern_id)
            except ValueError:
                return False, "شناسه الگو باید عدد باشد"
        return True, None

    @classmethod
    def _client(cls, creds: dict) -> SignalSmsService:
        return SignalSmsService(
            api_key=cls._resolve_api_key(creds),
            sender=cls._resolve_sender(creds),
        )

    @classmethod
    def send_otp(cls, *, phone: str, code: str, creds: dict) -> tuple[bool, str | None]:
        ok, err = cls.validate_credentials(creds)
        if not ok:
            return False, err

        try:
            client = cls._client(creds)
            pattern_id = str(creds.get("pattern_id") or "").strip()
            if pattern_id:
                param_name = (creds.get("pattern_param") or "otp").strip() or "otp"
                client.send_pattern(
                    phone,
                    pattern_id,
                    {param_name: str(code)},
                )
                return True, None

            template = (
                creds.get("message_template") or "کد تأیید شما: {code}"
            ).strip()
            text = template.replace("{code}", str(code))
            client.send_sms(phone, text)
            return True, None
        except SignalSmsError as exc:
            return False, str(exc)
