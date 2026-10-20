from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from app.models import SmsLog, SmsTemplate
from app.permissions import HasAdminPage
from app.sms.signal.exceptions import SignalSmsError
from app.services.sms_params import MANUAL_SEND_MAX_RECIPIENTS, normalize_phone
from app.services.sms_templates import (
    catalog_payload,
    create_template,
    delete_template,
    fetch_balance,
    list_templates,
    preview_template,
    send_quick,
    send_template_test,
    send_template_to_users,
    serialize_template,
    update_template,
)


def _error(exc):
    if isinstance(exc, SignalSmsError):
        raw = int(getattr(exc, "http_status", 400) or 400)
        # Avoid Cloudflare HTML replacement for origin 502/503/504.
        status_code = 400 if raw >= 500 else raw
        return Response(
            {
                "detail": str(exc),
                "code": getattr(exc, "code", "signal_sms_error"),
            },
            status=status_code,
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


class AdminSmsSendTemplateView(APIView):
    """Send a saved template to selected customer user IDs (max 100)."""

    permission_classes = [HasAdminPage]
    required_admin_page = "sms"

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        # Strict JSON boolean true only — reject "true", 1, "false", etc.
        if data.get("confirm") is not True:
            return Response(
                {
                    "detail": "برای ارسال، فیلد confirm باید بولین JSON برابر true باشد.",
                    "confirm": "مقدار true (بولین) الزامی است.",
                },
                status=400,
            )
        try:
            template_id = int(data.get("template_id"))
        except (TypeError, ValueError):
            return Response({"template_id": "قالب نامعتبر است."}, status=400)
        try:
            row = SmsTemplate.objects.get(pk=template_id)
        except SmsTemplate.DoesNotExist:
            return Response({"detail": "قالب یافت نشد."}, status=404)

        raw_ids = data.get("user_ids") or []
        if not isinstance(raw_ids, (list, tuple)):
            return Response({"user_ids": "لیست شناسه کاربران نامعتبر است."}, status=400)
        if "manual_params" in data and data.get("manual_params") is not None:
            if not isinstance(data.get("manual_params"), dict):
                return Response(
                    {"manual_params": "پارامترهای دستی باید آبجکت باشد."},
                    status=400,
                )
            manual = data.get("manual_params")
        else:
            manual = {}
        try:
            result = send_template_to_users(
                template=row,
                user_ids=list(raw_ids),
                actor=request.user,
                manual_params=manual,
                client_request_id=data.get("client_request_id"),
            )
        except (ValidationError, SignalSmsError) as exc:
            return _error(exc)
        detail = "عملیات ارسال انجام شد."
        if result.get("duplicate"):
            detail = "نتیجه درخواست تکراری بازگردانده شد."
        return Response({"detail": detail, **result})


class AdminSmsRecipientsView(APIView):
    """Search customers for manual SMS (sms page permission; limited fields)."""

    permission_classes = [HasAdminPage]
    required_admin_page = "sms"

    def get(self, request):
        User = get_user_model()
        q = str(request.query_params.get("search") or "").strip()[:80]
        qs = (
            User.objects.filter(is_staff=False, is_active=True)
            .select_related("profile")
            .order_by("-date_joined")
        )
        if q:
            qs = qs.filter(
                Q(username__icontains=q)
                | Q(email__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(profile__phone__icontains=q)
            )
        rows = []
        for user in qs[:50]:
            profile = getattr(user, "profile", None)
            phone = normalize_phone(getattr(profile, "phone", "") or "")
            rows.append(
                {
                    "id": user.id,
                    "username": user.get_username(),
                    "name": (user.get_full_name() or "").strip() or user.get_username(),
                    "phone": phone,
                    "phone_ok": len(phone) == 11 and phone.startswith("09"),
                }
            )
        return Response(
            {
                "results": rows,
                "max_recipients": MANUAL_SEND_MAX_RECIPIENTS,
            }
        )


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


class AdminSmsTemplatePreviewView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "sms"

    def post(self, request, pk):
        try:
            row = SmsTemplate.objects.get(pk=pk)
        except SmsTemplate.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        data = request.data if isinstance(request.data, dict) else {}
        params = data.get("parameters") if isinstance(data.get("parameters"), dict) else {}
        return Response(preview_template(row, params))


class AdminSmsLogListView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "sms"

    def get(self, request):
        try:
            page = max(1, int(request.query_params.get("page") or 1))
        except (TypeError, ValueError):
            page = 1
        page_size = 50
        qs = SmsLog.objects.select_related("template", "actor").order_by("-created_at")
        total = qs.count()
        start = (page - 1) * page_size
        rows = qs[start : start + page_size]
        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "results": [
                    {
                        "id": row.id,
                        "phone": row.phone,
                        "event": row.event,
                        "status": row.status,
                        "status_label": row.get_status_display(),
                        "error": row.error,
                        "template_id": row.template_id,
                        "template_name": row.template.name if row.template_id else "",
                        "actor_id": row.actor_id,
                        "actor_username": (
                            row.actor.get_username() if row.actor_id else ""
                        ),
                        "batch_id": row.batch_id or "",
                        "fallback_reason": row.fallback_reason or "",
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                    }
                    for row in rows
                ],
            }
        )
