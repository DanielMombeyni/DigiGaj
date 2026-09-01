# Generated manually for staff roles + profile.staff_role

from django.db import migrations, models
import django.db.models.deletion


def seed_full_role(apps, schema_editor):
    StaffRole = apps.get_model("app", "StaffRole")
    UserProfile = apps.get_model("app", "UserProfile")
    User = apps.get_model("auth", "User")

    pages = [
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
    ]
    role, _ = StaffRole.objects.get_or_create(
        slug="full-access",
        defaults={
            "name": "دسترسی کامل",
            "description": "دسترسی به تمام صفحات پنل",
            "pages": pages,
            "is_active": True,
        },
    )
    if list(role.pages or []) != pages:
        role.pages = pages
        role.is_active = True
        role.save(update_fields=["pages", "is_active", "updated_at"])

    for user in User.objects.filter(is_staff=True):
        profile, _ = UserProfile.objects.get_or_create(user=user)
        if profile.staff_role_id is None:
            profile.staff_role_id = role.id
            profile.save(update_fields=["staff_role", "updated_at"])


def unseed_full_role(apps, schema_editor):
    StaffRole = apps.get_model("app", "StaffRole")
    StaffRole.objects.filter(slug="full-access").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0005_support_tickets"),
    ]

    operations = [
        migrations.CreateModel(
            name="StaffRole",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=140, unique=True)),
                ("description", models.CharField(blank=True, max_length=255)),
                ("pages", models.JSONField(blank=True, default=list)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "نقش پرسنل",
                "verbose_name_plural": "نقش‌های پرسنل",
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="userprofile",
            name="staff_role",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="members",
                to="app.staffrole",
            ),
        ),
        migrations.RunPython(seed_full_role, unseed_full_role),
    ]
