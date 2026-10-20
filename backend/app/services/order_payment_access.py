"""Authorization helpers for order payment initiation and status transitions."""

from __future__ import annotations

from app.models import Order
from app.services.staff_access import user_has_admin_page

# Hard ceiling for any future direct-quantity purchase paths.
MAX_PURCHASE_QUANTITY = 100


def parse_positive_quantity(raw) -> tuple[int | None, str | None]:
    """Return (qty, None) or (None, error_message). Rejects zero/negative/malformed/too large."""
    if raw is None or (isinstance(raw, str) and not str(raw).strip()):
        return None, "تعداد الزامی است"
    try:
        qty = int(raw)
    except (TypeError, ValueError):
        return None, "تعداد نامعتبر است"
    if qty < 1 or qty > MAX_PURCHASE_QUANTITY:
        return None, "تعداد نامعتبر است"
    return qty, None


def user_can_initiate_order_payment(user, order: Order) -> bool:
    """
    Who may start a payment against an existing order.

    - Order owner (authenticated) may pay their own order.
    - Staff with the orders or transactions admin page may pay on behalf of a customer.
    - Ownerless (guest) orders: fail closed for ordinary users — no secure guest
      proof exists in this codebase. Only staff with orders/transactions may initiate.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if order.user_id and order.user_id == user.id:
        return True
    if user_has_admin_page(user, "orders") or user_has_admin_page(user, "transactions"):
        return True
    return False


def manual_status_change_error(previous: str, next_status: str) -> str | None:
    """
    Block marking an order paid via ordinary status APIs/admin.
    PaymentService.activate / authorized card confirm remain the only paid paths.
    """
    if next_status == Order.Status.PAID and previous != Order.Status.PAID:
        return (
            "وضعیت «پرداخت‌شده» فقط پس از تأیید پرداخت (درگاه یا کارت‌به‌کارت مجاز) "
            "اعمال می‌شود و از این مسیر قابل تنظیم نیست."
        )
    return None
