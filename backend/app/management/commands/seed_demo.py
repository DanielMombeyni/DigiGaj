from django.core.management.base import BaseCommand
from django.utils.text import slugify

from app.models import Category, Product, Banner
from app.services.seed_state import DEMO_MARKER, is_seed_done, mark_seed_done


class Command(BaseCommand):
    help = "Seed demo catalog (categories, products, banners)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--if-needed",
            action="store_true",
            help="Skip when demo catalog was already applied once",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Run even if demo catalog was already applied",
        )

    def handle(self, *args, **options):
        from django.core.management import call_command

        if options["if_needed"] and not options["force"] and is_seed_done(DEMO_MARKER):
            self.stdout.write(self.style.WARNING("Demo seed already applied — skipped (use --force to re-run)."))
            return

        bootstrap_args = {}
        if options["if_needed"] and not options["force"]:
            bootstrap_args["if_needed"] = True
        call_command("seed_bootstrap", **bootstrap_args)

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

        mark_seed_done(DEMO_MARKER)
        self.stdout.write(self.style.SUCCESS("Demo seed ready."))
