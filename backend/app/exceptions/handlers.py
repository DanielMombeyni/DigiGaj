from rest_framework.views import exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
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
