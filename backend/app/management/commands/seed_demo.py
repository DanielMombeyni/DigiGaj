from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils.text import slugify

from app.models import Category, Product, SitePage, SiteSetting, Banner, StaffRole, UserProfile


class Command(BaseCommand):
    help = "Seed demo catalog, pages, and admin user"

    def handle(self, *args, **options):
        User = get_user_model()
        admin, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@gadgetstore.local",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin.email = admin.email or "admin@gadgetstore.local"
        admin.is_staff = True
        admin.is_superuser = True
        admin.is_active = True
        admin.set_password("admin1234")
        admin.save()
        full_pages = [
            "dashboard",
            "products",
            "categories",
            "discounts",
            "orders",
            "accounting",
            "gateways",
            "transactions",
            "tickets",
            "settings",
            "personnel",
            "customers",
            "storefront",
        ]
        role, _ = StaffRole.objects.get_or_create(
            slug="full-access",
            defaults={
                "name": "دسترسی کامل",
                "description": "دسترسی به تمام صفحات پنل",
                "pages": full_pages,
                "is_active": True,
            },
        )
        if list(role.pages or []) != full_pages:
            role.pages = full_pages
            role.is_active = True
            role.save(update_fields=["pages", "is_active", "updated_at"])
        profile, _ = UserProfile.objects.get_or_create(user=admin)
        profile.staff_role = role
        profile.save(update_fields=["staff_role", "updated_at"])
        self.stdout.write(
            self.style.SUCCESS(
                "Admin ready: admin / admin1234"
                + (" (created)" if created else " (password reset)")
            )
        )

        SiteSetting.objects.update_or_create(
            key="store",
            defaults={
                "value": {
                    "name": "دیجی گج",
                    "tagline": "فروشگاه تخصصی گجت و لوازم دیجیتال",
                    "phone": "021-91000000",
                    "email": "support@gadgetstore.local",
                    "address": "تهران",
                    "hero_glass_title": "اتمسفر دیجیتال",
                    "hero_glass_subtitle": "تجربه خرید گجت، متفاوت",
                }
            },
        )

        SiteSetting.objects.update_or_create(
            key="storefront",
            defaults={
                "value": {
                    "auth_methods": {
                        "username_password": True,
                        "email_password": False,
                        "phone_password": False,
                        "phone_otp": False,
                    },
                    "company_phone": "",
                    "company_address": "",
                    "enamad_html": "",
                }
            },
        )

        from app.services.public_pages import DEFAULT_ENABLED

        SiteSetting.objects.update_or_create(
            key="public_pages",
            defaults={"value": {"enabled": DEFAULT_ENABLED.copy(), "site_icon": ""}},
        )

        SitePage.objects.update_or_create(
            slug="about",
            defaults={
                "title": "درباره ما",
                "body": (
                    "دیجی گج یک فروشگاه آنلاین تخصصی برای خرید و فروش گجت‌ها، "
                    "لوازم جانبی و محصولات دیجیتال است. هدف ما ارائه کالای اصل "
                    "با گارانتی معتبر و پشتیبانی سریع است."
                ),
                "is_published": True,
            },
        )
        SitePage.objects.update_or_create(
            slug="contact",
            defaults={
                "title": "تماس با ما",
                "body": "از طریق ایمیل support@gadgetstore.local یا تلفن پشتیبانی با ما در ارتباط باشید.",
                "is_published": True,
            },
        )
        SitePage.objects.update_or_create(
            slug="terms",
            defaults={
                "title": "قوانین و مقررات",
                "body": "شرایط استفاده از فروشگاه، بازگشت کالا و حریم خصوصی.",
                "is_published": True,
            },
        )

        Banner.objects.get_or_create(
            title="گجت‌های روز را همین امروز بخرید",
            defaults={
                "subtitle": "ارسال سریع · گارانتی معتبر · پرداخت امن",
                "link_url": "/products",
                "is_active": True,
                "sort_order": 1,
            },
        )

        cats = [
            ("هدفون و هندزفری", "headphones"),
            ("ساعت هوشمند", "smartwatch"),
            ("لوازم موبایل", "mobile-accessories"),
            ("گیمینگ", "gaming"),
        ]
        for name, slug in cats:
            Category.objects.get_or_create(
                slug=slug,
                defaults={"name": name, "is_active": True},
            )

        samples = [
            ("هدفون بی‌سیم Pro X", "headphones", 2890000, True, 4.5),
            ("ساعت هوشمند Pulse 7", "smartwatch", 4590000, True, 5.0),
            ("پاوربانک 20000 میلی‌آمپر", "mobile-accessories", 890000, False, 3.5),
            ("دسته بازی Wireless Elite", "gaming", 2190000, True, 4.0),
        ]
        for name, cat_slug, price, featured, rating in samples:
            cat = Category.objects.get(slug=cat_slug)
            slug = slugify(name, allow_unicode=True)
            Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "category": cat,
                    "name": name,
                    "sku": f"SKU-{slug[:20]}",
                    "short_description": f"{name} — کیفیت بالا",
                    "description": f"توضیحات کامل محصول {name}",
                    "brand": "GadgetBrand",
                    "price_toman": price,
                    "compare_at_price_toman": int(price * 1.15),
                    "stock": 25,
                    "is_active": True,
                    "is_featured": featured,
                    "rating": rating,
                    "specs": {"warranty": "18 ماه"},
                },
            )

        self.stdout.write(self.style.SUCCESS("Seed data ready."))
