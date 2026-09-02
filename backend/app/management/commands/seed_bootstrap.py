"""Idempotent bootstrap data — safe to run on every deploy (dev + production)."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from app.models import SitePage, SiteSetting, StaffRole, UserProfile
from app.services.public_pages import DEFAULT_ENABLED
from app.services.seed_state import BOOTSTRAP_MARKER, is_seed_done, mark_seed_done

FULL_STAFF_PAGES = [
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

BOOTSTRAP_USERNAME = "daniel"
BOOTSTRAP_EMAIL = "mombeyni.daniel@gmail.com"
BOOTSTRAP_PHONE = "09001362211"
BOOTSTRAP_PASSWORD = "admin@1234"


class Command(BaseCommand):
    help = "Seed bootstrap admin user and essential site settings (production-safe)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--if-needed",
            action="store_true",
            help="Skip when bootstrap was already applied once",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Run even if bootstrap was already applied",
        )

    def handle(self, *args, **options):
        if options["if_needed"] and not options["force"] and is_seed_done(BOOTSTRAP_MARKER):
            self.stdout.write(self.style.WARNING("Bootstrap already applied — skipped (use --force to re-run)."))
            return

        user = self._ensure_admin_user()
        self._ensure_staff_role(user)
        self._ensure_site_settings()
        self._ensure_cms_pages()
        mark_seed_done(BOOTSTRAP_MARKER)
        self.stdout.write(
            self.style.SUCCESS(
                "Bootstrap ready — login with phone, email, or username:\n"
                f"  phone:    {BOOTSTRAP_PHONE}\n"
                f"  email:    {BOOTSTRAP_EMAIL}\n"
                f"  username: {BOOTSTRAP_USERNAME}\n"
                f"  password: {BOOTSTRAP_PASSWORD}"
            )
        )

    def _ensure_admin_user(self):
        User = get_user_model()
        user = User.objects.filter(email__iexact=BOOTSTRAP_EMAIL).first()
        if not user:
            profile = (
                UserProfile.objects.select_related("user")
                .filter(phone__in=[BOOTSTRAP_PHONE, BOOTSTRAP_PHONE.lstrip("0")])
                .first()
            )
            user = profile.user if profile else None
        if not user:
            user = User.objects.filter(username=BOOTSTRAP_USERNAME).first()

        created = user is None
        if created:
            user = User(username=BOOTSTRAP_USERNAME)

        user.username = BOOTSTRAP_USERNAME
        user.email = BOOTSTRAP_EMAIL
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        if created:
            user.set_password(BOOTSTRAP_PASSWORD)
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.phone = BOOTSTRAP_PHONE
        profile.save(update_fields=["phone", "updated_at"])
        return user

    def _ensure_staff_role(self, user):
        role, _ = StaffRole.objects.get_or_create(
            slug="full-access",
            defaults={
                "name": "دسترسی کامل",
                "description": "دسترسی به تمام صفحات پنل",
                "pages": FULL_STAFF_PAGES,
                "is_active": True,
            },
        )
        if list(role.pages or []) != FULL_STAFF_PAGES:
            role.pages = FULL_STAFF_PAGES
            role.is_active = True
            role.save(update_fields=["pages", "is_active", "updated_at"])

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.staff_role = role
        profile.save(update_fields=["staff_role", "updated_at"])

    def _ensure_site_settings(self):
        SiteSetting.objects.update_or_create(
            key="store",
            defaults={
                "value": {
                    "name": "دیجی گج",
                    "tagline": "فروشگاه تخصصی گجت و لوازم دیجیتال",
                    "phone": "021-91000000",
                    "email": BOOTSTRAP_EMAIL,
                    "address": "تهران",
                    "hero_glass_title": "اتمسفر دیجیتال",
                    "hero_glass_subtitle": "تجربه خرید گجت، متفاوت",
                }
            },
        )

        auth_methods = {
            "username_password": True,
            "email_password": True,
            "phone_password": True,
            "phone_otp": False,
        }
        storefront_row = SiteSetting.objects.filter(key="storefront").first()
        if storefront_row and isinstance(storefront_row.value, dict):
            value = dict(storefront_row.value)
            value["auth_methods"] = auth_methods
            storefront_row.value = value
            storefront_row.save(update_fields=["value", "updated_at"])
        else:
            SiteSetting.objects.update_or_create(
                key="storefront",
                defaults={
                    "value": {
                        "auth_methods": auth_methods,
                        "company_phone": "",
                        "company_address": "",
                        "enamad_html": "",
                    }
                },
            )

        public_row = SiteSetting.objects.filter(key="public_pages").first()
        if not public_row:
            SiteSetting.objects.create(
                key="public_pages",
                value={"enabled": DEFAULT_ENABLED.copy(), "site_icon": "", "theme": "classic", "colors": {}},
            )

    def _ensure_cms_pages(self):
        SitePage.objects.update_or_create(
            slug="about",
            defaults={
                "title": "درباره ما",
                "body": (
                    "دیجی گج یک فروشگاه آنلاین تخصصی برای خرید و فروش گجت‌ها، "
                    "لوازم جانبی و محصولات دیجیتال است."
                ),
                "is_published": True,
            },
        )
        SitePage.objects.update_or_create(
            slug="contact",
            defaults={
                "title": "تماس با ما",
                "body": f"از طریق ایمیل {BOOTSTRAP_EMAIL} با ما در ارتباط باشید.",
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
