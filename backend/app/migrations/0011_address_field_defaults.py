from django.db import migrations, models


def backfill_address_fields(apps, schema_editor):
    CustomerAddress = apps.get_model("app", "CustomerAddress")
    CustomerAddress.objects.filter(province__isnull=True).update(province="")
    CustomerAddress.objects.filter(city__isnull=True).update(city="")
    CustomerAddress.objects.filter(postal_code__isnull=True).update(postal_code="")


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0010_address_province"),
    ]

    operations = [
        migrations.RunPython(backfill_address_fields, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="customeraddress",
            name="province",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AlterField(
            model_name="customeraddress",
            name="city",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AlterField(
            model_name="customeraddress",
            name="postal_code",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
    ]
