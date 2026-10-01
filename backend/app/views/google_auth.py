import re

from django.contrib.auth import get_user_model
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from app.models import UserProfile
from app.serializers.user import UserSerializer
from app.services.google_auth import GoogleAuthError, exchange_code, link_google_account
from app.services.store_config import google_credentials
from app.views.auth_otp import _normalize_phone, _phone_ok

User = get_user_model()
_USERNAME_VALIDATOR = UnicodeUsernameValidator()


def _tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def _profile_payload(user) -> dict:
    profile = UserProfile.objects.filter(user=user).only("phone").first()
    phone = ((profile.phone if profile else "") or "").strip()
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    phone_missing = not bool(phone)
    creds = google_credentials()
    return {
        "phone": phone,
        "phone_missing": phone_missing,
        "phone_required": bool(creds["phone_required"] or phone_missing),
        "profile_incomplete": not first or not last or phone_missing,
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def google_login(request):
    data = request.data if isinstance(request.data, dict) else {}
    code = str(data.get("code") or "").strip()
    verifier = str(data.get("code_verifier") or "").strip()
    redirect_uri = str(data.get("redirect_uri") or "").strip()
    if not code or not verifier or not redirect_uri:
        return Response(
            {"detail": "درخواست ورود گوگل ناقص است."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        claims = exchange_code(
            code=code,
            code_verifier=verifier,
            redirect_uri=redirect_uri,
        )
        user, created = link_google_account(claims)
    except GoogleAuthError as exc:
        return Response({"detail": exc.message}, status=exc.status)
    except Exception as exc:
        detail = getattr(exc, "detail", None)
        if isinstance(detail, dict):
            message = detail.get("detail") or "ورود با گوگل ناموفق بود."
            if not isinstance(message, str):
                message = str(message)
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"detail": "ورود با گوگل ناموفق بود."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not user.is_active:
        return Response(
            {"detail": "حساب کاربری غیرفعال است."},
            status=status.HTTP_403_FORBIDDEN,
        )

    user = User.objects.select_related("profile").get(pk=user.pk)
    body = {
        **_tokens_for(user),
        "user": UserSerializer(user).data,
        "created": created,
        **_profile_payload(user),
    }
    return Response(body)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_phone(request):
    phone = _normalize_phone(request.data.get("phone", "") if isinstance(request.data, dict) else "")
    if not _phone_ok(phone):
        return Response(
            {"detail": "شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    taken = (
        UserProfile.objects.filter(phone=phone)
        .exclude(user_id=request.user.pk)
        .exists()
    )
    if taken:
        return Response(
            {"detail": "این شماره قبلاً برای حساب دیگری ثبت شده است."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    profile.phone = phone
    profile.save(update_fields=["phone", "updated_at"])
    return Response({"phone": phone, "phone_missing": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def complete_google_profile(request):
    """Collect the shop profile Google does not supply: name, username, phone."""
    data = request.data if isinstance(request.data, dict) else {}
    user = User.objects.select_related("profile").get(pk=request.user.pk)
    profile, _ = UserProfile.objects.get_or_create(user=user)
    if not profile.google_sub:
        return Response(
            {"detail": "این حساب با گوگل ساخته نشده است."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    first = str(data.get("first_name") or "").strip()[:150]
    last = str(data.get("last_name") or "").strip()[:150]
    username = re.sub(r"\s+", "", str(data.get("username") or user.username or ""))[:150]
    phone = _normalize_phone(data.get("phone", "") or profile.phone or "")
    errors = {}
    if not first:
        errors["first_name"] = "نام الزامی است."
    if not last:
        errors["last_name"] = "نام خانوادگی الزامی است."
    if len(username) < 3:
        errors["username"] = "نام کاربری باید حداقل ۳ کاراکتر باشد."
    else:
        try:
            _USERNAME_VALIDATOR(username)
        except DjangoValidationError:
            errors["username"] = "نام کاربری فقط می‌تواند حروف، عدد و _ باشد."
        else:
            taken = User.objects.filter(username__iexact=username).exclude(pk=user.pk).exists()
            if taken:
                errors["username"] = "این نام کاربری قبلاً گرفته شده است."
    if not _phone_ok(phone):
        errors["phone"] = "شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)."
    elif (
        UserProfile.objects.filter(phone=phone).exclude(user_id=user.pk).exists()
    ):
        errors["phone"] = "این شماره قبلاً برای حساب دیگری ثبت شده است."
    current_phone = (profile.phone or "").strip()
    if current_phone and phone != current_phone:
        errors["phone"] = "شماره موبایل قابل تغییر نیست."
    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    user.first_name = first
    user.last_name = last
    user.username = username
    try:
        user.save(update_fields=["first_name", "last_name", "username"])
    except IntegrityError:
        return Response(
            {"username": "این نام کاربری قبلاً گرفته شده است."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if phone != current_phone:
        profile.phone = phone
        profile.save(update_fields=["phone", "updated_at"])

    user = User.objects.select_related("profile").get(pk=user.pk)
    return Response(
        {
            "user": UserSerializer(user).data,
            **_profile_payload(user),
        }
    )
