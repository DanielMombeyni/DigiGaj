from app.models import UserProfile
from app.staff_pages import ADMIN_PAGES, normalize_pages

ALL_PAGE_KEYS_ORDERED = [k for k, _ in ADMIN_PAGES]


def get_user_admin_pages(user):
    """Return ordered list of admin page keys the user may access."""
    if not user or not getattr(user, "is_authenticated", False):
        return []
    if not user.is_staff:
        return []
    if user.is_superuser:
        return list(ALL_PAGE_KEYS_ORDERED)
    profile = getattr(user, "profile", None)
    if profile is None:
        try:
            profile = UserProfile.objects.select_related("staff_role").get(user=user)
        except UserProfile.DoesNotExist:
            return []
    role = profile.staff_role
    if role is None or not role.is_active:
        return []
    return normalize_pages(role.pages)


def user_has_admin_page(user, page_key):
    if not user or not getattr(user, "is_authenticated", False) or not user.is_staff:
        return False
    if user.is_superuser:
        return True
    return page_key in get_user_admin_pages(user)
