from django.urls import path
from app.views.payment_views import (
    AdminCardConfirmView,
    AdminGatewayCatalogView,
    AdminGatewayDetailView,
    AdminGatewayListCreateView,
    AdminTransactionListView,
    CallbackView,
    ConfirmView,
    GatewayListView,
    PurchaseView,
    StatusView,
)

urlpatterns = [
    path("gateways/", GatewayListView.as_view(), name="payment-gateways"),
    path("purchase/", PurchaseView.as_view(), name="payment-purchase"),
    path("confirm/", ConfirmView.as_view(), name="payment-confirm"),
    path("status/<str:tracking_number>/", StatusView.as_view(), name="payment-status"),
    path("callback/<str:provider>/", CallbackView.as_view(), name="payment-callback"),
    # Admin
    path("admin/catalog/", AdminGatewayCatalogView.as_view(), name="payment-admin-catalog"),
    path("admin/gateways/", AdminGatewayListCreateView.as_view(), name="payment-admin-list"),
    path(
        "admin/gateways/<int:pk>/",
        AdminGatewayDetailView.as_view(),
        name="payment-admin-detail",
    ),
    path(
        "admin/card-confirm/",
        AdminCardConfirmView.as_view(),
        name="payment-admin-card-confirm",
    ),
    path(
        "admin/transactions/",
        AdminTransactionListView.as_view(),
        name="payment-admin-transactions",
    ),
]
