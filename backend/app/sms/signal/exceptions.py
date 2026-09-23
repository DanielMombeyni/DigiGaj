"""Signal SMS (Transmitor) domain errors — mapped by the DRF exception handler."""

from __future__ import annotations


class SignalSmsError(Exception):
    """Base error for Signal / Transmitor SMS API failures."""

    code = "signal_sms_error"
    http_status = 502
    default_message = "خطا در ارتباط با سرویس پیامک سیگنال"

    def __init__(self, message: str | None = None, *, details: object | None = None):
        self.message = (message or self.default_message).strip() or self.default_message
        self.details = details
        super().__init__(self.message)

    def __str__(self) -> str:
        return self.message


class SignalSmsConfigError(SignalSmsError):
    code = "signal_sms_config"
    http_status = 503
    default_message = "تنظیمات سرویس پیامک سیگنال ناقص است (کلید API یا خط ارسال)."


class SignalSmsAuthError(SignalSmsError):
    """Invalid/expired API key (keys are valid for 365 days)."""

    code = "signal_sms_auth"
    http_status = 401
    default_message = (
        "احراز هویت پیامک سیگنال ناموفق بود. کلید API منقضی یا نامعتبر است "
        "(اعتبار کلید ۳۶۵ روز است؛ ساخت کلید جدید کلید قبلی را باطل می‌کند)."
    )


class SignalSmsInsufficientBalanceError(SignalSmsError):
    code = "signal_sms_insufficient_balance"
    http_status = 402
    default_message = "موجودی اعتبار پنل پیامک سیگنال کافی نیست."


class SignalSmsNotFoundError(SignalSmsError):
    code = "signal_sms_not_found"
    http_status = 404
    default_message = "پیامک موردنظر یافت نشد یا هنوز تکمیل نشده است."


class SignalSmsRateLimitError(SignalSmsError):
    code = "signal_sms_rate_limit"
    http_status = 429
    default_message = "تعداد درخواست‌های پیامک سیگنال بیش از حد مجاز است. کمی بعد دوباره تلاش کنید."
