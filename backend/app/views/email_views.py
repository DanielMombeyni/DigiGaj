from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from app.models import EmailTemplate
from app.permissions import HasAdminPage
from app.services.email_smtp import (
    admin_email_smtp,
    ensure_email_smtp_defaults,
    save_email_smtp,
    send_test_email,
)
from app.services.email_templates import (
    catalog_payload,
    create_template,
    delete_template,
    list_templates,
    serialize_template,
    update_template,
)
from app.services.email_dispatch import send_template_test


def _error(exc):
    detail = getattr(exc, "detail", str(exc))
    return Response(detail if isinstance(detail, dict) else {"detail": detail}, status=400)


class AdminEmailSmtpView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "settings"

    def get(self, request):
        ensure_email_smtp_defaults()
        return Response(admin_email_smtp())

    def put(self, request):
        return self._save(request)

    def patch(self, request):
        return self._save(request)

    def _save(self, request):
        ensure_email_smtp_defaults()
        try:
            save_email_smtp(request.data if isinstance(request.data, dict) else {})
        except ValidationError as exc:
            return _error(exc)
        return Response(admin_email_smtp())


class AdminEmailSmtpTestView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "settings"

    def post(self, request):
        ensure_email_smtp_defaults()
        to = (request.data.get("to") or "").strip()
        try:
            send_test_email(to)
        except ValidationError as exc:
            return _error(exc)
        except Exception:
            return Response({"detail": "ارسال آزمایشی ناموفق بود. تنظیمات SMTP را بررسی کنید."}, status=400)
        return Response({"detail": "ایمیل آزمایشی ارسال شد."})


class AdminEmailTemplateCatalogView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "emails"

    def get(self, request):
        return Response(catalog_payload())


class AdminEmailTemplateListView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "emails"

    def get(self, request):
        return Response(list_templates())

    def post(self, request):
        try:
            row = create_template(request.data if isinstance(request.data, dict) else {})
        except ValidationError as exc:
            return _error(exc)
        return Response(serialize_template(row), status=status.HTTP_201_CREATED)


class AdminEmailTemplateDetailView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "emails"

    def _get(self, pk):
        return EmailTemplate.objects.get(pk=pk)

    def patch(self, request, pk):
        try:
            row = self._get(pk)
        except EmailTemplate.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        try:
            row = update_template(row, request.data if isinstance(request.data, dict) else {})
        except ValidationError as exc:
            return _error(exc)
        return Response(serialize_template(row))

    def delete(self, request, pk):
        try:
            row = self._get(pk)
        except EmailTemplate.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        try:
            delete_template(row)
        except ValidationError as exc:
            return _error(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminEmailTemplateTestView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "emails"

    def post(self, request, pk):
        try:
            row = EmailTemplate.objects.get(pk=pk)
        except EmailTemplate.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        to = (request.data.get("to") or "").strip()
        try:
            send_template_test(row, to)
        except ValidationError as exc:
            return _error(exc)
        except Exception:
            return Response({"detail": "ارسال آزمایشی ناموفق بود."}, status=400)
        return Response({"detail": "ایمیل آزمایشی ارسال شد."})
