from django.contrib.auth import get_user_model
from rest_framework import serializers

from app.services.staff_access import get_user_admin_pages

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    admin_pages = serializers.SerializerMethodField()
    role_id = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_superuser",
            "admin_pages",
            "role_id",
            "role_name",
        )
        read_only_fields = fields

    def get_admin_pages(self, obj):
        return get_user_admin_pages(obj)

    def get_role_id(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.staff_role_id if profile else None

    def get_role_name(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and profile.staff_role_id:
            return profile.staff_role.name
        return None
