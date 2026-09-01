from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count
from rest_framework import serializers, status, viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from app.models import StaffRole, UserProfile
from app.permissions import HasAdminPage
from app.services.staff_access import get_user_admin_pages
from app.staff_pages import ADMIN_PAGES, normalize_pages

User = get_user_model()


class StaffRoleSerializer(serializers.ModelSerializer):
    members_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = StaffRole
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "pages",
            "is_active",
            "members_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("slug", "created_at", "updated_at", "members_count")

    def validate_pages(self, value):
        return normalize_pages(value)

    def create(self, validated_data):
        role = StaffRole(**validated_data)
        role.ensure_slug()
        role.save()
        return role

    def update(self, instance, validated_data):
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if not instance.slug:
            instance.ensure_slug()
        instance.save()
        return instance


class PersonnelSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    role_id = serializers.IntegerField(required=False, allow_null=True)
    role_name = serializers.SerializerMethodField()
    admin_pages = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_active",
            "is_superuser",
            "password",
            "role_id",
            "role_name",
            "admin_pages",
            "date_joined",
        )
        read_only_fields = ("date_joined", "admin_pages", "role_name")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        profile = getattr(instance, "profile", None)
        data["role_id"] = profile.staff_role_id if profile else None
        return data

    def get_role_name(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and profile.staff_role_id:
            return profile.staff_role.name
        return None

    def get_admin_pages(self, obj):
        return get_user_admin_pages(obj)

    def validate_username(self, value):
        qs = User.objects.filter(username__iexact=value.strip())
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("این نام کاربری قبلاً ثبت شده است.")
        return value.strip()

    def validate_role_id(self, value):
        if value is None:
            return value
        if not StaffRole.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("نقش معتبر نیست.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        actor = request.user if request else None
        creating = self.instance is None

        if creating and not attrs.get("password"):
            raise serializers.ValidationError({"password": "رمز عبور الزامی است."})

        if "is_superuser" in attrs and attrs["is_superuser"]:
            if not actor or not actor.is_superuser:
                raise serializers.ValidationError(
                    {"is_superuser": "فقط مدیرکل می‌تواند سوپریوزر بسازد."}
                )

        if creating:
            attrs.setdefault("is_staff", True)

        role_id = attrs.get("role_id", serializers.empty)
        if creating and (role_id is serializers.empty or role_id is None):
            if not attrs.get("is_superuser"):
                raise serializers.ValidationError({"role_id": "انتخاب نقش الزامی است."})

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        role_id = validated_data.pop("role_id", None)
        validated_data["is_staff"] = True
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.staff_role_id = role_id
        profile.save(update_fields=["staff_role", "updated_at"])
        return User.objects.select_related("profile__staff_role").get(pk=user.pk)

    @transaction.atomic
    def update(self, instance, validated_data):
        request = self.context.get("request")
        password = validated_data.pop("password", None)
        role_id = validated_data.pop("role_id", serializers.empty)

        if instance == request.user and validated_data.get("is_active") is False:
            raise serializers.ValidationError(
                {"is_active": "نمی‌توانید خودتان را غیرفعال کنید."}
            )
        if instance == request.user and validated_data.get("is_staff") is False:
            raise serializers.ValidationError(
                {"is_staff": "نمی‌توانید دسترسی پنل خود را بردارید."}
            )

        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        instance.save()

        if role_id is not serializers.empty:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            profile.staff_role_id = role_id
            profile.save(update_fields=["staff_role", "updated_at"])
        return User.objects.select_related("profile__staff_role").get(pk=instance.pk)


class StaffRoleViewSet(viewsets.ModelViewSet):
    serializer_class = StaffRoleSerializer
    permission_classes = [HasAdminPage]
    required_admin_page = "personnel"
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "slug", "description"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        return StaffRole.objects.annotate(members_count=Count("members"))

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.members.exists():
            return Response(
                {"detail": "نقش به پرسنل اختصاص داده شده و قابل حذف نیست."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class PersonnelViewSet(viewsets.ModelViewSet):
    serializer_class = PersonnelSerializer
    permission_classes = [HasAdminPage]
    required_admin_page = "personnel"
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["username", "date_joined"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (
            User.objects.filter(is_staff=True)
            .select_related("profile__staff_role")
            .order_by("username")
        )

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {"detail": "نمی‌توانید خودتان را حذف کنید."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {"detail": "حذف مدیرکل مجاز نیست."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user.is_active = False
        user.is_staff = False
        user.save(update_fields=["is_active", "is_staff"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminPagesCatalogView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "personnel"

    def get(self, request):
        return Response([{"key": k, "label": label} for k, label in ADMIN_PAGES])
