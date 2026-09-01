from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0003_product_options"),
    ]

    operations = [
        migrations.CreateModel(
            name="SmsProviderConfig",
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
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="ایجاد"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="به‌روزرسانی"),
                ),
                (
                    "provider_type",
                    models.CharField(
                        choices=[
                            ("farapayamak", "فراپیامک"),
                            ("smsir", "SMS.ir"),
                        ],
                        max_length=32,
                        unique=True,
                    ),
                ),
                ("display_name", models.CharField(max_length=120)),
                ("is_enabled", models.BooleanField(default=False)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("credentials", models.JSONField(blank=True, default=dict)),
            ],
            options={
                "verbose_name": "سرویس پیامک",
                "verbose_name_plural": "سرویس‌های پیامک",
                "ordering": ["sort_order", "provider_type"],
            },
        ),
    ]
