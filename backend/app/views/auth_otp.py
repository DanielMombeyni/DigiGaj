import hashlib
import hmac
import logging
import random
import re

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from app.models import UserProfile
from app.services.sms_dispatch import send_login_otp, send_password_reset_otp
from app.services.store_config import effective_auth_methods

User = get_user_model()
logger = logging.getLogger("app.auth")

OTP_TTL = 120
RESEND_COOLDOWN = 60
MAX_WRONG_ATTEMPTS = 5
MAX_SENDS_PER_PHONE = 5
MAX_SENDS_PER_IP = 10
SEND_WINDOW = 600


def _normalize_phone(value: str) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    if digits.startswith("98") and len(digits) >= 12:
        digits = "0" + digits[2:]
    return digits


def _phone_ok(phone: str) -> bool:
    return bool(re.fullmatch(r"09\d{9}", phone))


def _client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64] or "unknown"
    return (request.META.get("REMOTE_ADDR") or "unknown")[:64]


def _hash_code(phone: str, code: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode(),
        f"{phone}:{code}".encode(),
        hashlib.sha256,
    ).hexdigest()


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def _bump_counter(key: str, window: int) -> int:
    current = cache.get(key)
    try:
        count = int(current or 0) + 1
    except (TypeError, ValueError):
        count = 1
    cache.set(key, count, window)
    return count


