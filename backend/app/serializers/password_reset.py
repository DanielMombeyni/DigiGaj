from django.conf import settings
from dj_rest_auth.serializers import PasswordResetSerializer


def frontend_password_reset_url(request, user, temp_key):
    from allauth.account.utils import user_pk_to_url_str

    uid = user_pk_to_url_str(user)
    base = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return f"{base}/reset-password/{uid}/{temp_key}"


class FrontendPasswordResetSerializer(PasswordResetSerializer):
    """Send reset links to the React app, and an SMS when a template and phone exist."""

    def get_email_options(self):
        return {"url_generator": frontend_password_reset_url}

    def save(self):
        email = self.validated_data.get("email")
        super().save()
        if not email:
            return
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = (
            User.objects.filter(email__iexact=email, is_active=True)
            .select_related("profile")
            .order_by("id")
            .first()
        )
        if not user:
            return
        try:
            from app.services.sms_dispatch import queue_forgot_password_sms

            queue_forgot_password_sms(user)
        except Exception:
            import logging

            logging.getLogger("app.sms").exception("forgot-password sms failed")
