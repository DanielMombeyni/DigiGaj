from django.urls import include, path
from rest_framework.routers import DefaultRouter

from app.views.shop import (
    AccountingViewSet,
    BannerViewSet,
    CategoryViewSet,
    DiscountCodeViewSet,
    OrderViewSet,
    ProductViewSet,
    SitePageViewSet,
    SiteSettingViewSet,
    admin_dashboard,
    admin_home_hero,
    admin_store_config,
    admin_storefront_pages,
    product_price_stats,
    storefront_config,
    storefront_home,
)
from app.views.auth_otp import request_otp, verify_otp
from app.views.sms_views import (
    AdminSmsCatalogView,
    AdminSmsProviderDetailView,
    AdminSmsProviderListView,
)
from app.views.email_views import (
    AdminEmailSmtpTestView,
    AdminEmailSmtpView,
    AdminEmailTemplateCatalogView,
    AdminEmailTemplateDetailView,
    AdminEmailTemplateListView,
    AdminEmailTemplateTestView,
)
from app.views.support_views import SupportTicketViewSet
from app.views.personnel_views import (
    AdminPagesCatalogView,
    PersonnelViewSet,
    StaffRoleViewSet,
)
from app.views.customer_views import CustomerViewSet
from app.views.account_views import (
    CustomerAddressViewSet,
    CustomerTicketViewSet,
    CustomerTransactionViewSet,
    customer_profile,
)
from app.urls.payment import urlpatterns as payment_urls

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("products", ProductViewSet, basename="product")
router.register("discounts", DiscountCodeViewSet, basename="discount")
router.register("orders", OrderViewSet, basename="order")
router.register("accounting", AccountingViewSet, basename="accounting")
router.register("pages", SitePageViewSet, basename="page")
router.register("banners", BannerViewSet, basename="banner")
router.register("settings", SiteSettingViewSet, basename="setting")
router.register("tickets", SupportTicketViewSet, basename="ticket")
router.register("admin/personnel", PersonnelViewSet, basename="personnel")
router.register("admin/roles", StaffRoleViewSet, basename="staff-role")
router.register("admin/customers", CustomerViewSet, basename="customer")

me_router = DefaultRouter()
me_router.register("addresses", CustomerAddressViewSet, basename="me-address")
me_router.register("transactions", CustomerTransactionViewSet, basename="me-transaction")
me_router.register("tickets", CustomerTicketViewSet, basename="me-ticket")

urlpatterns = [
    path("storefront/home/", storefront_home, name="storefront-home"),
    path("storefront/config/", storefront_config, name="storefront-config"),
    path("products/price-stats/", product_price_stats, name="product-price-stats"),
    path("admin/dashboard/", admin_dashboard, name="admin-dashboard"),
    path("admin/home-hero/", admin_home_hero, name="admin-home-hero"),
    path("admin/storefront-pages/", admin_storefront_pages, name="admin-storefront-pages"),
    path("admin/store-config/", admin_store_config, name="admin-store-config"),
    path("admin/pages-catalog/", AdminPagesCatalogView.as_view(), name="admin-pages-catalog"),
    path("admin/sms-providers/catalog/", AdminSmsCatalogView.as_view(), name="admin-sms-catalog"),
    path("admin/sms-providers/", AdminSmsProviderListView.as_view(), name="admin-sms-list"),
    path(
        "admin/sms-providers/<int:pk>/",
        AdminSmsProviderDetailView.as_view(),
        name="admin-sms-detail",
    ),
    path("admin/email-smtp/", AdminEmailSmtpView.as_view(), name="admin-email-smtp"),
    path("admin/email-smtp/test/", AdminEmailSmtpTestView.as_view(), name="admin-email-smtp-test"),
    path(
        "admin/email-templates/catalog/",
        AdminEmailTemplateCatalogView.as_view(),
        name="admin-email-templates-catalog",
    ),
    path("admin/email-templates/", AdminEmailTemplateListView.as_view(), name="admin-email-templates"),
    path(
        "admin/email-templates/<int:pk>/test/",
        AdminEmailTemplateTestView.as_view(),
        name="admin-email-template-test",
    ),
    path(
        "admin/email-templates/<int:pk>/",
        AdminEmailTemplateDetailView.as_view(),
        name="admin-email-template-detail",
    ),
    path("auth/otp/request/", request_otp, name="otp-request"),
    path("auth/otp/verify/", verify_otp, name="otp-verify"),
    path("payment/", include(payment_urls)),
    path("me/profile/", customer_profile, name="me-profile"),
    path("me/", include(me_router.urls)),
    path("", include(router.urls)),
]
