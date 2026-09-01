from django.db import migrations, models


def add_customers_page(apps, schema_editor):
    StaffRole = apps.get_model("app", "StaffRole")
    for role in StaffRole.objects.filter(slug="full-access"):
        pages = list(role.pages or [])
        if "customers" not in pages:
            pages.append("customers")
            role.pages = pages
            role.save(update_fields=["pages", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0006_staff_roles"),
    ]

    operations = [
        migrations.AlterField(
            model_name="order",
            name="address",
            field=models.TextField(blank=True),
        ),
        migrations.RunPython(add_customers_page, migrations.RunPython.noop),
    ]
