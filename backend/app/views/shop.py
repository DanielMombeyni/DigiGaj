from django.db.models import Sum, Count, Q, Min, Max, Prefetch
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from app.models import (
    AccountingEntry,
    Banner,
    Category,
    DiscountCode,
    Order,
    PaymentGatewayConfig,
    Product,
    ProductImage,
    ProductVariant,
    PurchaseTransaction,
    SitePage,
    SiteSetting,
    SupportTicket,
)
from app.serializers import (
    AccountingEntrySerializer,
    BannerSerializer,
    CategorySerializer,
    CreateOrderSerializer,
    DiscountCodeSerializer,
    OrderSerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductListSerializer,
    ProductWriteSerializer,
    PurchaseTransactionSerializer,
    SitePageSerializer,
    SiteSettingSerializer,
)
from app.services.store_config import (
    admin_storefront_config,
    ensure_storefront_defaults,
    get_storefront_config,
    public_storefront_config,
    save_storefront_config,
)
from app.payment.facade import PaymentFacade
from app.payment.utils import detect_platform
from app.services.home_content import (
    ensure_store_defaults,
    get_home_hero,
    public_store_settings,
    save_home_hero,
)
from app.services.public_pages import (
    ensure_public_pages_defaults,
    get_admin_storefront_pages,
    save_appearance,
    save_enabled_map,
    save_page_enabled,
    save_site_icon,
    save_storefront_home,
)
from app.permissions import IsAdminOrReadOnly, HasAdminPage, require_admin_page
from app.services.staff_access import user_has_admin_page
from app.services.order_service import OrderService
from app.services.payment_service import PaymentService
from app.payment.utils import detect_platform
from app.filters import ProductFilter


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.select_related("parent").all()
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    required_admin_page = "categories"
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active"]
    search_fields = ["name", "slug"]
    ordering_fields = ["sort_order", "name"]

    def get_queryset(self):
        from django.db.models import Count

        qs = super().get_queryset().annotate(children_count=Count("children"))
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        parent = self.request.query_params.get("parent")
        if parent is not None:
            if parent in ("null", ""):
                qs = qs.filter(parent__isnull=True)
            elif str(parent).isdigit():
                qs = qs.filter(parent_id=int(parent))
        return qs

    def destroy(self, request, *args, **kwargs):
        """Any category (including seed) is deletable; products become uncategorized."""
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related("category")
    permission_classes = [IsAdminOrReadOnly]
    required_admin_page = "products"
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_field = "slug"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ProductFilter
    search_fields = ["name", "brand", "short_description"]
    ordering_fields = ["price_toman", "created_at", "name"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Product.objects.select_related("category")
        action = getattr(self, "action", None)
        if action in ("list", None):
            # Lean prefetch for cards — primary image + variants for price/stock only
            qs = qs.prefetch_related(
                Prefetch(
                    "images",
                    queryset=ProductImage.objects.order_by("-is_primary", "sort_order"),
                ),
                Prefetch(
                    "variants",
                    queryset=ProductVariant.objects.only(
                        "id",
                        "product_id",
                        "price_toman",
                        "stock",
                        "is_active",
                    ),
                ),
                "colors",
                "sizes",
            )
        else:
            qs = qs.prefetch_related(
                "images",
                "colors",
                "sizes",
                "variants__color",
                "variants__size",
                "attributes",
            )
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ProductWriteSerializer
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def destroy(self, request, *args, **kwargs):
        """Delete product; order lines keep product_name (FK set null)."""
        product = self.get_object()
        product.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def images(self, request, slug=None):
        """Upload one or more images: files under `images` or `image`."""
        product = self.get_object()
        files = request.FILES.getlist("images") or request.FILES.getlist("image")
        if not files and request.FILES.get("image"):
            files = [request.FILES["image"]]
        if not files:
            return Response({"detail": "فایل تصویر ارسال نشده"}, status=400)
        created = []
        primary_set = product.images.filter(is_primary=True).exists()
        for i, f in enumerate(files):
            img = ProductImage.objects.create(
                product=product,
                image=f,
                alt=request.data.get("alt", ""),
                is_primary=(not primary_set and i == 0),
                sort_order=product.images.count() + i,
            )
            created.append(ProductImageSerializer(img, context={"request": request}).data)
        return Response(created, status=201)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"images/(?P<image_id>[0-9]+)",
    )
    def delete_image(self, request, slug=None, image_id=None):
        product = self.get_object()
        deleted, _ = product.images.filter(pk=image_id).delete()
        if not deleted:
            return Response({"detail": "یافت نشد"}, status=404)
        return Response(status=204)