@api_view(["POST"])
@permission_classes([AllowAny])
def request_otp(request):
    methods = effective_auth_methods()
    if not methods.get("phone_otp"):
        return Response(
            {"detail": "ورود با رمز یک‌بارمصرف فعال نیست."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    phone = _normalize_phone(request.data.get("phone", ""))
    if not _phone_ok(phone):
        return Response(
            {"detail": "شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ip = _client_ip(request)
    if cache.get(f"otp:cd:{phone}"):
        return Response(
            {"detail": "لطفاً کمی صبر کنید و دوباره درخواست دهید.", "retry_after": RESEND_COOLDOWN},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    phone_sends = int(cache.get(f"otp:rl:phone:{phone}") or 0)
    ip_sends = int(cache.get(f"otp:rl:ip:{ip}") or 0)
    if phone_sends >= MAX_SENDS_PER_PHONE or ip_sends >= MAX_SENDS_PER_IP:
        return Response(
            {"detail": "تعداد درخواست کد بیش از حد مجاز است. بعداً تلاش کنید."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    code = f"{random.SystemRandom().randint(0, 999999):06d}"
    cache.set(
        f"otp:{phone}",
        {"hash": _hash_code(phone, code), "attempts": 0},
        OTP_TTL,
    )
    _bump_counter(f"otp:rl:phone:{phone}", SEND_WINDOW)
    _bump_counter(f"otp:rl:ip:{ip}", SEND_WINDOW)

    sent, sms_err = send_login_otp(phone, code)
    if not sent:
        cache.delete(f"otp:{phone}")
        if settings.DEBUG and sms_err and "فعالی" in sms_err:
            cache.set(
                f"otp:{phone}",
                {"hash": _hash_code(phone, code), "attempts": 0},
                OTP_TTL,
            )
            cache.set(f"otp:cd:{phone}", 1, RESEND_COOLDOWN)
            return Response(
                {
                    "detail": "سرویس پیامک فعال نیست؛ کد آزمایشی صادر شد.",
                    "expires_in": OTP_TTL,
                    "resend_after": RESEND_COOLDOWN,
                    "debug_code": code,
                }
            )
        return Response(
            {"detail": sms_err or "ارسال پیامک ناموفق بود."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    cache.set(f"otp:cd:{phone}", 1, RESEND_COOLDOWN)
    payload = {
        "detail": "کد تأیید ارسال شد.",
        "expires_in": OTP_TTL,
        "resend_after": RESEND_COOLDOWN,
    }
    if settings.DEBUG:
        payload["debug_code"] = code
    return Response(payload)


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_otp(request):
    methods = effective_auth_methods()
    if not methods.get("phone_otp"):
        return Response(
            {"detail": "ورود با رمز یک‌بارمصرف فعال نیست."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    phone = _normalize_phone(request.data.get("phone", ""))
    code = str(request.data.get("code") or "").strip()
    if not _phone_ok(phone) or not re.fullmatch(r"\d{5,6}", code):
        return Response(
            {"detail": "شماره و کد را کامل وارد کنید."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cached = cache.get(f"otp:{phone}")
    if not isinstance(cached, dict) or "hash" not in cached:
        return Response(
            {"detail": "کد نامعتبر یا منقضی شده است."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    attempts = int(cached.get("attempts") or 0)
    if attempts >= MAX_WRONG_ATTEMPTS:
        cache.delete(f"otp:{phone}")
        return Response(
            {"detail": "تعداد تلاش اشتباه بیش از حد است. کد جدید بگیرید."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    expected = cached.get("hash") or ""
    if not hmac.compare_digest(str(expected), _hash_code(phone, code)):
        attempts += 1
        if attempts >= MAX_WRONG_ATTEMPTS:
            cache.delete(f"otp:{phone}")
            return Response(
                {"detail": "تعداد تلاش اشتباه بیش از حد است. کد جدید بگیرید."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        cache.set(
            f"otp:{phone}",
            {"hash": expected, "attempts": attempts},
            OTP_TTL,
        )
        return Response(
            {"detail": "کد نامعتبر یا منقضی شده است."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cache.delete(f"otp:{phone}")

    profile = UserProfile.objects.select_related("user").filter(phone=phone).first()
    if not profile:
        username = f"u{phone}"
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{phone}@phone.local"},
        )
        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.phone != phone:
            profile.phone = phone
            profile.save(update_fields=["phone", "updated_at"])
    else:
        user = profile.user

    if not user.is_active:
        return Response(
            {"detail": "حساب کاربری غیرفعال است."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return Response(_tokens_for(user))


def _password_user(phone):
    profile = UserProfile.objects.select_related("user").filter(phone=phone).first()
    if not profile or not profile.user.is_active:
        return None
    return profile.user


@api_view(["POST"])
@permission_classes([AllowAny])
def request_password_otp(request):
    phone = _normalize_phone(request.data.get("phone", ""))
    if not _phone_ok(phone):
        return Response(
            {"detail": "شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ip = _client_ip(request)
    if cache.get(f"pwd-otp:cd:{phone}"):
        return Response(
            {"detail": "لطفاً کمی صبر کنید و دوباره درخواست دهید.", "retry_after": RESEND_COOLDOWN},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )
    if int(cache.get(f"pwd-otp:rl:phone:{phone}") or 0) >= MAX_SENDS_PER_PHONE or int(
        cache.get(f"pwd-otp:rl:ip:{ip}") or 0
    ) >= MAX_SENDS_PER_IP:
        return Response(
            {"detail": "تعداد درخواست کد بیش از حد مجاز است. بعداً تلاش کنید."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    user = _password_user(phone)
    if not user:
        _bump_counter(f"pwd-otp:rl:phone:{phone}", SEND_WINDOW)
        _bump_counter(f"pwd-otp:rl:ip:{ip}", SEND_WINDOW)
        return Response(
            {"detail": "حسابی با این شماره پیدا نشد."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    code = f"{random.SystemRandom().randint(0, 999999):06d}"
    cache.set(
        f"pwd-otp:{phone}",
        {"hash": _hash_code(f"pwd:{phone}", code), "attempts": 0},
        OTP_TTL,
    )
    _bump_counter(f"pwd-otp:rl:phone:{phone}", SEND_WINDOW)
    _bump_counter(f"pwd-otp:rl:ip:{ip}", SEND_WINDOW)

    name = (user.get_full_name() or "").strip() or user.get_username()
    sent, sms_err = send_password_reset_otp(phone, code, name)
    if not sent:
        cache.delete(f"pwd-otp:{phone}")
        if settings.DEBUG and sms_err and "فعالی" in sms_err:
            cache.set(
                f"pwd-otp:{phone}",
                {"hash": _hash_code(f"pwd:{phone}", code), "attempts": 0},
                OTP_TTL,
            )
            cache.set(f"pwd-otp:cd:{phone}", 1, RESEND_COOLDOWN)
            return Response(
                {
                    "detail": "سرویس پیامک فعال نیست؛ کد آزمایشی صادر شد.",
                    "expires_in": OTP_TTL,
                    "resend_after": RESEND_COOLDOWN,
                    "debug_code": code,
                }
            )
        return Response(
            {"detail": sms_err or "ارسال پیامک ناموفق بود."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    cache.set(f"pwd-otp:cd:{phone}", 1, RESEND_COOLDOWN)
    payload = {
        "detail": "کد بازیابی ارسال شد.",
        "expires_in": OTP_TTL,
        "resend_after": RESEND_COOLDOWN,
    }
    if settings.DEBUG:
        payload["debug_code"] = code
    return Response(payload)


@api_view(["POST"])
@permission_classes([AllowAny])
def confirm_password_otp(request):
    data = request.data if isinstance(request.data, dict) else {}
    phone = _normalize_phone(data.get("phone", ""))
    code = str(data.get("code") or "").strip()
    password = str(data.get("new_password1") or "")
    password2 = str(data.get("new_password2") or "")
    if not _phone_ok(phone) or not re.fullmatch(r"\d{5,6}", code):
        return Response(
            {"detail": "شماره و کد را کامل وارد کنید."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not password or password != password2:
        return Response(
            {"detail": "تکرار رمز عبور مطابقت ندارد."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cached = cache.get(f"pwd-otp:{phone}")
    if not isinstance(cached, dict) or "hash" not in cached:
        return Response(
            {"detail": "کد نامعتبر یا منقضی شده است."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    attempts = int(cached.get("attempts") or 0)
    expected = cached.get("hash") or ""
    if attempts >= MAX_WRONG_ATTEMPTS or not hmac.compare_digest(
        str(expected), _hash_code(f"pwd:{phone}", code)
    ):
        attempts += 1
        if attempts >= MAX_WRONG_ATTEMPTS:
            cache.delete(f"pwd-otp:{phone}")
            return Response(
                {"detail": "تعداد تلاش اشتباه بیش از حد است. کد جدید بگیرید."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        cache.set(
            f"pwd-otp:{phone}",
            {"hash": expected, "attempts": attempts},
            OTP_TTL,
        )
        return Response(
            {"detail": "کد نامعتبر یا منقضی شده است."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = _password_user(phone)
    if not user:
        cache.delete(f"pwd-otp:{phone}")
        return Response(
            {"detail": "حسابی با این شماره پیدا نشد."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        message = exc.messages[0] if exc.messages else "رمز عبور نامعتبر است."
        return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(password)
    user.save(update_fields=["password"])
    cache.delete(f"pwd-otp:{phone}")
    return Response({"detail": "رمز عبور تغییر کرد."})
