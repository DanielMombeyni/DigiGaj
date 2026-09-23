# Generated manually for Signal SMS provider choice

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0018_preserve_history_on_delete"),
    ]

    operations = [
        migrations.AlterField(
            model_name="smsproviderconfig",
            name="provider_type",
            field=models.CharField(
                choices=[
                    ("farapayamak", "فراپیامک"),
                    ("smsir", "SMS.ir"),
                    ("signal", "سیگنال SMS"),
                ],
                max_length=32,
                unique=True,
            ),
        ),
    ]
