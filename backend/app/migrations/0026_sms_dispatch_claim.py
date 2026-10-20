from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("app", "0025_sms_template_bindings_and_log_audit"),
    ]

    operations = [
        migrations.CreateModel(
            name="SmsDispatchClaim",
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
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="ایجاد")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="به‌روزرسانی")),
                ("claim_key", models.CharField(db_index=True, max_length=191, unique=True)),
                ("event", models.CharField(db_index=True, max_length=40)),
                ("phone", models.CharField(blank=True, max_length=20)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "در حال ارسال"),
                            ("sent", "ارسال‌شده"),
                            ("failed", "ناموفق"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("error", models.CharField(blank=True, max_length=500)),
            ],
            options={
                "verbose_name": "ادعای ارسال پیامک رویداد",
                "verbose_name_plural": "ادعاهای ارسال پیامک رویداد",
            },
        ),
    ]
