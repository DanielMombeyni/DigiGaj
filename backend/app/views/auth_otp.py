import hashlib
import hmac
import logging
import random
import re

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from app.models import UserProfile
from app.serializers.user import UserSerializer
from app.services.sms_dispatch import send_login_otp, send_password_reset_otp, send_signup_otp
from app.services.store_config import effective_auth_methods

User = get_user_model()
logger = logging.getLogger("app.auth")
_USERNAME_VALIDATOR = UnicodeUsernameValidator()

OTP_TTL = 120
RESEND_COOLDOWN = 60
MAX_WRONG_ATTEMPTS = 5
MAX_SENDS_PER_PHONE = 5
MAX_SENDS_PER_IP = 10
SEND_WINDOW = 600
SIGNUP_PENDING_TTL = 600


_PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def _normalize_phone(value: str) -> str:
    text = str(value or "").translate(_PERSIAN_DIGITS)
    digits = "".join(ch for ch in text if ch.isdigit())
    if digits.startswith("98") and len(digits) >= 12:
        digits = "0" + digits[2:]
    elif digits.startswith("9") and len(digits) == 10:
        digits = "0" + digits
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


def _issue_otp_sms(*, phone: str, ip: str, cache_prefix: str, sender, name: str = ""):
    """Shared rate-limit + send for login/signup OTP. Returns (Response, code|None)."""
    try:
        return _issue_otp_sms_inner(
            phone=phone,
            ip=ip,
            cache_prefix=cache_prefix,
            sender=sender,
            name=name,
        )
    except Exception:
        logger.exception("%s otp issue crashed phone=%s", cache_prefix, phone[-4:])
        return (
            Response(
                {"detail": "ارسال پیامک ناموفق بود. چند لحظه بعد دوباره تلاش کنید."},
                status=status.HTTP_400_BAD_REQUEST,
            ),
            None,
        )


