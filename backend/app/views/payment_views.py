from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from app.models import Order, PaymentGatewayConfig, PurchaseTransaction
from app.payment.facade import PaymentFacade
from app.payment.return_page import render_return_page
from app.payment.utils import detect_platform
from app.permissions import HasAdminPage
from app.serializers import PurchaseTransactionSerializer
from app.services.payment_gateway_service import PaymentGatewayService
from app.services.order_payment_access import (
    parse_positive_quantity,
    user_can_initiate_order_payment,
)
from app.services.payment_service import PaymentService, user_can_access_transaction


def _parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("1", "true", "yes", "on")


def _parse_gateway_payload(request):
    """Normalize JSON or multipart FormData into a plain dict for the service."""
    import json

    raw = request.data
    data = {}

    if "provider_type" in raw:
        data["provider_type"] = raw.get("provider_type")
    if "display_name" in raw:
        data["display_name"] = raw.get("display_name")
    if "sort_order" in raw:
        data["sort_order"] = raw.get("sort_order", 0)
    if "is_enabled_web" in raw:
        data["is_enabled_web"] = _parse_bool(raw.get("is_enabled_web"))
    if "is_enabled_app" in raw:
        data["is_enabled_app"] = _parse_bool(raw.get("is_enabled_app"))

    if "credentials" in raw:
        credentials = raw.get("credentials")
        if isinstance(credentials, str):
            try:
                credentials = json.loads(credentials) if credentials.strip() else {}
            except json.JSONDecodeError:
                credentials = {}
        elif credentials is None:
            credentials = {}
        data["credentials"] = credentials

    if request.FILES.get("logo"):
        data["logo"] = request.FILES["logo"]
    elif "clear_logo" in raw and _parse_bool(raw.get("clear_logo")):
        data["logo"] = None

    return data


class GatewayListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        platform = (
            str(request.query_params.get("platform") or "").lower().strip()
            or detect_platform(request)
        )
        if platform not in ("web", "app"):
            platform = "web"
        return Response(
            {
                "platform": platform,
                "currency": "IRR",
                "gateways": PaymentFacade.list_enabled_public(request, platform),
            }
        )


class PurchaseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        gateway = request.data.get("gateway")
        platform = request.data.get("platform") or detect_platform(request)
        order_id = request.data.get("order_id")
        product_id = request.data.get("product_id")

        if not gateway:
            return Response({"detail": "gateway الزامی است"}, status=400)

        # Direct product purchase is disabled (no safe inventory reservation on this path).
        if product_id and not order_id:
            if "quantity" in request.data:
                _qty, qty_err = parse_positive_quantity(request.data.get("quantity"))
                if qty_err:
                    return Response({"detail": qty_err}, status=400)
            return Response(
                {
                    "detail": "خرید مستقیم محصول پشتیبانی نمی‌شود؛ از مسیر ثبت سفارش استفاده کنید"
                },
                status=400,
            )

        if not order_id:
            return Response({"detail": "سفارش الزامی است"}, status=400)

        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            return Response({"detail": "سفارش یافت نشد"}, status=404)

        if not user_can_initiate_order_payment(request.user, order):
            return Response({"detail": "دسترسی ندارید"}, status=403)

        data, err = PaymentService.create_purchase(
            request=request,
            gateway=gateway,
            order=order,
            platform=platform,
            mobile=request.data.get("mobile", ""),
            description=request.data.get("description", ""),
        )
        if err:
            return Response({"detail": err}, status=400)
        return Response(data, status=201)


