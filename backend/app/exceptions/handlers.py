from rest_framework.views import exception_handler
from rest_framework.response import Response

from app.sms.signal.exceptions import SignalSmsError


def _cloudflare_safe_status(code: int) -> int:
    """Map gateway-style 5xx to 400 so Cloudflare does not replace JSON with HTML."""
    try:
        status_code = int(code)
    except (TypeError, ValueError):
        return 400
    if status_code in {502, 503, 504, 520, 521, 522, 523, 524}:
        return 400
    return status_code


def custom_exception_handler(exc, context):
    if isinstance(exc, SignalSmsError):
        return Response(
            {
                "success": False,
                "errors": {"detail": str(exc)},
                "detail": str(exc),
                "code": getattr(exc, "code", "signal_sms_error"),
            },
            status=_cloudflare_safe_status(getattr(exc, "http_status", 400)),
        )

    response = exception_handler(exc, context)
    if response is not None:
        payload = {
            "success": False,
            "errors": response.data,
            "detail": None,
        }
        if isinstance(response.data, dict) and "detail" in response.data:
            payload["detail"] = response.data.get("detail")
        response.data = payload
        response.status_code = _cloudflare_safe_status(response.status_code)
    return response
