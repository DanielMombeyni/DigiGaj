from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework_simplejwt.views import TokenRefreshView
from app.serializers.auth_token import EmailOrUsernameTokenView
from app.views.product_html import product_detail_html, product_sitemap, robots_txt, sitemap_index

urlpatterns = [
    path("products/<str:slug>", product_detail_html, name="public-product"),
    path("products/<str:slug>/", product_detail_html),
    path("sitemap.xml", sitemap_index, name="sitemap-index"),
    path("sitemap-products.xml", product_sitemap, name="product-sitemap"),
    path("robots.txt", robots_txt, name="robots"),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    path("api/v1/auth/", include("dj_rest_auth.urls")),
    path("api/v1/auth/registration/", include("dj_rest_auth.registration.urls")),
    path("api/v1/auth/token/", EmailOrUsernameTokenView.as_view(), name="token_obtain_pair"),
    path(
        "api/v1/auth/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path("api/v1/", include("app.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
