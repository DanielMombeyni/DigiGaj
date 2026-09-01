from rest_framework.permissions import BasePermission, SAFE_METHODS

from app.services.staff_access import user_has_admin_page


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        if not (request.user and request.user.is_authenticated and request.user.is_staff):
            return False
        page = getattr(view, "required_admin_page", None)
        if not page:
            return True
        return user_has_admin_page(request.user, page)


class IsStaffUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsCustomerUser(BasePermission):
    """Authenticated shoppers only — staff/panel users are excluded."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and not user.is_staff)


class HasAdminPage(BasePermission):
    """Staff + optional view.required_admin_page (superusers always pass)."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.is_staff):
            return False
        page = getattr(view, "required_admin_page", None)
        if not page:
            return True
        return user_has_admin_page(request.user, page)


def require_admin_page(page_key):
    """Permission class factory for function-based views / explicit page keys."""

    class RequiredPage(BasePermission):
        def has_permission(self, request, view):
            if not (request.user and request.user.is_authenticated and request.user.is_staff):
                return False
            return user_has_admin_page(request.user, page_key)

    RequiredPage.__name__ = f"RequireAdminPage_{page_key}"
    RequiredPage.__qualname__ = RequiredPage.__name__
    return RequiredPage
