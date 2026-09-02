import random
import re

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from app.models import UserProfile
from app.services.store_config import effective_auth_methods
from app.services.sms_service import SmsProviderService

User = get_user_model()

OTP_TTL = 300


def _normalize_phone(value: str) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    if digits.startswith("98") and len(digits) >= 12:
        digits = "0" + digits[2:]
    return digits


def _phone_ok(phone: str) -> bool:
    return bool(re.fullmatch(r"09\d{9}", phone))


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


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

    code = f"{random.randint(100000, 999999)}"
    cache.set(f"otp:{phone}", code, OTP_TTL)

    sent, sms_err = SmsProviderService.send_otp(phone, code)
    if not sent:
        cache.delete(f"otp:{phone}")
        # در DEBUG اگر سرویس تنظیم نشده، کد را برگردان تا تست ورود ممکن باشد
        if settings.DEBUG and sms_err and "فعالی" in sms_err:
            return Response(
                {
                    "detail": "سرویس پیامک فعال نیست؛ کد آزمایشی صادر شد.",
                    "expires_in": OTP_TTL,
                    "debug_code": code,
                }
            )
        return Response(
            {"detail": sms_err or "ارسال پیامک ناموفق بود."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    payload = {
        "detail": "کد تأیید ارسال شد.",
        "expires_in": OTP_TTL,
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
    if not _phone_ok(phone) or not code:
        return Response(
            {"detail": "شماره و کد را کامل وارد کنید."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cached = cache.get(f"otp:{phone}")
    if not cached or str(cached) != code:
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
