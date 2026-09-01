from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers, status, viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response

from app.models import UserProfile
from app.permissions import HasAdminPage

User = get_user_model()


class CustomerSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "is_active",
            "password",
            "date_joined",
        )
        read_only_fields = ("date_joined",)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        profile = getattr(instance, "profile", None)
        data["phone"] = profile.phone if profile else ""
        return data

    def validate_username(self, value):
        qs = User.objects.filter(username__iexact=value.strip())
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("این نام کاربری قبلاً ثبت شده است.")
        return value.strip()

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        phone = validated_data.pop("phone", "")
        if not password:
            raise serializers.ValidationError({"password": "رمز عبور الزامی است."})
        user = User(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            is_active=validated_data.get("is_active", True),
            is_staff=False,
            is_superuser=False,
        )
        user.set_password(password)
        user.save()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.phone = str(phone or "").strip()
        profile.save(update_fields=["phone", "updated_at"])
        return User.objects.select_related("profile").get(pk=user.pk)

    @transaction.atomic
    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        phone = validated_data.pop("phone", serializers.empty)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        instance.is_staff = False
        instance.is_superuser = False
        instance.save()
        if phone is not serializers.empty:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            profile.phone = str(phone or "").strip()
            profile.save(update_fields=["phone", "updated_at"])
        return User.objects.select_related("profile").get(pk=instance.pk)


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [HasAdminPage]
    required_admin_page = "customers"
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["username", "email", "first_name", "last_name", "profile__phone"]
    ordering_fields = ["username", "date_joined"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (
            User.objects.filter(is_staff=False)
            .select_related("profile")
            .order_by("-date_joined")
        )

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.orders.exists():
            return Response(
                {"detail": "این مشتری سفارش دارد و قابل حذف نیست."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