def _issue_otp_sms_inner(*, phone: str, ip: str, cache_prefix: str, sender, name: str = ""):
    cd_key = f"{cache_prefix}:cd:{phone}"
    otp_key = f"{cache_prefix}:{phone}"
    if cache.get(cd_key):
        return (
            Response(
                {
                    "detail": "لطفاً کمی صبر کنید و دوباره درخواست دهید.",
                    "retry_after": RESEND_COOLDOWN,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            ),
            None,
        )

    phone_sends = int(cache.get(f"{cache_prefix}:rl:phone:{phone}") or 0)
    ip_sends = int(cache.get(f"{cache_prefix}:rl:ip:{ip}") or 0)
    if phone_sends >= MAX_SENDS_PER_PHONE or ip_sends >= MAX_SENDS_PER_IP:
        return (
            Response(
                {"detail": "تعداد درخواست کد بیش از حد مجاز است. بعداً تلاش کنید."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            ),
            None,
        )

    code = f"{random.SystemRandom().randint(0, 999999):06d}"
    cache.set(otp_key, {"hash": _hash_code(f"{cache_prefix}:{phone}", code), "attempts": 0}, OTP_TTL)
    _bump_counter(f"{cache_prefix}:rl:phone:{phone}", SEND_WINDOW)
    _bump_counter(f"{cache_prefix}:rl:ip:{ip}", SEND_WINDOW)

    try:
        sent, sms_err = sender(phone, code, name=name)
    except Exception:
        logger.exception("%s otp sms crashed phone=%s", cache_prefix, phone[-4:])
        cache.delete(otp_key)
        return (
            Response(
                {"detail": "ارسال پیامک ناموفق بود. چند لحظه بعد دوباره تلاش کنید."},
                status=status.HTTP_400_BAD_REQUEST,
            ),
            None,
        )

    if not sent:
        cache.delete(otp_key)
        if settings.DEBUG and sms_err and "فعالی" in sms_err:
            cache.set(
                otp_key,
                {"hash": _hash_code(f"{cache_prefix}:{phone}", code), "attempts": 0},
                OTP_TTL,
            )
            cache.set(cd_key, 1, RESEND_COOLDOWN)
            return (
                Response(
                    {
                        "detail": "سرویس پیامک فعال نیست؛ کد آزمایشی صادر شد.",
                        "expires_in": OTP_TTL,
                        "resend_after": RESEND_COOLDOWN,
                        "debug_code": code,
                    }
                ),
                code,
            )
        return (
            Response(
                {
                    "detail": sms_err
                    or "ارسال پیامک ناموفق بود. تنظیمات سیگنال را در پنل بررسی کنید."
                },
                status=status.HTTP_400_BAD_REQUEST,
            ),
            None,
        )

    cache.set(cd_key, 1, RESEND_COOLDOWN)
    payload = {
        "detail": "کد تأیید ارسال شد.",
        "expires_in": OTP_TTL,
        "resend_after": RESEND_COOLDOWN,
        "phone": phone,
    }
    if settings.DEBUG:
        payload["debug_code"] = code
    return Response(payload), code


def _verify_cached_otp(*, phone: str, code: str, cache_prefix: str):
    otp_key = f"{cache_prefix}:{phone}"
    cached = cache.get(otp_key)
    if not isinstance(cached, dict) or "hash" not in cached:
        return None, Response(
            {"detail": "کد نامعتبر یا منقضی شده است."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    attempts = int(cached.get("attempts") or 0)
    if attempts >= MAX_WRONG_ATTEMPTS:
        cache.delete(otp_key)
        return None, Response(
            {"detail": "تعداد تلاش اشتباه بیش از حد است. کد جدید بگیرید."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    expected = cached.get("hash") or ""
    if not hmac.compare_digest(str(expected), _hash_code(f"{cache_prefix}:{phone}", code)):
        attempts += 1
        if attempts >= MAX_WRONG_ATTEMPTS:
            cache.delete(otp_key)
            return None, Response(
                {"detail": "تعداد تلاش اشتباه بیش از حد است. کد جدید بگیرید."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        cache.set(
            otp_key,
            {**cached, "hash": expected, "attempts": attempts},
            OTP_TTL,
        )
        return None, Response(
            {"detail": "کد نامعتبر یا منقضی شده است."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cache.delete(otp_key)
    return cached, None


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

    profile = UserProfile.objects.select_related("user").filter(phone=phone).first()
    if not profile or not profile.user_id:
        return Response(
            {
                "detail": "حسابی با این شماره ثبت نشده است. ابتدا ثبت‌نام کنید.",
                "code": "not_registered",
                "redirect": "/register",
                "phone": phone,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not profile.user.is_active:
        return Response(
            {"detail": "حساب کاربری غیرفعال است."},
            status=status.HTTP_403_FORBIDDEN,
        )

    response, _ = _issue_otp_sms(
        phone=phone,
        ip=_client_ip(request),
        cache_prefix="otp",
        sender=send_login_otp,
    )
    return response


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

    _, err = _verify_cached_otp(phone=phone, code=code, cache_prefix="otp")
    if err:
        return err

    profile = UserProfile.objects.select_related("user").filter(phone=phone).first()
    if not profile or not profile.user_id:
        return Response(
            {
                "detail": "حسابی با این شماره ثبت نشده است. ابتدا ثبت‌نام کنید.",
                "code": "not_registered",
                "redirect": "/register",
                "phone": phone,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = profile.user
    if not user.is_active:
        return Response(
            {"detail": "حساب کاربری غیرفعال است."},
            status=status.HTTP_403_FORBIDDEN,
        )

    return Response({**_tokens_for(user), "user": UserSerializer(user).data})


def _validate_signup_payload(data: dict) -> tuple[dict | None, Response | None]:
    username = re.sub(r"\s+", "", str(data.get("username") or ""))
    email = str(data.get("email") or "").strip().lower()
    phone = _normalize_phone(data.get("phone", ""))
    password1 = str(data.get("password1") or "")
    password2 = str(data.get("password2") or "")
    errors = {}

    if len(username) < 3:
        errors["username"] = "نام کاربری باید حداقل ۳ کاراکتر باشد."
    else:
        try:
            _USERNAME_VALIDATOR(username)
        except DjangoValidationError:
            errors["username"] = "نام کاربری فقط می‌تواند حروف، عدد و _ باشد."
        elif User.objects.filter(username__iexact=username).exists():
            errors["username"] = "این نام کاربری قبلاً گرفته شده است."

    if email:
        try:
            validate_email(email)
        except DjangoValidationError:
            errors["email"] = "ایمیل نامعتبر است."
        else:
            if User.objects.filter(email__iexact=email).exists():
                errors["email"] = "این ایمیل قبلاً ثبت شده است."

    if not _phone_ok(phone):
        errors["phone"] = "شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)."
    elif UserProfile.objects.filter(phone=phone).exists():
        errors["phone"] = "این شماره قبلاً ثبت شده است. وارد شوید."

    if not password1 or len(password1) < 8:
        errors["password1"] = "رمز عبور باید حداقل ۸ کاراکتر باشد."
    elif password1 != password2:
        errors["password2"] = "تکرار رمز عبور مطابقت ندارد."
    else:
        try:
            validate_password(password1)
        except DjangoValidationError as exc:
            errors["password1"] = exc.messages[0] if exc.messages else "رمز عبور نامعتبر است."

    if errors:
        return None, Response(errors, status=status.HTTP_400_BAD_REQUEST)

    return {
        "username": username,
        "email": email,
        "phone": phone,
        "password": password1,
    }, None


@api_view(["POST"])
@permission_classes([AllowAny])
def request_signup_otp(request):
    data = request.data if isinstance(request.data, dict) else {}
    payload, err = _validate_signup_payload(data)
    if err:
        return err

    phone = payload["phone"]
    pending_key = f"signup:pending:{phone}"
    try:
        cache.set(
            pending_key,
            {
                "username": payload["username"],
                "email": payload["email"],
                "phone": phone,
                "password_hash": make_password(payload["password"]),
            },
            SIGNUP_PENDING_TTL,
        )
        response, _ = _issue_otp_sms(
            phone=phone,
            ip=_client_ip(request),
            cache_prefix="signup-otp",
            sender=send_signup_otp,
            name=payload["username"],
        )
    except Exception:
        logger.exception("signup otp request crashed phone=%s", phone[-4:])
        try:
            cache.delete(pending_key)
        except Exception:
            pass
        return Response(
            {"detail": "ارسال کد تأیید ناموفق بود. چند لحظه بعد دوباره تلاش کنید."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if response.status_code >= 400:
        return response

    body = dict(response.data)
    body["detail"] = "کد تأیید ثبت‌نام ارسال شد."
    body["pending_ttl"] = SIGNUP_PENDING_TTL
    return Response(body)


@api_view(["POST"])
@permission_classes([AllowAny])
def confirm_signup_otp(request):
    data = request.data if isinstance(request.data, dict) else {}
    phone = _normalize_phone(data.get("phone", ""))
    code = str(data.get("code") or "").strip()
    if not _phone_ok(phone) or not re.fullmatch(r"\d{5,6}", code):
        return Response(
            {"detail": "شماره و کد را کامل وارد کنید."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    pending_key = f"signup:pending:{phone}"
    pending = cache.get(pending_key)
    if not isinstance(pending, dict) or not pending.get("password_hash"):
        return Response(
            {"detail": "جلسه ثبت‌نام منقضی شده است. دوباره فرم را ارسال کنید."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    _, err = _verify_cached_otp(phone=phone, code=code, cache_prefix="signup-otp")
    if err:
        return err

    if User.objects.filter(username__iexact=pending.get("username") or "").exists():
        cache.delete(pending_key)
        return Response(
            {"username": "این نام کاربری قبلاً گرفته شده است."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if UserProfile.objects.filter(phone=phone).exists():
        cache.delete(pending_key)
        return Response(
            {"phone": "این شماره قبلاً ثبت شده است. وارد شوید."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = str(pending.get("email") or "").strip()
    username = str(pending.get("username") or "").strip()
    try:
        with transaction.atomic():
            user = User(username=username, email=email or f"{phone}@phone.local")
            user.password = pending["password_hash"]
            user.save()
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.phone = phone
            profile.save(update_fields=["phone", "updated_at"])
    except IntegrityError:
        return Response(
            {"detail": "ثبت‌نام همزمان ناموفق بود. دوباره تلاش کنید."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cache.delete(pending_key)
    cache.delete(f"signup-otp:cd:{phone}")
    user = User.objects.select_related("profile").get(pk=user.pk)
    return Response(
        {
            **_tokens_for(user),
            "user": UserSerializer(user).data,
            "detail": "ثبت‌نام با موفقیت انجام شد.",
        },
        status=status.HTTP_201_CREATED,
    )


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
    try:
        sent, sms_err = send_password_reset_otp(phone, code, name)
    except Exception:
        logger.exception("password otp sms crashed phone=%s", phone[-4:])
        cache.delete(f"pwd-otp:{phone}")
        return Response(
            {"detail": "ارسال پیامک ناموفق بود. چند لحظه بعد دوباره تلاش کنید."},
            status=status.HTTP_400_BAD_REQUEST,
        )
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
            {"detail": sms_err or "ارسال پیامک ناموفق بود. تنظیمات سیگنال را در پنل بررسی کنید."},
            status=status.HTTP_400_BAD_REQUEST,
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
