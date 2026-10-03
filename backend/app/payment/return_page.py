from django.conf import settings
from django.shortcuts import render

from .utils import app_return_url


def render_return_page(request, *, status: str, tracking: str, message: str = ""):
    frontend = getattr(settings, "FRONTEND_URL", "/").rstrip("/")
    platform = "web"
    if tracking:
        try:
            from app.models import PurchaseTransaction

            tx = (
                PurchaseTransaction.objects.filter(tracking_number=tracking)
                .only("platform")
                .first()
            )
            if tx and str(getattr(tx, "platform", "") or "").lower() == "app":
                platform = "app"
        except Exception:
            platform = "web"

    # /orders is not a shop route (white page). Send users to the SPA result page.
    shop_return_url = f"{frontend}/payment/result?status={status}&tracking={tracking or ''}"
    show_app_return = platform == "app"
    deep_link = app_return_url(status, tracking) if show_app_return else ""

    context = {
        "status": status,
        "tracking": tracking,
        "message": message,
        "deep_link": deep_link,
        "show_app_return": show_app_return,
        "frontend_url": frontend or "/",
        "shop_orders_url": shop_return_url,
        "account_orders_url": f"{frontend}/account/orders",
    }
    return render(request, "payment/return.html", context)
