from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model

from app.models import (
    AccountingEntry,
    Banner,
    Category,
    DiscountCode,
    Order,
    OrderItem,
    PaymentGatewayConfig,
    Product,
    ProductAttribute,
    ProductColor,
    ProductImage,
    ProductSize,
    ProductVariant,
    PurchaseTransaction,
    SitePage,
    SiteSetting,
    SmsProviderConfig,
    SupportTicket,
    TicketMessage,
    StaffRole,
    UserProfile,
)

User = get_user_model()


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductColorInline(admin.TabularInline):
    model = ProductColor
    extra = 0


class ProductSizeInline(admin.TabularInline):
    model = ProductSize
    extra = 0


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0
    autocomplete_fields = ("color", "size")


class ProductAttributeInline(admin.TabularInline):
    model = ProductAttribute
    extra = 0


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "parent", "is_active", "sort_order")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "slug")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "price_toman",
        "stock",
        "is_active",
        "is_featured",
    )
    list_filter = ("is_active", "is_featured", "condition", "category")
    search_fields = ("name", "brand")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [
        ProductImageInline,
        ProductColorInline,
        ProductSizeInline,
        ProductVariantInline,
        ProductAttributeInline,
    ]


@admin.register(ProductColor)
class ProductColorAdmin(admin.ModelAdmin):
    list_display = ("name", "product", "hex_code")
    search_fields = ("name", "product__name")


@admin.register(ProductSize)
class ProductSizeAdmin(admin.ModelAdmin):
    list_display = ("name", "product")
    search_fields = ("name", "product__name")


@admin.register(DiscountCode)
class DiscountCodeAdmin(admin.ModelAdmin):
    list_display = ("code", "discount_type", "value", "used_count", "is_active")
    search_fields = ("code",)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "product_name", "unit_price_toman", "quantity", "line_total_toman")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "full_name", "status", "total_toman", "created_at")
    list_filter = ("status",)
    search_fields = ("order_number", "phone", "full_name")
    inlines = [OrderItemInline]


@admin.register(PaymentGatewayConfig)
class PaymentGatewayConfigAdmin(admin.ModelAdmin):
    list_display = (
        "provider_type",
        "display_name",
        "is_enabled_web",
        "is_enabled_app",
        "sort_order",
    )


@admin.register(PurchaseTransaction)
class PurchaseTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "tracking_number",
        "gateway",
        "status",
        "amount",
        "platform",
        "created_at",
    )
    list_filter = ("status", "gateway", "platform")
    search_fields = ("tracking_number", "authority", "ref_id")


@admin.register(AccountingEntry)
class AccountingEntryAdmin(admin.ModelAdmin):
    list_display = ("title", "entry_type", "amount_toman", "occurred_at")
    list_filter = ("entry_type",)


@admin.register(SitePage)
class SitePageAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "is_published")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ("title", "is_active", "sort_order")


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "updated_at")


@admin.register(SmsProviderConfig)
class SmsProviderConfigAdmin(admin.ModelAdmin):
    list_display = ("display_name", "provider_type", "is_enabled", "sort_order")
    list_filter = ("is_enabled", "provider_type")


class TicketMessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = (
        "ticket_number",
        "subject",
        "full_name",
        "status",
        "priority",
        "updated_at",
    )
    list_filter = ("status", "priority")
    search_fields = ("ticket_number", "full_name", "email", "phone", "subject")
    inlines = [TicketMessageInline]


@admin.register(StaffRole)
class StaffRoleAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    search_fields = ("name", "slug")
    list_filter = ("is_active",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone", "staff_role")
    search_fields = ("user__username", "phone")
    list_select_related = ("user", "staff_role")
    autocomplete_fields = ("staff_role",)
