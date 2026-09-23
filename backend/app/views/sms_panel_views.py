from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from app.models import SmsTemplate
from app.permissions import HasAdminPage
from app.sms.signal.exceptions import SignalSmsError
from app.services.sms_templates import (
    catalog_payload,
    create_template,
    delete_template,
    fetch_balance,
    list_templates,
    send_quick,
    send_template_test,
    serialize_template,
    update_template,
)


def _error(exc):
    if isinstance(exc, SignalSmsError):
        return Response(
            {
                "detail": str(exc),
                "code": getattr(exc, "code", "signal_sms_error"),
            },
            status=getattr(exc, "http_status", 502),
        )
    detail = getattr(exc, "detail", str(exc))
    return Response(detail if isinstance(detail, dict) else {"detail": detail}, status=400)


class AdminSmsPanelCatalogView(APIView):
    """Catalog for SMS templates page (placeholders, balance, readiness)."""

    permission_classes = [HasAdminPage]
    required_admin_page = "sms"

    def get(self, request):
        return Response(catalog_payload())


class AdminSmsBalanceView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "sms"

    def get(self, request):
        try:
            return Response({"balance": fetch_balance()})
        except SignalSmsError as exc:
            return _error(exc)
        except Exception:
            return Response({"detail": "استعلام اعتبار ناموفق بود."}, status=400)


class AdminSmsSendView(APIView):
    """Quick send: free text (single/bulk) or Signal pattern."""

    permission_classes = [HasAdminPage]
    required_admin_page = "sms"

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        phones = data.get("phones") or data.get("phone")
        try:
            result = send_quick(
                phones=phones,
                message=data.get("message"),
                pattern_id=data.get("pattern_id"),
                parameters=data.get("parameters") if isinstance(data.get("parameters"), dict) else {},
            )
        except (ValidationError, SignalSmsError) as exc:
            return _error(exc)
        return Response({"detail": "پیامک ارسال شد.", **result})


class AdminSmsTemplateListView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "sms"

    def get(self, request):
        return Response(list_templates())

    def post(self, request):
        try:
            row = create_template(request.data if isinstance(request.data, dict) else {})
        except ValidationError as exc:
            return _error(exc)
        return Response(serialize_template(row), status=status.HTTP_201_CREATED)


class AdminSmsTemplateDetailView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "sms"

    def _get(self, pk):
        return SmsTemplate.objects.get(pk=pk)

    def patch(self, request, pk):
        try:
            row = self._get(pk)
        except SmsTemplate.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        try:
            row = update_template(row, request.data if isinstance(request.data, dict) else {})
        except ValidationError as exc:
            return _error(exc)
        return Response(serialize_template(row))

    def delete(self, request, pk):
        try:
            row = self._get(pk)
        except SmsTemplate.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        delete_template(row)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminSmsTemplateTestView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "sms"

    def post(self, request, pk):
        try:
            row = SmsTemplate.objects.get(pk=pk)
        except SmsTemplate.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        data = request.data if isinstance(request.data, dict) else {}
        phone = (data.get("phone") or data.get("to") or "").strip()
        params = data.get("parameters") if isinstance(data.get("parameters"), dict) else {}
        try:
            result = send_template_test(row, phone, params=params)
        except (ValidationError, SignalSmsError) as exc:
            return _error(exc)
        return Response({"detail": "پیامک آزمایشی ارسال شد.", **result})
