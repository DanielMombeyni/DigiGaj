from django.conf import settings
from dj_rest_auth.serializers import PasswordResetSerializer


def frontend_password_reset_url(request, user, temp_key):
    from allauth.account.utils import user_pk_to_url_str

    uid = user_pk_to_url_str(user)
    base = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
    return f"{base}/reset-password/{uid}/{temp_key}"


class FrontendPasswordResetSerializer(PasswordResetSerializer):
    """Send reset links to the React app instead of Django templates."""

    def get_email_options(self):
        return {"url_generator": frontend_password_reset_url}
