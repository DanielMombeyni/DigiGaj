from django.db import migrations


def add_storefront_to_roles(apps, schema_editor):
    StaffRole = apps.get_model("app", "StaffRole")
    for role in StaffRole.objects.all():
        pages = list(role.pages or [])
        if "dashboard" in pages and "storefront" not in pages:
            pages.append("storefront")
            role.pages = pages
            role.save(update_fields=["pages"])


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0011_address_field_defaults"),
    ]

    operations = [
        migrations.RunPython(add_storefront_to_roles, migrations.RunPython.noop),
    ]
