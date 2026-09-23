from rest_framework.views import exception_handler
from rest_framework.response import Response

from app.sms.signal.exceptions import SignalSmsError


def custom_exception_handler(exc, context):
    if isinstance(exc, SignalSmsError):
        return Response(
            {
                "success": False,
                "errors": {"detail": str(exc)},
                "detail": str(exc),
                "code": getattr(exc, "code", "signal_sms_error"),
            },
            status=getattr(exc, "http_status", 502),
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
    return response