class ConfirmView(APIView):
    """Authenticated confirm for the TX owner (or staff). Gateway callbacks use CallbackView."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        tracking = request.data.get("tracking_number")
        if not tracking:
            return Response({"detail": "tracking_number الزامی است"}, status=400)
        tx = PaymentService.get_transaction(str(tracking).strip())
        if not tx:
            return Response({"detail": "تراکنش یافت نشد"}, status=404)
        if not user_can_access_transaction(request.user, tx):
            return Response({"detail": "دسترسی ندارید"}, status=403)
        data, err = PaymentService.confirm_payment_by_tracking(
            tx.tracking_number, callback_data=request.data
        )
        if err:
            return Response({"detail": err}, status=400)
        return Response(data)


class StatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, tracking_number):
        tx = PaymentService.get_transaction(tracking_number)
        if not tx:
            return Response({"detail": "یافت نشد"}, status=404)
        if not user_can_access_transaction(request.user, tx):
            return Response({"detail": "دسترسی ندارید"}, status=403)
        return Response(PaymentService.serialize_status(tx))


class CallbackView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, provider):
        return self._handle(request, provider)

    def post(self, request, provider):
        return self._handle(request, provider)

    def _handle(self, request, provider):
        tracking = request.query_params.get("tracking") or request.data.get("tracking")
        callback_data = {}
        callback_data.update(request.query_params.dict())
        if hasattr(request.data, "dict"):
            callback_data.update(request.data.dict())
        elif isinstance(request.data, dict):
            callback_data.update(request.data)

        if not tracking:
            return render_return_page(
                request, status="failed", tracking="", message="tracking یافت نشد"
            )

        tx = PaymentService.get_transaction(str(tracking).strip())
        if not tx:
            return render_return_page(
                request, status="failed", tracking=tracking, message="تراکنش یافت نشد"
            )
        route_provider = str(provider or "").strip().lower()
        if route_provider and route_provider != str(tx.gateway or "").strip().lower():
            return render_return_page(
                request,
                status="failed",
                tracking=tracking,
                message="درگاه callback با تراکنش مطابقت ندارد",
            )

        data, err = PaymentService.confirm_payment_by_tracking(
            tx.tracking_number, callback_data=callback_data
        )
        if err:
            return render_return_page(
                request, status="failed", tracking=tracking, message=err
            )
        if data.get("pending"):
            return render_return_page(
                request,
                status="pending",
                tracking=tracking,
                message=data.get("message", "در انتظار تأیید"),
            )
        return render_return_page(
            request, status="success", tracking=tracking, message="پرداخت موفق"
        )


class AdminGatewayCatalogView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "gateways"

    def get(self, request):
        return Response(PaymentGatewayService.catalog())


class AdminGatewayListCreateView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "gateways"
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        items = [
            PaymentGatewayService.serialize_config(c, request=request)
            for c in PaymentGatewayConfig.objects.all()
        ]
        return Response(items)

    def post(self, request):
        cfg, err = PaymentGatewayService.create(_parse_gateway_payload(request))
        if err:
            return Response({"detail": err}, status=400)
        return Response(
            PaymentGatewayService.serialize_config(cfg, request=request), status=201
        )


class AdminGatewayDetailView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "gateways"
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_object(self, pk):
        return PaymentGatewayConfig.objects.get(pk=pk)

    def get(self, request, pk):
        try:
            cfg = self.get_object(pk)
        except PaymentGatewayConfig.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        return Response(PaymentGatewayService.serialize_config(cfg, request=request))

    def patch(self, request, pk):
        try:
            cfg = self.get_object(pk)
        except PaymentGatewayConfig.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        cfg, err = PaymentGatewayService.update(cfg, _parse_gateway_payload(request))
        if err:
            return Response({"detail": err}, status=400)
        return Response(PaymentGatewayService.serialize_config(cfg, request=request))

    def delete(self, request, pk):
        try:
            cfg = self.get_object(pk)
        except PaymentGatewayConfig.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        PaymentGatewayService.delete(cfg)
        return Response(status=204)


class AdminCardConfirmView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "transactions"

    def post(self, request):
        tracking = request.data.get("tracking_number")
        if not tracking:
            return Response({"detail": "tracking_number الزامی است"}, status=400)
        tx = PaymentService.get_transaction(str(tracking).strip())
        if not tx:
            return Response({"detail": "تراکنش یافت نشد"}, status=404)
        if tx.gateway != "card":
            return Response(
                {"detail": "تأیید دستی فقط برای تراکنش کارت‌به‌کارت مجاز است"},
                status=400,
            )
        data, err = PaymentService.confirm_payment_by_tracking(
            tx.tracking_number, force_admin=True
        )
        if err:
            return Response({"detail": err}, status=400)
        return Response(data)


class AdminTransactionListView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "transactions"

    def get(self, request):
        qs = PurchaseTransaction.objects.all()[:100]
        return Response(PurchaseTransactionSerializer(qs, many=True).data)
