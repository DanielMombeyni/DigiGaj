# Generated manually — remove Cafe Bazaar gateway

from django.db import migrations, models


def purge_cafebazaar(apps, schema_editor):
    PaymentGatewayConfig = apps.get_model("app", "PaymentGatewayConfig")
    PaymentGatewayConfig.objects.filter(provider_type="cafebazaar").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(purge_cafebazaar, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="paymentgatewayconfig",
            name="provider_type",
            field=models.CharField(
                choices=[
                    ("zarinpal", "زرین‌پال"),
                    ("zibal", "زیبال"),
                    ("payping", "پی‌پینگ"),
                    ("card", "کارت‌به‌کارت"),
                ],
                max_length=32,
                unique=True,
            ),
        ),
    ]