class DiscountCodeViewSet(viewsets.ModelViewSet):
    queryset = DiscountCode.objects.all()
    serializer_class = DiscountCodeSerializer
    permission_classes = [HasAdminPage]
    required_admin_page = "discounts"
    search_fields = ["code", "description"]

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def validate_code(self, request):
        code = request.data.get("code", "")
        amount = int(request.data.get("amount_toman") or 0)
        try:
            obj = DiscountCode.objects.get(code__iexact=code.strip())
        except DiscountCode.DoesNotExist:
            return Response({"valid": False, "detail": "کد نامعتبر"}, status=400)
        if not obj.is_valid_now():
            return Response({"valid": False, "detail": "کد منقضی/غیرفعال"}, status=400)
        discount = obj.calculate_discount(amount)
        return Response({"valid": True, "discount_toman": discount, "code": obj.code})


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status"]
    search_fields = ["order_number", "full_name", "phone", "email"]
    ordering_fields = ["created_at", "total_toman", "order_number"]

    def get_queryset(self):
        qs = Order.objects.prefetch_related("items").all()
        if self.request.user.is_staff and user_has_admin_page(self.request.user, "orders"):
            return qs
        return qs.filter(user=self.request.user)

    @action(detail=True, methods=["patch"], url_path="status")
    def set_status(self, request, pk=None):
        if not user_has_admin_page(request.user, "orders"):
            return Response({"detail": "دسترسی ندارید"}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        next_status = (request.data.get("status") or "").strip()
        valid = {c.value for c in Order.Status}
        if next_status not in valid:
            return Response({"detail": "وضعیت نامعتبر است"}, status=400)
        previous = order.status
        if previous != next_status:
            order.status = next_status
            order.save(update_fields=["status", "updated_at"])
            from app.services.email_dispatch import queue_mail_event

            queue_mail_event(
                "order_status_changed",
                "order",
                order.pk,
                {"previous_status": previous},
            )
        return Response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="set-item-prices")
    def set_item_prices(self, request, pk=None):
        if not user_has_admin_page(request.user, "orders"):
            return Response({"detail": "دسترسی ندارید"}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object()
        items = request.data.get("items") or []
        if not isinstance(items, list):
            return Response({"detail": "فرمت آیتم‌ها نامعتبر است"}, status=400)
        order, err = OrderService.set_item_prices(order, items)
        if err:
            return Response({"detail": err}, status=400)
        return Response(OrderSerializer(order, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, pk=None):
        """Start payment for an existing order (after admin sets pending prices)."""
        order = self.get_object()
        pending_err = OrderService.pending_price_error(order)
        if pending_err:
            return Response({"detail": pending_err}, status=400)
        if order.status != Order.Status.PENDING:
            return Response(
                {"detail": "این سفارش در وضعیت قابل پرداخت نیست"},
                status=400,
            )

        platform = request.data.get("platform") or detect_platform(request)
        enabled_gateways = PaymentFacade.list_enabled_public(request, platform)
        if not enabled_gateways:
            return Response({"detail": "درگاه پرداخت غیرفعال است."}, status=400)

        gateway = request.data.get("gateway")
        if not gateway:
            return Response({"detail": "درگاه پرداخت را انتخاب کنید."}, status=400)
        valid_types = {g["provider_type"] for g in enabled_gateways}
        if gateway not in valid_types:
            return Response({"detail": "درگاه پرداخت نامعتبر است."}, status=400)

        pay, pay_err = PaymentService.create_purchase(
            request=request,
            gateway=gateway,
            order=order,
            platform=platform,
            mobile=order.phone,
        )
        if pay_err:
            return Response({"detail": pay_err}, status=400)
        return Response(
            {"order": OrderSerializer(order, context={"request": request}).data, "payment": pay}
        )

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def checkout(self, request):
        ser = CreateOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        order, err = OrderService.create_order(
            user=request.user,
            items=data["items"],
            full_name=data["full_name"],
            phone=data["phone"],
            address=data["address"],
            email=data.get("email", ""),
            province=data.get("province", ""),
            city=data.get("city", ""),
            postal_code=data.get("postal_code", ""),
            notes=data.get("notes", ""),
            discount_code=data.get("discount_code") or None,
            shipping_toman=data.get("shipping_toman") or 0,
        )
        if err:
            return Response({"detail": err}, status=400)

        pending_err = OrderService.pending_price_error(order)
        if pending_err:
            # Order is saved as awaiting_price so admin can set prices; no payment.
            return Response(
                {
                    "detail": pending_err,
                    "price_pending": True,
                    "order": OrderSerializer(order, context={"request": request}).data,
                },
                status=400,
            )

        platform = data.get("platform") or detect_platform(request)
        enabled_gateways = PaymentFacade.list_enabled_public(request, platform)
        if not enabled_gateways:
            return Response(
                {"detail": "درگاه پرداخت غیرفعال است."},
                status=400,
            )

        gateway = data.get("gateway")
        if not gateway:
            return Response({"detail": "درگاه پرداخت را انتخاب کنید."}, status=400)

        valid_types = {g["provider_type"] for g in enabled_gateways}
        if gateway not in valid_types:
            return Response({"detail": "درگاه پرداخت نامعتبر است."}, status=400)

        result = {"order": OrderSerializer(order).data}
        pay, pay_err = PaymentService.create_purchase(
            request=request,
            gateway=gateway,
            order=order,
            platform=platform,
            mobile=order.phone,
        )
        if pay_err:
            return Response(
                {"order": result["order"], "payment_error": pay_err},
                status=201,
            )
        result["payment"] = pay
        return Response(result, status=201)

class AccountingViewSet(viewsets.ModelViewSet):
    queryset = AccountingEntry.objects.all()
    serializer_class = AccountingEntrySerializer
    permission_classes = [HasAdminPage]
    required_admin_page = "accounting"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["entry_type"]
    search_fields = ["title", "description"]
    ordering_fields = ["occurred_at", "amount_toman"]

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        income = qs.filter(entry_type="income").aggregate(s=Sum("amount_toman"))["s"] or 0
        expense = qs.filter(entry_type="expense").aggregate(s=Sum("amount_toman"))["s"] or 0
        refund = qs.filter(entry_type="refund").aggregate(s=Sum("amount_toman"))["s"] or 0
        return Response(
            {
                "income": income,
                "expense": expense,
                "refund": refund,
                "net": income - expense - refund,
                "orders_paid": Order.objects.filter(status=Order.Status.PAID).count(),
            }
        )


class SitePageViewSet(viewsets.ModelViewSet):
    queryset = SitePage.objects.all()
    serializer_class = SitePageSerializer
    permission_classes = [IsAdminOrReadOnly]
    required_admin_page = "settings"
    lookup_field = "slug"

    def get_queryset(self):
        qs = super().get_queryset()
        if not self.request.user.is_staff:
            qs = qs.filter(is_published=True)
        return qs


class BannerViewSet(viewsets.ModelViewSet):
    queryset = Banner.objects.all()
    serializer_class = BannerSerializer
    permission_classes = [IsAdminOrReadOnly]
    required_admin_page = "settings"

    def get_queryset(self):
        qs = super().get_queryset()
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        return qs


class SiteSettingViewSet(viewsets.ModelViewSet):
    queryset = SiteSetting.objects.all()
    serializer_class = SiteSettingSerializer
    permission_classes = [HasAdminPage]
    required_admin_page = "settings"
    lookup_field = "key"


@api_view(["GET"])
@permission_classes([AllowAny])
def storefront_config(request):
    ensure_storefront_defaults()
    ensure_public_pages_defaults()
    return Response(public_storefront_config())


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([require_admin_page("settings")])
def admin_store_config(request):
    from rest_framework.exceptions import ValidationError

    ensure_storefront_defaults()
    if request.method == "GET":
        return Response(admin_storefront_config())
    try:
        save_storefront_config(request.data)
    except ValidationError as exc:
        return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
    return Response(admin_storefront_config())


@api_view(["GET"])
@permission_classes([AllowAny])
def product_price_stats(request):
    """Cheap min/max for filter UI — avoids two full product list requests."""
    qs = Product.objects.filter(is_active=True)
    category = (request.query_params.get("category") or "").strip()
    if category:
        if category.isdigit():
            qs = qs.filter(category_id=int(category))
        else:
            qs = qs.filter(category__slug=category)
    agg = qs.filter(price_on_request=False).aggregate(
        min_price=Min("price_toman"), max_price=Max("price_toman")
    )
    return Response(
        {
            "min_price": agg["min_price"] or 0,
            "max_price": agg["max_price"] or 0,
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def storefront_home(request):
    ensure_storefront_defaults()
    ensure_public_pages_defaults()
    ensure_store_defaults()
    featured = (
        Product.objects.filter(is_active=True, is_featured=True)
        .select_related("category")
        .prefetch_related(
            "images",
            Prefetch(
                "variants",
                queryset=ProductVariant.objects.only(
                    "id", "product_id", "price_toman", "stock", "is_active"
                ),
            ),
            "colors",
            "sizes",
        )[:8]
    )
    categories = (
        Category.objects.filter(is_active=True)
        .select_related("parent")
        .annotate(children_count=Count("children"))
        .order_by("sort_order", "name")[:100]
    )
    banners = Banner.objects.filter(is_active=True)[:5]
    settings_map = {s.key: s.value for s in SiteSetting.objects.all()}
    settings_map["store"] = public_store_settings()
    return Response(
        {
            "banners": BannerSerializer(banners, many=True, context={"request": request}).data,
            "featured_products": ProductListSerializer(
                featured, many=True, context={"request": request}
            ).data,
            "categories": CategorySerializer(
                categories, many=True, context={"request": request}
            ).data,
            "settings": settings_map,
            "config": public_storefront_config(),
        }
    )


@api_view(["GET", "PATCH"])
@permission_classes([require_admin_page("storefront")])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def admin_storefront_pages(request):
    from rest_framework.exceptions import ValidationError

    ensure_public_pages_defaults()
    ensure_store_defaults()
    if request.method == "GET":
        return Response(get_admin_storefront_pages())
    try:
        if request.FILES.get("site_icon") or str(
            request.data.get("clear_site_icon", "")
        ).lower() in ("1", "true", "yes"):
            saved = save_site_icon(
                image_file=request.FILES.get("site_icon"),
                clear_icon=str(request.data.get("clear_site_icon", "")).lower()
                in ("1", "true", "yes"),
            )
        elif request.data.get("page_key") is not None and "enabled" in request.data:
            enabled_val = request.data.get("enabled")
            if isinstance(enabled_val, bool):
                enabled = enabled_val
            else:
                enabled = str(enabled_val).lower() in ("1", "true", "yes")
            saved = save_page_enabled(request.data.get("page_key"), enabled)
        elif request.data.get("title") is not None or request.data.get("home_title") is not None:
            payload = {
                "title": request.data.get("title") or request.data.get("home_title") or "",
                "subtitle": request.data.get("subtitle")
                or request.data.get("home_subtitle")
                or "",
            }
            clear_image = str(request.data.get("clear_image", "")).lower() in (
                "1",
                "true",
                "yes",
            )
            enabled_raw = request.data.get("enabled")
            enabled = (
                str(enabled_raw).lower() in ("1", "true", "yes")
                if enabled_raw is not None and str(enabled_raw) != ""
                else None
            )
            saved = save_storefront_home(
                payload,
                image_file=request.FILES.get("home_image") or request.FILES.get("image"),
                clear_image=clear_image,
                enabled=enabled,
            )
        elif request.data.get("theme") is not None or request.data.get("colors") is not None:
            apply_preset = str(request.data.get("apply_preset", "")).lower() in (
                "1",
                "true",
                "yes",
            )
            colors = request.data.get("colors")
            if isinstance(colors, str):
                import json

                try:
                    colors = json.loads(colors)
                except json.JSONDecodeError as exc:
                    raise ValidationError({"colors": "فرمت رنگ نامعتبر است."}) from exc
            saved = save_appearance(
                theme=request.data.get("theme"),
                colors=colors,
                apply_preset=apply_preset,
            )
        elif isinstance(request.data.get("enabled"), dict):
            saved = save_enabled_map(request.data["enabled"])
        else:
            raise ValidationError("درخواست نامعتبر است.")
    except ValidationError as exc:
        return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
    return Response(saved)


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([require_admin_page("dashboard")])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def admin_home_hero(request):
    ensure_store_defaults()
    if request.method == "GET":
        return Response(get_home_hero())
    clear_image = str(request.data.get("clear_image", "")).lower() in ("1", "true", "yes")
    try:
        saved = save_home_hero(
            request.data,
            image_file=request.FILES.get("image"),
            clear_image=clear_image,
        )
    except ValidationError as exc:
        return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
    return Response(saved)


@api_view(["GET"])
@permission_classes([require_admin_page("dashboard")])
def admin_dashboard(request):
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return Response(
        {
            "products": Product.objects.count(),
            "active_products": Product.objects.filter(is_active=True).count(),
            "orders_total": Order.objects.count(),
            "orders_pending": Order.objects.filter(status=Order.Status.PENDING).count(),
            "orders_paid_month": Order.objects.filter(
                status=Order.Status.PAID, created_at__gte=month_start
            ).count(),
            "revenue_month": AccountingEntry.objects.filter(
                entry_type="income", occurred_at__gte=month_start
            ).aggregate(s=Sum("amount_toman"))["s"]
            or 0,
            "low_stock": Product.objects.filter(is_active=True, stock__lte=3).count(),
            "pending_card_payments": PurchaseTransaction.objects.filter(
                gateway="card", status=PurchaseTransaction.Status.PENDING
            ).count(),
            "open_tickets": SupportTicket.objects.exclude(
                status=SupportTicket.Status.CLOSED
            ).count(),
        }
    )
