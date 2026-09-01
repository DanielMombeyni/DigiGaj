from django.shortcuts import render
from django.conf import settings

from .utils import app_return_url


def render_return_page(request, *, status: str, tracking: str, message: str = ""):
    deep_link = app_return_url(status, tracking)
    frontend = getattr(settings, "FRONTEND_URL", "/")
    context = {
        "status": status,
        "tracking": tracking,
        "message": message,
        "deep_link": deep_link,
        "frontend_url": frontend,
        "shop_orders_url": f"{frontend.rstrip('/')}/orders",
    }
    return render(request, "payment/return.html", context)
