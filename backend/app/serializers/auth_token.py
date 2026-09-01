from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from app.models import UserProfile
from app.services.store_config import get_storefront_config

User = get_user_model()


def _normalize_phone(value: str) -> str:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    if digits.startswith("98") and len(digits) >= 12:
        digits = "0" + digits[2:]
    return digits


def _looks_like_phone(value: str) -> bool:
    digits = _normalize_phone(value)
    return len(digits) >= 10 and "@" not in (value or "")


class EmailOrUsernameTokenSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        login = (attrs.get("username") or "").strip()
        methods = get_storefront_config()["auth_methods"]

        if "@" in login:
            if not methods.get("email_password"):
                raise AuthenticationFailed("ورود با ایمیل فعال نیست.")
            user = User.objects.filter(email__iexact=login).first()
            if user:
                attrs["username"] = user.get_username()
        elif _looks_like_phone(login):
            if not methods.get("phone_password"):
                raise AuthenticationFailed("ورود با شماره تلفن و رمز عبور فعال نیست.")
            phone = _normalize_phone(login)
            profile = (
                UserProfile.objects.select_related("user")
                .filter(phone__in=[phone, login])
                .first()
            )
            if not profile:
                profile = (
                    UserProfile.objects.select_related("user")
                    .filter(phone__endswith=phone[-10:])
                    .first()
                )
            if not profile:
                raise AuthenticationFailed("کاربری با این شماره یافت نشد.")
            attrs["username"] = profile.user.get_username()
        else:
            if not methods.get("username_password"):
                raise AuthenticationFailed("ورود با نام کاربری فعال نیست.")

        return super().validate(attrs)


class EmailOrUsernameTokenView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenSerializer
